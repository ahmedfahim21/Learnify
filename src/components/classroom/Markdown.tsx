"use client";

import { Fragment, type ReactNode } from "react";

/**
 * A deliberately small markdown renderer for Narration text.
 *
 * We avoid a markdown dependency for the Phase-1 slice: this handles the subset
 * the tutor actually emits — headings, unordered lists, and inline `code`,
 * **bold**, and *italic*. Anything fancier degrades gracefully to plain text.
 */

/** Render inline spans: `code`, **bold**, *italic*. */
function renderInline(text: string): ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  const parts = text.split(pattern).filter((part) => part.length > 0);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          className="rounded bg-white/10 px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={key} className="ml-5 list-disc space-y-1">
        {items.map((item, index) => (
          <li key={index}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd();
    const key = `b${index}`;

    if (/^\s*[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList(`l${index}`);

    if (line.trim() === "") return;

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const content = renderInline(heading[2]);
      if (level === 1) {
        blocks.push(
          <h2 key={key} className="text-xl font-semibold">
            {content}
          </h2>,
        );
      } else if (level === 2) {
        blocks.push(
          <h3 key={key} className="text-lg font-semibold">
            {content}
          </h3>,
        );
      } else {
        blocks.push(
          <h4 key={key} className="font-semibold">
            {content}
          </h4>,
        );
      }
      return;
    }

    blocks.push(
      <p key={key} className="leading-relaxed">
        {renderInline(line)}
      </p>,
    );
  });

  flushList("l-final");

  return <div className="space-y-2">{blocks}</div>;
}
