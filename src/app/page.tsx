import { ArrowRight, Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { CyclingLanguage } from "@/components/site/CyclingLanguage";
import { FeaturedShelf } from "@/components/site/FeaturedShelf";
import { LANGUAGES } from "@/lib/languages";

/**
 * Landing page: what Learnify does, in the student's own scripts.
 *
 * The hero's quiz is real model output (see HeroDemo), answerable on the page:
 * generated study screens are the product, so the landing page leads with one.
 */

const HeroDemo = dynamic(() => import("@/components/site/HeroDemo"), {
  loading: () => <div className="h-96 animate-pulse rounded-(--radius) bg-(--color-raised)" />,
});

// Each feature numbered in a different script: Devanagari, Bengali, Tamil, Telugu.
const FEATURES = [
  {
    numeral: "१",
    numeralLang: "hi",
    title: "Notes you work through",
    body: "Interactive notes written from the lecture in your language: key ideas, worked examples, and questions to answer in your head before you reveal them.",
  },
  {
    numeral: "২",
    numeralLang: "bn",
    title: "Quizzes that teach",
    body: "Multiple choice, true or false, fill in the blank, match and order. Every answer explains why and jumps the video to where it's taught. Make it simpler or harder.",
  },
  {
    numeral: "௩",
    numeralLang: "ta",
    title: "Checks and doubts in the video",
    body: "The video pauses for a quick question at the right moments. Stuck? Ask a doubt by voice in your language, answered from what the lecturer just said.",
  },
  {
    numeral: "౪",
    numeralLang: "te",
    title: "Flashcards and a concept map",
    body: "Flashcards come back when you're about to forget them, and a concept map shows how the lecture's ideas build on each other.",
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
            The official lecture plays as it is. Beside it, AI writes notes, quizzes and flashcards from that lecture in
            the language you think in, and grades every answer instantly.
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

        {/* A real generated quiz, answerable right here. */}
        <figure className="kolam space-y-3 rounded-(--radius) border border-(--color-line) p-4 sm:p-6" aria-label="A generated quiz">
          <div className="rounded-(--radius) border border-(--color-line) bg-(--color-surface) p-4 shadow-(--shadow-card)">
            <HeroDemo />
          </div>
          <figcaption className="flex items-center gap-2 text-sm text-(--color-mist)">
            <Sparkles size={14} className="text-(--color-signal)" aria-hidden />
            Written by AI in Tamil from an IIT Madras calculus lecture. Try it.
          </figcaption>
        </figure>
      </section>

      <FeaturedShelf />

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
