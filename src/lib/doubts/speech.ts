import { createParser, type ElementNode } from "@openuidev/lang-core";

import { doubtCore } from "@/lib/openui/doubtSpec";

/**
 * Turn a stored answer (OpenUI Lang) into the plain text Bulbul reads aloud:
 * the title, paragraphs, steps, callouts and formula captions, in reading
 * order. Timestamp chips and raw formulas are skipped — "T of n equals two T
 * of n by two" helps nobody by ear.
 */

export const BULBUL_MAX_CHARS = 2500;

function isElement(v: unknown): v is ElementNode {
  return typeof v === "object" && v !== null && (v as { type?: unknown }).type === "element";
}

export function speakableText(answer: string): string {
  const root = createParser(doubtCore.toJSONSchema()).parse(answer).root;
  const parts: string[] = [];

  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!isElement(node)) return;
    const p = node.props as Record<string, unknown>;
    switch (node.typeName) {
      case "Answer":
        if (typeof p.title === "string") parts.push(p.title);
        visit(p.parts);
        break;
      case "Paragraph":
        if (typeof p.text === "string") parts.push(p.text);
        if (typeof p.continuation === "string") parts.push(p.continuation);
        break;
      case "Steps":
        if (Array.isArray(p.items)) parts.push(...p.items.filter((x): x is string => typeof x === "string"));
        break;
      case "Callout":
        if (typeof p.text === "string") parts.push(p.text);
        break;
      case "Formula":
        if (typeof p.caption === "string") parts.push(p.caption);
        break;
      default:
        break;
    }
  };
  visit(root);
  // A full stop between parts gives Bulbul a pause in every language; a danda
  // would be wrong outside Devanagari and Bengali scripts.
  return fitForSpeech(parts.map((s) => s.trim()).filter(Boolean).join(". ").replace(/([.?!।])\./g, "$1"));
}

/** Cut at the last sentence end that fits Bulbul's limit, never mid-word. */
export function fitForSpeech(text: string, max = BULBUL_MAX_CHARS): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  // A sentence ender followed by a space, or one that lands exactly at the cut.
  let end = -1;
  for (const m of head.matchAll(/[.?!।](?=\s|$)/g)) end = m.index ?? end;
  if (end > max / 2) return head.slice(0, end + 1);
  const space = head.lastIndexOf(" ");
  return space > 0 ? head.slice(0, space) : head;
}
