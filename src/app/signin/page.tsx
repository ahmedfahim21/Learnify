import { redirect } from "next/navigation";

import { configuredProviders } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/session";
import { SignInButtons } from "@/components/auth/SignInButtons";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  if (await getCurrentUserId()) redirect(next ?? "/courses");

  const providers = configuredProviders();

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
        <SignInButtons providers={providers} next={next ?? "/courses"} />
      ) : (
        // Dead UI is worse than absent UI: with no credentials configured the
        // buttons could only fail, so say why instead of rendering them.
        <div className="space-y-2 border border-(--color-mango)/30 bg-(--color-mango)/[0.06] p-4">
          <p className="label">Not configured</p>
          <p className="text-sm text-(--color-mist)">
            No OAuth provider is set up on this deployment yet. Add{" "}
            <code>GOOGLE_CLIENT_ID</code>/<code>GOOGLE_CLIENT_SECRET</code> or{" "}
            <code>GITHUB_CLIENT_ID</code>/<code>GITHUB_CLIENT_SECRET</code> to the environment
            and restart.
          </p>
        </div>
      )}
    </main>
  );
}
