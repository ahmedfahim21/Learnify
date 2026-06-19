"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface TopicSummary {
  id: string;
  title: string;
}

export function TopicsClient({ initialTopics }: { initialTopics: TopicSummary[] }) {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicSummary[]>(initialTopics);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createTopic() {
    const trimmed = title.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      });
      if (!response.ok) throw new Error("Could not create the topic.");
      const { topic } = (await response.json()) as {
        topic: TopicSummary;
      };
      setTopics((prev) => [topic, ...prev]);
      setTitle("");
      // Land on the topic page, where the concept map is built and a session
      // can be started against the whole topic or selected concepts (#42).
      router.push(`/topics/${topic.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-12">
      <div>
        <h1 className="text-3xl font-semibold">What do you want to learn?</h1>
        <p className="mt-2 text-white/60">
          Enter any topic and the tutor will build a live, interactive session
          for you.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void createTopic();
          }}
          placeholder="e.g. Bayes' theorem"
          disabled={busy}
          className="flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-3 outline-none placeholder:text-white/30 focus:border-white/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => void createTopic()}
          disabled={busy || !title.trim()}
          className="rounded-lg border border-white/20 bg-white/10 px-5 py-3 font-medium transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Starting…" : "Start learning"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}

      {topics.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xs uppercase tracking-widest text-white/40">
            Your topics
          </h2>
          <ul className="divide-y divide-white/10 rounded-lg border border-white/10">
            {topics.map((topic) => (
              <li
                key={topic.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span>{topic.title}</span>
                <button
                  type="button"
                  onClick={() => router.push(`/topics/${topic.id}`)}
                  disabled={busy}
                  className="rounded border border-white/15 px-3 py-1 text-sm text-white/70 transition hover:border-white/40 disabled:opacity-50"
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
