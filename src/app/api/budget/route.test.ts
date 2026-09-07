import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The budget endpoint is what the classroom reads to warn someone before they
 * run out, so it has to be caller-scoped: a signed-out request must not get a
 * number, and a signed-in one must only ever get its own.
 */
const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), getBudget: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/budget", () => ({ getBudget: mocks.getBudget }));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "user-1" });
});

describe("GET /api/budget", () => {
  it("returns the caller's own budget", async () => {
    const state = { used: 4, limit: 30, remaining: 26, exceeded: false };
    mocks.getBudget.mockResolvedValue(state);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(state);
    expect(mocks.getBudget).toHaveBeenCalledWith("user-1");
  });

  it("reports an exhausted budget without erroring", async () => {
    mocks.getBudget.mockResolvedValue({ used: 30, limit: 30, remaining: 0, exceeded: true });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ remaining: 0, exceeded: true });
  });

  it("rejects an anonymous request and reads nothing", async () => {
    mocks.requireUserId.mockResolvedValue({
      response: Response.json({ error: "Sign in to continue." }, { status: 401 }),
    });

    expect((await GET()).status).toBe(401);
    expect(mocks.getBudget).not.toHaveBeenCalled();
  });
});
