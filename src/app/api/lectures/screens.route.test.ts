import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  consumeDoubt: vi.fn(),
  getScreen: vi.fn(),
  prepareScreen: vi.fn(),
  generateScreen: vi.fn(),
}));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/budget", () => ({ consumeDoubt: mocks.consumeDoubt, refundDoubt: vi.fn() }));
vi.mock("@/lib/screens/generate", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/screens/generate")>();
  return { ScreenNotReadyError: real.ScreenNotReadyError, getScreen: mocks.getScreen, prepareScreen: mocks.prepareScreen, generateScreen: mocks.generateScreen };
});

const { GET, POST } = await import("./[lectureId]/screens/[kind]/route");
const { ScreenNotReadyError } = await import("@/lib/screens/generate");

const ID = "325080ef-3145-4eba-8ecd-ee35980d3c78";
const ctx = (kind = "quiz", lectureId = ID) => ({ params: Promise.resolve({ lectureId, kind }) });
const req = (qs = "lang=hi", method = "GET") => new Request(`http://x?${qs}`, { method });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "u1" });
  mocks.prepareScreen.mockResolvedValue([{ role: "system", content: "s" }]);
  mocks.consumeDoubt.mockResolvedValue({ allowed: true, state: { used: 1, limit: 20, remaining: 19, exceeded: false } });
  mocks.generateScreen.mockImplementation(async function* () {
    yield { type: "delta", text: "root = Screen(" };
    yield { type: "done", screenId: "s1" };
  });
});

describe("GET screen", () => {
  it("returns a stored screen to anyone", async () => {
    mocks.getScreen.mockResolvedValue({ id: "s1", program: "root = Screen()", createdAt: "2026-11-01T00:00:00.000Z" });
    const res = await GET(req("lang=hi&variant=harder"), ctx("notes"));
    expect(await res.json()).toEqual({ screenId: "s1", program: "root = Screen()", createdAt: "2026-11-01T00:00:00.000Z" });
    expect(mocks.getScreen).toHaveBeenCalledWith(ID, "hi", "notes", "harder");
  });

  it("404s one not generated yet, and unknown kinds", async () => {
    mocks.getScreen.mockResolvedValue(null);
    expect((await GET(req(), ctx())).status).toBe(404);
    expect((await GET(req(), ctx("essay"))).status).toBe(404);
  });

  it("400s a bad language, style or lecture id", async () => {
    expect((await GET(req("lang=xx"), ctx())).status).toBe(400);
    expect((await GET(req("lang=hi&variant=weird"), ctx())).status).toBe(400);
    expect((await GET(req(), ctx("quiz", "nope"))).status).toBe(400);
  });
});

describe("POST screen", () => {
  it("streams generation events and charges one generation", async () => {
    const res = await POST(req("lang=hi&variant=simpler", "POST"), ctx());
    expect(res.headers.get("x-generations-remaining")).toBe("19");
    expect((await res.text()).trim().split("\n").map((l) => JSON.parse(l))).toEqual([
      { type: "delta", text: "root = Screen(" },
      { type: "done", screenId: "s1" },
    ]);
    expect(mocks.generateScreen).toHaveBeenCalledWith(
      { userId: "u1", lectureId: ID, lang: "hi", kind: "quiz", variant: "simpler" },
      [{ role: "system", content: "s" }],
    );
  });

  it("needs a user", async () => {
    mocks.requireUserId.mockResolvedValue({ response: Response.json({}, { status: 401 }) });
    expect((await POST(req("lang=hi", "POST"), ctx())).status).toBe(401);
    expect(mocks.consumeDoubt).not.toHaveBeenCalled();
  });

  it("charges nothing when the transcript isn't ready", async () => {
    mocks.prepareScreen.mockRejectedValue(new ScreenNotReadyError());
    expect((await POST(req("lang=hi", "POST"), ctx())).status).toBe(409);
    expect(mocks.consumeDoubt).not.toHaveBeenCalled();
  });

  it("refuses once today's generations are spent", async () => {
    mocks.consumeDoubt.mockResolvedValue({ allowed: false, state: { used: 20, limit: 20, remaining: 0, exceeded: true } });
    const res = await POST(req("lang=hi", "POST"), ctx());
    expect(res.status).toBe(429);
    expect(mocks.generateScreen).not.toHaveBeenCalled();
  });
});
