"use client";

import { Renderer } from "@openuidev/react-lang";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { LANGUAGES } from "@/lib/languages";
import { LectureClockContext, type LectureClock } from "@/lib/openui/contexts";
import { doubtLibrary } from "@/lib/openui/doubtLibrary";
import { screenLibrary } from "@/lib/openui/screenLibrary";

import { PoweredBy } from "./Brands";

/**
 * The hero's proof: one NPTEL lecture, paused, a doubt asked about it, and
 * then what Learnify wrote from it to practise with, in three languages. Every
 * statement below is model output for NPTEL's "Coulomb's Law" (IIT Kanpur),
 * copied verbatim, so switching language shows the real thing, rendered by the
 * same OpenUI libraries as the lecture page. Each one was checked by hand for
 * correctness and language. Left out: the stored Hindi quiz's first question
 * (force "proportional to r²", wrong key), and a first Bengali answer whose
 * table said the electric force depends on mass. The Malayalam answer's p2 is
 * never placed in the answer, so it doesn't render.
 */

const LECTURE = {
  id: "25042c56-b734-4ac9-8531-d135b8bdcc3c",
  title: "Coulomb's Law",
  course: "Introduction to Electromagnetic Theory",
  by: "Prof. Manoj K Harbola · IIT Kanpur",
  youtubeId: "EiX3R6IkDDU",
};

type DemoLang = "hi" | "bn" | "ml";

/** Where the demo lecture is paused when the doubt is asked. */
const PAUSED_AT = "10:00";

/**
 * A doubt asked with the lecture paused at 10:00, and the answer sarvam-105b
 * wrote, verbatim. The answer's title restates the question, so only the
 * answer is shown; the question is kept as what was asked.
 */
const DOUBTS: Record<DemoLang, { question: string; answer: string }> = {
  hi: {
    question: "Electric force और gravitational force में क्या फर्क है?",
    answer: String.raw`root = Answer("Electric force और gravitational force में क्या फर्क है?", [k1, c1, t1])
k1 = KeyIdea("Gravitational force हमेशा attractive होती है, जबकि electric force charges के signs के हिसाब से attractive या repulsive दोनों हो सकती है।")
c1 = Compare(["Property", "Electric Force", "Gravitational Force"], [["Nature", "Attractive या Repulsive (signs पर निर्भर)", "हमेशा Attractive"], ["Formula", "$\vec{F}_{12} = \frac{1}{4\pi\epsilon_0} \frac{q_1 q_2}{r_{12}^2} \hat{r}_{12}$", "$\vec{F}_{12} = -G \frac{m_1 m_2}{r_{12}^2} \hat{r}_{12}$"]])
t1 = TimeChip(568, "Cavendish experiment और gravitational law का experimental verification")`,
  },
  bn: {
    question: "Electric force আর gravitational force-এর মধ্যে পার্থক্য কী?",
    answer: String.raw`root = Answer("Electric force আর gravitational force-এর মধ্যে পার্থক্য কী?", [k1, p1, c1, t1])
k1 = KeyIdea("Electric force charges-এর উপর কাজ করে এবং এটি attractive বা repulsive হতে পারে, কিন্তু gravitational force সবসময় attractive হয়।")
p1 = Paragraph("Coulomb's Law অনুযায়ী electric force-এর দিক charges-এর sign-এর উপর নির্ভর করে। যদি charges একই হয়, তবে force repulsive হয়, আর বিপরীত হলে attractive হয়। অন্যদিকে, gravitational force-এ mass সবসময় positive হয়, তাই এটি সবসময় attractive হয়।")
c1 = Compare(["Point", "Electric Force", "Gravitational Force"], [["Nature", "Repulsive or Attractive", "Always Attractive"], ["Formula", "$\vec{F}_{12} = \frac{1}{4\pi\epsilon_0} \frac{q_1 q_2}{r_{12}^2} \hat{r}_{12}$", "$\vec{F}_{12} = -G \frac{m_1 m_2}{r_{12}^2} \hat{r}_{12}$"]])
t1 = TimeChip(609, "Gravitational law-এর formula দেখানো হয়েছে")`,
  },
  ml: {
    question: "Electric force-ഉം gravitational force-ഉം തമ്മിലുള്ള വ്യത്യാസം എന്താണ്?",
    answer: String.raw`root = Answer("Electric force-ഉം gravitational force-ഉം തമ്മിലുള്ള വ്യത്യാസം?", [k1, p1, t1, t2, mc1])
k1 = KeyIdea("Electric force charges-ന്റെ sign-നെ ആശ്രയിച്ചിരിക്കുന്നു, എന്നാൽ gravitational force എപ്പോഴും attractive ആണ്.")
p1 = Paragraph("Coulomb's law-ൽ force-ന്റെ magnitude $\frac{1}{4\pi\epsilon_0} \frac{q_1 q_2}{r_{12}^2}$ ആണ്. $q_1$, $q_2$ ഒരേ sign ആണെങ്കിൽ repulsion ഉണ്ടാകും, opposite sign ആണെങ്കിൽ attraction ഉണ്ടാകും. എന്നാൽ gravitational law-ൽ എപ്പോഴും masses-കൾ തമ്മിലുള്ള attraction മാത്രമേ ഉള്ളൂ.")
p2 = Paragraph("Gravitational force-ന്റെ vector form $\vec{F}_1 = -G \frac{m_1 m_2}{r_{12}^2} \hat{r}_{21}$ ആണ്. ഇവിടെ negative sign ഉള്ളത് കൊണ്ട് force എപ്പോഴും masses-നെ പരസ്പരം അടുപ്പിക്കുന്നു.")
t1 = TimeChip(420, "Vector form-ൽ direction എങ്ങനെ എടുക്കുന്നു എന്ന് പറയുന്നു")
t2 = TimeChip(609, "Gravitational law-ന്റെ vector form വിശദീകരിക്കുന്നു")
mc1 = Mcq("Gravitational force-ഉം electric force-ഉം തമ്മിലുള്ള പ്രധാന വ്യത്യാസം എന്താണ്?", ["Gravitational force എപ്പോഴും attractive ആണ്", "Electric force എപ്പോഴും repulsive ആണ്", "രണ്ടും charges-നെ ആശ്രയിച്ചിരിക്കുന്നു", "രണ്ടും masses-നെ ആശ്രയിച്ചിരിക്കുന്നു"], 0, "Gravitational force-ൽ masses എപ്പോഴും positive ആയതിനാൽ negative sign കാരണം attraction മാത്രമേ ഉണ്ടാകൂ, എന്നാൽ electric force charges-ന്റെ sign അനുസരിച്ച് repulsion അല്ലെങ്കിൽ attraction ആകാം.", 609)`,
  },
};

/** What was written from the lecture to practise with, one piece per step after the doubt. */
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
const WRITE_MS = 1600;

/**
 * Plays an example the way a generated screen arrives on the lecture page:
 * the real component renders, and its text streams into it. The finished
 * screen is rendered once by OpenUI; this walks its text nodes and reveals
 * them a few characters at a time (maths, as KaTeX, appears whole when the
 * stream reaches it). Held finished for anyone who prefers reduced motion.
 *
 * Maths is hidden by a class on the screen, not by styling each formula:
 * after a language switch React swaps in fresh KaTeX nodes, and a formula
 * this hadn't seen would otherwise show before the text around it.
 */
function useStreamedText(root: React.RefObject<HTMLDivElement | null>, key: string): boolean {
  const [writing, setWriting] = useState(true);
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setWriting(false);
      return;
    }
    setWriting(true);
    // Text nodes to fill, and KaTeX blocks to show whole, in reading order.
    const pieces: ({ kind: "text"; node: Text; full: string } | { kind: "math"; node: HTMLElement })[] = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n instanceof HTMLElement && n.classList.contains("katex")
          ? NodeFilter.FILTER_ACCEPT
          : n instanceof HTMLElement && n.closest(".katex")
            ? NodeFilter.FILTER_REJECT
            : n.nodeType === Node.TEXT_NODE && n.textContent?.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_SKIP,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n instanceof HTMLElement) pieces.push({ kind: "math", node: n });
      else pieces.push({ kind: "text", node: n as Text, full: n.textContent ?? "" });
    }
    const total = pieces.reduce((sum, p) => sum + (p.kind === "text" ? p.full.length : 4), 0);
    const show = (budget: number) => {
      let left = budget;
      for (const p of pieces) {
        if (p.kind === "math") {
          p.node.style.visibility = left >= 4 ? "visible" : "";
          left -= 4;
        } else {
          p.node.textContent = p.full.slice(0, Math.max(0, left));
          left -= p.full.length;
        }
      }
    };
    const finish = () => {
      show(total);
      el.classList.remove("streaming");
      for (const p of pieces) if (p.kind === "math") p.node.style.visibility = "";
    };
    el.classList.add("streaming");
    show(0);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WRITE_MS);
      const n = Math.round(total * t);
      // Word-sized steps, the way tokens arrive.
      if (t < 1) {
        show(n - (n % 4));
        raf = requestAnimationFrame(tick);
      } else {
        finish();
        setWriting(false);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      finish();
    };
  }, [root, key]);
  return writing;
}

export default function HeroDemo() {
  const [lang, setLang] = useState<DemoLang>("hi");
  const [step, setStep] = useState(0);
  const items = ITEMS[lang];
  const steps = items.length + 1;
  const screen = useRef<HTMLDivElement>(null);
  const writing = useStreamedText(screen, `${lang}-${step}`);
  const router = useRouter();
  // An answer's moments open the lecture there, as they would seek it on the lecture page.
  const clock = useMemo<LectureClock>(
    () => ({ durationSec: Number.POSITIVE_INFINITY, seekTo: (sec) => router.push(`/lecture/${LECTURE.id}?t=${Math.round(sec)}`) }),
    [router],
  );

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-(--color-line)/70 bg-(--color-node)/95 shadow-(--shadow-card) backdrop-blur">
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
          <span className="text-sm text-(--color-mist)">Ask in</span>
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

        {/* One piece at a time, in a box of fixed height so switching doesn't jump the page; a long answer scrolls inside it. */}
        <div
          key={`${lang}-${step}`}
          lang={LANGUAGES[lang].sarvam}
          className={`flex h-[26rem] flex-col gap-3 overflow-y-auto overscroll-contain ${step === 0 ? "" : "justify-center"}`}
          aria-busy={writing}
        >
          {step === 0 ? (
            <div className="space-y-4">
              <p className="label">Paused at {PAUSED_AT} · asked</p>
              <div ref={screen} className="doubt-answer">
                <LectureClockContext.Provider value={clock}>
                  <Renderer response={DOUBTS[lang].answer} library={doubtLibrary} isStreaming={false} />
                </LectureClockContext.Provider>
              </div>
            </div>
          ) : (
            <div ref={screen}>
              <Renderer response={HEAD + items[step - 1]} library={screenLibrary} isStreaming={false} />
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
            {Array.from({ length: steps }, (_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={step === i}
                aria-label={i === 0 ? "The doubt" : `Practice ${i} of ${items.length}`}
                onClick={() => setStep(i)}
                className="flex h-8 items-center"
              >
                <span className={`block h-2 rounded-full transition-all ${step === i ? "w-6 bg-(--color-signal)" : "w-2 bg-(--color-raised)"}`} />
              </button>
            ))}
          </div>
          {step < steps - 1 ? (
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
