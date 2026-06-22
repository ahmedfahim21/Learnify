import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

import {
  CHUNK_TARGET_CHARS,
  estimateTokens,
  splitIntoChunks,
} from "./chunk";
import { type IngestedChunk, type IngestResult, SourceIngestError } from "./types";

/**
 * URL ingestion (#45): fetch a web article, strip chrome with Mozilla
 * Readability (the same extractor Firefox Reader View uses), and split the
 * readable text into citable chunks tagged with the section `heading` they fall
 * under. No vector DB — chunks are long-context blocks for grounded teaching.
 */

const FETCH_TIMEOUT_MS = 15_000;
const USER_AGENT =
  "Mozilla/5.0 (compatible; LearnifyBot/2.0; +https://learnify.local)";

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function ingestUrl(rawUrl: string): Promise<IngestResult> {
  if (!isValidHttpUrl(rawUrl)) {
    throw new SourceIngestError("That doesn't look like a valid web address.");
  }

  let html: string;
  try {
    const response = await fetch(rawUrl, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,*/*" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!response.ok) {
      throw new SourceIngestError(
        `The page responded with ${response.status}. It may be private or unavailable.`,
      );
    }
    html = await response.text();
  } catch (cause) {
    if (cause instanceof SourceIngestError) throw cause;
    throw new SourceIngestError(
      `Couldn't fetch that page${cause instanceof Error ? `: ${cause.message}` : "."}`,
    );
  }

  const dom = new JSDOM(html, { url: rawUrl });
  const doc = dom.window.document;
  const title =
    doc.title?.trim() || new URL(rawUrl).hostname.replace(/^www\./, "");

  const article = new Readability(doc).parse();
  if (!article || !article.content) {
    throw new SourceIngestError(
      "Couldn't extract readable content from that page. Try a different article URL.",
    );
  }

  const chunks = chunkArticleByHeading(article.content, dom.window.DOMParser);
  if (chunks.length === 0) {
    throw new SourceIngestError("That page had no readable text to learn from.");
  }

  const tokenEstimate = estimateTokens(chunks.map((c) => c.content).join("\n"));
  return { title: article.title?.trim() || title, chunks, tokenEstimate };
}

/**
 * Walk the Readability article DOM, accumulating text under the most recent
 * heading so each chunk carries a `{ heading }` citation locator. Long sections
 * are sub-split to the target chunk size.
 */
function chunkArticleByHeading(
  contentHtml: string,
  DOMParser: typeof globalThis.DOMParser,
): IngestedChunk[] {
  const parsed = new DOMParser().parseFromString(contentHtml, "text/html");
  const root = parsed.body;

  const sections: { heading?: string; text: string }[] = [];
  let current: { heading?: string; text: string } = { text: "" };

  const flush = () => {
    if (current.text.trim()) sections.push(current);
  };

  for (const node of Array.from(root.querySelectorAll("h1,h2,h3,h4,p,li,pre,blockquote"))) {
    const tag = node.tagName.toLowerCase();
    const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (/^h[1-4]$/.test(tag)) {
      flush();
      current = { heading: text, text: "" };
    } else {
      current.text = current.text ? `${current.text}\n\n${text}` : text;
    }
  }
  flush();

  const chunks: IngestedChunk[] = [];
  for (const section of sections) {
    for (const content of splitIntoChunks(section.text, CHUNK_TARGET_CHARS)) {
      chunks.push({ content, metadata: { heading: section.heading } });
    }
  }
  return chunks;
}
