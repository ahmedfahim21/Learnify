import { ArrowRight, BookOpen, Languages, Layers, Mic, Trophy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignInButtons } from "@/components/auth/SignInButtons";
import { LogoMark } from "@/components/site/Logo";
import { configuredProviders, isAuthConfigured } from "@/lib/auth";
import { INDIAN_LANGUAGE_COUNT, LANGUAGES } from "@/lib/languages";
import { getCurrentUserId } from "@/lib/session";

export const metadata = { title: "Sign in", robots: { index: false, follow: false } };

/** What signing in adds; lectures and anything already written stay open to everyone. */
const FEATURES = [
  { icon: Mic, colour: "var(--color-deep)", title: "Doubts by voice", body: "Pause, ask in your language, get an answer from that moment." },
  { icon: Trophy, colour: "var(--color-accent)", title: "Quizzes with checked answers", body: "Play for points; every key is checked against the lecture." },
  { icon: BookOpen, colour: "var(--color-signal)", title: "Notes written for you", body: "Chapter by chapter, with key ideas and cards to flip." },
  { icon: Layers, colour: "var(--color-flow)", title: "Flashcards and a streak", body: "Spaced review just before you'd forget, and a streak to keep." },
];

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  if (await getCurrentUserId()) redirect(next ?? "/");

  const providers = isAuthConfigured() ? await configuredProviders() : [];
  const scripts = Object.values(LANGUAGES).filter((l) => l.name !== "English").slice(0, 8);

  return (
    <main className="haze">
      <div className="wrap grid items-center gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        {/* What you get: second on phones, so the sign-in card comes first. */}
        <section className="space-y-8 max-lg:order-2" aria-labelledby="signin-why">
          <div className="space-y-4">
            <p className="eyebrow text-(--color-signal)">Free · {INDIAN_LANGUAGE_COUNT} Indian languages</p>
            <h2 id="signin-why" className="text-4xl leading-[1.08] tracking-[-0.03em] sm:text-5xl">
              Stuck mid-lecture? Ask in the language you think in.
            </h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3 rounded-2xl border border-(--color-line)/70 bg-(--color-node)/85 p-4 shadow-(--shadow-soft) backdrop-blur">
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: f.colour }}>
                  <f.icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block leading-snug">{f.title}</span>
                  <span className="block text-sm text-(--color-mist)">{f.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="flex flex-wrap items-center gap-2 text-(--color-mist)">
            <Languages size={16} aria-hidden />
            {scripts.map((l) => (
              <span key={l.sarvam} lang={l.sarvam} className="rounded-full bg-(--color-node) px-2.5 py-0.5 text-sm text-(--color-fg) shadow-(--shadow-soft)">
                {l.native}
              </span>
            ))}
            <span className="text-sm">and more</span>
          </p>
        </section>

        <section aria-labelledby="signin-heading" className="max-lg:order-1">
          <div className="mx-auto w-full max-w-md space-y-7 rounded-[1.75rem] border border-(--color-line)/70 bg-(--color-node) p-7 shadow-(--shadow-card) sm:p-9">
            <div className="space-y-4">
              <LogoMark size={44} />
              <div className="space-y-1.5">
                <h1 id="signin-heading" className="text-3xl tracking-tight">
                  Sign in to Learnify
                </h1>
                <p className="text-(--color-mist)">One tap. Your language, goal and level are saved on every device.</p>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-(--color-alert)/[0.07] px-4 py-3 text-sm text-(--color-alert)">
                Sign-in didn&apos;t complete: {error}
              </p>
            )}

            {providers.length > 0 ? (
              <SignInButtons providers={providers} next={next ?? "/"} />
            ) : (
              // Dead UI is worse than absent UI: with no credentials configured the
              // buttons could only fail, so say why instead of rendering them.
              <div className="space-y-2 rounded-xl border border-(--color-warn)/30 bg-(--color-warn)/[0.06] p-4">
                <p className="label">Not configured</p>
                <p className="text-sm text-(--color-mist)">
                  No sign-in providers are available. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
                  <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, and enable Google or GitHub under Authentication in the
                  Supabase dashboard.
                </p>
              </div>
            )}

            <div className="space-y-3 border-t border-(--color-line) pt-5 text-sm text-(--color-mist)">
              <p>Free. Learnify only uses your name, email and picture from your account.</p>
              <Link href="/courses" className="inline-flex items-center gap-1.5 text-(--color-signal) hover:underline">
                Browse lectures without signing in <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
