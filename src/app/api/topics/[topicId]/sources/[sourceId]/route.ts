import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { sources, topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";
import { ingestAndPersist, type IngestInput } from "@/lib/sources/ingest";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Load a source, scoped to the demo learner via its topic. */
async function ownSource(topicId: string, sourceId: string) {
  const db = getDb();
  const userId = await getDemoUserId();
  const [row] = await db
    .select({
      id: sources.id,
      kind: sources.kind,
      sourceUrl: sources.sourceUrl,
      blobUrl: sources.blobUrl,
    })
    .from(sources)
    .innerJoin(topics, eq(sources.topicId, topics.id))
    .where(
      and(
        eq(sources.id, sourceId),
        eq(sources.topicId, topicId),
        eq(topics.userId, userId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Remove a source (and its chunks, via cascade) plus its uploaded blob. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ topicId: string; sourceId: string }> },
): Promise<Response> {
  const { topicId, sourceId } = await params;
  const source = await ownSource(topicId, sourceId);
  if (!source) {
    return Response.json({ error: "source not found" }, { status: 404 });
  }

  // Best-effort blob cleanup — never block deletion of the DB row on it.
  if (source.blobUrl) {
    try {
      await del(source.blobUrl);
    } catch (err) {
      console.warn("[sources] blob delete failed (continuing):", err);
    }
  }

  await getDb().delete(sources).where(eq(sources.id, sourceId));
  return Response.json({ ok: true });
}

/**
 * Re-ingest a source. With a `manualTranscript` in the body, a failed YouTube
 * source is recovered from the pasted text; otherwise it re-runs the original
 * ingestion (e.g. after a transient fetch failure).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string; sourceId: string }> },
): Promise<Response> {
  const { topicId, sourceId } = await params;
  const source = await ownSource(topicId, sourceId);
  if (!source) {
    return Response.json({ error: "source not found" }, { status: 404 });
  }

  let body: { manualTranscript?: unknown } = {};
  try {
    body = (await request.json()) as { manualTranscript?: unknown };
  } catch {
    /* no body — a plain retry */
  }
  const manualTranscript =
    typeof body.manualTranscript === "string" ? body.manualTranscript.trim() : "";

  let input: IngestInput;
  if (source.kind === "youtube") {
    input = {
      kind: "youtube",
      url: source.sourceUrl ?? "",
      ...(manualTranscript ? { manualTranscript } : {}),
    };
  } else if (source.kind === "url") {
    input = { kind: "url", url: source.sourceUrl ?? "" };
  } else {
    // PDF re-ingestion would need the original bytes (only the blob is kept).
    // Removing and re-uploading is the supported path.
    return Response.json(
      { error: "Remove this PDF and upload it again to re-ingest." },
      { status: 400 },
    );
  }

  const outcome = await ingestAndPersist(sourceId, topicId, input);
  return Response.json({ outcome });
}
