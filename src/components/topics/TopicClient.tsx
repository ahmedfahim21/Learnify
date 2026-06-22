"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  KnowledgeGraph,
  type GraphConcept,
  type GraphEdge,
} from "@/components/graph/KnowledgeGraph";
import { SourcesPanel, type SourceItem } from "@/components/topics/SourcesPanel";

interface SessionSummary {
  id: string;
  status: string;
  createdAt: string;
}

export interface TopicView {
  id: string;
  title: string;
  status: string;
  concepts: GraphConcept[];
  edges: GraphEdge[];
  sessions: SessionSummary[];
  sources: SourceItem[];
}

const POLL_MS = 2500;

export function TopicClient({ topic }: { topic: TopicView }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggered = useRef(false);

  const decomposing = topic.status === "new" || topic.status === "decomposing";

  // Kick off decomposition once for a fresh topic, then let polling pick it up.
  useEffect(() => {
    if (topic.status !== "new" || triggered.current) return;
    triggered.current = true;
    void fetch(`/api/topics/${topic.id}/decompose`, { method: "POST" })
      .catch(() => {})
      .finally(() => router.refresh());
  }, [topic.status, topic.id, router]);

  // While decomposing, poll the server component for the finished graph.
  useEffect(() => {
    if (!decomposing) return;
    const handle = setInterval(() => router.refresh(), POLL_MS);
    return () => clearInterval(handle);
  }, [decomposing, router]);

  function toggle(conceptId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) next.delete(conceptId);
      else next.add(conceptId);
      return next;
    });
  }

  async function retry() {
    setBusy(true);
    setError(null);
    try {
      triggered.current = true;
      await fetch(`/api/topics/${topic.id}/decompose`, { method: "POST" });
    } catch {
      // ignore — the refresh will reflect the new status
    } finally {
      router.refresh();
      setBusy(false);
    }
  }

  async function startSession() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicId: topic.id,
          conceptIds: [...selected],
        }),
      });
      if (!response.ok) throw new Error("Could not start a session.");
      const { session } = (await response.json()) as { session: { id: string } };
      router.push(`/session/${session.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => router.push("/topics")}
          className="self-start text-sm text-white/50 transition hover:text-white/80"
        >
          ← All topics
        </button>
        <h1 className="text-3xl font-semibold">{topic.title}</h1>
        <p className="text-white/50">
          The prerequisite concept map for this topic. Pick concepts to focus a
          session, or start one covering the whole topic.
        </p>
      </header>

      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {decomposing && (
        <div className="flex h-[28rem] flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
          <p className="text-white/70">Building your concept map…</p>
          <p className="max-w-sm text-sm text-white/40">
            The tutor is decomposing “{topic.title}” into a prerequisite graph of
            concepts. This takes a few seconds.
          </p>
        </div>
      )}

      {topic.status === "failed" && (
        <div className="flex h-[20rem] flex-col items-center justify-center gap-4 rounded-xl border border-white/10 bg-white/[0.02] text-center">
          <p className="text-white/70">We couldn’t build the concept map.</p>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={busy}
            className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 font-medium transition hover:bg-white/15 disabled:opacity-50"
          >
            {busy ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}

      {topic.status === "ready" && (
        <>
          <KnowledgeGraph
            concepts={topic.concepts}
            edges={topic.edges}
            selectedIds={selected}
            onToggle={toggle}
          />

          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-white/50">
              {selected.size === 0
                ? `${topic.concepts.length} concepts · start a session covering all of them`
                : `${selected.size} concept${selected.size === 1 ? "" : "s"} selected`}
            </p>
            <div className="flex items-center gap-2">
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="rounded-lg border border-white/15 px-4 py-2.5 text-sm text-white/70 transition hover:border-white/40"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => void startSession()}
                disabled={busy}
                className="rounded-lg border border-white/20 bg-white/10 px-5 py-2.5 font-medium transition hover:bg-white/15 disabled:opacity-50"
              >
                {busy
                  ? "Starting…"
                  : selected.size > 0
                    ? "Start focused session"
                    : "Start session"}
              </button>
            </div>
          </div>
        </>
      )}

      <SourcesPanel topicId={topic.id} sources={topic.sources} />

      {topic.sessions.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-widest text-white/40">
            Sessions
          </h2>
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
            {topic.sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="text-sm text-white/70">
                  {new Date(session.createdAt).toLocaleString()}
                  <span className="ml-2 text-white/40">· {session.status}</span>
                </span>
                <button
                  type="button"
                  onClick={() => router.push(`/session/${session.id}`)}
                  className="rounded border border-white/15 px-3 py-1 text-sm text-white/70 transition hover:border-white/40"
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
