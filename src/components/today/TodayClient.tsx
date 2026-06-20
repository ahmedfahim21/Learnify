"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DueConcept, TodaySnapshot } from "@/lib/mastery/engine";

/** Group a list of concepts by their topic, preserving first-seen order. */
function groupByTopic(items: DueConcept[]): {
  topicId: string;
  topicTitle: string;
  concepts: DueConcept[];
}[] {
  const groups = new Map<
    string,
    { topicId: string; topicTitle: string; concepts: DueConcept[] }
  >();
  for (const item of items) {
    const group = groups.get(item.topicId);
    if (group) group.concepts.push(item);
    else
      groups.set(item.topicId, {
        topicId: item.topicId,
        topicTitle: item.topicTitle,
        concepts: [item],
      });
  }
  return [...groups.values()];
}

function MasteryBar({ score }: { score: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-emerald-400/70"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs text-white/40">{pct}%</span>
    </div>
  );
}

export function TodayClient({ snapshot }: { snapshot: TodaySnapshot }) {
  const router = useRouter();
  const [busyTopic, setBusyTopic] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dueGroups = useMemo(() => groupByTopic(snapshot.due), [snapshot.due]);
  const { current, longest, activeToday } = snapshot.streak;

  async function startReview(topicId: string, conceptIds: string[]) {
    setBusyTopic(topicId);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, kind: "review", conceptIds }),
      });
      if (!response.ok) throw new Error("Could not start a review session.");
      const { session } = (await response.json()) as { session: { id: string } };
      router.push(`/session/${session.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusyTopic(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => router.push("/topics")}
          className="self-start text-sm text-white/50 transition hover:text-white/80"
        >
          ← All topics
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Today</h1>
            <p className="text-white/50">
              Your spaced-repetition queue and what still needs work.
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.03] px-4 py-2 text-right">
            <div className="flex items-center gap-1.5 text-2xl font-semibold">
              <span>{activeToday ? "🔥" : "🌙"}</span>
              <span>{current}</span>
            </div>
            <p className="text-xs text-white/40">
              day streak{longest > current ? ` · best ${longest}` : ""}
            </p>
          </div>
        </div>
      </header>

      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-widest text-white/40">
          Due for review {snapshot.due.length > 0 && `· ${snapshot.due.length}`}
        </h2>
        {dueGroups.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/50">
            Nothing due right now. Learn a topic or come back later — concepts
            resurface as they fade.
          </div>
        ) : (
          dueGroups.map((group) => (
            <div
              key={group.topicId}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.02] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => router.push(`/topics/${group.topicId}`)}
                  className="text-left font-medium text-white/90 transition hover:text-white"
                >
                  {group.topicTitle}
                </button>
                <button
                  type="button"
                  disabled={busyTopic === group.topicId}
                  onClick={() =>
                    void startReview(
                      group.topicId,
                      group.concepts.map((c) => c.conceptId),
                    )
                  }
                  className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium transition hover:bg-white/15 disabled:opacity-50"
                >
                  {busyTopic === group.topicId
                    ? "Starting…"
                    : `Review ${group.concepts.length} due`}
                </button>
              </div>
              <ul className="flex flex-col divide-y divide-white/5">
                {group.concepts.map((concept) => (
                  <li
                    key={concept.conceptId}
                    className="flex items-center justify-between gap-3 py-1.5"
                  >
                    <span className="text-sm text-white/70">
                      {concept.conceptName}
                    </span>
                    <MasteryBar score={concept.displayScore} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {snapshot.weak.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs uppercase tracking-widest text-white/40">
            Still shaky
          </h2>
          <ul className="flex flex-col divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02] px-4">
            {snapshot.weak.map((concept) => (
              <li
                key={concept.conceptId}
                className="flex items-center justify-between gap-3 py-3"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/topics/${concept.topicId}`)}
                  className="text-left text-sm text-white/70 transition hover:text-white"
                >
                  {concept.conceptName}
                  <span className="ml-2 text-white/35">
                    · {concept.topicTitle}
                  </span>
                </button>
                <MasteryBar score={concept.displayScore} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
