import { notFound } from "next/navigation";

import { TopicClient } from "@/components/topics/TopicClient";
import { getTopicGraph } from "@/lib/concepts";
import { getDemoUserId } from "@/lib/demo";
import { getTopicSources } from "@/lib/sources/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function TopicPage({
  params,
}: {
  params: Promise<{ topicId: string }>;
}) {
  const { topicId } = await params;
  const userId = await getDemoUserId();
  const [graph, sources] = await Promise.all([
    getTopicGraph(topicId, userId),
    getTopicSources(topicId, userId),
  ]);
  if (!graph) notFound();

  return (
    <main className="min-h-screen">
      <TopicClient
        topic={{
          id: graph.topic.id,
          title: graph.topic.title,
          status: graph.topic.status,
          concepts: graph.concepts.map((c) => ({
            id: c.id,
            slug: c.slug,
            name: c.name,
            summary: c.summary,
            difficulty: c.difficulty,
            mastery: c.mastery,
          })),
          edges: graph.edges,
          sessions: graph.sessions,
          sources: sources ?? [],
        }}
      />
    </main>
  );
}
