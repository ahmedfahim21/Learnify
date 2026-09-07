import type { DiagramColor } from "@/lib/a2ui/catalog";

/**
 * Literal Tailwind class bundles per accent, tuned for the light canvas. Tailwind v4 here is CSS-first
 * with no config file, so there's no safelist — an interpolated
 * `border-${color}-400` would silently render unstyled. Every value below is a
 * complete string Tailwind can see at build time.
 */
export interface DiagramPaletteEntry {
  /** Node border + icon accent. */
  border: string;
  text: string;
  ring: string;
  /** SVG edge stroke. A CSS variable rather than a hex, since edges are
   *  drawn rather than classed and still have to follow the theme. */
  stroke: string;
  /** Group region fill/border/label chip. */
  groupBg: string;
  groupBorder: string;
  groupText: string;
}

export const DIAGRAM_PALETTE: Record<DiagramColor, DiagramPaletteEntry> = {
  slate: {
    border: "border-slate-500/50",
    text: "text-slate-700",
    ring: "ring-slate-500",
    stroke: "var(--diagram-slate)",
    groupBg: "bg-slate-500/[0.07]",
    groupBorder: "border-slate-500/35",
    groupText: "text-slate-700",
  },
  blue: {
    border: "border-blue-500/50",
    text: "text-blue-700",
    ring: "ring-blue-500",
    stroke: "var(--diagram-blue)",
    groupBg: "bg-blue-500/[0.07]",
    groupBorder: "border-blue-500/35",
    groupText: "text-blue-700",
  },
  green: {
    border: "border-emerald-500/50",
    text: "text-emerald-700",
    ring: "ring-emerald-500",
    stroke: "var(--diagram-green)",
    groupBg: "bg-emerald-500/[0.07]",
    groupBorder: "border-emerald-500/35",
    groupText: "text-emerald-700",
  },
  pink: {
    border: "border-pink-500/50",
    text: "text-pink-700",
    ring: "ring-pink-500",
    stroke: "var(--diagram-pink)",
    groupBg: "bg-pink-500/[0.07]",
    groupBorder: "border-pink-500/35",
    groupText: "text-pink-700",
  },
  purple: {
    border: "border-purple-500/50",
    text: "text-purple-700",
    ring: "ring-purple-500",
    stroke: "var(--diagram-purple)",
    groupBg: "bg-purple-500/[0.07]",
    groupBorder: "border-purple-500/35",
    groupText: "text-purple-700",
  },
  amber: {
    border: "border-amber-500/50",
    text: "text-amber-700",
    ring: "ring-amber-500",
    stroke: "var(--diagram-amber)",
    groupBg: "bg-amber-500/[0.07]",
    groupBorder: "border-amber-500/35",
    groupText: "text-amber-700",
  },
  cyan: {
    border: "border-cyan-500/50",
    text: "text-cyan-700",
    ring: "ring-cyan-500",
    stroke: "var(--diagram-cyan)",
    groupBg: "bg-cyan-500/[0.07]",
    groupBorder: "border-cyan-500/35",
    groupText: "text-cyan-700",
  },
  rose: {
    border: "border-rose-500/50",
    text: "text-rose-700",
    ring: "ring-rose-500",
    stroke: "var(--diagram-rose)",
    groupBg: "bg-rose-500/[0.07]",
    groupBorder: "border-rose-500/35",
    groupText: "text-rose-700",
  },
  teal: {
    border: "border-teal-500/50",
    text: "text-teal-700",
    ring: "ring-teal-500",
    stroke: "var(--diagram-teal)",
    groupBg: "bg-teal-500/[0.07]",
    groupBorder: "border-teal-500/35",
    groupText: "text-teal-700",
  },
  indigo: {
    border: "border-indigo-500/50",
    text: "text-indigo-700",
    ring: "ring-indigo-500",
    stroke: "var(--diagram-indigo)",
    groupBg: "bg-indigo-500/[0.07]",
    groupBorder: "border-indigo-500/35",
    groupText: "text-indigo-700",
  },
};

/** Neutral default for nodes/edges without an explicit accent. */
export const DIAGRAM_NEUTRAL = {
  // Tokens, not white-based opacities: a white-on-white border is invisible
  // in light mode, which left un-accented nodes looking like bare text.
  border: "border-(--color-faint)",
  text: "text-(--color-mist)",
  stroke: "var(--color-faint)",
};
