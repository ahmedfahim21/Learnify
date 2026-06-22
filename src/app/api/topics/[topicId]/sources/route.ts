import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { sources, topics } from "@/db/schema";
import { getDemoUserId } from "@/lib/demo";
import { ingestAndPersist, type IngestInput } from "@/lib/sources/ingest";
import { MAX_PDF_BYTES, uploadPdfToBlob } from "@/lib/sources/pdf";
import { getTopicSources } from "@/lib/sources/queries";
import { SourceIngestError } from "@/lib/sources/types";

export const runtime = "nodejs";
// Fetching + parsing a URL or extracting a PDF can take a while.
export const maxDuration = 120;

/** Resolve the topic for the demo learner, or return null if it isn't theirs. */
async function ownTopic(topicId: string): Promise<string | null> {
  const db = getDb();
  const userId = await getDemoUserId();
  const [topic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.id, topicId), eq(topics.userId, userId)))
    .limit(1);
  return topic ? topicId : null;
}

/** List a topic's sources. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ topicId: string }> },
): Promise<Response> {
  const { topicId } = await params;
  const userId = await getDemoUserId();
  const list = await getTopicSources(topicId, userId);
  if (list === null) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }
  return Response.json({ sources: list });
}

/**
 * Attach and ingest a source.
 *
 * Two content types:
 *   - `multipart/form-data` with a `file` field → PDF (uploaded to Vercel Blob)
 *   - `application/json` `{ kind: "url" | "youtube", url }` → web article / video
 *
 * Ingestion runs inline (within the request) and the source is returned with
 * its final "ready" | "failed" status, so the panel reflects the outcome on the
 * next refresh without polling.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ topicId: string }> },
): Promise<Response> {
  const { topicId } = await params;
  if (!(await ownTopic(topicId))) {
    return Response.json({ error: "topic not found" }, { status: 404 });
  }

  const db = getDb();
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("multipart/form-data")) {
      return await createPdfSource(db, topicId, request);
    }
    return await createLinkSource(db, topicId, request);
  } catch (cause) {
    const message =
      cause instanceof SourceIngestError
        ? cause.message
        : "Couldn't add that source.";
    return Response.json({ error: message }, { status: 400 });
  }
}

async function createPdfSource(
  db: ReturnType<typeof getDb>,
  topicId: string,
  request: Request,
): Promise<Response> {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "a PDF file is required" }, { status: 400 });
  }
  if (file.type && file.type !== "application/pdf") {
    return Response.json({ error: "only PDF files are supported" }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return Response.json(
      {
        error: `PDF is too large (${(file.size / (1024 * 1024)).toFixed(
          1,
        )} MB). The limit is ${(MAX_PDF_BYTES / (1024 * 1024)).toFixed(0)} MB.`,
      },
      { status: 400 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const filename = file.name || "source.pdf";
  // Upload first so a missing Blob token / oversize fails before we create a row.
  const blobUrl = await uploadPdfToBlob(bytes, filename);

  const [source] = await db
    .insert(sources)
    .values({ topicId, kind: "pdf", title: filename, blobUrl, status: "pending" })
    .returning();

  const outcome = await ingestAndPersist(source.id, topicId, {
    kind: "pdf",
    bytes,
    filename,
  });
  return Response.json({ source: { ...source, ...outcome } }, { status: 201 });
}

async function createLinkSource(
  db: ReturnType<typeof getDb>,
  topicId: string,
  request: Request,
): Promise<Response> {
  let body: { kind?: unknown; url?: unknown };
  try {
    body = (await request.json()) as { kind?: unknown; url?: unknown };
  } catch {
    body = {};
  }
  const kind = body.kind === "youtube" ? "youtube" : body.kind === "url" ? "url" : null;
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!kind || !url) {
    return Response.json(
      { error: "kind ('url' | 'youtube') and url are required" },
      { status: 400 },
    );
  }

  const [source] = await db
    .insert(sources)
    .values({ topicId, kind, title: url, sourceUrl: url, status: "pending" })
    .returning();

  const input: IngestInput =
    kind === "youtube" ? { kind, url } : { kind: "url", url };
  const outcome = await ingestAndPersist(source.id, topicId, input);
  return Response.json({ source: { ...source, ...outcome } }, { status: 201 });
}
