import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isAuthConfigured } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * What a deployment is missing, without revealing anything: which settings
 * are present (true/false only) and, when the database can't be queried, the
 * error's code (ENOTFOUND, ECONNREFUSED, 28P01 bad password, 42P01 missing
 * table…) rather than its message, which can carry host names.
 */
export async function GET(): Promise<Response> {
  const configured = {
    database: Boolean(process.env.DATABASE_URL),
    auth: isAuthConfigured(),
    sarvam: Boolean(process.env.SARVAM_API_KEY),
    siteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  };
  let database: { ok: true } | { ok: false; code: string };
  try {
    await getDb().execute(sql`select 1 from courses limit 1`);
    database = { ok: true };
  } catch (err) {
    console.error("health: database check failed:", err);
    const e = err as { code?: unknown; cause?: { code?: unknown }; name?: unknown };
    database = { ok: false, code: String(e.code ?? e.cause?.code ?? e.name ?? "unknown") };
  }
  const ok = database.ok && configured.auth && configured.sarvam;
  return Response.json({ ok, configured, database }, { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } });
}
