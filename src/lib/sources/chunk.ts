/**
 * Text chunking + token estimation shared across the source ingesters (#45).
 *
 * Portfolio-scale approach: no vector DB. Sources become long-context document
 * blocks fed in with prompt caching, so chunks only need to be small enough to
 * be citable (#46) and to estimate token cost — not retrieval-optimised. We
 * split on natural boundaries (paragraphs) and only hard-split a paragraph that
 * is itself larger than the target.
 */

/** Rough heuristic: ~4 characters per token. Good enough for budgeting. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Target characters per chunk (~500 tokens) — citable granularity. */
export const CHUNK_TARGET_CHARS = 2_000;

/**
 * Split text into chunks at paragraph boundaries, packing paragraphs together
 * until the target size is reached. A single paragraph longer than twice the
 * target is hard-split on whitespace so no chunk grows unbounded.
 */
export function splitIntoChunks(
  text: string,
  targetChars = CHUNK_TARGET_CHARS,
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > targetChars * 2) {
      flush();
      chunks.push(...hardSplit(paragraph, targetChars));
      continue;
    }
    if (current.length + paragraph.length + 2 > targetChars && current) {
      flush();
    }
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  flush();

  return chunks;
}

/** Break an oversized paragraph into ~target-sized pieces at word boundaries. */
function hardSplit(text: string, targetChars: number): string[] {
  const words = text.split(/\s+/);
  const pieces: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > targetChars && current) {
      pieces.push(current);
      current = "";
    }
    current = current ? `${current} ${word}` : word;
  }
  if (current) pieces.push(current);
  return pieces;
}
