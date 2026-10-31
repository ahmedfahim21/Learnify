"use client";

import { Renderer } from "@openuidev/react-lang";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { LANGUAGES } from "@/lib/languages";
import { screenLibrary } from "@/lib/openui/screenLibrary";

/**
 * The hero's proof: one NPTEL lecture, and what Learnify wrote from it in
 * three languages. Every statement below is model output stored for NPTEL's
 * "Coulomb's Law" (IIT Kanpur), copied verbatim, so switching language shows
 * the real thing, rendered by the same OpenUI library as the lecture page.
 */

const LECTURE = {
  id: "25042c56-b734-4ac9-8531-d135b8bdcc3c",
  title: "Coulomb's Law",
  course: "Introduction to Electromagnetic Theory",
  by: "Prof. Manoj K Harbola · IIT Kanpur",
  youtubeId: "EiX3R6IkDDU",
};

type DemoLang = "hi" | "bn" | "ml";

const ITEMS: Record<DemoLang, string[]> = {
  hi: [
    String.raw`x = KeyIdea("Coulomb's Law दो point charges के बीच force को define करता है।")`,
    String.raw`x = Mcq("दो point charges $q_1$ और $q_2$ के बीच बल का परिमाण (magnitude) किसके समानुपाती होता है?", ["$r_{12}$", "$r_{12}^2$", "$r_{12}^3$", "$r_{12}^{1/2}$"], 1, "परिमाण $r_{12}^2$ के व्युत्क्रमानुपाती (inversely proportional) होता है, जैसा कि व्याख्यान में बताया गया है।", 135)`,
    String.raw`x = TrueFalse("गुरुत्वाकर्षण बल (gravitational force) हमेशा आकर्षक (attractive) होता है।", true, "व्याख्यान में बताया गया है कि गुरुत्वाकर्षण में द्रव्यमान (mass) का कोई चिह्न नहीं होता, इसलिए बल हमेशा आकर्षक होता है।", 568)`,
  ],
  bn: [
    String.raw`x = KeyIdea("দুটি point charge-এর মধ্যে electrostatic force-এর মান তাদের দূরত্বের বর্গের ব্যস্তানুপাতিক।")`,
    String.raw`x = Reveal("একই sign-এর charge হলে বলের direction কী হয়?", "বলটি repulsive হয়, অর্থাৎ charge-গুলো একে অপরের থেকে দূরে সরে যায়।")`,
    String.raw`x = Mcq("দুটি point charge $q_1$ এবং $q_2$-এর মধ্যে বলের magnitude-এর সূত্র কী?", ["$\\frac{1}{4\\pi\\epsilon_0}\\frac{q_1q_2}{r_{12}^2}$", "$\\frac{1}{2\\pi\\epsilon_0}\\frac{q_1q_2}{r_{12}}$", "$\\frac{q_1q_2}{4\\pi r_{12}^2}$", "$\\frac{1}{4\\pi\\epsilon_0}\\frac{q_1+q_2}{r_{12}}$"], 0, "SI unit-এ সূত্রটি $4\\pi\\epsilon_0$ দিয়ে লেখা হয়, যা vacuum-এর permittivity.", 161)`,
  ],
  ml: [
    String.raw`x = KeyIdea("രണ്ട് പോയിന്റ് ചാർജുകൾ തമ്മിലുള്ള ബലത്തിന്റെ മാഗ്നിറ്റ്യൂഡ് അവ തമ്മിലുള്ള അകലത്തിന്റെ സ്ക്വയറിന് വിപരീതാനുപാതത്തിലാണ്.")`,
    String.raw`x = Formula("$F = \frac{1}{4\pi\epsilon_0} \frac{q_1 q_2}{r_{12}^2}$", "SI യൂണിറ്റുകളിലെ ബലത്തിന്റെ സമവാക്യം")`,
    String.raw`x = Reveal("ദൂരം ഇരട്ടിയാക്കിയാൽ ബലത്തിന് എന്ത് സംഭവിക്കും?", "ബലം നാലിലൊന്നായി കുറയും, കാരണം സമവാക്യത്തിൽ ദൂരത്തിന്റെ സ്ക്വയർ ഉണ്ട്.")`,
  ],
};

const LANGS = Object.keys(ITEMS) as DemoLang[];

const program = (statement: string) => `root = Screen("", [x])\n${statement}`;

export default function HeroDemo() {
  const [lang, setLang] = useState<DemoLang>("hi");
  const [step, setStep] = useState(0);
  const items = ITEMS[lang];

  return (
    <div className="overflow-hidden rounded-3xl border border-(--color-line) bg-(--color-node) shadow-(--shadow-card)">
      {/* The lecture, as NPTEL recorded it */}
      <Link href={`/lecture/${LECTURE.id}`} className="group flex items-center gap-4 border-b border-(--color-line) p-4 sm:p-5">
        <span className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-xl bg-(--color-raised) sm:w-40">
          {/* eslint-disable-next-line @next/next/no-img-element -- a YouTube thumbnail; next/image would need a remote pattern for one picture */}
          <img
            src={`https://i.ytimg.com/vi/${LECTURE.youtubeId}/mqdefault.jpg`}
            alt=""
            loading="eager"
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/15">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-(--color-signal) transition-transform group-hover:scale-110">
              <Play size={16} className="translate-x-px" aria-hidden />
            </span>
          </span>
        </span>
        <span className="min-w-0 space-y-0.5">
          <span className="label block">NPTEL lecture</span>
          <span className="block text-lg leading-tight">{LECTURE.title}</span>
          <span className="block truncate text-sm text-(--color-mist)">{LECTURE.by}</span>
        </span>
      </Link>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-(--color-mist)">Learn it in</span>
          <div role="radiogroup" aria-label="Language" className="flex gap-1.5">
            {LANGS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={lang === l}
                onClick={() => {
                  setLang(l);
                  setStep(0);
                }}
                lang={LANGUAGES[l].sarvam}
                className={`min-h-9 rounded-full border px-3.5 transition-colors ${
                  lang === l
                    ? "border-(--color-signal) bg-(--color-signal) text-white"
                    : "border-(--color-line) text-(--color-fg) hover:border-(--color-signal)"
                }`}
              >
                {LANGUAGES[l].native}
              </button>
            ))}
          </div>
        </div>

        {/* One piece at a time, the height held so switching doesn't jump the page */}
        <div key={`${lang}-${step}`} lang={LANGUAGES[lang].sarvam} className="rise flex min-h-[22rem] flex-col justify-center">
          <Renderer response={program(items[step])} library={screenLibrary} isStreaming={false} />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-(--color-line) pt-4">
          <div className="flex gap-1.5" role="tablist" aria-label="Examples">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={step === i}
                aria-label={`Example ${i + 1} of ${items.length}`}
                onClick={() => setStep(i)}
                className="flex h-8 items-center"
              >
                <span className={`block h-2 rounded-full transition-all ${step === i ? "w-6 bg-(--color-signal)" : "w-2 bg-(--color-raised)"}`} />
              </button>
            ))}
          </div>
          {step < items.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-(--color-signal) hover:bg-(--color-signal)/[0.06]"
            >
              Next <ArrowRight size={14} aria-hidden />
            </button>
          ) : (
            <Link
              href={`/lecture/${LECTURE.id}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm text-(--color-signal) hover:bg-(--color-signal)/[0.06]"
            >
              Open this lecture <ArrowRight size={14} aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
