"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentDef } from "@/lib/a2ui/messages";
import { asString, emitAction, type NodeContext } from "../rendererContext";
/** Build the sandboxed iframe document that renders a Mermaid diagram. */
function buildDiagramDoc(source: string): string {
  // The iframe is sandboxed, so CSS variables never reach it — the palette
  // has to be literal. One theme means one set of values.
  const c = { bg: "#f7f8fa", fg: "#0f1117", err: "#c9382f" };
  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  body { margin: 0; padding: 8px; background: ${c.bg}; color: ${c.fg}; font-family: system-ui, sans-serif; }
  .node { cursor: pointer; }
  .err { color: ${c.err}; font-size: 12px; white-space: pre-wrap; }
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
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "strict" });
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

export function Diagram({ def, ctx }: { def: ComponentDef; ctx: NodeContext }) {
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
    <div className="space-y-2 border border-(--color-line) bg-(--color-raised) p-3">
      <iframe
        ref={frameRef}
        sandbox="allow-scripts"
        srcDoc={srcDoc}
        title="diagram"
        style={{ height }}
        className="w-full border border-(--color-line) bg-(--color-canvas)"
      />
      {caption && <p className="text-xs text-(--color-mist)">{caption}</p>}
    </div>
  );
}
