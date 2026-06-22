import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { sources, topics } from "@/db/schema";

import { allowsManualPaste } from "./ingest";

/** A source as the topic page / sources panel renders it. */
export interface SourceView {
  id: string;
  kind: string;
  title: string;
  sourceUrl: string | null;
  status: string;
  error: string | null;
  tokenEstimate: number;
  /** Whether a failed source can be recovered by pasting a transcript. */
  canPasteTranscript: boolean;
  createdAt: string;
}

/**
 * Load a topic's sources, oldest first, scoped to the owning user (so one
 * learner can't read another's sources). Returns `null` only if the topic
 * doesn't exist or isn't theirs; an empty array means no sources yet.
 */
export async function getTopicSources(
  topicId: string,
  userId: string,
): Promise<SourceView[] | null> {
  const db = getDb();

  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);
  if (!topic) return null;

  const rows = await db
    .select()
    .from(sources)
    .where(eq(sources.topicId, topicId))
    .orderBy(asc(sources.createdAt));

  return rows.map((s) => ({
    id: s.id,
    kind: s.kind,
    title: s.title,
    sourceUrl: s.sourceUrl,
    status: s.status,
    error: s.error,
    tokenEstimate: s.tokenEstimate,
    canPasteTranscript: allowsManualPaste(s.kind as "youtube", s.status),
    createdAt: s.createdAt.toISOString(),
  }));
}
