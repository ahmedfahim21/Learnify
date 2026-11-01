"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import type { SocialProvider } from "@/lib/auth";
import { signIn } from "@/lib/authClient";

/** Each provider's own mark, from /public/brands (Google's is its multicolour G, as its guidelines ask). */
const PROVIDERS: Record<string, { label: string; logo: string }> = {
  google: { label: "Continue with Google", logo: "/brands/google.svg" },
  github: { label: "Continue with GitHub", logo: "/brands/github.svg" },
};

export function SignInButtons({
  providers,
  next,
}: {
  providers: SocialProvider[];
  next: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: SocialProvider) {
    setPending(provider);
    setError(null);
    try {
      await signIn(provider, next);
    } catch (err) {
      // Surface it rather than leaving a button stuck on "Redirecting…".
      console.error("sign-in failed:", err);
      setError("Could not reach the provider. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={pending !== null}
            onClick={() => start(provider)}
            className="btn btn-secondary min-h-13 w-full justify-center gap-3 border border-(--color-line) text-base disabled:cursor-wait disabled:opacity-70"
          >
            {pending === provider ? (
              <Loader2 size={20} className="animate-spin text-(--color-mist)" aria-hidden />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- a 20px static logo
              <img src={PROVIDERS[provider].logo} alt="" width={20} height={20} className="h-5 w-5" />
            )}
            {pending === provider ? "Redirecting…" : PROVIDERS[provider].label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-(--color-alert)">
          {error}
        </p>
      )}
    </div>
  );
}
