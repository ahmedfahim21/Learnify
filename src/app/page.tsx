import { ArrowRight, BookOpen, Layers, Mic, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { CyclingLanguage } from "@/components/site/CyclingLanguage";
import { FeaturedShelf } from "@/components/site/FeaturedShelf";
import { InstituteMarquee } from "@/components/site/InstituteMarquee";

/**
 * Landing page, kept to what a student needs to decide: what this is (the
 * hero), proof (a real generated quiz they can answer), whose lectures these
 * are, how it works in three steps, and lectures to start on.
 */

const HeroDemo = dynamic(() => import("@/components/site/HeroDemo"), {
  loading: () => <div className="h-[30rem] animate-pulse rounded-3xl bg-(--color-raised)" />,
});

// Steps numbered in three scripts: Devanagari, Bengali, Tamil.
const STEPS = [
  {
    numeral: "१",
    numeralLang: "hi",
    title: "Pick a lecture",
    body: "Any of 3,050 NPTEL courses from over 100 institutes, the IITs and IISc among them, played as the professor recorded it.",
  },
  {
    numeral: "২",
    numeralLang: "bn",
    title: "Tell us how you learn",
    body: "Your language, whether you want to understand, practise or revise, and how hard to pitch it.",
  },
  {
    numeral: "௩",
    numeralLang: "ta",
    title: "Study it your way",
    body: "Notes, quizzes and flashcards written from that lecture in your language, and doubts answered by voice.",
  },
];

const MODES = [
  { icon: BookOpen, label: "Notes", colour: "var(--color-signal)" },
  { icon: Trophy, label: "Quizzes", colour: "var(--color-accent)" },
  { icon: Layers, label: "Flashcards", colour: "var(--color-flow)" },
  { icon: Mic, label: "Voice doubts", colour: "var(--color-deep)" },
];

export default function HomePage() {
  return (
    <main className="space-y-24 pb-8">
      <section className="wrap grid items-center gap-12 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <h1 className="text-[2.6rem] leading-[1.08] tracking-tight sm:text-6xl">
            <span className="sr-only">Watch an NPTEL lecture. Learn it in your language.</span>
            <span aria-hidden>
              Watch an NPTEL lecture.
              <br />
              Learn it in <CyclingLanguage />
            </span>
          </h1>
          <p className="max-w-lg text-xl leading-relaxed text-(--color-mist)">
            Free lectures from the IITs, IISc and over 100 other institutes, turned into notes, quizzes and flashcards in the language you think in.
          </p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link
              href="/courses"
              className="tile inline-flex min-h-13 items-center gap-2 rounded-full bg-(--color-signal) px-7 text-lg text-white"
            >
              Pick a lecture <ArrowRight size={18} aria-hidden />
            </Link>
            <span className="font-mono text-sm text-(--color-faint)">Free · 10 Indian languages</span>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="What you get">
            {MODES.map((m) => (
              <li key={m.label} className="inline-flex items-center gap-2 rounded-full border border-(--color-line) bg-(--color-node) py-1 pr-3.5 pl-1">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ background: m.colour }}>
                  <m.icon size={14} aria-hidden />
                </span>
                <span className="text-sm">{m.label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Proof, not a picture: one real lecture and what was written from it. */}
        <HeroDemo />
      </section>

      <InstituteMarquee />

      <section className="wrap space-y-8" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-3xl">
          How it works
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.title} className="space-y-3 rounded-2xl border border-(--color-line) bg-(--color-surface) p-6">
              <span lang={s.numeralLang} aria-hidden className="block text-4xl leading-none text-(--color-warn)">
                {s.numeral}
              </span>
              <h3 className="text-xl">{s.title}</h3>
              <p className="leading-relaxed text-(--color-mist)">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <FeaturedShelf />
    </main>
  );
}
