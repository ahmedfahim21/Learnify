import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LectureStatus } from "@/lib/jobs/prepare";
import type { StudyPack } from "@/lib/study/pack";

/**
 * Lecture routes. What matters: input is validated before Postgres sees it,
 * starting paid work needs a user and respects the daily cap, polling a
 * lecture that's ready or in progress stays open to everyone, the answer key
 * never reaches the browser, and grading releases only what's been earned.
 */
const mocks = vi.hoisted(() => ({
  getLecture: vi.fn(),
  getStoredTranscript: vi.fn(),
  getStoredPack: vi.fn(),
  lectureStatus: vi.fn(),
  runStages: vi.fn(),
  stagesStartedToday: vi.fn(),
  getCurrentUserId: vi.fn(),
  touchStreak: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/transcripts/store", () => ({
  dbDeps: { getLecture: mocks.getLecture, getStored: mocks.getStoredTranscript },
}));
vi.mock("@/lib/study/store", () => ({ dbPackDeps: { getStored: mocks.getStoredPack } }));
vi.mock("@/lib/jobs/prepare", async (importOriginal) => ({
  stagesFor: (await importOriginal<typeof import("@/lib/jobs/prepare")>()).stagesFor,
  lectureStatus: mocks.lectureStatus,
  runStages: mocks.runStages,
}));
vi.mock("@/lib/jobs/claim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/claim")>()),
  stagesStartedToday: mocks.stagesStartedToday,
}));
vi.mock("@/lib/session", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/streaks", () => ({ touchStreak: mocks.touchStreak }));

const { GET: viewGET } = await import("./[lectureId]/route");
const { POST: preparePOST } = await import("./[lectureId]/prepare/route");
const { POST: answerPOST } = await import("../checkpoints/answer/route");

const ID = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const lecture = {
  id: ID,
  courseId: 111106146,
  position: 0,
  nptelLessonId: 1,
  unitName: "Week 1",
  title: "The Real line - Part 1",
  youtubeId: "suv-iQnlETc",
  conceptsCovered: null,
  vttRefs: { English: "drive-secret-ref" },
  createdAt: new Date(0),
};
const segments = [{ i: 0, startSec: 1, endSec: 4, text: "Hello." }];
const pack: StudyPack = {
  concepts: [{ id: "c1", title: "Real line", summary: "s", startSec: 1, endSec: 3, prereqIds: [] }],
  checkpoints: [
    { id: "k1", atSec: 120, conceptId: "c1", question: "q?", options: ["a", "b", "c", "d"], answerIndex: 2, explanation: "because c", replayFrom: 40, replayTo: 90 },
  ],
  flashcards: [],
  recap: { summary: "r", keyPoints: [] },
};
const statusOf = (ready: boolean, state: "ready" | "pending" | "running" = ready ? "ready" : "pending"): LectureStatus => ({
  lang: "ta",
  ready,
  stages: [
    { lang: "en", stage: "transcript", state: ready ? "ready" : state } as never,
    { lang: "ta", stage: "transcript", state: ready ? "ready" : state } as never,
  ],
});
const ctx = (lectureId = ID) => ({ params: Promise.resolve({ lectureId }) });
const req = (lang = "ta", method = "GET") => new Request(`http://x/api/lectures/${ID}?lang=${lang}`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLecture.mockResolvedValue(lecture);
  mocks.lectureStatus.mockResolvedValue(statusOf(true));
  mocks.getStoredTranscript.mockImplementation(async (_id: string, lang: string) => ({
    lang,
    source: lang === "en" ? "youtube" : "sarvam",
    durationSec: 4,
    segments: segments.map((s) => ({ ...s, text: `${lang}:${s.text}` })),
  }));
  mocks.getStoredPack.mockResolvedValue({ payload: pack });
  mocks.stagesStartedToday.mockResolvedValue(0);
  mocks.getCurrentUserId.mockResolvedValue("user-1");
  mocks.runStages.mockResolvedValue({ built: [], stoppedAt: null });
});

describe("GET /api/lectures/[lectureId]", () => {
  it("returns the lecture, the English transcript only, and the pack without answer keys", async () => {
    const res = await viewGET(req("ta"), ctx());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      lecture: { id: ID, courseId: 111106146, position: 0, unitName: "Week 1", title: "The Real line - Part 1", youtubeId: "suv-iQnlETc" },
      status: statusOf(true),
      subtitles: {
        en: { lang: "en", source: "youtube", durationSec: 4, segments: [{ i: 0, startSec: 1, endSec: 4, text: "en:Hello." }] },
      },
      pack: {
        ...pack,
        checkpoints: [{ id: "k1", atSec: 120, conceptId: "c1", question: "q?", options: ["a", "b", "c", "d"], replayFrom: 40, replayTo: 90 }],
      },
    });
    const raw = JSON.stringify(body);
    expect(raw).not.toMatch(/answerIndex|because c|drive-secret-ref/);
  });

  it("is edge-cacheable only once fully ready", async () => {
    expect((await viewGET(req(), ctx())).headers.get("cache-control")).toMatch(/s-maxage=3600/);
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    expect((await viewGET(req(), ctx())).headers.get("cache-control")).toBe("no-store");
  });

  it("returns nulls for what isn't built yet", async () => {
    mocks.getStoredTranscript.mockResolvedValue(null);
    mocks.getStoredPack.mockResolvedValue(null);
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    const body = await (await viewGET(req(), ctx())).json();
    expect(body.subtitles).toEqual({ en: null });
    expect(body.pack).toBeNull();
  });

  it.each([
    ["not-a-uuid", "ta", 400],
    [ID, "xx", 400],
  ])("rejects lecture %s lang %s with %s before querying", async (id, lang, code) => {
    const res = await viewGET(new Request(`http://x?lang=${lang}`), ctx(id));
    expect(res.status).toBe(code);
    expect(mocks.getLecture).not.toHaveBeenCalled();
  });

  it("404s an unknown lecture", async () => {
    mocks.getLecture.mockResolvedValue(null);
    expect((await viewGET(req(), ctx())).status).toBe(404);
  });
});

describe("POST /api/lectures/[lectureId]/prepare", () => {
  it("does nothing for a ready lecture, signed in or not", async () => {
    mocks.getCurrentUserId.mockResolvedValue(null);
    const res = await preparePOST(req("ta", "POST"), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: statusOf(true) });
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("starts new work for a signed-in user and schedules it after the response", async () => {
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    const res = await preparePOST(req("ta", "POST"), ctx());
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ status: statusOf(false) });
    expect(mocks.after).toHaveBeenCalledTimes(1);
    await mocks.after.mock.calls[0][0]();
    expect(mocks.runStages).toHaveBeenCalledWith(ID, "ta", undefined, "full");
  });

  it("refuses to start new work anonymously", async () => {
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    mocks.getCurrentUserId.mockResolvedValue(null);
    const res = await preparePOST(req("ta", "POST"), ctx());
    expect(res.status).toBe(401);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("lets anyone poll a lecture that's already being built", async () => {
    mocks.lectureStatus.mockResolvedValue(statusOf(false, "running"));
    mocks.getCurrentUserId.mockResolvedValue(null);
    const res = await preparePOST(req("ta", "POST"), ctx());
    expect(res.status).toBe(202);
    expect(mocks.after).toHaveBeenCalledTimes(1);
  });

  it("refuses new lectures once today's global cap is spent", async () => {
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    mocks.stagesStartedToday.mockResolvedValue(300);
    const res = await preparePOST(req("ta", "POST"), ctx());
    expect(res.status).toBe(429);
    expect(mocks.after).not.toHaveBeenCalled();
  });

  it("refuses a lecture with no video", async () => {
    mocks.getLecture.mockResolvedValue({ ...lecture, youtubeId: null });
    expect((await preparePOST(req("ta", "POST"), ctx())).status).toBe(422);
  });

  it("logs a crash in the background run instead of losing it", async () => {
    mocks.lectureStatus.mockResolvedValue(statusOf(false));
    mocks.runStages.mockRejectedValue(new Error("db gone"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await preparePOST(req("ta", "POST"), ctx());
    await mocks.after.mock.calls[0][0]();
    expect(spy).toHaveBeenCalledWith(`prepare ${ID}/ta crashed:`, expect.any(Error));
    spy.mockRestore();
  });
});

describe("POST /api/checkpoints/answer", () => {
  const answer = (b: unknown) =>
    answerPOST(new Request("http://x", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } }));
  const base = { lectureId: ID, lang: "ta", checkpointId: "k1" };

  it("grades a right answer with the explanation but not the key", async () => {
    const res = await answer({ ...base, choice: 2, attempt: 1 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ correct: true, replayFrom: 40, replayTo: 90, explanation: "because c", answerIndex: null });
    expect(mocks.getStoredPack).toHaveBeenCalledWith(ID, "ta");
  });

  it("gives a first wrong answer only the replay", async () => {
    expect(await (await answer({ ...base, choice: 0, attempt: 1 })).json()).toEqual({
      correct: false,
      replayFrom: 40,
      replayTo: 90,
      explanation: null,
      answerIndex: null,
    });
  });

  it("counts a signed-in student's answer toward their streak", async () => {
    await answer({ ...base, choice: 2, attempt: 1 });
    expect(mocks.touchStreak).toHaveBeenCalledWith("user-1");
  });

  it("grades an anonymous answer without touching any streak", async () => {
    mocks.getCurrentUserId.mockResolvedValue(null);
    expect((await answer({ ...base, choice: 2, attempt: 1 })).status).toBe(200);
    expect(mocks.touchStreak).not.toHaveBeenCalled();
  });

  it("reveals the answer after the second wrong try", async () => {
    expect(await (await answer({ ...base, choice: 0, attempt: 2 })).json()).toMatchObject({ explanation: "because c", answerIndex: 2 });
  });

  it.each([
    { ...base, choice: 4, attempt: 1 },
    { ...base, choice: 1, attempt: 0 },
    { ...base, lang: "xx", choice: 1, attempt: 1 },
    { ...base, lectureId: "nope", choice: 1, attempt: 1 },
  ])("rejects a malformed answer %#", async (b) => {
    expect((await answer(b)).status).toBe(400);
    expect(mocks.getStoredPack).not.toHaveBeenCalled();
  });

  it("404s an unknown check or a lecture without a pack", async () => {
    expect((await answer({ ...base, checkpointId: "zz", choice: 1, attempt: 1 })).status).toBe(404);
    mocks.getStoredPack.mockResolvedValue(null);
    expect((await answer({ ...base, choice: 1, attempt: 1 })).status).toBe(404);
  });

  it("rejects a non-JSON body", async () => {
    expect((await answerPOST(new Request("http://x", { method: "POST", body: "nope" }))).status).toBe(400);
  });
});
