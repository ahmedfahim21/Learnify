"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Chapter completion, recorded only on an explicit acknowledgement.
 *
 * Scroll position used to drive this, which measured the wrong thing: a fast
 * scroll marked a chapter read without any of it being taken in, and a slow
 * reader who stopped mid-chapter got no credit. Completion is now something
 * the reader does — answer the chapter's check, or acknowledge a refresher —
 * so the number on the progress page reflects engagement rather than travel.
 *
 * Anonymous readers get no-ops: the API would 401, and nagging someone to
 * sign in mid-read is worse than quietly not tracking.
 */
export function useChapterProgress(
  problemSlug: string,
  enabled: boolean,
) {
  const [completed, setCompleted] = useState<Set<string>>(() => new Set());
  // Avoids re-POSTing a phase we've already sent this session.
  const sent = useRef<Set<string>>(new Set());

  // Hydrate what's already read. Client-side so the course page itself stays
  // statically prerendered.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/progress");
      if (!res.ok || cancelled) return;
      const { progress } = (await res.json()) as {
        progress: { problemSlug: string; completedPhases: string[] }[];
      };
      const mine = progress.find((p) => p.problemSlug === problemSlug)?.completedPhases ?? [];
      if (cancelled) return;
      for (const phase of mine) sent.current.add(phase);
      setCompleted(new Set(mine));
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, problemSlug]);

  const markRead = useCallback(
    async (phase: string) => {
      if (!enabled || sent.current.has(phase)) return;
      sent.current.add(phase);
      setCompleted((prev) => new Set(prev).add(phase));
      try {
        const res = await fetch("/api/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problemSlug, phase }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        // Let it be retried rather than silently claiming progress that was
        // never persisted.
        sent.current.delete(phase);
        setCompleted((prev) => {
          const next = new Set(prev);
          next.delete(phase);
          return next;
        });
      }
    },
    [enabled, problemSlug],
  );


  return { completed, markRead };
}
