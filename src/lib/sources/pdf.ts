import { put } from "@vercel/blob";

import {
  CHUNK_TARGET_CHARS,
  estimateTokens,
  splitIntoChunks,
} from "./chunk";
import { type IngestedChunk, type IngestResult, SourceIngestError } from "./types";

/**
 * PDF ingestion (#45).
 *
 * Bedrock has no Files API and no URL document sources, so a PDF travels into a
 * session as a base64 document block (20 MB request cap). We therefore:
 *   1. cap the upload well under that limit at ingest time (`MAX_PDF_BYTES`),
 *   2. store the bytes in Vercel Blob so they can be re-fetched + base64'd at
 *      session time (#46), and
 *   3. extract per-page text into citable chunks (`{ page }` metadata).
 *
 * Text extraction uses `unpdf` (a serverless-friendly pdf.js wrapper). A
 * scanned/image-only PDF yields no text; that's not a hard failure — the base64
 * document block still grounds teaching — so we keep the source `ready` with a
 * single placeholder chunk rather than erroring.
 */

/** Ingest-time upload cap: ~5 MB, comfortably under Bedrock's 20 MB payload. */
export const MAX_PDF_BYTES = 5 * 1024 * 1024;

/** Whether PDF uploads are configured (Vercel Blob token present). */
export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Upload a PDF to Vercel Blob and return its public URL. Throws a friendly
 * {@link SourceIngestError} if the file is too large or Blob isn't configured.
 */
export async function uploadPdfToBlob(
  bytes: Uint8Array,
  filename: string,
): Promise<string> {
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new SourceIngestError(
      `PDF is too large (${formatMB(bytes.byteLength)}). The limit is ${formatMB(
        MAX_PDF_BYTES,
      )}.`,
    );
  }
  if (!isBlobConfigured()) {
    throw new SourceIngestError(
      "PDF uploads aren't configured on this deployment (set BLOB_READ_WRITE_TOKEN). Try a URL or YouTube source instead.",
    );
  }

  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "_") || "source.pdf";
  const blob = await put(`sources/${Date.now()}-${safeName}`, Buffer.from(bytes), {
    access: "public",
    contentType: "application/pdf",
    addRandomSuffix: true,
  });
  return blob.url;
}

/**
 * Extract per-page text from a PDF and split each page into citable chunks.
 * Returns chunks tagged with their 1-based `page`. Never throws on empty text
 * (scanned PDFs) — returns a single placeholder chunk so the source is usable.
 */
export async function ingestPdf(
  bytes: Uint8Array,
  filename: string,
): Promise<IngestResult> {
  const title = filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() ||
    "Untitled PDF";

  let pages: string[];
  try {
    // Imported lazily so bundling/building never pulls pdf.js into the client.
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const result = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(result.text) ? result.text : [String(result.text)];
  } catch (cause) {
    throw new SourceIngestError(
      `Couldn't read this PDF${cause instanceof Error ? `: ${cause.message}` : "."}`,
    );
  }

  const chunks: IngestedChunk[] = [];
  pages.forEach((pageText, i) => {
    const page = i + 1;
    for (const content of splitIntoChunks(pageText, CHUNK_TARGET_CHARS)) {
      chunks.push({ content, metadata: { page } });
    }
  });

  if (chunks.length === 0) {
    // Image-only / scanned PDF: no extractable text. The base64 document block
    // still grounds teaching, so keep it ready with a marker chunk.
    chunks.push({
      content: `(${title} — no extractable text; the PDF is attached as an image-based document.)`,
      metadata: { page: 1 },
    });
  }

  const tokenEstimate = estimateTokens(chunks.map((c) => c.content).join("\n"));
  return { title, chunks, tokenEstimate };
}

function formatMB(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
