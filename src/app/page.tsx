import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CyclingLanguage } from "@/components/site/CyclingLanguage";
import { LANGUAGES } from "@/lib/languages";

/**
 * Landing page: what Learnify does, in the student's own scripts.
 *
 * The sample subtitle is real: the opening of NPTEL's "Programming, Data
 * Structures and Algorithms using C" (IIT Madras), with NPTEL's own human
 * Tamil track, CC BY-NC-SA.
 */

// Each feature numbered in a different script: Devanagari, Bengali, Tamil, Telugu.
const FEATURES = [
  {
    numeral: "१",
    numeralLang: "hi",
    title: "Subtitles in your language",
    body: "English captions translated into Tamil, Telugu, Kannada and more, shown under the video. Where NPTEL already has a human translation, that's what you see.",
  },
  {
    numeral: "২",
    numeralLang: "bn",
    title: "Checks during the video",
    body: "At the right moments the video pauses for a short question in your language. Get it wrong and it replays the part that explains it.",
  },
  {
    numeral: "௩",
    numeralLang: "ta",
    title: "Ask a doubt by voice",
    body: "Pause and ask in your language. The answer is grounded in what the lecturer just said, with links back to the exact moment.",
  },
  {
    numeral: "౪",
    numeralLang: "te",
    title: "Study screens per lecture",
    body: "A concept map, flashcards and a recap. Every item links to its timestamp, and tapping it jumps the video there.",
  },
];

export default function HomePage() {
  const languages = Object.values(LANGUAGES).filter((l) => l.name !== "English");

  return (
    <main className="space-y-20 pb-8">
      <section className="wrap grid items-center gap-10 pt-14 sm:pt-20 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="space-y-7">
          <p className="label shirorekha">NPTEL lectures · 10 Indian languages</p>
          <h1 className="text-4xl leading-[1.12] tracking-tight sm:text-[3.4rem]">
            <span className="sr-only">Watch an IIT lecture in English, learn it in your language.</span>
            <span aria-hidden>
              Watch an IIT lecture in English,
              <br />
              learn it in <CyclingLanguage />
            </span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-(--color-mist)">
            The official lecture plays as it is. Learnify adds subtitles, checks, spoken doubts and study screens in the
            language you think in.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/courses"
              className="inline-flex min-h-11 items-center gap-2 rounded-(--radius) bg-(--color-signal) px-5 text-white transition-opacity hover:opacity-90"
            >
              Browse courses <ArrowRight size={16} aria-hidden />
            </Link>
            <span className="text-sm text-(--color-mist)">3,050 video courses from IITs and IISc</span>
          </div>
        </div>

        {/* A real subtitle, the way it appears under the video. */}
        <figure className="kolam rounded-(--radius) border border-(--color-line) p-6 sm:p-8" aria-label="Sample subtitle">
          <div className="space-y-3 rounded-(--radius) border border-(--color-line) bg-(--color-surface) p-5 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <span className="font-mono text-xs text-(--color-faint)">0:01</span>
              <span className="label">Human translation · NPTEL</span>
            </div>
            <p lang="ta-IN" className="text-[1.35rem]">
              ப்ரொக்ராமிங் குறித்த இந்த ஆன்லைன் படிப்புக்கு வரவேற்கிறோம்.
            </p>
            <p className="text-(--color-mist)">Welcome to this online course on programming.</p>
          </div>
          <figcaption className="mt-4 text-sm text-(--color-mist)">
            Programming, Data Structures and Algorithms using C · IIT Madras
          </figcaption>
        </figure>
      </section>

      <section className="wrap">
        <ul className="flex flex-wrap gap-2" aria-label="Supported languages">
          {languages.map((l) => (
            <li
              key={l.sarvam}
              lang={l.sarvam}
              className="rounded-(--radius) border border-(--color-line) bg-(--color-surface) px-3 py-1.5 text-(--color-fg)"
            >
              {l.native}
              <span className="ml-2 text-sm text-(--color-faint)">{l.name}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="wrap grid gap-x-10 gap-y-10 sm:grid-cols-2">
        {FEATURES.map((f) => (
          <div key={f.title} className="flex gap-5 border-t border-(--color-line) pt-5">
            <span lang={f.numeralLang} aria-hidden className="w-8 shrink-0 text-3xl leading-none text-(--color-warn)">
              {f.numeral}
            </span>
            <div className="space-y-2">
              <h2 className="text-lg">{f.title}</h2>
              <p className="leading-relaxed text-(--color-mist)">{f.body}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
