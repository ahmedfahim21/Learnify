import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Preferences decide what gets generated for a student, so they are
 * caller-scoped and validated whole: a signed-out request reads and writes
 * nothing, and a bad field is refused rather than stored.
 */
const mocks = vi.hoisted(() => ({ requireUserId: vi.fn(), get: vi.fn(), put: vi.fn() }));

vi.mock("@/lib/session", () => ({ requireUserId: mocks.requireUserId }));
vi.mock("@/lib/preferencesStore", () => ({ dbPreferences: { get: mocks.get, put: mocks.put } }));

const { GET, PUT } = await import("./route");

const PREFS = { lang: "ta", goal: "practise", level: "simpler", checks: false };
const put = (body: unknown) => PUT(new Request("http://x", { method: "PUT", body: typeof body === "string" ? body : JSON.stringify(body) }));
const anonymous = { response: Response.json({ error: "Sign in to continue." }, { status: 401 }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireUserId.mockResolvedValue({ userId: "u1" });
  mocks.put.mockImplementation(async (_id: string, p: unknown) => p);
});

describe("GET /api/me/preferences", () => {
  it("returns the caller's own preferences, every field", async () => {
    mocks.get.mockResolvedValue(PREFS);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ lang: "ta", goal: "practise", level: "simpler", checks: false });
    expect(mocks.get).toHaveBeenCalledWith("u1");
  });

  it("says 404 before the student has chosen any", async () => {
    mocks.get.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "No preferences yet." });
  });

  it("rejects an anonymous request and reads nothing", async () => {
    mocks.requireUserId.mockResolvedValue(anonymous);

    expect((await GET()).status).toBe(401);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("PUT /api/me/preferences", () => {
  it("stores and returns exactly what was sent, for the caller only", async () => {
    const res = await put(PREFS);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(PREFS);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledWith("u1", PREFS);
  });

  it("replaces a previous choice: only the changed field differs", async () => {
    const before = { ...PREFS };
    const after = { ...PREFS, level: "harder" };

    await put(after);

    const stored = mocks.put.mock.calls[0][1];
    expect(stored).toEqual(after);
    expect(Object.keys(stored).filter((k) => stored[k] !== before[k as keyof typeof before])).toEqual(["level"]);
  });

  it.each([
    [{ ...PREFS, lang: "fr" }, "lang: Unsupported language."],
    [{ ...PREFS, goal: "cram" }, "goal:"],
    [{ ...PREFS, level: "expert" }, "level:"],
    [{ ...PREFS, checks: "yes" }, "checks:"],
    [{ lang: "ta", goal: "practise", level: "simpler" }, "checks:"],
    [{ ...PREFS, isAdmin: true }, "Unrecognized key"],
  ])("refuses %j and stores nothing", async (body, message) => {
    const res = await put(body);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain(message);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("refuses a body that isn't JSON", async () => {
    const res = await put("not json");

    expect(res.status).toBe(400);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it("rejects an anonymous write and stores nothing", async () => {
    mocks.requireUserId.mockResolvedValue(anonymous);

    expect((await put(PREFS)).status).toBe(401);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
