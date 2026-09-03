import type { DiagramColor } from "@/lib/a2ui/catalog";

/**
 * Literal Tailwind class bundles per accent. Tailwind v4 here is CSS-first
 * with no config file, so there's no safelist — an interpolated
 * `border-${color}-400` would silently render unstyled. Every value below is a
 * complete string Tailwind can see at build time.
 */
export interface DiagramPaletteEntry {
  /** Node border + icon accent. */
  border: string;
  text: string;
  ring: string;
  /** SVG edge stroke (hex, since edges are drawn, not classed). */
  stroke: string;
  /** Group region fill/border/label chip. */
  groupBg: string;
  groupBorder: string;
  groupText: string;
}

export const DIAGRAM_PALETTE: Record<DiagramColor, DiagramPaletteEntry> = {
  slate: {
    border: "border-slate-400/50",
    text: "text-slate-300",
    ring: "ring-slate-300",
    stroke: "#94a3b8",
    groupBg: "bg-slate-400/[0.06]",
    groupBorder: "border-slate-400/30",
    groupText: "text-slate-300",
  },
  blue: {
    border: "border-blue-400/50",
    text: "text-blue-300",
    ring: "ring-blue-300",
    stroke: "#60a5fa",
    groupBg: "bg-blue-400/[0.06]",
    groupBorder: "border-blue-400/30",
    groupText: "text-blue-300",
  },
  green: {
    border: "border-emerald-400/50",
    text: "text-emerald-300",
    ring: "ring-emerald-300",
    stroke: "#34d399",
    groupBg: "bg-emerald-400/[0.06]",
    groupBorder: "border-emerald-400/30",
    groupText: "text-emerald-300",
  },
  pink: {
    border: "border-pink-400/50",
    text: "text-pink-300",
    ring: "ring-pink-300",
    stroke: "#f472b6",
    groupBg: "bg-pink-400/[0.06]",
    groupBorder: "border-pink-400/30",
    groupText: "text-pink-300",
  },
  purple: {
    border: "border-purple-400/50",
    text: "text-purple-300",
    ring: "ring-purple-300",
    stroke: "#c084fc",
    groupBg: "bg-purple-400/[0.06]",
    groupBorder: "border-purple-400/30",
    groupText: "text-purple-300",
  },
  amber: {
    border: "border-amber-400/50",
    text: "text-amber-300",
    ring: "ring-amber-300",
    stroke: "#fbbf24",
    groupBg: "bg-amber-400/[0.06]",
    groupBorder: "border-amber-400/30",
    groupText: "text-amber-300",
  },
  cyan: {
    border: "border-cyan-400/50",
    text: "text-cyan-300",
    ring: "ring-cyan-300",
    stroke: "#22d3ee",
    groupBg: "bg-cyan-400/[0.06]",
    groupBorder: "border-cyan-400/30",
    groupText: "text-cyan-300",
  },
  rose: {
    border: "border-rose-400/50",
    text: "text-rose-300",
    ring: "ring-rose-300",
    stroke: "#fb7185",
    groupBg: "bg-rose-400/[0.06]",
    groupBorder: "border-rose-400/30",
    groupText: "text-rose-300",
  },
  teal: {
    border: "border-teal-400/50",
    text: "text-teal-300",
    ring: "ring-teal-300",
    stroke: "#2dd4bf",
    groupBg: "bg-teal-400/[0.06]",
    groupBorder: "border-teal-400/30",
    groupText: "text-teal-300",
  },
  indigo: {
    border: "border-indigo-400/50",
    text: "text-indigo-300",
    ring: "ring-indigo-300",
    stroke: "#818cf8",
    groupBg: "bg-indigo-400/[0.06]",
    groupBorder: "border-indigo-400/30",
    groupText: "text-indigo-300",
  },
};

/** Neutral default for nodes/edges without an explicit accent. */
export const DIAGRAM_NEUTRAL = {
  border: "border-white/20",
  text: "text-white/70",
  stroke: "#8f8f8f",
};
