import { type ChatMessage, chatJson, SarvamError } from "@/lib/sarvam/client";
import type { Segment } from "@/lib/transcripts/merge";

import { normalisePack, type StudyPack, studyPackJsonSchema, validatePack } from "./pack";

/**
 * Build a lecture's English study pack with one sarvam-105b call over the
 * whole transcript. If the result breaks a validation rule, the model gets one
 * retry with the exact errors; a second failure throws with them.
 */

// Bumped from 1: packs are now normalised (replay repair, shuffled options).
export const STUDY_PROMPT_VERSION = 2;

export class PackValidationError extends Error {
  constructor(readonly errors: string[]) {
    super(`Study pack failed validation:\n- ${errors.join("\n- ")}`);
    this.name = "PackValidationError";
  }
}

function stamp(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function transcriptForModel(segments: Segment[]): string {
  return segments.map((s) => `[${Math.round(s.startSec)}s ${stamp(s.startSec)}] ${s.text}`).join("\n");
}

const SYSTEM = [
  "You build study material for one recorded NPTEL lecture from its transcript.",
  "Each transcript line starts with [<seconds>s <mm:ss>]. Every time you output is in seconds and must come from those markers.",
  "Concepts: the 5-12 ideas the lecture actually teaches, in order. prereqIds only point to earlier concepts in your list.",
  "Checkpoints: one every 6-10 minutes, placed within 3 minutes after the lecturer finishes explaining a concept. The question must be answerable from what was just said. replayFrom/replayTo cover only the 10-150 s where the answer is explained, and replayTo <= atSec. Exactly 4 options, one correct.",
  "Flashcards: 8-20 cards testing facts and reasoning from this lecture, each pointing to where it is covered.",
  "Recap: a short summary and key points with times.",
  "Write everything in clear English. Only use what the lecture says.",
].join("\n");

export interface GenerateResult {
  pack: StudyPack;
  attempts: number;
  usage: { promptTokens: number; completionTokens: number }[];
}

export type PackModel = "sarvam-105b" | "sarvam-105b-conversations";

/**
 * Which model writes study packs. The conversations model is the default: on
 * the same three lectures it produced 6/6 valid packs first time in ~6 s and
 * ~2K tokens each, with 8/9 answer keys right. sarvam-105b took 5 calls and
 * ~207K tokens for one pack (two runs truncated at 64K, one used placeholder
 * ids). STUDY_PACK_MODEL=sarvam-105b switches back.
 */
export function packModel(): PackModel {
  return process.env.STUDY_PACK_MODEL === "sarvam-105b" ? "sarvam-105b" : "sarvam-105b-conversations";
}

export async function generateStudyPack(
  lectureTitle: string,
  segments: Segment[],
  model: PackModel = packModel(),
): Promise<GenerateResult> {
  const durationSec = Math.ceil(segments.at(-1)?.endSec ?? 0);
  const ctx = { durationSec, segments };
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Lecture: ${lectureTitle}\nDuration: ${durationSec}s\n\nTranscript:\n${transcriptForModel(segments)}`,
    },
  ];
  const usage: GenerateResult["usage"] = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    let value: StudyPack;
    let content: string;
    try {
      const res = await chatJson<StudyPack>(
        {
          messages,
          model,
          jsonSchema: { name: "study_pack", schema: studyPackJsonSchema },
          // Reasoning tokens count against max_tokens on sarvam-105b: 20-37
          // minute lectures used 21-40K completion tokens at "low", and some
          // runs overran 64K. The conversations model doesn't reason and caps
          // output at 8,192.
          ...(model === "sarvam-105b" ? { maxTokens: 64_000, reasoningEffort: "low" as const } : { maxTokens: 8192 }),
        },
        { timeoutMs: 300_000, retries: 2 },
      );
      if (res.result.usage) usage.push(res.result.usage);
      const normalised = normalisePack(res.value, segments);
      if (normalised.repairs.length) console.info(`study pack "${lectureTitle}" repairs: ${normalised.repairs.join("; ")}`);
      value = normalised.pack;
      content = res.result.content;
    } catch (err) {
      const truncated = err instanceof SarvamError && /truncated/.test(err.detail);
      if (truncated && attempt === 1) continue;
      throw err;
    }
    const errors = validatePack(value, ctx);
    if (errors.length === 0) return { pack: value, attempts: attempt, usage };
    if (attempt === 2) throw new PackValidationError(errors);
    messages.push(
      { role: "assistant", content },
      {
        role: "user",
        content: `That pack breaks these rules. Return a corrected full pack:\n- ${errors.join("\n- ")}`,
      },
    );
  }
  throw new Error("unreachable");
}
