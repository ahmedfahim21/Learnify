import { createParser, type ElementNode } from "@openuidev/lang-core";

import { screenCore } from "@/lib/openui/screenSpec";
import { type ChatMessage, chatJson } from "@/lib/sarvam/client";

/**
 * A second look at a generated quiz's answer keys before it's stored. The
 * model that writes quizzes gets keys wrong (an Mcq marking the wrong option,
 * steps listed out of order), and a wrong key teaches the wrong thing. A
 * reasoning model reads each question against the lecture and says whether
 * the key is right; wrong ones are corrected (with an explanation to match),
 * and ones it can't settle are dropped.
 */

export const VERIFY_MODEL = "sarvam-105b";

type QuestionType = "Mcq" | "TrueFalse" | "FillBlank" | "MatchPairs" | "OrderSteps";
const QUESTION_TYPES = new Set<string>(["Mcq", "TrueFalse", "FillBlank", "MatchPairs", "OrderSteps"]);

export interface Question {
  id: string;
  type: QuestionType;
  props: Record<string, unknown>;
}

export interface Verdict {
  id: string;
  verdict: "correct" | "fixed" | "unsure";
  /** Mcq: the right option's 0-based index. */
  answerIndex: number | null;
  /** TrueFalse: whether the statement is true. */
  answer: boolean | null;
  /** FillBlank: the word or phrase that fills the blank. */
  fillAnswer: string | null;
  /** OrderSteps: indexes into the listed steps, in the correct order. */
  order: number[] | null;
  /** MatchPairs: for each left item, the index of its match in the right list. */
  matches: number[] | null;
  /** When fixed: an explanation that supports the corrected answer. */
  explanation: string | null;
}

export interface KeyReport {
  checked: number;
  fixed: string[];
  dropped: string[];
}

/** The quiz's questions, by the statement each is defined in. */
export function quizQuestions(program: string): Question[] {
  const result = createParser(screenCore.toJSONSchema()).parse(program);
  const out: Question[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null || (node as ElementNode).type !== "element") return;
    const el = node as ElementNode;
    if (QUESTION_TYPES.has(el.typeName) && el.statementId) out.push({ id: el.statementId, type: el.typeName as QuestionType, props: el.props });
    for (const v of Object.values(el.props)) walk(v);
  };
  walk(result.root);
  return out;
}

/** How each question is shown to the checker: what's asked and what the quiz claims is right. */
export function describe(q: Question): string {
  const p = q.props as Record<string, never>;
  const list = (xs: unknown[]) => xs.map((x, i) => `  ${i}. ${String(x)}`).join("\n");
  switch (q.type) {
    case "Mcq":
      return `[${q.id}] Multiple choice: ${p.question}\nOptions:\n${list(p.options)}\nClaimed answer: option ${p.answerIndex}`;
    case "TrueFalse":
      return `[${q.id}] True or false: ${p.statement}\nClaimed answer: ${p.answer ? "true" : "false"}`;
    case "FillBlank":
      return `[${q.id}] Fill the blank: ${p.prompt}\nClaimed answer: ${p.answer}`;
    case "MatchPairs":
      return `[${q.id}] Match: ${p.instruction}\nLeft:\n${list(p.left)}\nRight:\n${list(p.right)}\nClaimed: left i matches right i`;
    case "OrderSteps":
      return `[${q.id}] Order: ${p.instruction}\nSteps as listed:\n${list(p.steps)}\nClaimed: the listed order is correct`;
  }
}

const nullable = (type: string) => ({ type: [type, "null"] });
const nullableArray = { type: ["array", "null"], items: { type: "integer" } };

export const verdictsJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "verdict", "answerIndex", "answer", "fillAnswer", "order", "matches", "explanation"],
        properties: {
          id: { type: "string" },
          verdict: { type: "string", enum: ["correct", "fixed", "unsure"] },
          answerIndex: nullable("integer"),
          answer: nullable("boolean"),
          fillAnswer: nullable("string"),
          order: nullableArray,
          matches: nullableArray,
          explanation: nullable("string"),
        },
      },
    },
  },
} as const;

export function verifyMessages(questions: Question[], transcript: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "You check the answer keys of a practice quiz written from a recorded lecture.",
        "For each question, work out the right answer from the lecture transcript and the subject itself, then compare it with the claimed answer.",
        'verdict "correct": the claimed answer is right. Set every other field to null.',
        'verdict "fixed": the claimed answer is wrong. Give the right one in the field for its type (answerIndex for multiple choice, answer for true or false, fillAnswer for fill the blank, order for ordering as indexes of the listed steps in the right sequence, matches for matching as the right-list index for each left item) and an explanation that supports it, written in the same language as the question.',
        'verdict "unsure": the question is ambiguous, has no single right answer, or the lecture doesn\'t settle it.',
        'In explanations say "the lecture", never "the transcript", and never write seconds or timestamps.',
        "Return one verdict per question, using its id.",
      ].join("\n"),
    },
    { role: "user", content: `${transcript}\n\nQuestions:\n\n${questions.map(describe).join("\n\n")}` },
  ];
}

export type VerifyCall = (messages: ChatMessage[], tag: string) => Promise<Verdict[]>;

export const liveVerify: VerifyCall = async (messages, tag) => {
  const { value } = await chatJson<{ verdicts: Verdict[] }>(
    {
      messages,
      model: VERIFY_MODEL,
      jsonSchema: { name: "quiz_key_check", schema: verdictsJsonSchema },
      maxTokens: 16_000,
      reasoningEffort: "low",
    },
    { tag, timeoutMs: 80_000 },
  );
  return value.verdicts;
};

const isPermutation = (xs: number[], n: number) => xs.length === n && new Set(xs).size === n && xs.every((x) => Number.isInteger(x) && x >= 0 && x < n);

/**
 * The question rebuilt with a verdict's fix, or null when the fix doesn't fit
 * the question (an index out of range, an order that isn't a permutation).
 */
export function applyFix(q: Question, v: Verdict): Record<string, unknown> | null {
  const p = { ...q.props } as Record<string, unknown>;
  if (v.explanation) p.explanation = v.explanation;
  switch (q.type) {
    case "Mcq": {
      const n = (p.options as unknown[]).length;
      if (v.answerIndex === null || !Number.isInteger(v.answerIndex) || v.answerIndex < 0 || v.answerIndex >= n) return null;
      return { ...p, answerIndex: v.answerIndex };
    }
    case "TrueFalse":
      return v.answer === null ? null : { ...p, answer: v.answer };
    case "FillBlank":
      return v.fillAnswer?.trim() ? { ...p, answer: v.fillAnswer.trim(), alternatives: [] } : null;
    case "OrderSteps": {
      const steps = p.steps as unknown[];
      if (!v.order || !isPermutation(v.order, steps.length)) return null;
      return { ...p, steps: v.order.map((i) => steps[i]) };
    }
    case "MatchPairs": {
      const right = p.right as unknown[];
      if (!v.matches || !isPermutation(v.matches, (p.left as unknown[]).length) || right.length !== v.matches.length) return null;
      return { ...p, right: v.matches.map((i) => right[i]) };
    }
  }
}

/** Positional argument order for each question type, as the specs define them. */
const ARGS: Record<QuestionType, string[]> = {
  Mcq: ["question", "options", "answerIndex", "explanation", "sec"],
  TrueFalse: ["statement", "answer", "explanation", "sec"],
  FillBlank: ["prompt", "answer", "alternatives", "explanation", "sec"],
  MatchPairs: ["instruction", "left", "right", "explanation", "sec"],
  OrderSteps: ["instruction", "steps", "explanation", "sec"],
};

export function statement(id: string, type: QuestionType, props: Record<string, unknown>): string {
  return `${id} = ${type}(${ARGS[type].map((k) => JSON.stringify(props[k])).join(", ")})`;
}

/** Apply verdicts: rewrite fixed questions, and take unsure or unfixable ones out of the quiz. */
export function applyVerdicts(program: string, questions: Question[], verdicts: Verdict[]): { program: string; report: KeyReport } {
  const byId = new Map(verdicts.map((v) => [v.id, v]));
  const lines = program.split("\n");
  const report: KeyReport = { checked: questions.length, fixed: [], dropped: [] };
  for (const q of questions) {
    const v = byId.get(q.id);
    const at = lines.findIndex((l) => l.startsWith(`${q.id} = `));
    if (!v || v.verdict === "unsure") {
      report.dropped.push(q.id);
      continue;
    }
    if (v.verdict === "fixed") {
      const fixed = applyFix(q, v);
      if (!fixed || at < 0) {
        report.dropped.push(q.id);
        continue;
      }
      lines[at] = statement(q.id, q.type, fixed);
      report.fixed.push(q.id);
    }
  }
  // Remove dropped questions from the Quiz's list; their statements become harmless orphans, then go.
  if (report.dropped.length) {
    const gone = new Set(report.dropped);
    for (let i = 0; i < lines.length; i++) {
      if (/^\w+ = Quiz\(/.test(lines[i])) {
        lines[i] = lines[i].replace(/\[([^\[\]]*)\]\)\s*$/, (_, inner: string) => `[${inner.split(",").map((s) => s.trim()).filter((s) => s && !gone.has(s)).join(", ")}])`);
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const id = /^(\w+) = /.exec(lines[i])?.[1];
      if (id && gone.has(id)) lines.splice(i, 1);
    }
  }
  return { program: lines.join("\n"), report };
}

/** Check a quiz's keys and return the corrected program with what changed. */
export async function verifyQuiz(program: string, transcript: string, call: VerifyCall = liveVerify, tag = "quiz keys") {
  const questions = quizQuestions(program);
  if (questions.length === 0) return { program, report: { checked: 0, fixed: [], dropped: [] } as KeyReport };
  const verdicts = await call(verifyMessages(questions, transcript), tag);
  return applyVerdicts(program, questions, verdicts);
}
