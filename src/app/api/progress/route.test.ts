import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level tests for the progress API: the auth gate, input validation
 * against authored content, and the exact rows the route writes.
 *
 * `requireUserId` and the progress data layer are mocked so this exercises the
 * HTTP contract — status codes, bodies, and what the handler asks the data
 * layer to do — without needing a database.
 */

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  markChapterComplete: vi.fn(),
  getCourseProgress: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/progress", () => ({
  markChapterComplete: mocks.markChapterComplete,
  getCourseProgress: mocks.getCourseProgress,
}));

const { GET, POST } = await import("./route");

const post = (body: unknown) =>
  new Request("http://localhost/api/progress", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "user-1" });
  mocks.markChapterComplete.mockResolvedValue(undefined);
});

describe("POST /api/progress", () => {
  it("records the chapter and returns 201", async () => {
    const res = await POST(post({ problemSlug: "url-shortener", phase: "estimation" }));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(mocks.markChapterComplete).toHaveBeenCalledTimes(1);
    expect(mocks.markChapterComplete).toHaveBeenCalledWith("user-1", "url-shortener", "estimation");
  });

  it("rejects an anonymous request with 401 and writes nothing", async () => {
    const unauthorized = Response.json({ error: "Sign in to continue." }, { status: 401 });
    mocks.requireUserId.mockResolvedValue({ response: unauthorized });

    const res = await POST(post({ problemSlug: "url-shortener", phase: "estimation" }));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in to continue." });
    expect(mocks.markChapterComplete).not.toHaveBeenCalled();
  });

  it("rejects a course that isn't in the authored catalog", async () => {
    const res = await POST(post({ problemSlug: "not-a-course", phase: "estimation" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown course" });
    expect(mocks.markChapterComplete).not.toHaveBeenCalled();
  });

  it("rejects a phase that isn't one of the design stages", async () => {
    const res = await POST(post({ problemSlug: "url-shortener", phase: "conclusion" }));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unknown chapter phase" });
    expect(mocks.markChapterComplete).not.toHaveBeenCalled();
  });

  it("rejects a malformed body rather than throwing", async () => {
    const res = await POST(
      new Request("http://localhost/api/progress", { method: "POST", body: "not json" }),
    );

    expect(res.status).toBe(400);
    expect(mocks.markChapterComplete).not.toHaveBeenCalled();
  });

  it("does not let the client choose whose progress is written", async () => {
    // A userId in the body must be ignored — it comes from the session only.
    await POST(post({ problemSlug: "url-shortener", phase: "api", userId: "someone-else" }));

    expect(mocks.markChapterComplete).toHaveBeenCalledWith("user-1", "url-shortener", "api");
  });
});

describe("GET /api/progress", () => {
  it("returns the caller's progress summary", async () => {
    const progress = [
      { problemSlug: "url-shortener", completedPhases: ["requirements"], totalChapters: 7, fraction: 1 / 7 },
    ];
    mocks.getCourseProgress.mockResolvedValue(progress);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ progress });
    expect(mocks.getCourseProgress).toHaveBeenCalledWith("user-1");
  });

  it("rejects an anonymous read with 401", async () => {
    mocks.requireUserId.mockResolvedValue({
      response: Response.json({ error: "Sign in to continue." }, { status: 401 }),
    });

    expect((await GET()).status).toBe(401);
    expect(mocks.getCourseProgress).not.toHaveBeenCalled();
  });
});
