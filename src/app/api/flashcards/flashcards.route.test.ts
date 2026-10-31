import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), reviewCard: vi.fn(), today: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/flashcards/review", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/flashcards/review")>();
  return { RATINGS: real.RATINGS, UnknownCardError: real.UnknownCardError, reviewCard: mocks.reviewCard, today: mocks.today };
});

const { POST } = await import("./review/route");
const { GET } = await import("../today/route");
const { UnknownCardError } = await import("@/lib/flashcards/review");

const LECTURE = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const anon = { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };
const post = (b: unknown) => new Request("http://x", { method: "POST", body: JSON.stringify(b), headers: { "content-type": "application/json" } });
const review = { lectureId: LECTURE, lang: "hi", cardId: "a1b2c3d4e5f60718", rating: "good" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "u1" });
});

describe("POST /api/flashcards/review", () => {
  it("schedules the card for the caller and returns every field", async () => {
    mocks.reviewCard.mockResolvedValue({ cardId: "a1b2c3d4e5f60718", dueAt: new Date("2026-11-04T10:00:00Z"), intervalDays: 3, streak: 2 });
    const res = await POST(post(review));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ cardId: "a1b2c3d4e5f60718", dueAt: "2026-11-04T10:00:00.000Z", intervalDays: 3, streak: 2 });
    expect(mocks.reviewCard).toHaveBeenCalledWith("u1", review);
  });

  it("404s a card that isn't in the lecture's pack", async () => {
    mocks.reviewCard.mockRejectedValue(new UnknownCardError());
    expect((await POST(post(review))).status).toBe(404);
  });

  it.each([
    { ...review, rating: "perfect" },
    { ...review, cardId: "../etc" },
    { ...review, lang: "xx" },
    { ...review, lectureId: "nope" },
  ])("rejects a malformed review %#", async (b) => {
    expect((await POST(post(b))).status).toBe(400);
    expect(mocks.reviewCard).not.toHaveBeenCalled();
  });

  it("needs a user", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await POST(post(review))).status).toBe(401);
  });
});

describe("GET /api/today", () => {
  it("returns due cards, upcoming count, next due time and streak", async () => {
    const due = [{ cardId: "a1b2c3d4e5f60718", lectureId: LECTURE, lang: "hi", front: "f", back: "b", startSec: 55, reviews: 2 }];
    mocks.today.mockResolvedValue({
      due,
      upcoming: 7,
      nextDueAt: new Date("2026-11-02T08:00:00Z"),
      streak: { current: 3, longest: 9, lastActiveDate: "2026-11-01" },
    });
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ due, upcoming: 7, nextDueAt: "2026-11-02T08:00:00.000Z", streak: { current: 3, longest: 9 } });
    expect(mocks.today).toHaveBeenCalledWith("u1");
  });

  it("needs a user", async () => {
    mocks.requireUserId.mockResolvedValue(anon);
    expect((await GET()).status).toBe(401);
  });
});
