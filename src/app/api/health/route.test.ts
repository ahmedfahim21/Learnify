import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The health check is public, so it must say what's missing without saying
 * anything secret: booleans for settings, and an error code, never a message.
 */
const mocks = vi.hoisted(() => ({ execute: vi.fn(), isAuthConfigured: vi.fn() }));

vi.mock("@/db", () => ({ getDb: () => ({ execute: mocks.execute }) }));
vi.mock("@/lib/auth", () => ({ isAuthConfigured: mocks.isAuthConfigured }));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("DATABASE_URL", "postgresql://user:secret@db.example.supabase.com:6543/postgres");
  vi.stubEnv("SARVAM_API_KEY", "sk-secret");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://learnify.example");
  mocks.isAuthConfigured.mockReturnValue(true);
  mocks.execute.mockResolvedValue([]);
});

describe("GET /api/health", () => {
  it("reports a healthy deployment, every field", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      configured: { database: true, auth: true, sarvam: true, siteUrl: true },
      database: { ok: true },
    });
  });

  it("names the failing database's error code and nothing else", async () => {
    mocks.execute.mockRejectedValue(
      Object.assign(new Error("getaddrinfo ENOTFOUND db.example.supabase.com password=secret"), { code: "ENOTFOUND" }),
    );

    const res = await GET();
    const text = await res.text();

    expect(res.status).toBe(503);
    expect(JSON.parse(text)).toEqual({
      ok: false,
      configured: { database: true, auth: true, sarvam: true, siteUrl: true },
      database: { ok: false, code: "ENOTFOUND" },
    });
    expect(text).not.toContain("secret");
    expect(text).not.toContain("supabase.com");
  });

  it("reads a code nested in the error's cause", async () => {
    mocks.execute.mockRejectedValue(Object.assign(new Error("Failed query"), { cause: { code: "42P01" } }));

    expect((await (await GET()).json()).database).toEqual({ ok: false, code: "42P01" });
  });

  it("shows a missing setting as false without a value", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("SARVAM_API_KEY", "");
    mocks.isAuthConfigured.mockReturnValue(false);
    mocks.execute.mockRejectedValue(new Error("DATABASE_URL is not set."));

    const body = await (await GET()).json();

    expect(body.ok).toBe(false);
    expect(body.configured).toEqual({ database: false, auth: false, sarvam: false, siteUrl: true });
    expect(body.database).toEqual({ ok: false, code: "Error" });
  });
});
