import { ArrowRight, BookOpen, Feather, Languages, Layers, Mic, Target, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

import { BrandLogo, BRANDS } from "@/components/site/Brands";
import { CyclingLanguage } from "@/components/site/CyclingLanguage";
import { INDIAN_LANGUAGE_COUNT } from "@/lib/languages";
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

// Steps numbered in three scripts: Devanagari, Bengali, Tamil. Each shows
// what does the work: NPTEL and YouTube, your choices, Sarvam and OpenUI.
const STEPS = [
  {
    numeral: "१",
    numeralLang: "hi",
    title: "Pick a lecture",
    body: "Any of 3,050 NPTEL courses from over 100 institutes, the IITs and IISc among them, played in YouTube's player as the professor recorded it.",
  },
  {
    numeral: "২",
    numeralLang: "bn",
    title: "Tell us how you learn",
    body: "Your language, whether you want to understand, practise or revise, and how hard to pitch it. Four taps, saved for every lecture.",
  },
  {
    numeral: "௩",
    numeralLang: "ta",
    title: "Study it your way",
    body: "Sarvam's Indian-language models write notes, quizzes and flashcards from the lecture and answer doubts you speak. OpenUI turns them into screens you play with.",
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
      <section className="haze">
       <div className="wrap grid items-center gap-12 pt-12 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-8">
          <p className="eyebrow text-(--color-signal)">NPTEL · in {INDIAN_LANGUAGE_COUNT} Indian languages</p>
          <h1 className="text-[2.6rem] leading-[1.06] tracking-[-0.035em] sm:text-[4rem]">
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
            <Link href="/courses" className="btn btn-primary text-lg">
              Pick a lecture <ArrowRight size={18} aria-hidden />
            </Link>
            <a href="#how-heading" className="btn btn-secondary">
              How it works
            </a>
          </div>
          <ul className="flex flex-wrap gap-2" aria-label="What you get">
            {MODES.map((m) => (
              <li key={m.label} className="inline-flex items-center gap-2 rounded-full bg-(--color-node)/80 py-1 pr-3.5 pl-1 shadow-(--shadow-soft) backdrop-blur">
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
       </div>
      </section>

      <InstituteMarquee />

      <section className="wrap space-y-10" aria-labelledby="how-heading">
        <div className="space-y-3 text-center">
          <p className="eyebrow">How it works</p>
          <h2 id="how-heading" className="scroll-mt-24 text-4xl tracking-[-0.03em] sm:text-5xl">
            One lecture, three steps
          </h2>
        </div>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((s, n) => (
            <li
              key={s.title}
              className="glow-corner flex flex-col gap-3 rounded-[1.5rem] border border-(--color-line)/70 bg-(--color-node) p-7 shadow-(--shadow-soft)"
              style={{ "--glow": GLOWS[n] } as React.CSSProperties}
            >
              <span lang={s.numeralLang} aria-hidden className="block text-4xl leading-none text-(--color-deep)">
                {s.numeral}
              </span>
              <h3 className="text-xl">{s.title}</h3>
              <p className="leading-relaxed text-(--color-mist)">{s.body}</p>
              <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
                {n === 0 && (
                  <>
                    <BrandChip brand="nptel" />
                    <BrandChip brand="youtube" label="YouTube" />
                  </>
                )}
                {n === 1 &&
                  [
                    { icon: Languages, label: "Language" },
                    { icon: Target, label: "Goal" },
                    { icon: Feather, label: "Level" },
                  ].map((c) => (
                    <span key={c.label} className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-(--color-line) bg-(--color-node) px-3 text-sm">
                      <c.icon size={15} className="text-(--color-signal)" aria-hidden /> {c.label}
                    </span>
                  ))}
                {n === 2 && (
                  <>
                    <BrandChip brand="sarvam" />
                    <BrandChip brand="openui" />
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <FeaturedShelf />
    </main>
  );
}

/** Each step's corner glow: mint, indigo, teal. */
const GLOWS = ["var(--haze-mint)", "var(--haze-cool)", "var(--color-accent)"];

/** Heights that give the logos the same visual weight: Sarvam's wordmark is wide and bold, OpenUI's has room around it. */
const BRAND_HEIGHT: Record<keyof typeof BRANDS, number> = { sarvam: 11, openui: 24, nptel: 16, youtube: 16, github: 16 };

function BrandChip({ brand, label }: { brand: keyof typeof BRANDS; label?: string }) {
  return (
    <a
      href={BRANDS[brand].href}
      target="_blank"
      rel="noreferrer"
      className="tile inline-flex min-h-10 items-center gap-2 rounded-full border border-(--color-line) bg-white px-3.5 text-sm"
    >
      <BrandLogo brand={brand} height={BRAND_HEIGHT[brand]} mark={Boolean(label)} />
      {label}
    </a>
  );
}
