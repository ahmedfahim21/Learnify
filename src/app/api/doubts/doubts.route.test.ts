import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Doubt and voice routes. All need a user. What matters: nothing is charged
 * before the doubt can be grounded, the cap is enforced, the stream carries
 * the service's events intact, audio is size- and type-checked before Sarvam
 * sees it, and speech only reads the caller's own answers.
 */
const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  consumeDoubt: vi.fn(),
  getBudget: vi.fn(),
  prepareDoubt: vi.fn(),
  answerDoubt: vi.fn(),
  listOwnDoubts: vi.fn(),
  getOwnDoubt: vi.fn(),
  transcribe: vi.fn(),
  speak: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/budget", () => ({ consumeDoubt: mocks.consumeDoubt, getBudget: mocks.getBudget, refundDoubt: vi.fn() }));
vi.mock("@/lib/doubts/answer", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/doubts/answer")>();
  return {
    NotReadyError: real.NotReadyError,
    prepareDoubt: mocks.prepareDoubt,
    answerDoubt: mocks.answerDoubt,
    listOwnDoubts: mocks.listOwnDoubts,
    getOwnDoubt: mocks.getOwnDoubt,
  };
});
vi.mock("@/lib/sarvam/client", () => ({ transcribe: mocks.transcribe, speak: mocks.speak }));

const { POST: askPOST, GET: listGET } = await import("./route");
const { POST: transcribePOST } = await import("../voice/transcribe/route");
const { POST: speakPOST } = await import("../voice/speak/route");
const { NotReadyError } = await import("@/lib/doubts/answer");

const LECTURE = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const DOUBT = "9b2f6a8e-1c5d-4f7a-8e3b-2d4c6a8e0f12";
const anon = { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
const post = (body: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const ask = { lectureId: LECTURE, lang: "ta", atSec: 330, question: "n-ஆல் ஏன் divide?" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "u1" });
  mocks.prepareDoubt.mockResolvedValue([{ role: "system", content: "s" }]);
  mocks.consumeDoubt.mockResolvedValue({ allowed: true, state: { used: 3, limit: 20, remaining: 17, exceeded: false } });
  mocks.getBudget.mockResolvedValue({ used: 3, limit: 20, remaining: 17, exceeded: false });
  mocks.answerDoubt.mockImplementation(async function* () {
    yield { type: "delta", text: 'root = Answer("t", [p])\n' };
    yield { type: "delta", text: 'p = Paragraph("x")' };
    yield { type: "done", doubtId: DOUBT };
  });
});

describe("POST /api/doubts", () => {
  it("streams the service's events as NDJSON and reports remaining doubts", async () => {
    const res = await askPOST(post(ask));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/x-ndjson; charset=utf-8");
    expect(res.headers.get("x-doubts-remaining")).toBe("17");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines).toEqual([
      { type: "delta", text: 'root = Answer("t", [p])\n' },
      { type: "delta", text: 'p = Paragraph("x")' },
      { type: "done", doubtId: DOUBT },
    ]);
    expect(mocks.answerDoubt).toHaveBeenCalledWith({ userId: "u1", ...ask }, [{ role: "system", content: "s" }]);
  });

  it("trims the question", async () => {
    await askPOST(post({ ...ask, question: "  why n?  " }));
    expect(mocks.prepareDoubt).toHaveBeenCalledWith({ userId: "u1", ...ask, question: "why n?" });
  });

  it("needs a user", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await askPOST(post(ask))).status).toBe(401);
    expect(mocks.consumeDoubt).not.toHaveBeenCalled();
  });

  it("charges nothing when the lecture isn't ready to ground a doubt", async () => {
    mocks.prepareDoubt.mockRejectedValue(new NotReadyError("This lecture's transcript isn't ready yet"));
    const res = await askPOST(post(ask));
    expect(res.status).toBe(409);
    expect(mocks.consumeDoubt).not.toHaveBeenCalled();
  });

  it("refuses once today's doubts are spent, without calling the model", async () => {
    mocks.consumeDoubt.mockResolvedValue({ allowed: false, state: { used: 20, limit: 20, remaining: 0, exceeded: true } });
    const res = await askPOST(post(ask));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("You've used all 20 doubts for today. They reset at midnight UTC.");
    expect(mocks.answerDoubt).not.toHaveBeenCalled();
  });

  it.each([
    { ...ask, question: "x" },
    { ...ask, question: "x".repeat(501) },
    { ...ask, lang: "xx" },
    { ...ask, atSec: -1 },
    { ...ask, lectureId: "nope" },
  ])("rejects a malformed doubt %#", async (body) => {
    expect((await askPOST(post(body))).status).toBe(400);
    expect(mocks.consumeDoubt).not.toHaveBeenCalled();
  });
});

describe("GET /api/doubts", () => {
  it("lists the caller's answered doubts with only public fields", async () => {
    mocks.listOwnDoubts.mockResolvedValue([
      { id: DOUBT, userId: "u1", lectureId: LECTURE, lang: "ta", atSec: 330, question: "q", status: "answered", answer: "root = A()", error: null, model: "m", createdAt: "2026-10-31T00:00:00.000Z" },
    ]);
    const res = await listGET(new Request(`http://x/api/doubts?lectureId=${LECTURE}`));
    expect(await res.json()).toEqual({
      doubts: [{ id: DOUBT, lang: "ta", atSec: 330, question: "q", answer: "root = A()", createdAt: "2026-10-31T00:00:00.000Z" }],
    });
    expect(mocks.listOwnDoubts).toHaveBeenCalledWith("u1", LECTURE);
  });

  it("rejects a malformed lecture id", async () => {
    expect((await listGET(new Request("http://x/api/doubts?lectureId=x"))).status).toBe(400);
  });
});

function audioUpload(type: string, bytes = 2000, lang = "ta") {
  const form = new FormData();
  form.set("audio", new Blob([new Uint8Array(bytes)], { type }), "doubt");
  return new Request(`http://x/api/voice/transcribe?lang=${lang}`, { method: "POST", body: form });
}

describe("POST /api/voice/transcribe", () => {
  it("transcribes in the student's language with a matching file extension", async () => {
    mocks.transcribe.mockResolvedValue({ transcript: "  n-ஆல் ஏன் divide பண்றோம்?  ", languageCode: "ta-IN" });
    const res = await transcribePOST(audioUpload("audio/webm;codecs=opus"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ text: "n-ஆல் ஏன் divide பண்றோம்?" });
    const [blob, code, opts] = mocks.transcribe.mock.calls[0];
    expect(blob.size).toBe(2000);
    expect(code).toBe("ta-IN");
    expect(opts).toMatchObject({ filename: "doubt.webm" });
  });

  it("names Safari's mp4 recordings .m4a", async () => {
    mocks.transcribe.mockResolvedValue({ transcript: "hi", languageCode: null });
    await transcribePOST(audioUpload("audio/mp4"));
    expect(mocks.transcribe.mock.calls[0][2]).toMatchObject({ filename: "doubt.m4a" });
  });

  it.each([
    ["anonymous", () => mocks.requireUserId.mockResolvedValue(anon), audioUpload("audio/webm"), 401],
    ["too large", () => {}, audioUpload("audio/webm", 1024 * 1024 + 1), 413],
    ["not audio", () => {}, audioUpload("text/plain"), 415],
    ["bad language", () => {}, audioUpload("audio/webm", 2000, "xx"), 400],
    ["out of doubts", () => mocks.getBudget.mockResolvedValue({ used: 20, limit: 20, remaining: 0, exceeded: true }), audioUpload("audio/webm"), 429],
  ] as const)("refuses %s before calling Sarvam", async (_name, setup, req, code) => {
    setup();
    expect((await transcribePOST(req)).status).toBe(code);
    expect(mocks.transcribe).not.toHaveBeenCalled();
  });

  it("says so when nothing was heard", async () => {
    mocks.transcribe.mockResolvedValue({ transcript: "   ", languageCode: null });
    const res = await transcribePOST(audioUpload("audio/webm"));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/voice/speak", () => {
  const answer = 'root = Answer("Why n", [p])\np = Paragraph("Because we count n values.")';

  it("reads the caller's own answer in its language", async () => {
    mocks.getOwnDoubt.mockResolvedValue({ id: DOUBT, lang: "ta", status: "answered", answer });
    mocks.speak.mockResolvedValue(new Uint8Array([82, 73, 70, 70]));
    const res = await speakPOST(post({ doubtId: DOUBT }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/wav");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));
    expect(mocks.getOwnDoubt).toHaveBeenCalledWith("u1", DOUBT);
    expect(mocks.speak).toHaveBeenCalledWith("Why n. Because we count n values.", "ta-IN", { tag: `tts ${DOUBT}` });
  });

  it("404s someone else's doubt, or a failed one, without calling Bulbul", async () => {
    mocks.getOwnDoubt.mockResolvedValue(null);
    expect((await speakPOST(post({ doubtId: DOUBT }))).status).toBe(404);
    mocks.getOwnDoubt.mockResolvedValue({ id: DOUBT, lang: "ta", status: "failed", answer: null });
    expect((await speakPOST(post({ doubtId: DOUBT }))).status).toBe(404);
    expect(mocks.speak).not.toHaveBeenCalled();
  });

  it("refuses raw text and anonymous callers", async () => {
    expect((await speakPOST(post({ text: "say this" }))).status).toBe(400);
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await speakPOST(post({ doubtId: DOUBT }))).status).toBe(401);
  });
});
