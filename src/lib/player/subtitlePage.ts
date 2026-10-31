/**
 * Long subtitle segments, shown a page at a time.
 *
 * Segments are whole sentences of up to 30 s, so one can run to five lines.
 * Rather than clamp it (and lose words), the text is split into pages that fit
 * the bar, at word boundaries, and each page is shown for its share of the
 * segment's time, weighted by length — the way broadcast subtitles advance.
 */

export function pages(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let current = "";
  for (const w of words) {
    if (current && current.length + 1 + w.length > maxChars) {
      out.push(current);
      current = w;
    } else {
      current = current ? `${current} ${w}` : w;
    }
  }
  if (current) out.push(current);
  return out.length ? out : [""];
}

/** The page of `text` to show at `nowSec`, within a segment spanning startSec–endSec. */
export function pageAt(text: string, startSec: number, endSec: number, nowSec: number, maxChars: number): string {
  const all = pages(text, maxChars);
  if (all.length === 1) return all[0];
  const total = all.reduce((n, p) => n + p.length, 0);
  const progress = Math.min(1, Math.max(0, (nowSec - startSec) / Math.max(0.001, endSec - startSec)));
  let seen = 0;
  for (const p of all) {
    seen += p.length;
    if (progress < seen / total) return p;
  }
  return all[all.length - 1];
}
