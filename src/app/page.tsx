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
      <p className="text-sm text-white/40">
        The Next.js 15 foundation is in place. The generative classroom lands
        next.
      </p>
    </main>
  );
}
