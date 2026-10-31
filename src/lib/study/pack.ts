import { z } from "zod";

/**
 * A lecture's study pack: concepts, in-video checks, flashcards and a recap,
 * every item anchored to a timestamp. sarvam-105b produces it once per lecture
 * in English (structured output against `studyPackJsonSchema`); `validatePack`
 * then enforces what a JSON Schema can't — that timestamps are inside the
 * lecture and land on real speech, replays end before the check, and the
 * prerequisite graph has no cycles.
 */

export const studyPackSchema = z.object({
  concepts: z
    .array(
      z.object({
        id: z.string().describe("short kebab-case id, e.g. 'stored-program'"),
        title: z.string(),
        summary: z.string().describe("one or two sentences"),
        startSec: z.number().describe("when the lecturer starts explaining it"),
        endSec: z.number(),
        prereqIds: z.array(z.string()).describe("ids of concepts in this list it builds on"),
      }),
    )
    .describe("5 to 12 concepts, in lecture order"),
  checkpoints: z
    .array(
      z.object({
        id: z.string(),
        atSec: z.number().describe("pause here: just after the concept has been explained"),
        conceptId: z.string(),
        question: z.string().describe("one short question a student can answer in 15 seconds"),
        options: z.array(z.string()).describe("exactly 4 distinct options"),
        answerIndex: z.number().int().describe("0-based index of the correct option"),
        explanation: z.string().describe("why the answer is right, in one or two sentences"),
        replayFrom: z.number().describe("start of the 10-150 s part that explains the answer"),
        replayTo: z.number().describe("end of that part; must be <= atSec"),
      }),
    )
    .describe("one check every 6 to 10 minutes of lecture"),
  flashcards: z
    .array(
      z.object({
        front: z.string(),
        back: z.string(),
        startSec: z.number().describe("where the lecture covers it"),
      }),
    )
    .describe("8 to 20 cards"),
  recap: z.object({
    summary: z.string().describe("three or four sentences"),
    keyPoints: z.array(z.object({ text: z.string(), startSec: z.number() })),
  }),
});

export type StudyPack = z.infer<typeof studyPackSchema>;

export const studyPackJsonSchema = z.toJSONSchema(studyPackSchema) as Record<string, unknown>;

export interface PackContext {
  durationSec: number;
  /** Segment start/end pairs, sorted, for checking a timestamp lands on real speech. */
  segments: { startSec: number; endSec: number }[];
}

/** Minimum gap between checks so two never fire back to back. */
const MIN_CHECK_GAP_SEC = 60;
/** A replay re-plays the part that explains the answer — not the whole lecture so far. */
const MIN_REPLAY_SEC = 10;
const MAX_REPLAY_SEC = 150;
/** A check fires right after its explanation, not minutes later. */
const MAX_REPLAY_TO_CHECK_SEC = 180;

/** Every rule the pack breaks, as messages the model can be shown on a retry. */
export function validatePack(pack: StudyPack, ctx: PackContext): string[] {
  const errors: string[] = [];
  const inRange = (sec: number) => sec >= 0 && sec <= ctx.durationSec;
  const onSpeech = (sec: number) =>
    ctx.segments.some((s) => sec >= s.startSec - 2 && sec <= s.endSec + 2);
  const time = (label: string, sec: number) => {
    if (!inRange(sec)) errors.push(`${label}: ${sec}s is outside the lecture (0–${ctx.durationSec}s)`);
    else if (!onSpeech(sec)) errors.push(`${label}: ${sec}s does not land on any transcript segment`);
  };

  const conceptIds = new Set<string>();
  for (const c of pack.concepts) {
    if (conceptIds.has(c.id)) errors.push(`concept ${c.id}: duplicate id`);
    conceptIds.add(c.id);
    time(`concept ${c.id} startSec`, c.startSec);
    if (c.endSec < c.startSec) errors.push(`concept ${c.id}: endSec before startSec`);
  }
  for (const c of pack.concepts) {
    for (const p of c.prereqIds) {
      if (!conceptIds.has(p)) errors.push(`concept ${c.id}: unknown prerequisite ${p}`);
      if (p === c.id) errors.push(`concept ${c.id}: lists itself as a prerequisite`);
    }
  }
  const cycle = findCycle(pack.concepts);
  if (cycle) errors.push(`prerequisite cycle: ${cycle.join(" → ")}`);

  const checkIds = new Set<string>();
  let lastAt = -Infinity;
  for (const cp of [...pack.checkpoints].sort((a, b) => a.atSec - b.atSec)) {
    if (checkIds.has(cp.id)) errors.push(`checkpoint ${cp.id}: duplicate id`);
    checkIds.add(cp.id);
    time(`checkpoint ${cp.id} atSec`, cp.atSec);
    if (!conceptIds.has(cp.conceptId)) errors.push(`checkpoint ${cp.id}: unknown concept ${cp.conceptId}`);
    if (cp.options.length !== 4) errors.push(`checkpoint ${cp.id}: needs exactly 4 options`);
    if (new Set(cp.options.map((o) => o.trim().toLowerCase())).size !== cp.options.length) {
      errors.push(`checkpoint ${cp.id}: options are not distinct`);
    }
    if (cp.answerIndex < 0 || cp.answerIndex >= cp.options.length) {
      errors.push(`checkpoint ${cp.id}: answerIndex ${cp.answerIndex} out of range`);
    }
    if (!(cp.replayFrom < cp.replayTo && cp.replayTo <= cp.atSec)) {
      errors.push(`checkpoint ${cp.id}: replay must satisfy replayFrom < replayTo <= atSec`);
    }
    const replayLen = cp.replayTo - cp.replayFrom;
    if (replayLen > 0 && (replayLen < MIN_REPLAY_SEC || replayLen > MAX_REPLAY_SEC)) {
      errors.push(
        `checkpoint ${cp.id}: replay is ${Math.round(replayLen)}s; keep it ${MIN_REPLAY_SEC}–${MAX_REPLAY_SEC}s around the explanation`,
      );
    }
    if (cp.atSec - cp.replayTo > MAX_REPLAY_TO_CHECK_SEC) {
      errors.push(
        `checkpoint ${cp.id}: fires ${Math.round(cp.atSec - cp.replayTo)}s after its explanation; place it within ${MAX_REPLAY_TO_CHECK_SEC}s`,
      );
    }
    if (cp.atSec - lastAt < MIN_CHECK_GAP_SEC) {
      errors.push(`checkpoint ${cp.id}: less than ${MIN_CHECK_GAP_SEC}s after the previous check`);
    }
    lastAt = cp.atSec;
  }

  pack.flashcards.forEach((f, n) => time(`flashcard ${n} startSec`, f.startSec));
  pack.recap.keyPoints.forEach((k, n) => time(`recap point ${n} startSec`, k.startSec));
  return errors;
}

function findCycle(concepts: StudyPack["concepts"]): string[] | null {
  const prereqs = new Map(concepts.map((c) => [c.id, c.prereqIds]));
  const state = new Map<string, "visiting" | "done">();
  const path: string[] = [];

  const visit = (id: string): string[] | null => {
    if (state.get(id) === "done") return null;
    if (state.get(id) === "visiting") return [...path.slice(path.indexOf(id)), id];
    state.set(id, "visiting");
    path.push(id);
    for (const p of prereqs.get(id) ?? []) {
      if (!prereqs.has(p)) continue;
      const found = visit(p);
      if (found) return found;
    }
    path.pop();
    state.set(id, "done");
    return null;
  };

  for (const c of concepts) {
    const found = visit(c.id);
    if (found) return found;
  }
  return null;
}

/**
 * Snap each replay's end to the end of the segment it lands in. The model
 * cites segment *start* markers, so a replay ending "at 1246s" would stop
 * just as the sentence that holds the answer begins.
 */
export function snapReplays(pack: StudyPack, segments: { startSec: number; endSec: number }[]): StudyPack {
  return {
    ...pack,
    checkpoints: pack.checkpoints.map((cp) => {
      const landing = segments.find((s) => cp.replayTo >= s.startSec && cp.replayTo < s.endSec);
      if (!landing) return cp;
      return { ...cp, replayTo: Math.min(landing.endSec, cp.atSec) };
    }),
  };
}

const LETTER_LABEL = /^\s*(?:\(?[A-Da-d][).:]|[A-Da-d]\s+-)\s+/;

/** FNV-1a: a small stable hash, so a check's option order is the same every time it's normalised. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let n = 0; n < text.length; n++) {
    h ^= text.charCodeAt(n);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Deterministic Fisher–Yates driven by a seeded LCG. */
function shuffledOrder(length: number, seed: number): number[] {
  const order = [...Array(length).keys()];
  let state = seed || 1;
  for (let n = length - 1; n > 0; n--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const k = state % (n + 1);
    [order[n], order[k]] = [order[k], order[n]];
  }
  return order;
}

export interface Normalised {
  pack: StudyPack;
  /** Human-readable notes on what was repaired, for the log. */
  repairs: string[];
}

/**
 * Repair what models reliably get mechanically wrong, before validation:
 *
 * - replay windows: each replay must end at or before its check and cover the
 *   10–150 s that explains it. A replay ending after the check is cut at the
 *   check; a reversed or too-short one becomes the 60 s before its end; an
 *   over-long one keeps its last 150 s. The end then snaps to the end of the
 *   sentence it lands in (see snapReplays).
 * - options: "B) …" letter labels are stripped, and options are shuffled into
 *   an order seeded by the check id, with answerIndex remapped. Models put the
 *   right answer in the same slot far too often (every key was B in one run).
 *
 * Questions, answers, and every other timestamp are left as the model wrote
 * them; validatePack still rejects anything this doesn't cover.
 */
export function normalisePack(pack: StudyPack, segments: { startSec: number; endSec: number }[]): Normalised {
  const repairs: string[] = [];
  const checkpoints = pack.checkpoints.map((cp) => {
    let { replayFrom, replayTo } = cp;
    if (replayTo > cp.atSec) {
      repairs.push(`${cp.id}: replay ended ${Math.round(replayTo - cp.atSec)}s after the check; cut at the check`);
      replayTo = cp.atSec;
    }
    const length = replayTo - replayFrom;
    if (length < 10) {
      repairs.push(`${cp.id}: replay was ${Math.round(length)}s; using the 60s before its end`);
      replayFrom = Math.max(0, replayTo - 60);
    } else if (length > 150) {
      repairs.push(`${cp.id}: replay was ${Math.round(length)}s; keeping its last 150s`);
      replayFrom = replayTo - 150;
    }

    const stripped = cp.options.map((o) => o.replace(LETTER_LABEL, ""));
    if (stripped.some((o, n) => o !== cp.options[n])) repairs.push(`${cp.id}: stripped letter labels from options`);
    const order = shuffledOrder(stripped.length, hash(cp.id + cp.question));
    const options = order.map((n) => stripped[n]);
    const answerIndex = order.indexOf(cp.answerIndex);

    return { ...cp, replayFrom, replayTo, options, answerIndex };
  });
  return { pack: snapReplays({ ...pack, checkpoints }, segments), repairs };
}
