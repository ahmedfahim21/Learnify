"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  A2UI_VERSION,
  type A2UIActionMessage,
  type A2UIServerMessage,
  type ComponentDef,
} from "@/lib/a2ui/messages";

import { Markdown } from "./Markdown";

/**
 * Hand-rolled A2UI v0.9 renderer — the single boundary between the protocol and
 * React. The issue pre-planned this reducer-over-four-envelopes fallback in case
 * the upstream `@a2ui/react` v0.9 preview proved unusable; we adopt it so the
 * slice has no unstable preview dependency. Swapping the package in later means
 * re-fronting the same `rendererReducer` + `SurfaceRenderer` interface.
 *
 * The tutor streams components into a single session surface via append-mode
 * `updateComponents` (no declared root), so the renderer creates surfaces on
 * demand and renders every *top-level* component — one not referenced as
 * another component's child — in arrival order.
 */

export interface SurfaceState {
  surfaceId: string;
  /** Component ids in first-seen order. */
  order: string[];
  components: Record<string, ComponentDef>;
  data: Record<string, unknown>;
}

export interface RendererState {
  surfaceOrder: string[];
  surfaces: Record<string, SurfaceState>;
}

export const initialRendererState: RendererState = {
  surfaceOrder: [],
  surfaces: {},
};

export type RendererAction = A2UIServerMessage | { type: "reset" };

function emptySurface(surfaceId: string): SurfaceState {
  return { surfaceId, order: [], components: {}, data: {} };
}

/** Upsert components into a surface, preserving first-seen order. */
function upsert(surface: SurfaceState, components: ComponentDef[]): SurfaceState {
  const map = { ...surface.components };
  const order = [...surface.order];
  for (const component of components) {
    if (!(component.id in map)) order.push(component.id);
    map[component.id] = component;
  }
  return { ...surface, components: map, order };
}

export function rendererReducer(
  state: RendererState,
  action: RendererAction,
): RendererState {
  switch (action.type) {
    case "reset":
      return initialRendererState;

    case "createSurface": {
      const fresh = upsert(emptySurface(action.surfaceId), action.components);
      const surfaceOrder = state.surfaceOrder.includes(action.surfaceId)
        ? state.surfaceOrder
        : [...state.surfaceOrder, action.surfaceId];
      return {
        surfaceOrder,
        surfaces: { ...state.surfaces, [action.surfaceId]: fresh },
      };
    }

    case "updateComponents": {
      const base = state.surfaces[action.surfaceId] ?? emptySurface(action.surfaceId);
      const surfaceOrder = state.surfaceOrder.includes(action.surfaceId)
        ? state.surfaceOrder
        : [...state.surfaceOrder, action.surfaceId];
      return {
        surfaceOrder,
        surfaces: {
          ...state.surfaces,
          [action.surfaceId]: upsert(base, action.components),
        },
      };
    }

    case "updateDataModel": {
      const existing = state.surfaces[action.surfaceId];
      if (!existing) return state;
      return {
        ...state,
        surfaces: {
          ...state.surfaces,
          [action.surfaceId]: {
            ...existing,
            data: { ...existing.data, ...action.data },
          },
        },
      };
    }

    case "deleteSurface": {
      if (!state.surfaces[action.surfaceId]) return state;
      const surfaces = { ...state.surfaces };
      delete surfaces[action.surfaceId];
      return {
        surfaceOrder: state.surfaceOrder.filter((id) => id !== action.surfaceId),
        surfaces,
      };
    }

    default:
      return state;
  }
}

interface NodeContext {
  surfaceId: string;
  resolve: (id: string) => ComponentDef | undefined;
  onAction: (action: A2UIActionMessage) => void;
  interactive: boolean;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Read an `{ id, label }[]` property defensively (already catalog-validated). */
function readOptions(value: unknown): Array<{ id: string; label: string }> {
  return Array.isArray(value)
    ? (value as Array<{ id: string; label: string }>)
    : [];
}

/** Fire a learner interaction back through the renderer's action channel. */
function emitAction(
  ctx: NodeContext,
  def: ComponentDef,
  action: string,
  payload: Record<string, unknown>,
) {
  ctx.onAction({
    type: "action",
    version: A2UI_VERSION,
    surfaceId: ctx.surfaceId,
    componentId: def.id,
    action,
    payload,
  });
}

function MultipleChoiceCheck({
  def,
  ctx,
}: {
  def: ComponentDef;
  ctx: NodeContext;
}) {
  const [chosen, setChosen] = useState<string | null>(null);
  const prompt = asString(def.properties.prompt);
  const options = Array.isArray(def.properties.options)
    ? (def.properties.options as Array<{ id: string; label: string }>)
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{prompt}</p>
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isChosen = chosen === option.id;
          const locked = chosen !== null || !ctx.interactive;
          return (
            <button
              key={option.id}
              type="button"
              disabled={locked}
              onClick={() => {
                setChosen(option.id);
                ctx.onAction({
                  type: "action",
                  version: A2UI_VERSION,
                  surfaceId: ctx.surfaceId,
                  componentId: def.id,
                  action: "select",
                  payload: { optionId: option.id, label: option.label },
                });
              }}
              className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                isChosen
                  ? "border-white/60 bg-white/15"
                  : "border-white/15 hover:border-white/40 hover:bg-white/[0.06]"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SessionRecap({ def }: { def: ComponentDef }) {
  const summary = asString(def.properties.summary);
  const keyPoints = Array.isArray(def.properties.keyPoints)
    ? (def.properties.keyPoints as unknown[]).map(asString)
    : [];
  const nextUp = asString(def.properties.nextUp);

  return (
    <div className="space-y-3 rounded-xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4">
      <div className="text-white/85">
        <Markdown text={summary} />
      </div>
      {keyPoints.length > 0 && (
        <ul className="ml-5 list-disc space-y-1 text-sm text-white/80">
          {keyPoints.map((point, index) => (
            <li key={index}>{point}</li>
          ))}
        </ul>
      )}
      {nextUp && (
        <p className="text-sm text-white/60">
          <span className="font-medium text-white/80">Next up:</span> {nextUp}
        </p>
      )}
    </div>
  );
}

function Flashcard({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<number | null>(null);
  const front = asString(def.properties.front);
  const back = asString(def.properties.back);
  const hint = asString(def.properties.hint);
  const locked = rated !== null || !ctx.interactive;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full rounded-lg border border-white/15 bg-white/[0.04] p-4 text-left transition hover:border-white/30"
      >
        <span className="text-xs uppercase tracking-widest text-white/40">
          {flipped ? "Back" : "Front"} · tap to flip
        </span>
        <div className="mt-1 text-white/90">
          <Markdown text={flipped ? back : front} />
        </div>
        {!flipped && hint && (
          <p className="mt-2 text-xs text-white/40">Hint: {hint}</p>
        )}
      </button>
      {flipped && (
        <div className="space-y-2">
          <p className="text-xs text-white/50">How well did you recall this?</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4, 5].map((quality) => (
              <button
                key={quality}
                type="button"
                disabled={locked}
                onClick={() => {
                  setRated(quality);
                  emitAction(ctx, def, "rate_recall", {
                    quality,
                    label: `Self-rated recall ${quality}/5`,
                  });
                }}
                className={`h-9 w-9 rounded-lg border text-sm transition ${
                  rated === quality
                    ? "border-white/60 bg-white/15"
                    : "border-white/15 hover:border-white/40 hover:bg-white/[0.06]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {quality}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrderingExercise({
  def,
  ctx,
}: {
  def: ComponentDef;
  ctx: NodeContext;
}) {
  const items = readOptions(def.properties.items);
  const labelOf = new Map(items.map((item) => [item.id, item.label]));
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id));
  const [submitted, setSubmitted] = useState(false);
  const dragId = useRef<string | null>(null);
  const locked = submitted || !ctx.interactive;

  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setOrder((prev) => {
      const next = prev.filter((id) => id !== fromId);
      const at = next.indexOf(toId);
      next.splice(at < 0 ? next.length : at, 0, fromId);
      return next;
    });
  };

  const move = (index: number, delta: number) => {
    setOrder((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{asString(def.properties.prompt)}</p>
      <ol className="space-y-2">
        {order.map((id, index) => (
          <li
            key={id}
            draggable={!locked}
            onDragStart={() => {
              dragId.current = id;
            }}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragId.current) reorder(dragId.current, id);
              dragId.current = null;
            }}
            className={`flex items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm ${
              locked ? "" : "cursor-grab active:cursor-grabbing"
            }`}
          >
            <span className="w-5 text-white/40">{index + 1}.</span>
            <span className="flex-1">{labelOf.get(id) ?? id}</span>
            <button
              type="button"
              disabled={locked || index === 0}
              onClick={() => move(index, -1)}
              aria-label="Move up"
              className="rounded border border-white/15 px-2 py-0.5 text-xs hover:border-white/40 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              type="button"
              disabled={locked || index === order.length - 1}
              onClick={() => move(index, 1)}
              aria-label="Move down"
              className="rounded border border-white/15 px-2 py-0.5 text-xs hover:border-white/40 disabled:opacity-30"
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          setSubmitted(true);
          emitAction(ctx, def, "submit_order", {
            orderedIds: order,
            label: `Submitted order: ${order
              .map((id) => labelOf.get(id) ?? id)
              .join(" → ")}`,
          });
        }}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit order
      </button>
    </div>
  );
}

function MatchingPairs({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const left = readOptions(def.properties.left);
  const right = readOptions(def.properties.right);
  const labelOf = new Map(
    [...left, ...right].map((item) => [item.id, item.label]),
  );
  const [activeLeft, setActiveLeft] = useState<string | null>(null);
  const [pairs, setPairs] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const locked = submitted || !ctx.interactive;
  const usedRight = new Set(Object.values(pairs));
  const prompt = asString(def.properties.prompt);

  const partnerLabel = (rightId: string) => {
    const leftId = Object.keys(pairs).find((l) => pairs[l] === rightId);
    return leftId ? labelOf.get(leftId) : undefined;
  };

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      {prompt && <p className="font-medium">{prompt}</p>}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          {left.map((item) => {
            const matched = item.id in pairs;
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked}
                onClick={() => setActiveLeft(item.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  activeLeft === item.id
                    ? "border-sky-400/70 bg-sky-400/10"
                    : matched
                      ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                      : "border-white/15 hover:border-white/40"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {item.label}
                {matched && (
                  <span className="block text-xs text-emerald-300/80">
                    → {labelOf.get(pairs[item.id])}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2">
          {right.map((item) => {
            const taken = usedRight.has(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={locked || activeLeft === null}
                onClick={() => {
                  if (activeLeft === null) return;
                  setPairs((prev) => ({ ...prev, [activeLeft]: item.id }));
                  setActiveLeft(null);
                }}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  taken
                    ? "border-emerald-400/40 bg-emerald-400/[0.06]"
                    : "border-white/15 hover:border-white/40"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {item.label}
                {taken && (
                  <span className="block text-xs text-emerald-300/80">
                    ← {partnerLabel(item.id)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        disabled={locked || Object.keys(pairs).length === 0}
        onClick={() => {
          setSubmitted(true);
          const list = Object.entries(pairs).map(([leftId, rightId]) => ({
            leftId,
            rightId,
          }));
          emitAction(ctx, def, "submit_pairs", {
            pairs: list,
            label: `Matched: ${list
              .map(
                (p) => `${labelOf.get(p.leftId)} → ${labelOf.get(p.rightId)}`,
              )
              .join("; ")}`,
          });
        }}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit matches
      </button>
    </div>
  );
}

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
    if (token.startsWith("//") || token.startsWith("#")) cls = "italic text-white/40";
    else if (/^["'`]/.test(token)) cls = "text-emerald-300";
    else if (/^\d/.test(token)) cls = "text-amber-300";
    else if (CODE_KEYWORDS.has(token)) cls = "text-sky-300";
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

function CodeSnippet({ def }: { def: ComponentDef }) {
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
    <figure className="overflow-hidden rounded-xl border border-white/15 bg-[#0d0d0d]">
      {language && (
        <div className="border-b border-white/10 px-4 py-1.5 text-xs uppercase tracking-widest text-white/40">
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
                className={`flex ${highlight.has(lineNo) ? "bg-amber-400/10" : ""}`}
              >
                <span className="w-10 shrink-0 select-none px-2 text-right text-white/25">
                  {lineNo}
                </span>
                <span className="whitespace-pre px-2">{highlightLine(line)}</span>
              </div>
            );
          })}
        </code>
      </pre>
      {caption && (
        <figcaption className="border-t border-white/10 px-4 py-2 text-xs text-white/50">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Build the sandboxed iframe document that renders a Mermaid diagram. */
function buildDiagramDoc(source: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  body { margin: 0; padding: 8px; background: #0d0d0d; color: #ededed; font-family: system-ui, sans-serif; }
  .node { cursor: pointer; }
  .err { color: #fca5a5; font-size: 12px; white-space: pre-wrap; }
  svg { max-width: 100%; height: auto; }
</style></head><body>
<div id="root"></div>
<script type="module">
  const src = ${JSON.stringify(source)};
  const root = document.getElementById("root");
  const sendSize = () =>
    parent.postMessage({ type: "a2ui-diagram-size", height: document.body.scrollHeight }, "*");
  try {
    const mermaid = (await import("https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
    mermaid.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" });
    const { svg, bindFunctions } = await mermaid.render("graph", src);
    root.innerHTML = svg;
    bindFunctions?.(root);
    root.querySelectorAll(".node").forEach((node) => {
      node.style.cursor = "pointer";
      node.addEventListener("click", () => {
        const label = (node.textContent || "").trim();
        parent.postMessage({ type: "a2ui-node-click", nodeId: node.id, label }, "*");
      });
    });
  } catch (error) {
    const pre = document.createElement("pre");
    pre.className = "err";
    pre.textContent = "Diagram could not render:\\n" + (error && error.message ? error.message : String(error)) + "\\n\\n" + src;
    root.appendChild(pre);
  }
  sendSize();
  setTimeout(sendSize, 300);
</script></body></html>`;
}

function Diagram({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(220);
  const source = asString(def.properties.source);
  const caption = asString(def.properties.caption);
  const srcDoc = useMemo(() => buildDiagramDoc(source), [source]);

  // Latest ctx without resubscribing the message listener every render.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== frameRef.current?.contentWindow) return;
      const data = event.data as { type?: string; height?: number; nodeId?: string; label?: string };
      if (data?.type === "a2ui-diagram-size" && typeof data.height === "number") {
        setHeight(Math.min(Math.max(data.height + 4, 120), 800));
      } else if (data?.type === "a2ui-node-click" && ctxRef.current.interactive) {
        const label = String(data.label || data.nodeId || "");
        emitAction(ctxRef.current, def, "node_click", {
          nodeId: String(data.nodeId ?? ""),
          label: `Clicked diagram node "${label}"`,
        });
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [def]);

  return (
    <div className="space-y-2 rounded-xl border border-white/15 bg-white/[0.04] p-3">
      <iframe
        ref={frameRef}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        title="diagram"
        style={{ height }}
        className="w-full rounded-lg border border-white/10 bg-[#0d0d0d]"
      />
      {caption && <p className="text-xs text-white/50">{caption}</p>}
    </div>
  );
}

function FreeResponse({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const prompt = asString(def.properties.prompt);
  const placeholder = asString(def.properties.placeholder);
  const locked = submitted || !ctx.interactive;

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <p className="font-medium">{prompt}</p>
      <textarea
        value={text}
        disabled={locked}
        rows={3}
        placeholder={placeholder || "Type your answer…"}
        onChange={(event) => setText(event.target.value)}
        className="w-full resize-y rounded-lg border border-white/15 bg-white/[0.04] p-3 text-sm outline-none focus:border-white/40 disabled:opacity-60"
      />
      <button
        type="button"
        disabled={locked || !text.trim()}
        onClick={() => {
          setSubmitted(true);
          emitAction(ctx, def, "submit_text", {
            text: text.trim(),
            label: text.trim(),
          });
        }}
        className="rounded-lg border border-white/20 px-3 py-1.5 text-sm hover:border-white/40 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Submit answer
      </button>
    </div>
  );
}

function ProgressMeter({ def }: { def: ComponentDef }) {
  const concepts = Array.isArray(def.properties.concepts)
    ? (def.properties.concepts as Array<{ label: string; mastery: number }>)
    : [];
  const phase = asString(def.properties.phase);

  return (
    <div className="space-y-3 rounded-xl border border-white/15 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-white/40">Progress</p>
        {phase && (
          <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-white/60">
            {phase}
          </span>
        )}
      </div>
      <div className="space-y-2">
        {concepts.map((concept, index) => {
          const pct = Math.round(
            Math.min(Math.max(asNumber(concept.mastery), 0), 1) * 100,
          );
          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between text-xs text-white/70">
                <span>{asString(concept.label)}</span>
                <span className="text-white/40">{pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400/70"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function renderNode(id: string, ctx: NodeContext): React.ReactNode {
  const def = ctx.resolve(id);
  if (!def) return null;

  switch (def.component) {
    case "Narration":
      return (
        <div key={id} className="text-white/85">
          <Markdown text={asString(def.properties.text)} />
        </div>
      );

    case "ExplanationCard": {
      const emoji = asString(def.properties.emoji);
      return (
        <div
          key={id}
          className="space-y-2 rounded-xl border border-white/15 bg-white/[0.04] p-4"
        >
          <h3 className="text-lg font-semibold">
            {emoji ? `${emoji} ` : ""}
            {asString(def.properties.title)}
          </h3>
          <div className="text-white/80">
            <Markdown text={asString(def.properties.body)} />
          </div>
        </div>
      );
    }

    case "MultipleChoiceCheck":
      return <MultipleChoiceCheck key={id} def={def} ctx={ctx} />;

    case "Flashcard":
      return <Flashcard key={id} def={def} ctx={ctx} />;

    case "OrderingExercise":
      return <OrderingExercise key={id} def={def} ctx={ctx} />;

    case "MatchingPairs":
      return <MatchingPairs key={id} def={def} ctx={ctx} />;

    case "CodeSnippet":
      return <CodeSnippet key={id} def={def} />;

    case "Diagram":
      return <Diagram key={id} def={def} ctx={ctx} />;

    case "FreeResponse":
      return <FreeResponse key={id} def={def} ctx={ctx} />;

    case "ProgressMeter":
      return <ProgressMeter key={id} def={def} />;

    case "SessionRecap":
      return <SessionRecap key={id} def={def} />;

    case "Row":
      return (
        <div key={id} className="flex flex-wrap gap-4">
          {(def.children ?? []).map((childId) => renderNode(childId, ctx))}
        </div>
      );

    case "Column":
      return (
        <div key={id} className="flex flex-col gap-4">
          {(def.children ?? []).map((childId) => renderNode(childId, ctx))}
        </div>
      );

    default:
      return (
        <div
          key={id}
          className="rounded border border-amber-400/40 bg-amber-400/10 p-2 text-xs text-amber-200"
        >
          Unknown widget: {def.component}
        </div>
      );
  }
}

/** Top-level components are those no other component references as a child. */
function topLevelIds(surface: SurfaceState): string[] {
  const childIds = new Set<string>();
  for (const id of surface.order) {
    for (const childId of surface.components[id]?.children ?? []) {
      childIds.add(childId);
    }
  }
  return surface.order.filter((id) => !childIds.has(id));
}

export function SurfaceRenderer({
  state,
  onAction,
  interactive,
}: {
  state: RendererState;
  onAction: (action: A2UIActionMessage) => void;
  interactive: boolean;
}) {
  return (
    <div className="space-y-6">
      {state.surfaceOrder.map((surfaceId) => {
        const surface = state.surfaces[surfaceId];
        if (!surface) return null;
        const ctx: NodeContext = {
          surfaceId,
          resolve: (id) => surface.components[id],
          onAction,
          interactive,
        };
        return (
          <div key={surfaceId} className="space-y-4">
            {topLevelIds(surface).map((id) => renderNode(id, ctx))}
          </div>
        );
      })}
    </div>
  );
}
