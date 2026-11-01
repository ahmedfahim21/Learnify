import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { attachOrphans, checkScreen, generateScreen, prepareScreen, type ScreenDeps, type ScreenEvent, ScreenNotReadyError } from "./generate";
import { NOTES_EXAMPLE, QUIZ_EXAMPLE } from "./prompt";

describe("checkScreen", () => {
  it("accepts the notes and quiz examples the model is shown", () => {
    expect(checkScreen(NOTES_EXAMPLE, "notes")).toEqual({ ok: true, fatal: [], dropped: [] });
    expect(checkScreen(QUIZ_EXAMPLE, "quiz")).toEqual({ ok: true, fatal: [], dropped: [] });
  });

  it("rejects the wrong root, dangling references and truncated output", () => {
    expect(checkScreen('root = Section("x", 0, [])', "notes").fatal).toContain("root is Section, expected Screen");
    expect(checkScreen('root = Screen("x", [s1, s9])\ns1 = Section("a", 0, [])', "notes").fatal).toContain("undefined reference s9");
  });

  it("rejects a quiz with too few questions, or notes with too few sections", () => {
    expect(checkScreen('root = Screen("x", [q])\nq = Quiz("x", [a])\na = TrueFalse("s", true, "e", 1)', "quiz").fatal).toContain(
      "quiz has 1 questions; expected 8 to 10",
    );
    expect(checkScreen('root = Screen("x", [s])\ns = Section("a", 0, [])', "notes").fatal).toContain("notes have 1 sections; expected 3 to 6");
  });

  it("counts questions whose answer key can't be right, and rejects more than two", () => {
    const one = QUIZ_EXAMPLE.replace('"√2", "-4"], 2,', '"√2", "-4"], 7,');
    expect(checkScreen(one, "quiz")).toMatchObject({ ok: true, dropped: ["Mcq answerIndex 7 out of range"] });
    const many = one
      .replace('["N", "Z", "Q"]', '["N"]')
      .replace('["N", "Z", "Q", "R"]', '["N", "Z"]');
    expect(checkScreen(many, "quiz")).toMatchObject({ ok: false, fatal: ["3 broken components"] });
  });
});

describe("attachOrphans", () => {
  it("adds note parts the model forgot to reference to the section above them", () => {
    const program = [
      'root = Screen("x", [s1, s2])',
      's1 = Section("a", 10, [k1])',
      'k1 = KeyIdea("k")',
      'r1 = Reveal("q?", "a")',
      's2 = Section("b", 20, [])',
      't2 = TimeChip(25, "here")',
    ].join("\n");
    const out = attachOrphans(program);
    expect(out.attached).toEqual(["r1", "t2"]);
    expect(out.program.split("\n")[1]).toBe('s1 = Section("a", 10, [k1, r1])');
    expect(out.program.split("\n")[4]).toBe('s2 = Section("b", 20, [t2])');
    expect(checkScreen(out.program, "notes")).toMatchObject({ ok: true });
  });

  it("leaves a complete program unchanged", () => {
    expect(attachOrphans(NOTES_EXAMPLE)).toEqual({ program: NOTES_EXAMPLE, attached: [] });
  });
});

function deps(chunks: string[] | Error): ScreenDeps & { saved: unknown[]; refunded: string[] } {
  const saved: unknown[] = [];
  const refunded: string[] = [];
  return {
    saved,
    refunded,
    lecture: vi.fn(async () => ({ title: "The Real line", english: [{ i: 0, startSec: 216, endSec: 230, text: "A rational number is p by q." }] })),
    stream: vi.fn(async function* () {
      if (chunks instanceof Error) {
        yield "root = Scr";
        throw chunks;
      }
      yield* chunks;
    }),
    save: vi.fn(async (row) => {
      saved.push(row);
      return "screen-1";
    }),
    refund: vi.fn(async (u: string) => void refunded.push(u)),
    // Stands in for Sarvam-Translate: marks every string so the test can see what moved.
    // Keys check out by default; tests that need a fix set their own.
    verify: vi.fn(async (program: string) => ({ program, report: { checked: 5, fixed: [], dropped: [] } })),
    translate: vi.fn(async (program: string) => program.replace(/"([^"\\]*)"/g, (m, t: string) => (t ? `"NE:${t}"` : m))),
  };
}

const input = { userId: "u1", lectureId: "lec-1", lang: "hi" as const, kind: "quiz" as const, variant: "standard" as const };
async function collect(g: AsyncGenerator<ScreenEvent>) {
  const out: ScreenEvent[] = [];
  for await (const e of g) out.push(e);
  return out;
}

let spies: MockInstance[];
beforeEach(() => {
  spies = [vi.spyOn(console, "error").mockImplementation(() => {}), vi.spyOn(console, "warn").mockImplementation(() => {})];
});
afterEach(() => spies.forEach((s) => s.mockRestore()));

describe("generateScreen", () => {
  it("streams the program, then stores it with every field", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    const events = await collect(generateScreen(input, await prepareScreen(input, d), d));
    expect(events.filter((e) => e.type === "delta").map((e) => (e as { text: string }).text).join("")).toBe(QUIZ_EXAMPLE);
    expect(events.at(-1)).toEqual({ type: "done", screenId: "screen-1" });
    expect(d.saved).toEqual([{ lectureId: "lec-1", lang: "hi", kind: "quiz", variant: "standard", program: QUIZ_EXAMPLE, model: "sarvam-105b-conversations" }]);
    expect(d.refunded).toEqual([]);
  });

  it("stores nothing and refunds on a malformed screen", async () => {
    const d = deps(['root = Screen("x", [q])']);
    const events = await collect(generateScreen(input, await prepareScreen(input, d), d));
    expect(events.at(-1)).toMatchObject({ type: "error" });
    expect((events.at(-1) as { message: string }).message).toMatch(/^The screen came back malformed/);
    expect(d.saved).toEqual([]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("stores nothing and refunds when Sarvam fails mid-stream", async () => {
    const d = deps(new Error("Sarvam /v1/chat/completions failed (HTTP 503): down"));
    const events = await collect(generateScreen(input, await prepareScreen(input, d), d));
    expect(events.at(-1)).toEqual({ type: "error", message: "Sarvam /v1/chat/completions failed (HTTP 503): down" });
    expect(d.saved).toEqual([]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("writes the prompt for the student's language and style, grounded in the transcript", async () => {
    const d = deps([]);
    const [system, user] = await prepareScreen({ ...input, variant: "harder" }, d);
    expect(system.content).toMatch(/in Hindi, in Hindi script/);
    expect(system.content).toMatch(/This student wants a challenge/);
    expect(system.content).toMatch(/one Quiz with 8 to 10 questions/);
    expect(user.content).toMatch(/^Transcript:\n\[216s\] A rational number is p by q\.\n\nWrite the whole screen in Hindi \(हिन्दी\), in Hindi script/);
  });

  it("writes in English and stores only the translation for a language the model can't write", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    const ne = { ...input, lang: "ne" as const };
    const messages = await prepareScreen(ne, d);
    expect(messages[0].content).not.toMatch(/Nepali/);
    expect(messages[1].content).toMatch(/Write the screen in English\.$/);

    const events = await collect(generateScreen(ne, messages, d));

    // No English ever reaches the student: statuses, then the whole translated screen.
    expect(events.filter((e) => e.type === "delta")).toEqual([]);
    expect(events.filter((e) => e.type === "status")).toEqual([
      { type: "status", text: "Writing from the lecture" },
      { type: "status", text: "Checking the answers" },
      { type: "status", text: "Translating into Nepali" },
    ]);
    const program = (events.find((e) => e.type === "program") as { text: string }).text;
    expect(program).toContain('"NE:');
    expect(events.at(-1)).toEqual({ type: "done", screenId: "screen-1" });
    expect(d.translate).toHaveBeenCalledWith(QUIZ_EXAMPLE, "ne", "screen lec-1/ne/quiz/standard");
    expect(d.saved).toEqual([
      { lectureId: "lec-1", lang: "ne", kind: "quiz", variant: "standard", program, model: "sarvam-105b-conversations+sarvam-translate:v1" },
    ]);
  });

  it("refunds and stores nothing when translation fails", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    vi.mocked(d.translate).mockRejectedValue(new Error("Sarvam /translate failed (HTTP 429)"));
    const ne = { ...input, lang: "ne" as const };
    const events = await collect(generateScreen(ne, await prepareScreen(ne, d), d));
    expect(events.at(-1)).toEqual({ type: "error", message: "Translating into Nepali failed: Sarvam /translate failed (HTTP 429)" });
    expect(d.saved).toEqual([]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("checks a quiz's answer keys against the transcript, and stores and shows the corrected quiz", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    const fixed = QUIZ_EXAMPLE.replace(', 2, "√2 has', ', 2, "Fixed: √2 has');
    vi.mocked(d.verify).mockResolvedValue({ program: fixed, report: { checked: 5, fixed: ["q1"], dropped: [] } });
    const messages = await prepareScreen(input, d);

    const events = await collect(generateScreen(input, messages, d));

    expect(d.verify).toHaveBeenCalledWith(QUIZ_EXAMPLE, messages[1].content, "screen lec-1/hi/quiz/standard");
    expect(events).toContainEqual({ type: "status", text: "Checking the answers" });
    expect(events.at(-2)).toEqual({ type: "program", text: fixed });
    expect(d.saved).toEqual([expect.objectContaining({ program: fixed })]);
  });

  it("doesn't check notes", async () => {
    const d = deps(NOTES_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    const notes = { ...input, kind: "notes" as const };
    await collect(generateScreen(notes, await prepareScreen(notes, d), d));
    expect(d.verify).not.toHaveBeenCalled();
    expect(d.saved).toHaveLength(1);
  });

  it("refunds and stores nothing when too few questions survive the check", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    const gutted = QUIZ_EXAMPLE.split("\n").filter((l) => !/^q[2-5] = /.test(l)).join("\n").replace("[q1, q2, q3, q4, q5]", "[q1]");
    vi.mocked(d.verify).mockResolvedValue({ program: gutted, report: { checked: 5, fixed: [], dropped: ["q2", "q3", "q4", "q5"] } });
    const events = await collect(generateScreen(input, await prepareScreen(input, d), d));
    expect((events.at(-1) as { message: string }).message).toMatch(/^Too few questions held up/);
    expect(d.saved).toEqual([]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("refunds and stores nothing when the check itself fails", async () => {
    const d = deps(QUIZ_EXAMPLE.match(/[\s\S]{1,50}/g)!);
    vi.mocked(d.verify).mockRejectedValue(new Error("Sarvam /v1/chat/completions failed (HTTP 503)"));
    const events = await collect(generateScreen(input, await prepareScreen(input, d), d));
    expect(events.at(-1)).toEqual({ type: "error", message: "Checking the answers failed: Sarvam /v1/chat/completions failed (HTTP 503)" });
    expect(d.saved).toEqual([]);
    expect(d.refunded).toEqual(["u1"]);
  });

  it("refuses before charging when there's no transcript", async () => {
    const d = deps([]);
    vi.mocked(d.lecture).mockResolvedValue(null);
    await expect(prepareScreen(input, d)).rejects.toBeInstanceOf(ScreenNotReadyError);
  });
});
