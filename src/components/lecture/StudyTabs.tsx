"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";

import type { Lang } from "@/lib/languages";
import type { ViewPack } from "@/lib/lectures/view";

/**
 * The study side of a lecture. Notes and Quiz are generated UI: the model
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
const LABELS: Record<Tab, string> = { notes: "Notes", quiz: "Quiz", cards: "Flashcards", map: "Concept map" };

interface Props {
  tab: Tab;
  onTab: (tab: Tab) => void;
  lectureId: string;
  lang: Lang;
  /** Generated screens need the English transcript to ground them in. */
  transcriptReady: boolean;
  pack: ViewPack | null;
  /** Why the pack tabs are empty, when they are: still building, or failed. */
  packNote: string | null;
}

export function StudyTabs({ tab, onTab, lectureId, lang, transcriptReady, pack, packNote }: Props) {
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const move = (delta: number) => {
    const next = TABS[(TABS.indexOf(tab) + delta + TABS.length) % TABS.length];
    onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <div
        role="tablist"
        aria-label="Study"
        className="flex gap-1 overflow-x-auto border-b border-(--color-line)"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") move(1);
          else if (e.key === "ArrowLeft") move(-1);
        }}
      >
        {TABS.map((t) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[t] = el;
            }}
            id={`tab-${t}`}
            role="tab"
            type="button"
            aria-selected={tab === t}
            aria-controls={`panel-${t}`}
            tabIndex={tab === t ? 0 : -1}
            onClick={() => onTab(t)}
            className={`-mb-px min-h-11 shrink-0 border-b px-3 text-sm transition-colors ${
              tab === t ? "border-(--color-signal) text-(--color-fg)" : "border-transparent text-(--color-mist) hover:text-(--color-fg)"
            }`}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="min-h-0">
        {tab === "notes" || tab === "quiz" ? (
          transcriptReady ? (
            <GeneratedScreen key={`${tab}-${lang}`} lectureId={lectureId} lang={lang} kind={tab} />
          ) : (
            <StudyPlaceholder note="Fetching the lecture's captions; notes and quizzes are written from them." />
          )
        ) : pack ? (
          <StudyProgram pack={pack} tab={tab} />
        ) : (
          <StudyPlaceholder note={packNote} />
        )}
      </div>
    </div>
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
