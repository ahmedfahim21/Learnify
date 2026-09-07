import { redirect } from "next/navigation";

import { configuredProviders, isAuthConfigured } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/session";
import { SignInButtons } from "@/components/auth/SignInButtons";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUserId()) redirect(next ?? "/concepts");

  const providers = isAuthConfigured() ? configuredProviders() : [];

  return (
    <main className="wrap-prose flex min-h-[70vh] flex-col justify-center gap-6 py-16">
      <div className="space-y-3">
        <p className="label">Sign in</p>
        <h1 className="text-3xl">Keep your progress</h1>
        <p className="text-(--color-mist)">
          Reading is open to everyone — no account needed. Signing in is what lets Learnify
          remember which chapters you have finished, track what you have mastered, and schedule
          the concepts that got shaky for review.
        </p>
      </div>

      {providers.length > 0 ? (
        <SignInButtons providers={providers} next={next ?? "/concepts"} />
      ) : (
        // Dead UI is worse than absent UI: with no credentials configured the
        // buttons could only fail, so say why instead of rendering them.
        <div className="space-y-2 border border-(--color-warn)/30 bg-(--color-warn)/[0.06] p-4">
          <p className="label">Not configured</p>
          <p className="text-sm text-(--color-mist)">
            Auth isn&apos;t configured on this deployment yet. Set{" "}
            <code>NEON_AUTH_BASE_URL</code> and <code>NEON_AUTH_COOKIE_SECRET</code> from the
            Neon Console&apos;s Auth tab, then restart.
          </p>
        </div>
      )}
    </main>
  );
}
