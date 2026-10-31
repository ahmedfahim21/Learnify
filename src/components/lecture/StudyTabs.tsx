"use client";

import { BookOpen, Layers, type LucideIcon, Network, Sparkles, Trophy } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef } from "react";

import { LANGUAGES, type Lang } from "@/lib/languages";
import type { ViewPack } from "@/lib/lectures/view";
import type { Level } from "@/lib/preferences";
import { StudyNavContext } from "@/lib/openui/contexts";

/**
 * The study area under a lecture: four modes as tiles, then the open one. Notes and Quiz are generated UI: the model
 * writes them from the lecture in the student's language. Flashcards and the
 * concept map render the lecture's study pack. Everything loads with its tab.
 */

const StudyProgram = dynamic(() => import("./StudyProgram"), {
  ssr: false,
  loading: () => <StudyPlaceholder note={null} />,
});
const GeneratedScreen = dynamic(() => import("./GeneratedScreen"), {
  ssr: false,
  loading: () => <StudyPlaceholder note={null} />,
});

export const TABS = ["notes", "quiz", "cards", "map"] as const;
export type Tab = (typeof TABS)[number];
const MODES: Record<Tab, { label: string; hint: string; icon: LucideIcon; colour: string }> = {
  notes: { label: "Notes", hint: "Read it, flip the cards", icon: BookOpen, colour: "var(--color-signal)" },
  quiz: { label: "Quiz", hint: "Play for points", icon: Trophy, colour: "var(--color-accent)" },
  cards: { label: "Flashcards", hint: "Remember it for good", icon: Layers, colour: "var(--color-flow)" },
  map: { label: "Concept map", hint: "See how it connects", icon: Network, colour: "var(--color-deep)" },
};

interface Props {
  tab: Tab;
  onTab: (tab: Tab) => void;
  lectureId: string;
  lang: Lang;
  /** How hard to pitch generated screens: the variant they open on. */
  level: Level;
  /** Generated screens need the English transcript to ground them in. */
  transcriptReady: boolean;
  pack: ViewPack | null;
  /** Whether the study pack has been asked for (it costs generations, so it waits until it is). */
  packRequested: boolean;
  onRequestPack: () => void;
  /** Why the pack tabs are empty, when they are: still building, or failed. */
  packNote: string | null;
}

export function StudyTabs({ tab, onTab, lectureId, lang, level, transcriptReady, pack, packRequested, onRequestPack, packNote }: Props) {
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const move = (delta: number) => {
    const next = TABS[(TABS.indexOf(tab) + delta + TABS.length) % TABS.length];
    onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <StudyNavContext.Provider value={onTab}>
      <section className="@container space-y-6" aria-label="Study this lecture">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-3xl">Study this lecture</h2>
          <p className="text-(--color-mist)" lang={LANGUAGES[lang].sarvam}>
            in {LANGUAGES[lang].native}
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Study mode"
          className="grid grid-cols-2 gap-3 @3xl:grid-cols-4"
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") move(1);
            else if (e.key === "ArrowLeft") move(-1);
          }}
        >
          {TABS.map((t) => {
            const m = MODES[t];
            const on = tab === t;
            return (
              <button
                key={t}
                ref={(el) => {
                  tabRefs.current[t] = el;
                }}
                id={`tab-${t}`}
                role="tab"
                type="button"
                aria-selected={on}
                aria-controls={`panel-${t}`}
                tabIndex={on ? 0 : -1}
                onClick={() => onTab(t)}
                className="tile flex items-center gap-3 rounded-2xl border-2 p-3 text-left sm:p-4"
                style={{
                  borderColor: on ? m.colour : "var(--color-line)",
                  background: on ? `color-mix(in srgb, ${m.colour} 9%, var(--color-node))` : "var(--color-node)",
                }}
              >
                <span
                  aria-hidden
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition-transform"
                  style={{ background: m.colour, transform: on ? "rotate(-6deg) scale(1.05)" : undefined }}
                >
                  <m.icon size={20} />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg leading-tight">{m.label}</span>
                  <span className="hidden truncate text-sm text-(--color-mist) @lg:block">{m.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div
          id={`panel-${tab}`}
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          className={`rounded-2xl border border-(--color-line) bg-(--color-ink) p-4 sm:p-8 ${tab === "map" ? "" : "[&>*]:mx-auto [&>*]:max-w-3xl"}`}
        >
          {tab === "notes" || tab === "quiz" ? (
            transcriptReady ? (
              <GeneratedScreen key={`${tab}-${lang}-${level}`} lectureId={lectureId} lang={lang} kind={tab} level={level} />
            ) : (
              <StudyPlaceholder note="Fetching the lecture's captions; notes and quizzes are written from them." />
            )
          ) : pack ? (
            <StudyProgram pack={pack} tab={tab} />
          ) : packRequested ? (
            <StudyPlaceholder note={packNote} />
          ) : (
            <div className="kolam flex flex-col items-start gap-4 rounded-2xl border border-(--color-line) p-6">
              <p className="text-xl">{tab === "cards" ? "Flashcards" : "A concept map"} for this lecture, in {LANGUAGES[lang].native}.</p>
              <p className="text-(--color-mist)">
                Flashcards, the concept map and the pop-up checks are one study pack, written once and shared with everyone.
              </p>
              <button
                type="button"
                onClick={onRequestPack}
                className="tile inline-flex min-h-12 items-center gap-2 rounded-full px-6 text-white"
                style={{ background: MODES[tab].colour }}
              >
                <Sparkles size={16} aria-hidden /> Make the study pack
              </button>
            </div>
          )}
        </div>
      </section>
    </StudyNavContext.Provider>
  );
}

function StudyPlaceholder({ note }: { note: string | null }) {
  return (
    <div className="space-y-3">
      <div className="h-40 animate-pulse rounded-(--radius) bg-(--color-raised)" />
      <div className="h-4 w-2/3 animate-pulse rounded-(--radius) bg-(--color-raised)" />
      {note && <p className="text-sm text-(--color-mist)">{note}</p>}
    </div>
  );
}
