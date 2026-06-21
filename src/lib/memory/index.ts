import { getBedrock, UTILITY_MODEL } from "../bedrock";
import { EventKind, type StoredEvent } from "../agent/transcript";
import { createPgNotesMemory } from "./pgNotes";
import { createSupermemoryMemory } from "./supermemory";

/**
 * The tutor's qualitative memory of *how* each learner learns (#44) — distinct
 * from the structured mastery DB. It captures things like "prefers football
 * analogies", "confused area with circumference", "is a visual learner" so a
 * later session, even on a different topic, can adapt unprompted.
 *
 * Two interchangeable backends implement {@link LearnerMemory}: Supermemory
 * (semantic recall, user-scoped containers) when `SUPERMEMORY_API_KEY` is set,
 * and a plain-Postgres `learner_notes` fallback otherwise — so the app runs with
 * or without the key. Every call here is best-effort: memory is an enhancement,
 * never a hard dependency of a session (see {@link recallLearnerNotes} /
 * {@link distillAndRemember}, which both swallow errors).
 */

/** One recalled memory. `score` (if present) is backend relevance, higher = better. */
export interface MemoryRecord {
  id?: string;
  content: string;
  score?: number;
}

export interface LearnerMemory {
  /** Persist one distilled insight about how this learner learns. */
  remember(userId: string, insight: string): Promise<void>;
  /** Semantically recall up to `k` insights relevant to `query`. */
  recall(userId: string, query: string, k?: number): Promise<MemoryRecord[]>;
  /** Wipe every memory for a learner (account/demo reset). */
  forget(userId: string): Promise<void>;
}

let cached: LearnerMemory | null = null;

/**
 * The active memory backend, chosen once by `SUPERMEMORY_API_KEY` presence.
 * Lazily constructed so importing this module never requires a key or DB.
 */
export function getLearnerMemory(): LearnerMemory {
  if (cached) return cached;
  const apiKey = process.env.SUPERMEMORY_API_KEY?.trim();
  cached = apiKey ? createSupermemoryMemory(apiKey) : createPgNotesMemory();
  return cached;
}

/** How many insights one session is allowed to distill. */
const MAX_INSIGHTS = 3;
/** How many memories to surface at the start of a session. */
const RECALL_LIMIT = 5;

/**
 * Read path: recall a learner's most relevant memories for an upcoming session
 * and format them as a single line for the session snapshot's `learnerNotes`.
 *
 * Best-effort: any failure (no key, network blip, empty store) yields
 * `undefined` and the session proceeds with no recalled context.
 */
export async function recallLearnerNotes(
  userId: string,
  query: string,
  k = RECALL_LIMIT,
): Promise<string | undefined> {
  try {
    const records = await getLearnerMemory().recall(userId, query, k);
    const notes = records
      .map((r) => r.content.trim())
      .filter((c) => c.length > 0);
    if (notes.length === 0) return undefined;
    return notes.join("; ");
  } catch (err) {
    console.warn("[memory] recall failed (continuing without it):", err);
    return undefined;
  }
}

/**
 * Pull human-readable strings out of a present_ui tool input so distillation
 * sees what the tutor actually put on screen, not raw widget JSON.
 */
function textFromComponents(input: unknown): string[] {
  const components = (input as { components?: unknown })?.components;
  if (!Array.isArray(components)) return [];
  const fields = [
    "title",
    "body",
    "text",
    "question",
    "front",
    "back",
    "prompt",
    "label",
  ];
  const out: string[] = [];
  for (const c of components) {
    const props = (c as { properties?: Record<string, unknown> })?.properties;
    if (!props) continue;
    for (const f of fields) {
      const v = props[f];
      if (typeof v === "string" && v.trim()) out.push(v.trim());
    }
  }
  return out;
}

/**
 * Flatten the session transcript into a compact, readable script for the
 * distiller: learner turns, tutor narration, and the gist of each rendered
 * screen. Capped so a long session can't blow up the utility-model call.
 */
function summarizeTranscript(events: StoredEvent[]): string {
  const lines: string[] = [];
  for (const e of [...events].sort((a, b) => a.seq - b.seq)) {
    const p = e.payload;
    if (p.kind === EventKind.UserMessage) {
      lines.push(`Learner: ${p.text}`);
    } else if (p.kind === EventKind.TutorText) {
      if (p.text.trim()) lines.push(`Tutor: ${p.text.trim()}`);
    } else if (p.kind === EventKind.TutorToolUse && p.name === "present_ui") {
      const shown = textFromComponents(p.input);
      if (shown.length > 0) lines.push(`Tutor shows: ${shown.join(" | ")}`);
    }
  }
  const text = lines.join("\n");
  const MAX_CHARS = 12_000;
  return text.length > MAX_CHARS ? text.slice(-MAX_CHARS) : text;
}

const DISTILL_TOOL = "emit_learner_insights";

const distillToolSchema = {
  type: "object",
  properties: {
    insights: {
      type: "array",
      description: `0–${MAX_INSIGHTS} durable, reusable insights about how this learner learns.`,
      items: { type: "string" },
    },
  },
  required: ["insights"],
  additionalProperties: false,
} as const;

function distillPrompt(topicTitle: string, transcript: string): string {
  return [
    `Here is the transcript of a tutoring session on "${topicTitle}".`,
    "",
    "Distill what it reveals about HOW this learner learns — durable traits that",
    "would help a future session on ANY topic. Look for: preferred explanation",
    "styles or analogies they responded to, stated interests, recurring",
    "misconceptions, pacing, and what made a concept finally click.",
    "",
    `Write 0–${MAX_INSIGHTS} short, self-contained insights (one sentence each),`,
    "phrased so they're useful out of context (e.g. \"Prefers football analogies\",",
    `"Tends to confuse correlation with causation"). Skip topic-specific facts and`,
    "anything you're not reasonably confident about — return an empty list if the",
    "session shows nothing durable. Call the tool with the result.",
    "",
    "Transcript:",
    transcript,
  ].join("\n");
}

/**
 * Write path: at the end of a session, run a cheap utility-model pass to distill
 * 1–3 durable insights about the learner and persist them via {@link remember}.
 *
 * Best-effort and non-fatal: any failure is logged and swallowed so ending a
 * session never depends on the memory layer. Returns the insights it stored
 * (mainly for tests/observability).
 */
export async function distillAndRemember(
  userId: string,
  topicTitle: string,
  events: StoredEvent[],
  opts: { model?: string } = {},
): Promise<string[]> {
  try {
    const transcript = summarizeTranscript(events);
    if (!transcript.trim()) return [];

    const client = getBedrock();
    const response = (await client.messages.create({
      model: opts.model ?? UTILITY_MODEL,
      max_tokens: 1024,
      tools: [
        {
          name: DISTILL_TOOL,
          description:
            "Emit durable insights about how this learner learns, for reuse in future sessions.",
          input_schema: distillToolSchema as unknown as Record<string, unknown>,
        },
      ],
      tool_choice: { type: "tool", name: DISTILL_TOOL },
      messages: [
        { role: "user", content: distillPrompt(topicTitle, transcript) },
      ],
    } as Parameters<typeof client.messages.create>[0])) as {
      content: Array<{ type: string; name?: string; input?: unknown }>;
    };

    const block = response.content.find(
      (b) => b.type === "tool_use" && b.name === DISTILL_TOOL,
    );
    const raw = (block?.input as { insights?: unknown })?.insights;
    const insights = (Array.isArray(raw) ? raw : [])
      .filter((i): i is string => typeof i === "string" && i.trim().length > 0)
      .map((i) => i.trim())
      .slice(0, MAX_INSIGHTS);

    const memory = getLearnerMemory();
    for (const insight of insights) {
      await memory.remember(userId, insight);
    }
    return insights;
  } catch (err) {
    console.warn("[memory] distillation failed (session unaffected):", err);
    return [];
  }
}
