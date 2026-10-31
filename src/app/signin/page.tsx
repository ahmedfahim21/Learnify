import { redirect } from "next/navigation";

import { configuredProviders, isAuthConfigured } from "@/lib/auth";
import { getCurrentUserId } from "@/lib/session";
import { SignInButtons } from "@/components/auth/SignInButtons";

export const metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await getCurrentUserId()) redirect(next ?? "/");

  const providers = isAuthConfigured() ? await configuredProviders() : [];

  return (
    <main className="wrap-prose flex min-h-[70vh] flex-col justify-center gap-6 py-16">
      <div className="space-y-3">
        <p className="label">Sign in</p>
        <h1 className="text-3xl">Ask doubts and keep your flashcards</h1>
        <p className="text-(--color-mist)">
          Watching lectures, subtitles and study screens are open to everyone. Signing in lets you
          ask doubts by voice and keeps your flashcard reviews and check history.
        </p>
      </div>

      {error && <p className="text-sm text-(--color-alert)">Sign-in didn&apos;t complete: {error}</p>}

      {providers.length > 0 ? (
        <SignInButtons providers={providers} next={next ?? "/"} />
      ) : (
        // Dead UI is worse than absent UI: with no credentials configured the
        // buttons could only fail, so say why instead of rendering them.
        <div className="space-y-2 border border-(--color-warn)/30 bg-(--color-warn)/[0.06] p-4">
          <p className="label">Not configured</p>
          <p className="text-sm text-(--color-mist)">
            No sign-in providers are available. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and enable Google or GitHub under
            Authentication in the Supabase dashboard.
          </p>
        </div>
      )}
    </main>
  );
}
