"use client";

import { useState } from "react";

import { signIn } from "@/lib/authClient";

const LABELS: Record<string, string> = { google: "Continue with Google", github: "Continue with GitHub" };

export function SignInButtons({
  providers,
  next,
}: {
  providers: ("google" | "github")[];
  next: string;
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function start(provider: "google" | "github") {
    setPending(provider);
    setError(null);
    try {
      await signIn.social({ provider, callbackURL: next });
    } catch {
      // Surface it rather than leaving a button stuck on "Redirecting…".
      setError("Could not reach the provider. Try again.");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <button
            key={provider}
            type="button"
            disabled={pending !== null}
            onClick={() => start(provider)}
            className="border border-(--color-line) px-4 py-3 text-left transition-colors hover:border-(--color-faint) hover:bg-(--color-surface) disabled:cursor-wait disabled:opacity-60"
          >
            {pending === provider ? "Redirecting…" : LABELS[provider]}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-(--color-strawberry)">{error}</p>}
    </div>
  );
}
