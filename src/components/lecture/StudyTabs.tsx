"use client";

import { Renderer } from "@openuidev/react-lang";
import { useEffect, useMemo, useRef } from "react";

import { LANGUAGES, type Lang } from "@/lib/languages";
import { serializeStudy } from "@/lib/openui/serializeStudy";
import { studyLibrary } from "@/lib/openui/studyLibrary";
import type { PublicPack } from "@/lib/study/grading";
import type { Segment } from "@/lib/transcripts/merge";

/**
 * Transcript, concept map, flashcards and recap, as tabs beside the player.
 * The study tabs render OpenUI programs built from the pack by the typed
 * serializer; until the pack exists they say what's being built.
 */

export const TABS = ["transcript", "map", "cards", "recap"] as const;
export type Tab = (typeof TABS)[number];
const LABELS: Record<Tab, string> = { transcript: "Transcript", map: "Concept map", cards: "Flashcards", recap: "Recap" };

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface Props {
  tab: Tab;
  onTab: (tab: Tab) => void;
  lang: Lang;
  segments: Segment[] | null;
  currentIndex: number;
  onSeek: (sec: number) => void;
  pack: PublicPack | null;
  /** Why the study tabs are empty, when they are: still building, or failed. */
  packNote: string | null;
}

export function StudyTabs({ tab, onTab, lang, segments, currentIndex, onSeek, pack, packNote }: Props) {
  const programs = useMemo(() => (pack ? serializeStudy(pack) : null), [pack]);
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const move = (delta: number) => {
    const next = TABS[(TABS.indexOf(tab) + delta + TABS.length) % TABS.length];
    onTab(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
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
        {tab === "transcript" ? (
          <Transcript lang={lang} segments={segments} currentIndex={currentIndex} onSeek={onSeek} />
        ) : programs ? (
          <Renderer
            response={programs[tab]}
            library={studyLibrary}
            isStreaming={false}
            onError={(errors) => {
              if (errors.length) console.error(`study ${tab} render errors:`, errors);
            }}
          />
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

function Transcript({
  lang,
  segments,
  currentIndex,
  onSeek,
}: {
  lang: Lang;
  segments: Segment[] | null;
  currentIndex: number;
  onSeek: (sec: number) => void;
}) {
  const list = useRef<HTMLOListElement>(null);

  // Keep the current line in view, without fighting a student who scrolled away.
  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>(`[data-i="${currentIndex}"]`);
    if (!el || !list.current) return;
    const box = list.current.getBoundingClientRect();
    const line = el.getBoundingClientRect();
    const nearView = line.top >= box.top - line.height * 3 && line.bottom <= box.bottom + line.height * 3;
    if (!nearView) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [currentIndex]);

  if (!segments) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }, (_, n) => (
          <div key={n} className="h-10 animate-pulse rounded-(--radius) bg-(--color-raised)" />
        ))}
      </div>
    );
  }

  return (
    <ol ref={list} lang={LANGUAGES[lang].sarvam} className="max-h-[60vh] space-y-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-14rem)]">
      {segments.map((s, n) => {
        const current = n === currentIndex;
        return (
          <li key={s.i} data-i={n}>
            <button
              type="button"
              onClick={() => onSeek(s.startSec)}
              aria-current={current ? "true" : undefined}
              className={`flex w-full gap-3 rounded-(--radius) border-l-2 px-2.5 py-1.5 text-left transition-colors ${
                current
                  ? "border-(--color-signal) bg-(--color-raised) text-(--color-fg)"
                  : "border-transparent text-(--color-mist) hover:text-(--color-fg)"
              }`}
            >
              <span className="mt-1 w-10 shrink-0 font-mono text-xs text-(--color-faint)">{formatTime(s.startSec)}</span>
              <span>{s.text}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
