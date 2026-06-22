/**
 * Shared shapes for source ingestion (#45).
 *
 * Each ingester (PDF / URL / YouTube) turns a raw source into an
 * {@link IngestResult}: a title plus ordered {@link IngestedChunk}s carrying the
 * citation metadata the grounded-teaching UX (#46) jumps to.
 */

export type SourceKind = "pdf" | "url" | "youtube";

export type SourceStatus = "pending" | "ingesting" | "ready" | "failed";

/**
 * Citation locator for a chunk. The populated key depends on the source kind:
 *   - PDF:     `{ page }`             (1-based page number)
 *   - URL:     `{ heading }`          (the section heading the chunk falls under)
 *   - YouTube: `{ startSec, endSec }` (transcript timestamps, seconds)
 */
export interface ChunkMetadata {
  page?: number;
  heading?: string;
  startSec?: number;
  endSec?: number;
}

export interface IngestedChunk {
  content: string;
  metadata: ChunkMetadata;
}

export interface IngestResult {
  /** Human-readable title for the source (filename, article, or video title). */
  title: string;
  chunks: IngestedChunk[];
  /** Rough token cost of the whole source (≈ chars / 4). */
  tokenEstimate: number;
}

/**
 * Thrown by an ingester when a source can't be processed. The message is
 * surfaced to the learner as the source's failure reason. `allowManualPaste`
 * tells the UI to offer the manual-transcript fallback (YouTube transcripts are
 * fragile — captions disabled, region-locked, etc.).
 */
export class SourceIngestError extends Error {
  readonly allowManualPaste: boolean;
  constructor(message: string, opts: { allowManualPaste?: boolean } = {}) {
    super(message);
    this.name = "SourceIngestError";
    this.allowManualPaste = opts.allowManualPaste ?? false;
  }
}
