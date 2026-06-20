import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-widest text-white/60">
        Phase 1 · foundation
      </span>
      <h1 className="text-4xl font-semibold sm:text-5xl">Learnify 2.0</h1>
      <p className="max-w-xl text-balance text-white/70">
        An agentic tutor that stops generating static content and starts
        generating the <em>experience</em> — live adaptive sessions where every
        screen is streamed as interactive UI and grounded in your sources.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/topics"
          className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-medium transition hover:bg-white/15"
        >
          Start learning
        </Link>
        <Link
          href="/today"
          className="rounded-lg border border-white/15 px-5 py-3 font-medium text-white/80 transition hover:border-white/40"
        >
          Today
        </Link>
      </div>
    </main>
  );
}
