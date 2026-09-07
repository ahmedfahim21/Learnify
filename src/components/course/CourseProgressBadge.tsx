"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/authClient";

interface Summary {
  problemSlug: string;
  completedPhases: string[];
  totalChapters: number;
  fraction: number;
}

/**
 * Per-course completion on the catalog cards.
 *
 * Fetched client-side so /courses stays statically prerendered, and rendered
 * as nothing at all when signed out — an empty "0/7" for every visitor is
 * noise, not information.
 */
export function CourseProgressBadge({ slug }: { slug: string }) {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/progress");
      if (!res.ok || cancelled) return;
      const { progress } = (await res.json()) as { progress: Summary[] };
      if (!cancelled) setSummary(progress.find((p) => p.problemSlug === slug) ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, slug]);

  if (!summary || summary.completedPhases.length === 0) return null;

  const done = summary.fraction >= 1;
  return (
    <span className={`chip ${done ? "border-(--color-signal)/40 text-(--color-signal)" : ""}`}>
      {done ? "completed" : `${summary.completedPhases.length}/${summary.totalChapters} read`}
    </span>
  );
}
