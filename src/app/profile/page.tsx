"use client";

import { ArrowRight, Flame, Layers, LogOut, SlidersHorizontal, Sparkles, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LearningSetup } from "@/components/lecture/LearningSetup";
import { usePreferences } from "@/components/lecture/usePreferences";
import { signOut, useSession } from "@/lib/authClient";
import { isLang, LANGUAGES, type Lang } from "@/lib/languages";

/**
 * The student's own page: who they're signed in as, how they've chosen to
 * learn, their streak and today's AI allowance, and the flashcards due for
 * review, each linking back to the moment of the lecture that teaches it.
 */

interface DueCard {
  cardId: string;
  lectureId: string;
  lang: string;
  front: string;
  startSec: number;
}

interface RecentQuiz {
  lectureId: string;
  lectureTitle: string;
  courseTitle: string;
  lang: string;
  score: number;
  total: number;
  createdAt: string;
}

interface Progress {
  quizzes: { taken: number; averagePct: number | null; recent: RecentQuiz[] };
  due: DueCard[];
  upcoming: number;
  nextDueAt: string | null;
  streak: { current: number; longest: number };
}

interface Budget {
  used: number;
  limit: number;
  remaining: number;
}

const GOAL = { understand: "Understand it properly", practise: "Test myself", revise: "Revise fast" } as const;
const LEVEL = { simpler: "Go easy", standard: "Just right", harder: "Challenge me" } as const;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `${url} → HTTP ${res.status}`);
  return body as T;
}

function nextIn(iso: string): string {
  const hours = (new Date(iso).getTime() - Date.now()) / 3_600_000;
  if (hours < 1) return "within the hour";
  if (hours < 20) return `in about ${Math.round(hours)} hours`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "tomorrow" : `in ${days} days`;
}

export default function ProfilePage() {
  const router = useRouter();
  const { user, isPending } = useSession();
  const prefs = usePreferences();
  const [progress, setProgress] = useState<Progress | null>(null);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    Promise.all([getJson<Progress>("/api/me/progress"), getJson<Budget>("/api/budget")]).then(
      ([p, b]) => {
        setProgress(p);
        setBudget(b);
      },
      (err: Error) => {
        console.error("loading the profile failed:", err);
        setError(err.message);
      },
    );
  }, [user]);

  if (isPending) {
    return (
      <main className="wrap max-w-4xl space-y-6 py-12" aria-busy>
        <div className="h-24 animate-pulse rounded-3xl bg-(--color-raised)" />
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-(--color-raised)" />
          ))}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="wrap max-w-xl space-y-4 py-16">
        <h1 className="text-4xl">Your profile</h1>
        <p className="text-lg text-(--color-mist)">Sign in to keep your streak, your flashcards and how you like to learn, on every device.</p>
        <Link href="/signin?next=/profile" className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-signal) px-6 text-white">
          Sign in <ArrowRight size={16} aria-hidden />
        </Link>
      </main>
    );
  }

  const current = prefs.state.phase === "ready" || prefs.state.phase === "editing" ? prefs.state.prefs : null;
  const suggested: Lang = current?.lang ?? "hi";

  return (
    <main className="wrap max-w-4xl space-y-8 py-12">
      <header className="flex flex-wrap items-center gap-5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element -- provider avatars are arbitrary remote hosts
          <img src={user.image} alt="" className="h-20 w-20 rounded-full border border-(--color-line)" />
        ) : (
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-(--color-signal) text-3xl text-white">
            {(user.name ?? user.email).slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-4xl">{user.name ?? "Your profile"}</h1>
          <p className="truncate text-(--color-mist)">{user.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut().then(() => router.push("/"), (err) => console.error("sign-out failed:", err))}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-(--color-line) px-4 text-(--color-mist) hover:border-(--color-faint) hover:text-(--color-fg)"
        >
          <LogOut size={15} aria-hidden /> Sign out
        </button>
      </header>

      {error && (
        <p role="alert" className="text-(--color-alert)">
          Couldn&apos;t load your progress: {error}
        </p>
      )}

      <section aria-label="Progress" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={Flame}
          colour="var(--color-accent)"
          label="Day streak"
          value={progress ? String(progress.streak.current) : null}
          note={progress ? `Longest ${progress.streak.longest}` : null}
        />
        <Stat
          icon={Trophy}
          colour="var(--color-deep)"
          label="Quizzes taken"
          value={progress ? String(progress.quizzes.taken) : null}
          note={progress ? (progress.quizzes.averagePct === null ? "Finish one to see your average" : `Average ${progress.quizzes.averagePct}%`) : null}
        />
        <Stat
          icon={Layers}
          colour="var(--color-flow)"
          label="Flashcards due"
          value={progress ? String(progress.due.length) : null}
          note={progress ? (progress.nextDueAt && progress.due.length === 0 ? `Next ${nextIn(progress.nextDueAt)}` : `${progress.upcoming} coming up`) : null}
        />
        <Stat
          icon={Sparkles}
          colour="var(--color-signal)"
          label="AI uses left today"
          value={budget ? String(budget.remaining) : null}
          note={budget ? `of ${budget.limit}, for notes, quizzes and doubts` : null}
        />
      </section>

      <section className="space-y-4 rounded-3xl border border-(--color-line) bg-(--color-surface) p-6" aria-labelledby="prefs-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="prefs-heading" className="text-2xl">
            How you learn
          </h2>
          <button
            type="button"
            onClick={prefs.edit}
            disabled={!current}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-(--color-line) bg-(--color-node) px-4 text-sm hover:border-(--color-signal) disabled:opacity-50"
          >
            <SlidersHorizontal size={14} aria-hidden /> Change
          </button>
        </div>
        {prefs.state.phase === "loading" ? (
          <div className="h-16 animate-pulse rounded-2xl bg-(--color-raised)" />
        ) : prefs.state.phase === "error" ? (
          <p className="text-(--color-alert)">Couldn&apos;t load them: {prefs.state.message}</p>
        ) : current ? (
          <dl className="grid gap-3 sm:grid-cols-4">
            {[
              ["Language", <span key="l" lang={LANGUAGES[current.lang].sarvam}>{LANGUAGES[current.lang].native}</span>],
              ["Here to", GOAL[current.goal]],
              ["Level", LEVEL[current.level]],
              ["Pop-up checks", current.checks ? "On" : "Off"],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-2xl bg-(--color-node) p-4">
                <dt className="label">{k}</dt>
                <dd className="mt-1 text-lg">{v}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-(--color-mist)">Not chosen yet. You&apos;ll be asked when you open your first lecture.</p>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="quizzes-heading">
        <h2 id="quizzes-heading" className="text-2xl">
          Recent quizzes
        </h2>
        {!progress ? (
          !error && <div className="h-24 animate-pulse rounded-2xl bg-(--color-raised)" />
        ) : progress.quizzes.recent.length === 0 ? (
          <div className="kolam rounded-2xl border border-(--color-line) p-6">
            <p className="text-lg">No quizzes yet.</p>
            <p className="text-(--color-mist)">Finish a quiz on any lecture and your score lands here.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {progress.quizzes.recent.map((q) => {
              const pct = Math.round((q.score / q.total) * 100);
              const tone = pct >= 80 ? "var(--color-deep)" : pct >= 50 ? "var(--color-signal)" : "var(--color-warn)";
              return (
                <li key={`${q.lectureId}-${q.createdAt}`}>
                  <Link
                    href={`/lecture/${q.lectureId}`}
                    className="tile group flex items-center gap-4 rounded-2xl border border-(--color-line) bg-(--color-node) p-4 hover:border-(--color-signal)"
                  >
                    <span
                      className="flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl font-mono text-white"
                      style={{ background: tone }}
                    >
                      <span className="text-lg leading-none">
                        {q.score}/{q.total}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{q.lectureTitle}</span>
                      <span className="block truncate text-sm text-(--color-mist)">
                        {q.courseTitle.replace(/^NOC:\s*/, "")} ·{" "}
                        <span lang={isLang(q.lang) ? LANGUAGES[q.lang].sarvam : undefined}>{isLang(q.lang) ? LANGUAGES[q.lang].native : q.lang}</span>
                        {" · "}
                        {new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-(--color-faint) group-hover:text-(--color-signal)" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4" aria-labelledby="due-heading">
        <h2 id="due-heading" className="text-2xl">
          Due for review
        </h2>
        {!progress ? (
          !error && <div className="h-32 animate-pulse rounded-2xl bg-(--color-raised)" />
        ) : progress.due.length === 0 ? (
          <div className="kolam rounded-2xl border border-(--color-line) p-6">
            <p className="text-lg">Nothing due right now.</p>
            <p className="text-(--color-mist)">
              {progress.nextDueAt ? `The next card comes back ${nextIn(progress.nextDueAt)}.` : "Rate flashcards on a lecture and they'll come back here when you're about to forget them."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {progress.due.slice(0, 12).map((c) => (
              <li key={`${c.lectureId}-${c.cardId}`}>
                <Link
                  href={`/lecture/${c.lectureId}?t=${Math.floor(c.startSec)}`}
                  className="tile group flex items-center gap-4 rounded-2xl border border-(--color-line) bg-(--color-node) p-4 hover:border-(--color-signal)"
                >
                  <span lang={isLang(c.lang) ? LANGUAGES[c.lang].sarvam : undefined} className="line-clamp-2 flex-1">
                    {c.front}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm text-(--color-signal)">
                    Review <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {prefs.state.phase === "editing" && (
        <LearningSetup initial={prefs.state.prefs} suggestedLang={suggested} onSave={prefs.save} onCancel={prefs.cancel} />
      )}
    </main>
  );
}

function Stat({
  icon: Icon,
  colour,
  label,
  value,
  note,
}: {
  icon: typeof Flame;
  colour: string;
  label: string;
  value: string | null;
  note: string | null;
}) {
  return (
    <div className="space-y-2 rounded-2xl border border-(--color-line) bg-(--color-node) p-5">
      <span className="flex items-center gap-2 text-sm text-(--color-mist)">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg text-white" style={{ background: colour }}>
          <Icon size={15} aria-hidden />
        </span>
        {label}
      </span>
      {value === null ? (
        <span className="block h-9 w-16 animate-pulse rounded-lg bg-(--color-raised)" />
      ) : (
        <span className="block font-mono text-4xl leading-none">{value}</span>
      )}
      {note && <span className="block text-sm text-(--color-mist)">{note}</span>}
    </div>
  );
}
