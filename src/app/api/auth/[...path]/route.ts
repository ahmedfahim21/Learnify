import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * Proxies /api/auth/* to the Neon-hosted auth server, attaching the signed
 * session cookie. Neon runs the actual auth service; this route only bridges
 * the browser to it.
 *
 * The handler is resolved per request rather than at module load so the
 * cookie secret isn't required to build.
 */
// The SDK's handler reads `params.path`, so the catch-all segment has to be
// named [...path] — naming it [...all] makes it read undefined and throw.
type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return getAuth().handler().GET(request, context);
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return getAuth().handler().POST(request, context);
}

export async function PUT(request: Request, context: RouteContext): Promise<Response> {
  return getAuth().handler().PUT(request, context);
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return getAuth().handler().DELETE(request, context);
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return getAuth().handler().PATCH(request, context);
}
