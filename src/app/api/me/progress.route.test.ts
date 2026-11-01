import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A student's study record is theirs alone: every write is caller-scoped and
 * validated whole, and a signed-out request reads and writes nothing.
 */
const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), recordQuiz: vi.fn(), recordActivity: vi.fn(), bestScores: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/progress", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/progress")>()),
  recordQuiz: mocks.recordQuiz,
  recordActivity: mocks.recordActivity,
  bestScores: mocks.bestScores,
}));

const { POST: attemptPOST } = await import("./quiz-attempts/route");
const { POST: activityPOST } = await import("./activity/route");
const { GET: bestGET } = await import("./best-scores/route");

const LECTURE = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const OTHER = "25042c56-b734-4ac9-8531-d135b8bdcc3c";
const anon = { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
const post = (body: unknown) => new Request("http://x", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) });
const ATTEMPT = { lectureId: LECTURE, lang: "ta", variant: "standard", score: 7, total: 10, points: 85, bestStreak: 4 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "u1" });
  mocks.recordQuiz.mockImplementation(async (_u: string, a: object) => ({ attempt: { id: "a1", createdAt: "2026-11-01T06:00:00.000Z", ...a }, streak: 3 }));
  mocks.recordActivity.mockResolvedValue({ streak: 3 });
});

describe("POST /api/me/quiz-attempts", () => {
  it("stores the caller's finished quiz, every field, and returns it with the streak", async () => {
    const res = await attemptPOST(post(ATTEMPT));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      attempt: { id: "a1", createdAt: "2026-11-01T06:00:00.000Z", lectureId: LECTURE, lang: "ta", variant: "standard", score: 7, total: 10, points: 85, bestStreak: 4 },
      streak: 3,
    });
    expect(mocks.recordQuiz).toHaveBeenCalledTimes(1);
    expect(mocks.recordQuiz).toHaveBeenCalledWith("u1", ATTEMPT);
  });

  it.each([
    [{ ...ATTEMPT, score: 11 }, "score: score can't exceed total"],
    [{ ...ATTEMPT, bestStreak: 8 }, "bestStreak: bestStreak can't exceed score"],
    [{ ...ATTEMPT, total: 0 }, "total:"],
    [{ ...ATTEMPT, total: 21, score: 1 }, "total:"],
    [{ ...ATTEMPT, score: 2.5 }, "score:"],
    [{ ...ATTEMPT, points: -1 }, "points:"],
    [{ ...ATTEMPT, lang: "fr" }, "lang: Unsupported language."],
    [{ ...ATTEMPT, variant: "expert" }, "variant:"],
    [{ ...ATTEMPT, lectureId: "nope" }, "lectureId:"],
    [{ lectureId: LECTURE, lang: "ta", score: 7, total: 10, points: 85, bestStreak: 4 }, "variant:"],
    [{ ...ATTEMPT, userId: "someone-else" }, "Unrecognized key"],
  ])("refuses %j and stores nothing", async (body, message) => {
    const res = await attemptPOST(post(body));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(message);
    expect(mocks.recordQuiz).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON", async () => {
    expect((await attemptPOST(post("nope"))).status).toBe(400);
    expect(mocks.recordQuiz).not.toHaveBeenCalled();
  });

  it("rejects an anonymous result and stores nothing", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await attemptPOST(post(ATTEMPT))).status).toBe(401);
    expect(mocks.recordQuiz).not.toHaveBeenCalled();
  });
});

describe("POST /api/me/activity", () => {
  it("counts finishing a lecture's notes toward the caller's streak", async () => {
    const res = await activityPOST(post({ kind: "notes", lectureId: LECTURE }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ streak: 3 });
    expect(mocks.recordActivity).toHaveBeenCalledWith("u1");
  });

  it.each([{ kind: "videos", lectureId: LECTURE }, { kind: "notes", lectureId: "nope" }, { kind: "notes" }])("refuses %j", async (body) => {
    expect((await activityPOST(post(body))).status).toBe(400);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });

  it("rejects an anonymous call", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await activityPOST(post({ kind: "notes", lectureId: LECTURE }))).status).toBe(401);
    expect(mocks.recordActivity).not.toHaveBeenCalled();
  });
});

describe("GET /api/me/best-scores", () => {
  it("returns the caller's best score per lecture, uncached", async () => {
    mocks.bestScores.mockResolvedValue({ [LECTURE]: { score: 9, total: 10 } });
    const res = await bestGET(new Request(`http://x?lectureIds=${LECTURE},${OTHER}`));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ best: { [LECTURE]: { score: 9, total: 10 } } });
    expect(mocks.bestScores).toHaveBeenCalledWith("u1", [LECTURE, OTHER]);
  });

  it.each(["", "lectureIds=", "lectureIds=nope"])("refuses %s", async (qs) => {
    expect((await bestGET(new Request(`http://x?${qs}`))).status).toBe(400);
    expect(mocks.bestScores).not.toHaveBeenCalled();
  });

  it("rejects an anonymous call", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await bestGET(new Request(`http://x?lectureIds=${LECTURE}`))).status).toBe(401);
    expect(mocks.bestScores).not.toHaveBeenCalled();
  });
});

describe("pickBest", () => {
  it("keeps the highest score per lecture, preferring the longer quiz on a tie", async () => {
    const { pickBest } = await import("@/lib/progress");
    expect(
      pickBest([
        { lectureId: "a", score: 5, total: 10 },
        { lectureId: "a", score: 9, total: 10 },
        { lectureId: "a", score: 8, total: 10 },
        { lectureId: "b", score: 4, total: 8 },
        { lectureId: "b", score: 5, total: 10 },
      ]),
    ).toEqual({ a: { score: 9, total: 10 }, b: { score: 5, total: 10 } });
  });
});
