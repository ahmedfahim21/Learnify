import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

/** Better Auth owns every /api/auth/* route: OAuth start, callback, session,
 *  sign-out. The handler is resolved per-request so the auth instance (and its
 *  database connection) is never constructed at build time. */
export async function GET(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return toNextJsHandler(getAuth()).POST(request);
}
