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
    border: "border-slate-500/50 dark:border-slate-400/50",
    text: "text-slate-700 dark:text-slate-300",
    ring: "ring-slate-500 dark:ring-slate-300",
    stroke: "var(--diagram-slate)",
    groupBg: "bg-slate-500/[0.07] dark:bg-slate-400/[0.06]",
    groupBorder: "border-slate-500/35 dark:border-slate-400/30",
    groupText: "text-slate-700 dark:text-slate-300",
  },
  blue: {
    border: "border-blue-500/50 dark:border-blue-400/50",
    text: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500 dark:ring-blue-300",
    stroke: "var(--diagram-blue)",
    groupBg: "bg-blue-500/[0.07] dark:bg-blue-400/[0.06]",
    groupBorder: "border-blue-500/35 dark:border-blue-400/30",
    groupText: "text-blue-700 dark:text-blue-300",
  },
  green: {
    border: "border-emerald-500/50 dark:border-emerald-400/50",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500 dark:ring-emerald-300",
    stroke: "var(--diagram-green)",
    groupBg: "bg-emerald-500/[0.07] dark:bg-emerald-400/[0.06]",
    groupBorder: "border-emerald-500/35 dark:border-emerald-400/30",
    groupText: "text-emerald-700 dark:text-emerald-300",
  },
  pink: {
    border: "border-pink-500/50 dark:border-pink-400/50",
    text: "text-pink-700 dark:text-pink-300",
    ring: "ring-pink-500 dark:ring-pink-300",
    stroke: "var(--diagram-pink)",
    groupBg: "bg-pink-500/[0.07] dark:bg-pink-400/[0.06]",
    groupBorder: "border-pink-500/35 dark:border-pink-400/30",
    groupText: "text-pink-700 dark:text-pink-300",
  },
  purple: {
    border: "border-purple-500/50 dark:border-purple-400/50",
    text: "text-purple-700 dark:text-purple-300",
    ring: "ring-purple-500 dark:ring-purple-300",
    stroke: "var(--diagram-purple)",
    groupBg: "bg-purple-500/[0.07] dark:bg-purple-400/[0.06]",
    groupBorder: "border-purple-500/35 dark:border-purple-400/30",
    groupText: "text-purple-700 dark:text-purple-300",
  },
  amber: {
    border: "border-amber-500/50 dark:border-amber-400/50",
    text: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500 dark:ring-amber-300",
    stroke: "var(--diagram-amber)",
    groupBg: "bg-amber-500/[0.07] dark:bg-amber-400/[0.06]",
    groupBorder: "border-amber-500/35 dark:border-amber-400/30",
    groupText: "text-amber-700 dark:text-amber-300",
  },
  cyan: {
    border: "border-cyan-500/50 dark:border-cyan-400/50",
    text: "text-cyan-700 dark:text-cyan-300",
    ring: "ring-cyan-500 dark:ring-cyan-300",
    stroke: "var(--diagram-cyan)",
    groupBg: "bg-cyan-500/[0.07] dark:bg-cyan-400/[0.06]",
    groupBorder: "border-cyan-500/35 dark:border-cyan-400/30",
    groupText: "text-cyan-700 dark:text-cyan-300",
  },
  rose: {
    border: "border-rose-500/50 dark:border-rose-400/50",
    text: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500 dark:ring-rose-300",
    stroke: "var(--diagram-rose)",
    groupBg: "bg-rose-500/[0.07] dark:bg-rose-400/[0.06]",
    groupBorder: "border-rose-500/35 dark:border-rose-400/30",
    groupText: "text-rose-700 dark:text-rose-300",
  },
  teal: {
    border: "border-teal-500/50 dark:border-teal-400/50",
    text: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-500 dark:ring-teal-300",
    stroke: "var(--diagram-teal)",
    groupBg: "bg-teal-500/[0.07] dark:bg-teal-400/[0.06]",
    groupBorder: "border-teal-500/35 dark:border-teal-400/30",
    groupText: "text-teal-700 dark:text-teal-300",
  },
  indigo: {
    border: "border-indigo-500/50 dark:border-indigo-400/50",
    text: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-500 dark:ring-indigo-300",
    stroke: "var(--diagram-indigo)",
    groupBg: "bg-indigo-500/[0.07] dark:bg-indigo-400/[0.06]",
    groupBorder: "border-indigo-500/35 dark:border-indigo-400/30",
    groupText: "text-indigo-700 dark:text-indigo-300",
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
