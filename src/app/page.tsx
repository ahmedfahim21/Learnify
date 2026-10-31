import { LANGUAGES } from "@/lib/languages";

/**
 * Landing page. The lecture player, course browser and featured shelf land in
 * later steps of PLAN.md; until then this page says what the product is and
 * links to nothing that doesn't exist yet.
 */

const FEATURES = [
  {
    title: "Subtitles in your language",
    body: "English captions translated into Tamil, Telugu, Kannada and more, shown under the video. Where NPTEL already has a human translation, that is what you see.",
  },
  {
    title: "Checks during the video",
    body: "At the right moments the video pauses for a short question in your language. Get it wrong and it replays the part that explains it.",
  },
  {
    title: "Ask a doubt by voice",
    body: "Pause and ask in your language. The answer is grounded in what the lecturer just said, with links back to the exact moment.",
  },
  {
    title: "Study screens per lecture",
    body: "A concept map, flashcards and a recap. Every item links to its timestamp, and tapping it jumps the video there.",
  },
];

export default function HomePage() {
  const languages = Object.values(LANGUAGES).filter((l) => l.name !== "English");

  return (
    <main className="wrap space-y-16 py-20">
      <section className="max-w-3xl space-y-6">
        <p className="label">NPTEL lectures · 10 Indian languages</p>
        <h1 className="text-4xl leading-tight tracking-tight sm:text-5xl">
          Watch an IIT lecture in English, learn it in your language.
        </h1>
        <ul className="flex flex-wrap gap-2" aria-label="Supported languages">
          {languages.map((l) => (
            <li
              key={l.sarvam}
              lang={l.sarvam}
              className="rounded-(--radius) border border-(--color-line) px-3 py-1 text-(--color-mist)"
            >
              {l.native}
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="space-y-2 border-t border-(--color-line) pt-4">
            <h2 className="text-lg">{f.title}</h2>
            <p className="leading-relaxed text-(--color-mist)">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
