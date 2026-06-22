import { and, eq, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { sourceChunks, sources } from "@/db/schema";

import { ingestPdf } from "./pdf";
import { ingestUrl } from "./url";
import { ingestManualTranscript, ingestYouTube } from "./youtube";
import { type IngestResult, SourceIngestError, type SourceKind } from "./types";

/**
 * Source ingestion orchestrator (#45).
 *
 * Routes a source to the right kind-specific ingester, enforces the per-topic
 * token budget, and persists the resulting chunks — flipping the source through
 * the "ingesting" → "ready" | "failed" lifecycle. Both the create route and the
 * retry route funnel through {@link ingestAndPersist} so the DB-write logic
 * lives in exactly one place.
 */

/**
 * Per-topic ceiling on total source tokens. Sources are long-context document
 * blocks (no vector DB), so the whole corpus rides in the prompt — this keeps a
 * topic comfortably inside the model's context window with room for teaching.
 */
export const MAX_TOPIC_SOURCE_TOKENS = 200_000;

/** Discriminated input describing what to ingest. */
export type IngestInput =
  | { kind: "url"; url: string }
  | { kind: "youtube"; url: string; manualTranscript?: string }
  | { kind: "pdf"; bytes: Uint8Array; filename: string };

/** Run the kind-specific ingester. Throws {@link SourceIngestError} on failure. */
async function dispatchIngest(input: IngestInput): Promise<IngestResult> {
  switch (input.kind) {
    case "url":
      return ingestUrl(input.url);
    case "youtube":
      return input.manualTranscript
        ? ingestManualTranscript(input.url, input.manualTranscript)
        : ingestYouTube(input.url);
    case "pdf":
      return ingestPdf(input.bytes, input.filename);
  }
}

/** Sum the token estimates of a topic's ready sources, excluding one source. */
async function otherSourcesTokenTotal(
  topicId: string,
  excludeSourceId: string,
): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${sources.tokenEstimate}), 0)` })
    .from(sources)
    .where(
      and(
        eq(sources.topicId, topicId),
        eq(sources.status, "ready"),
        ne(sources.id, excludeSourceId),
      ),
    );
  return Number(row?.total ?? 0);
}

/**
 * Ingest `input` into an existing source row and persist the result.
 *
 * Idempotent for retries: re-running deletes the source's prior chunks before
 * inserting fresh ones. Enforces {@link MAX_TOPIC_SOURCE_TOKENS} against the
 * topic's other ready sources. Never throws — failures are caught and recorded
 * on the source as a "failed" status with a friendly `error` message.
 */
export async function ingestAndPersist(
  sourceId: string,
  topicId: string,
  input: IngestInput,
): Promise<{ status: "ready" | "failed"; error?: string }> {
  const db = getDb();
  await db
    .update(sources)
    .set({ status: "ingesting", error: null, updatedAt: new Date() })
    .where(eq(sources.id, sourceId));

  try {
    const result = await dispatchIngest(input);

    const otherTokens = await otherSourcesTokenTotal(topicId, sourceId);
    if (otherTokens + result.tokenEstimate > MAX_TOPIC_SOURCE_TOKENS) {
      throw new SourceIngestError(
        `This source would push the topic past its ${Math.round(
          MAX_TOPIC_SOURCE_TOKENS / 1000,
        )}K-token source budget. Remove another source and try again.`,
      );
    }

    // Clean slate for retries.
    await db.delete(sourceChunks).where(eq(sourceChunks.sourceId, sourceId));
    if (result.chunks.length > 0) {
      await db.insert(sourceChunks).values(
        result.chunks.map((chunk, idx) => ({
          sourceId,
          idx,
          content: chunk.content,
          metadata: chunk.metadata,
        })),
      );
    }

    await db
      .update(sources)
      .set({
        status: "ready",
        title: result.title,
        tokenEstimate: result.tokenEstimate,
        error: null,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    return { status: "ready" };
  } catch (cause) {
    const message =
      cause instanceof SourceIngestError
        ? cause.message
        : cause instanceof Error
          ? cause.message
          : "Ingestion failed.";
    await db
      .update(sources)
      .set({ status: "failed", error: message, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));
    return { status: "failed", error: message };
  }
}

/** Whether a failed source can be recovered with a pasted transcript (YouTube). */
export function allowsManualPaste(kind: SourceKind, status: string): boolean {
  return kind === "youtube" && status === "failed";
}
