import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Preparing a lecture is what spends Sarvam calls, so the scope decides what a
 * request may start: opening a lecture asks only for the free caption fetch;
 * the study pack waits until a student asks for checks, flashcards or the map.
 */
const mocks = vi.hoisted(() => ({
  getLecture: vi.fn(),
  lectureStatus: vi.fn(),
  runStages: vi.fn(),
  getCurrentUserId: vi.fn(),
  stagesStartedToday: vi.fn(),
  after: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/transcripts/store", () => ({ dbDeps: { getLecture: mocks.getLecture } }));
vi.mock("@/lib/session", () => ({ getCurrentUserId: mocks.getCurrentUserId }));
vi.mock("@/lib/jobs/claim", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/jobs/claim")>()),
  stagesStartedToday: mocks.stagesStartedToday,
}));
vi.mock("@/lib/jobs/prepare", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/jobs/prepare")>();
  return { stagesFor: real.stagesFor, lectureStatus: mocks.lectureStatus, runStages: mocks.runStages };
});

const { POST } = await import("./[lectureId]/prepare/route");

const ID = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const ctx = { params: Promise.resolve({ lectureId: ID }) };
const post = (qs: string) => POST(new Request(`http://x?${qs}`, { method: "POST" }), ctx);

const transcriptReady = {
  lang: "ta",
  ready: false,
  stages: [
    { lang: "en", stage: "transcript", state: "ready" },
    { lang: "en", stage: "pack", state: "pending" },
    { lang: "ta", stage: "pack", state: "pending" },
  ],
};
const nothingYet = {
  lang: "ta",
  ready: false,
  stages: transcriptReady.stages.map((s) => ({ ...s, state: "pending" })),
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getLecture.mockResolvedValue({ id: ID, youtubeId: "yt1" });
  mocks.getCurrentUserId.mockResolvedValue("u1");
  mocks.stagesStartedToday.mockResolvedValue(0);
  mocks.runStages.mockResolvedValue({ built: [], stoppedAt: null });
  // Run the background work inline so the test can see what was started.
  mocks.after.mockImplementation((fn: () => Promise<void>) => fn());
});

describe("POST /api/lectures/[id]/prepare", () => {
  it("treats a lecture with its transcript as done for the transcript scope, starting nothing", async () => {
    mocks.lectureStatus.mockResolvedValue(transcriptReady);

    const res = await post("lang=ta&scope=transcript");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: transcriptReady });
    expect(mocks.runStages).not.toHaveBeenCalled();
  });

  it("fetches only the transcript when that is all that's asked for", async () => {
    mocks.lectureStatus.mockResolvedValue(nothingYet);

    const res = await post("lang=ta&scope=transcript");

    expect(res.status).toBe(202);
    expect(mocks.runStages).toHaveBeenCalledWith(ID, "ta", undefined, "transcript");
  });

  it("builds the study pack only for the full scope, which is the default", async () => {
    mocks.lectureStatus.mockResolvedValue(transcriptReady);

    const res = await post("lang=ta");

    expect(res.status).toBe(202);
    expect(mocks.runStages).toHaveBeenCalledWith(ID, "ta", undefined, "full");
  });

  it("rejects an unknown scope before reading anything", async () => {
    const res = await post("lang=ta&scope=everything");

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "scope must be transcript or full." });
    expect(mocks.getLecture).not.toHaveBeenCalled();
    expect(mocks.runStages).not.toHaveBeenCalled();
  });

  it("asks a signed-out visitor to sign in instead of starting work", async () => {
    mocks.lectureStatus.mockResolvedValue(nothingYet);
    mocks.getCurrentUserId.mockResolvedValue(null);

    const res = await post("lang=ta&scope=transcript");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to prepare this lecture.", status: nothingYet });
    expect(mocks.runStages).not.toHaveBeenCalled();
  });
});
