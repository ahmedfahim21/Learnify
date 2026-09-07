"use client";
import { Fragment } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString } from "../rendererContext";
const CODE_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "class", "import", "export", "from", "as", "def", "print", "public",
  "private", "static", "void", "new", "int", "float", "string", "bool",
  "true", "false", "null", "none", "await", "async", "yield", "try",
  "except", "catch", "finally", "switch", "case", "break", "continue",
  "this", "self", "type", "interface", "enum", "struct", "fn", "in", "of",
  "not", "and", "or", "lambda", "with", "do", "throw", "extends",
]);

/** Lightweight, language-agnostic highlighter for one line of code. */
function highlightLine(line: string): React.ReactNode[] {
  const tokenRe =
    /(\/\/.*$|#.*$|"[^"]*"|'[^']*'|`[^`]*`|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/g;
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(line)) !== null) {
    if (match.index > last) {
      nodes.push(<Fragment key={key++}>{line.slice(last, match.index)}</Fragment>);
    }
    const token = match[0];
    let cls = "";
    if (token.startsWith("//") || token.startsWith("#")) cls = "italic text-(--color-faint)";
    else if (/^["'`]/.test(token)) cls = "text-(--color-mint)";
    else if (/^\d/.test(token)) cls = "text-(--color-mango)";
    else if (CODE_KEYWORDS.has(token)) cls = "text-(--color-blueberry)";
    nodes.push(
      cls ? (
        <span key={key++} className={cls}>
          {token}
        </span>
      ) : (
        <Fragment key={key++}>{token}</Fragment>
      ),
    );
    last = match.index + token.length;
  }
  if (last < line.length) {
    nodes.push(<Fragment key={key++}>{line.slice(last)}</Fragment>);
  }
  return nodes;
}

export function CodeSnippet({ def }: { def: ComponentDef }) {
  const code = asString(def.properties.code);
  const language = asString(def.properties.language);
  const caption = asString(def.properties.caption);
  const highlight = new Set(
    Array.isArray(def.properties.highlightLines)
      ? (def.properties.highlightLines as unknown[]).map((n) => Number(n))
      : [],
  );
  const lines = code.replace(/\n$/, "").split("\n");

  return (
    <figure className="overflow-hidden border border-(--color-line) bg-[#0d0d0d]">
      {language && (
        <div className="border-b border-(--color-line) px-4 py-1.5 text-xs uppercase tracking-widest text-(--color-faint)">
          {language}
        </div>
      )}
      <pre className="overflow-x-auto py-3 text-sm leading-relaxed">
        <code className="font-mono">
          {lines.map((line, index) => {
            const lineNo = index + 1;
            return (
              <div
                key={index}
                className={`flex ${highlight.has(lineNo) ? "bg-(--color-mango)/10" : ""}`}
              >
                <span className="w-10 shrink-0 select-none px-2 text-right text-(--color-faint)">
                  {lineNo}
                </span>
                <span className="whitespace-pre px-2">{highlightLine(line)}</span>
              </div>
            );
          })}
        </code>
      </pre>
      {caption && (
        <figcaption className="border-t border-(--color-line) px-4 py-2 text-xs text-(--color-mist)">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
