import { getDemoUserId } from "@/lib/demo";
import { materializeProblem } from "@/lib/content/materialize";
import { getTopicGraph } from "@/lib/concepts";
import { getProblem } from "@/content/systemDesign";

export const runtime = "nodejs";

/**
 * Start (or resume) a curated course: materializes its concept DAG into a
 * topic for the demo user and returns the topic id, bypassing LLM
 * decomposition entirely (see `materializeProblem`). Idempotent — calling
 * this twice for the same course returns the same topic.
 *
 * Also returns the concept slug -> id mapping so the caller (the course
 * reader's "practice this chapter" button) can scope a session to a
 * specific chapter's concepts without a second round trip.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const { slug } = await params;

  if (!getProblem(slug)) {
    return Response.json({ error: "unknown course" }, { status: 404 });
  }

  const userId = await getDemoUserId();
  const { topicId, created } = await materializeProblem(userId, slug);
  const graph = await getTopicGraph(topicId, userId);

  return Response.json(
    {
      topicId,
      created,
      concepts: (graph?.concepts ?? []).map((c) => ({ id: c.id, slug: c.slug })),
    },
    { status: created ? 201 : 200 },
  );
}
