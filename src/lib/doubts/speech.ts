import { createParser, type ElementNode } from "@openuidev/lang-core";

import { doubtCore } from "@/lib/openui/doubtSpec";

/**
 * Turn a stored answer (OpenUI Lang) into the plain text Bulbul reads aloud:
 * the title, key idea, paragraphs, steps, worked example, comparison rows,
 * flip card, check question, callouts and formula captions, in reading order. Timestamp chips and raw formulas are skipped — "T of n equals two T
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
      case "KeyIdea":
        if (typeof p.text === "string") parts.push(p.text);
        break;
      case "Example":
        for (const k of ["title", "problem", "solution"]) if (typeof p[k] === "string") parts.push(p[k] as string);
        break;
      case "Reveal":
        if (typeof p.prompt === "string") parts.push(p.prompt);
        if (typeof p.answer === "string") parts.push(p.answer);
        break;
      case "Compare":
        // Each row as "label: cell, cell", which reads naturally by ear.
        if (Array.isArray(p.rows))
          for (const row of p.rows)
            if (Array.isArray(row) && typeof row[0] === "string") parts.push(`${row[0]}: ${row.slice(1).filter((c) => typeof c === "string").join(", ")}`);
        break;
      case "Mcq":
        // The question is worth hearing; four options read aloud are not.
        if (typeof p.question === "string") parts.push(p.question);
        break;
      case "TrueFalse":
        if (typeof p.statement === "string") parts.push(p.statement);
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
