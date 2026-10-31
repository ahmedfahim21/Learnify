"use client";

import { Flame, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useSession } from "@/lib/authClient";
import { isLang, LANGUAGES } from "@/lib/languages";

/**
 * Today: flashcards due across every lecture, reviewed one at a time. Each
 * card links back to the moment of the lecture that teaches it.
 */

interface DueCard {
  cardId: string;
  lectureId: string;
  lang: string;
  front: string;
  back: string;
  startSec: number;
  reviews: number;
}

interface TodayData {
  due: DueCard[];
  upcoming: number;
  nextDueAt: string | null;
  streak: { current: number; longest: number };
}

const RATINGS = [
  { rating: "again", label: "Again" },
  { rating: "hard", label: "Hard" },
  { rating: "good", label: "Good" },
  { rating: "easy", label: "Easy" },
] as const;

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function nextIn(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  if (hours < 1) return "within the hour";
  if (hours < 20) return `in about ${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "tomorrow" : `in ${days} days`;
}

export default function TodayPage() {
  const { user, isPending } = useSession();
  const [data, setData] = useState<TodayData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!user) return;
    fetch("/api/today")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData(body);
      })
      .catch((err: Error) => {
        console.error("loading Today failed:", err);
        setError(err.message);
      });
  }, [user]);

  const card = data?.due[index];

  async function rate(rating: (typeof RATINGS)[number]["rating"]) {
    if (!card) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/flashcards/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lectureId: card.lectureId, lang: card.lang, cardId: card.cardId, rating }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData((d) => (d ? { ...d, streak: { ...d.streak, current: body.streak } } : d));
      setDone((n) => n + 1);
      setIndex((i) => i + 1);
      setFlipped(false);
    } catch (err) {
      console.error("rating failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="wrap max-w-2xl space-y-8 py-12">
      <div className="space-y-3">
        <p className="label shirorekha">Today</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="text-3xl">Flashcards due</h1>
          {data && data.streak.current > 0 && (
            <p className="inline-flex items-center gap-1.5 text-(--color-warn)">
              <Flame size={16} aria-hidden /> {data.streak.current}-day streak
            </p>
          )}
        </div>
      </div>

      {isPending || (user && !data && !error) ? (
        <div className="h-56 animate-pulse rounded-(--radius) bg-(--color-raised)" />
      ) : !user ? (
        <p className="text-(--color-mist)">
          <Link href="/signin?next=/today" className="link">
            Sign in
          </Link>{" "}
          to keep flashcards from lectures and review them here when they&apos;re due.
        </p>
      ) : error && !data ? (
        <p role="alert" className="text-(--color-alert)">
          Couldn&apos;t load today&apos;s cards: {error}
        </p>
      ) : data && !card ? (
        <div className="kolam space-y-3 rounded-(--radius) border border-(--color-line) p-8">
          <p className="text-xl">{done > 0 ? `That's all ${done} for now.` : "Nothing due right now."}</p>
          <p className="text-(--color-mist)">
            {data.nextDueAt
              ? `The next card comes back ${nextIn(data.nextDueAt)}.`
              : "Rate flashcards in any lecture and they'll come back here when it's time to see them again."}
          </p>
          <Link href="/courses" className="link inline-block">
            Find a lecture
          </Link>
        </div>
      ) : (
        card &&
        data && (
          <div className="space-y-4">
            <p className="font-mono text-sm text-(--color-mist)" aria-live="polite">
              {index + 1} of {data.due.length}
            </p>
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              lang={isLang(card.lang) ? LANGUAGES[card.lang].sarvam : undefined}
              aria-label={flipped ? "Show the question" : "Show the answer"}
              className="flex min-h-56 w-full flex-col justify-between gap-6 rounded-(--radius) border border-(--color-line) bg-(--color-surface) p-6 text-left transition-colors hover:border-(--color-faint)"
            >
              <span className="label">{flipped ? "Answer" : "Question"}</span>
              <span className="text-xl">{flipped ? card.back : card.front}</span>
              <span className="label inline-flex items-center gap-1.5">
                <RotateCcw size={12} aria-hidden /> {flipped ? "Tap for the question" : "Tap to reveal"}
              </span>
            </button>

            {flipped && (
              <div className="grid grid-cols-4 gap-2">
                {RATINGS.map(({ rating, label }) => (
                  <button
                    key={rating}
                    type="button"
                    disabled={saving}
                    onClick={() => rate(rating)}
                    className={`min-h-11 rounded-(--radius) border border-(--color-line) transition-colors disabled:opacity-50 ${
                      rating === "again" ? "text-(--color-warn) hover:border-(--color-warn)" : "hover:border-(--color-signal) hover:text-(--color-signal)"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-(--color-alert)">
                Couldn&apos;t save that: {error}
              </p>
            )}

            <Link
              href={`/lecture/${card.lectureId}?t=${Math.floor(card.startSec)}`}
              className="inline-flex min-h-11 items-center gap-2 text-(--color-signal)"
            >
              <span className="font-mono">{formatTime(card.startSec)}</span> Watch the moment in the lecture
            </Link>
          </div>
        )
      )}
    </main>
  );
}
