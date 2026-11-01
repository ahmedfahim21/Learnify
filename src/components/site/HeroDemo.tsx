"use client";

import { Renderer } from "@openuidev/react-lang";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LANGUAGES } from "@/lib/languages";
import { screenLibrary } from "@/lib/openui/screenLibrary";

import { PoweredBy } from "./Brands";

/**
 * The hero's proof: one NPTEL lecture, and what Learnify wrote from it in
 * three languages. Every statement below is model output stored for NPTEL's
 * "Coulomb's Law" (IIT Kanpur), copied verbatim, so switching language shows
 * the real thing, rendered by the same OpenUI library as the lecture page.
 * Each one was checked by hand for correctness and language; the stored
 * Hindi quiz's first question (force "proportional to r²") was left out
 * because its answer key is wrong.
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
    String.raw`x = KeyIdea("दो point charges के बीच का force उनके magnitude और distance पर depend करता है।")`,
    String.raw`x = Mcq("दो आवेशों के बीच की दूरी दोगुनी करने पर बल में क्या परिवर्तन होता है?", ["दोगुना हो जाता है", "चार गुना हो जाता है", "आधा हो जाता है", "चौथाई हो जाता है"], 3, "दूरी दोगुनी होने पर बल $1/r^2$ निर्भरता के कारण चौथाई (1/4) हो जाता है, जैसा कि व्याख्यान में समझाया गया है।", 185)`,
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

const HEAD = `root = Screen("", [x])\n`;

/** How long writing one example takes, start to finish, as it would stream in. */
const WRITE_MS = 1400;

/**
 * Plays an example the way the lecture page receives one: the model's OpenUI
 * Lang streams in, then OpenUI renders it. (A component draws only once its
 * text is complete, so the source is what shows while it's being written.)
 * Held finished for anyone who prefers reduced motion.
 */
function useWriting(statement: string): { source: string; writing: boolean } {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(statement.length);
      return;
    }
    setShown(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WRITE_MS);
      // Ease out, and move in word-sized chunks the way tokens arrive.
      const n = Math.round(statement.length * (1 - (1 - t) ** 2));
      setShown(t < 1 ? Math.max(0, n - (n % 6)) : statement.length);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [statement]);
  return { source: statement.slice(0, shown), writing: shown < statement.length };
}

export default function HeroDemo() {
  const [lang, setLang] = useState<DemoLang>("hi");
  const [step, setStep] = useState(0);
  const items = ITEMS[lang];
  const { source, writing } = useWriting(items[step]);

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
        <div key={`${lang}-${step}`} lang={LANGUAGES[lang].sarvam} className="flex min-h-[22rem] flex-col justify-center gap-3" aria-busy={writing}>
          {writing ? (
            <pre className="overflow-hidden rounded-2xl bg-(--color-fg) p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-white/85" aria-hidden>
              <span className="text-white/45">{HEAD}</span>
              {source}
              <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 animate-pulse bg-(--color-warn)" />
            </pre>
          ) : (
            <div className="rise">
              <Renderer response={HEAD + source} library={screenLibrary} isStreaming={false} />
            </div>
          )}
        </div>
        <div className="flex min-h-5 items-center" aria-live="polite">
          {writing ? (
            <p className="flex items-center gap-1.5 text-xs text-(--color-signal)">
              <Sparkles size={13} className="animate-pulse" aria-hidden /> Sarvam is writing in {LANGUAGES[lang].native}…
            </p>
          ) : (
            <PoweredBy />
          )}
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
