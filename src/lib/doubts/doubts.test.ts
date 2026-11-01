import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import type { NewDoubt } from "@/db/schema";

import { type AnswerDeps, answerDoubt, type DoubtEvent, NotReadyError, prepareDoubt, stripFences } from "./answer";
import { fitForSpeech, speakableText } from "./speech";

const GOOD = [
  'root = Answer("ஏன் n-ஆல் divide?", [p1, t1, f1])',
  'p1 = Paragraph("Average-க்கு count-ஆல divide பண்றோம்.", "அதனால n.")',
  't1 = TimeChip(312, "Average define பண்ற இடம்")',
  'f1 = Formula("mean = sum / n", "n = values")',
].join("\n");

function deps(chunks: string[] | Error = GOOD.match(/[\s\S]{1,40}/g)!): AnswerDeps & { saved: NewDoubt[]; refunded: string[] } {
  const saved: NewDoubt[] = [];
  const refunded: string[] = [];
  return {
    saved,
    refunded,
    lectureTitle: vi.fn(async () => "Intro"),
    englishSegments: vi.fn(async () => [{ i: 0, startSec: 300, endSec: 320, text: "We divide by n." }]),
    concepts: vi.fn(async () => [{ title: "Average", startSec: 300 }]),
    stream: vi.fn(async function* () {
      if (chunks instanceof Error) {
        yield "root = Ans";
        throw chunks;
      }
      yield* chunks;
    }),
    save: vi.fn(async (row: NewDoubt) => void saved.push(row)),
    refund: vi.fn(async (userId: string) => void refunded.push(userId)),
    toEnglish: vi.fn(async (text: string) => `EN:${text}`),
    // Stands in for Sarvam-Translate: marks every string so the test can see what moved.
    translate: vi.fn(async (program: string) => program.replace(/"([^"\\]+)"/g, '"NE:$1"')),
  };
}

const input = { userId: "u1", lectureId: "lec-1", lang: "ta" as const, atSec: 330, question: "n-ஆல் ஏன் divide?" };

async function collect(gen: AsyncGenerator<DoubtEvent>) {
  const out: DoubtEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

let err: MockInstance<typeof console.error>;
beforeEach(() => {
  err = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => err.mockRestore());

describe("answerDoubt", () => {
  it("streams deltas, then stores the validated answer and reports done", async () => {
    const d = deps();
    const messages = await prepareDoubt(input, d);
    const events = await collect(answerDoubt(input, messages, d));

    const deltas = events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text);
    expect(deltas.join("")).toBe(GOOD);
    const done = events.at(-1) as { type: "done"; doubtId: string };
    expect(done.type).toBe("done");
    expect(d.saved).toEqual([
      {
        id: done.doubtId,
        userId: "u1",
        lectureId: "lec-1",
        lang: "ta",
        atSec: 330,
        question: "n-ஆல் ஏன் divide?",
        model: "sarvam-105b-conversations",
        status: "answered",
        answer: GOOD,
        error: null,
      },
    ]);
    expect(d.refunded).toEqual([]);
  });

  it("stores a malformed answer as failed, refunds, and says why", async () => {
    const d = deps(['root = Answer(title: "x", parts: [])']);
    const events = await collect(answerDoubt(input, await prepareDoubt(input, d), d));
    const last = events.at(-1) as { type: "error"; message: string };
    expect(last.type).toBe("error");
    expect(last.message).toMatch(/^The answer came back malformed/);
    expect(d.saved[0]).toMatchObject({ status: "failed", answer: null });
    expect(d.refunded).toEqual(["u1"]);
  });

  it("stores an upstream failure mid-stream as failed and refunds", async () => {
    const d = deps(new Error("Sarvam /v1/chat/completions failed (HTTP 503): down"));
    const events = await collect(answerDoubt(input, await prepareDoubt(input, d), d));
    expect(events.at(-1)).toMatchObject({ type: "error", message: "Sarvam /v1/chat/completions failed (HTTP 503): down" });
    expect(d.saved[0]).toMatchObject({ status: "failed", error: "Sarvam /v1/chat/completions failed (HTTP 503): down" });
    expect(d.refunded).toEqual(["u1"]);
  });

  it("accepts an answer wrapped in markdown fences, storing the program inside", async () => {
    const d = deps(["```openui\n", GOOD, "\n```"]);
    const events = await collect(answerDoubt(input, await prepareDoubt(input, d), d));
    expect(events.at(-1)?.type).toBe("done");
    expect(d.saved[0].answer).toBe(GOOD);
  });

  it("grounds the prompt in the transcript window and the student's language", async () => {
    const d = deps();
    const [system, user] = await prepareDoubt(input, d);
    expect(system.content).toMatch(/answer in Tamil written in Tamil script/);
    expect(user.content).toContain("[300s] We divide by n.");
    expect(user.content).toContain("Student's doubt: n-ஆல் ஏன் divide?");
  });

  it("answers in English and stores only the translation for a language the model can't write", async () => {
    const d = deps();
    const ne = { ...input, lang: "ne" as const, question: "किन n ले भाग गर्ने?" };
    const messages = await prepareDoubt(ne, d);
    expect(d.toEnglish).toHaveBeenCalledWith("किन n ले भाग गर्ने?", "ne");
    expect(messages[0].content).toMatch(/Always answer in English/);
    expect(messages.at(-1)!.content).toContain("EN:किन n ले भाग गर्ने?");

    const events = await collect(answerDoubt(ne, messages, d));

    expect(events.filter((e) => e.type === "delta")).toEqual([]);
    expect(events.filter((e) => e.type === "status").map((e) => (e as { text: string }).text)).toEqual(["Working out the answer", "Translating into Nepali"]);
    const program = (events.find((e) => e.type === "program") as { text: string }).text;
    expect(program).toContain('"NE:');
    expect(d.saved).toEqual([
      expect.objectContaining({
        lang: "ne",
        question: "किन n ले भाग गर्ने?",
        status: "answered",
        answer: program,
        model: "sarvam-105b-conversations+sarvam-translate:v1",
        error: null,
      }),
    ]);
  });

  it("stores a failed translation as failed and refunds", async () => {
    const d = deps();
    vi.mocked(d.translate).mockRejectedValue(new Error("HTTP 429"));
    const ne = { ...input, lang: "ne" as const };
    const events = await collect(answerDoubt(ne, await prepareDoubt(ne, d), d));
    expect(events.at(-1)).toMatchObject({ type: "error", message: "Translating into Nepali failed: HTTP 429" });
    expect(d.saved).toEqual([expect.objectContaining({ status: "failed", answer: null, error: "Translating into Nepali failed: HTTP 429" })]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("refuses before charging when the transcript isn't ready", async () => {
    const d = deps();
    vi.mocked(d.englishSegments).mockResolvedValue(null);
    await expect(prepareDoubt(input, d)).rejects.toBeInstanceOf(NotReadyError);
  });
});

describe("stripFences", () => {
  it("unwraps a fenced program and leaves a bare one alone", () => {
    expect(stripFences("```\nroot = A()\n```")).toBe("root = A()");
    expect(stripFences("```openui-lang\nroot = A()```")).toBe("root = A()");
    expect(stripFences("  root = A()  ")).toBe("root = A()");
  });
});

describe("speakableText", () => {
  it("reads title, paragraphs and captions in order, skipping chips and raw formulas", () => {
    expect(speakableText(GOOD)).toBe("ஏன் n-ஆல் divide? Average-க்கு count-ஆல divide பண்றோம். அதனால n. n = values");
  });

  it("includes steps and callouts", () => {
    const answer = ['root = Answer("T", [s, c])', 's = Steps(["one", "two"])', 'c = Callout("note", "careful")'].join("\n");
    expect(speakableText(answer)).toBe("T. one. two. careful");
  });
});

describe("fitForSpeech", () => {
  it("cuts at a sentence end within the limit", () => {
    expect(fitForSpeech("aaa. bbb. ccc", 9)).toBe("aaa. bbb.");
  });
  it("falls back to a word boundary", () => {
    expect(fitForSpeech("aaaa bbbb cccc", 10)).toBe("aaaa bbbb");
  });
});
