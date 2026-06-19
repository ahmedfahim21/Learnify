import { and, asc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  conceptEdges,
  concepts,
  sessions,
  topics,
  type Concept,
} from "@/db/schema";

/** A topic plus its decomposed concept graph and sessions, scoped to a user. */
export interface TopicGraph {
  topic: { id: string; title: string; status: string };
  concepts: ConceptNode[];
  edges: { from: string; to: string }[];
  sessions: { id: string; status: string; createdAt: string }[];
}

export interface ConceptNode {
  id: string;
  slug: string;
  name: string;
  summary: string;
  difficulty: number;
  orderIndex: number;
  mastery: number;
}

function toNode(c: Concept): ConceptNode {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    summary: c.summary,
    difficulty: c.difficulty,
    orderIndex: c.orderIndex,
    mastery: c.mastery,
  };
}

/**
 * Load a topic with its concept graph (nodes in topological order) and
 * sessions, scoped to the owning user. Returns `null` if the topic doesn't
 * exist or belongs to someone else. Edges are returned as concept-id pairs so
 * the graph view can wire them without a second slug lookup.
 */
export async function getTopicGraph(
  topicId: string,
  userId: string,
): Promise<TopicGraph | null> {
  const db = getDb();

  const [topic] = await db
    .select({ id: topics.id, title: topics.title, status: topics.status })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);
  if (!topic) return null;

  const conceptRows = await db
    .select()
    .from(concepts)
    .where(eq(concepts.topicId, topicId))
    .orderBy(asc(concepts.orderIndex));

  const edgeRows = await db
    .select({
      from: conceptEdges.fromConceptId,
      to: conceptEdges.toConceptId,
    })
    .from(conceptEdges)
    .where(eq(conceptEdges.topicId, topicId));

  const sessionRows = await db
    .select({
      id: sessions.id,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.topicId, topicId))
    .orderBy(asc(sessions.createdAt));

  return {
    topic,
    concepts: conceptRows.map(toNode),
    edges: edgeRows.map((e) => ({ from: e.from, to: e.to })),
    sessions: sessionRows.map((s) => ({
      id: s.id,
      status: s.status,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}
