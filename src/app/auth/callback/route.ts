import { NextResponse } from "next/server";

import { getSupabase } from "@/lib/auth";

/**
 * OAuth return leg: Supabase redirects here with a one-time `code`, which is
 * exchanged for a session cookie. `next` is only ever a same-site path, so the
 * callback can't be used as an open redirect.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const rawNext = url.searchParams.get("next") ?? "/";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  if (!code) {
    const reason = url.searchParams.get("error_description") ?? "missing code";
    console.error("auth callback without code:", reason);
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(reason)}`, url.origin));
  }

  const { error } = await (await getSupabase()).auth.exchangeCodeForSession(code);
  if (error) {
    console.error("auth code exchange failed:", error.message);
    return NextResponse.redirect(new URL(`/signin?error=${encodeURIComponent(error.message)}`, url.origin));
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
