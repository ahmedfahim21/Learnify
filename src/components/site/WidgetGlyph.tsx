import type { ReactNode } from "react";

import type { WidgetName } from "@/lib/a2ui/catalog";

/**
 * A wireframe of each widget in the catalog, drawn at postage-stamp size.
 *
 * The landing page listed the catalog as fifteen words, which asks the reader
 * to imagine what a name renders as. These are not illustrations of the idea
 * of a component — each one is the actual shape its widget puts on screen, so
 * the row reads as a vocabulary of layouts rather than a tag cloud.
 *
 * Typed as an exhaustive Record: adding a widget to the catalog is a compile
 * error until it has a glyph, the same guard the simulator registry uses.
 */

const VB = "0 0 44 30";
const line = "var(--color-faint)";

/** Body copy, drawn as rules. Widths vary so it reads as text, not a grid. */
function Lines({ y, widths, x = 6 }: { y: number; widths: number[]; x?: number }) {
  return (
    <>
      {widths.map((w, i) => (
        <line
          key={i}
          x1={x}
          y1={y + i * 5}
          x2={x + w}
          y2={y + i * 5}
          stroke={line}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
    </>
  );
}

const GLYPHS: Record<WidgetName, ReactNode> = {
  Narration: <Lines y={9} widths={[32, 32, 20]} />,

  ExplanationCard: (
    <>
      <rect x={5} y={5} width={34} height={20} rx={2} stroke={line} strokeWidth={1.5} fill="none" />
      <line x1={9} y1={11} x2={22} y2={11} stroke="var(--color-signal)" strokeWidth={2} strokeLinecap="round" />
      <Lines y={16} widths={[26, 18]} x={9} />
    </>
  ),

  MultipleChoiceCheck: (
    <>
      {[4, 13, 22].map((y, i) => (
        <g key={y}>
          <rect
            x={6}
            y={y}
            width={6}
            height={6}
            rx={1}
            stroke={i === 1 ? "var(--color-deep)" : line}
            fill={i === 1 ? "var(--color-deep)" : "none"}
            strokeWidth={1.5}
          />
          <line x1={16} y1={y + 3} x2={i === 1 ? 36 : 30} y2={y + 3} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      ))}
    </>
  ),

  Flashcard: (
    <>
      <rect x={9} y={3} width={30} height={18} rx={2} stroke={line} strokeWidth={1.5} fill="var(--color-node)" />
      <rect x={5} y={9} width={30} height={18} rx={2} stroke="var(--color-flow)" strokeWidth={1.5} fill="var(--color-node)" />
      <Lines y={16} widths={[18]} x={10} />
    </>
  ),

  OrderingExercise: (
    <>
      {[
        { y: 3, x: 12 },
        { y: 12, x: 6 },
        { y: 21, x: 9 },
      ].map((row, i) => (
        <g key={row.y}>
          <text
            x={row.x - 4}
            y={row.y + 5.5}
            fontSize={6}
            fill="var(--color-faint)"
            fontFamily="var(--font-mono)"
          >
            {i + 1}
          </text>
          <rect
            x={row.x}
            y={row.y}
            width={26}
            height={6}
            rx={1}
            stroke={i === 1 ? "var(--color-warn)" : line}
            strokeWidth={1.5}
            fill="none"
          />
        </g>
      ))}
    </>
  ),

  MatchingPairs: (
    <>
      {[4, 12, 20].map((y) => (
        <rect key={`l${y}`} x={4} y={y} width={12} height={6} rx={1} stroke={line} strokeWidth={1.5} fill="none" />
      ))}
      {[4, 12, 20].map((y) => (
        <rect key={`r${y}`} x={28} y={y} width={12} height={6} rx={1} stroke={line} strokeWidth={1.5} fill="none" />
      ))}
      <path d="M16 7 L28 23" stroke="var(--color-accent)" strokeWidth={1.5} fill="none" />
      <path d="M16 15 L28 7" stroke="var(--color-accent)" strokeWidth={1.5} fill="none" />
    </>
  ),

  CodeSnippet: (
    <>
      <rect x={4} y={4} width={36} height={22} rx={2} stroke={line} strokeWidth={1.5} fill="none" />
      <line x1={11} y1={4} x2={11} y2={26} stroke={line} strokeWidth={1} opacity={0.6} />
      <Lines y={10} widths={[18]} x={15} />
      <line x1={19} y1={15} x2={35} y2={15} stroke="var(--color-signal)" strokeWidth={1.5} strokeLinecap="round" />
      <line x1={19} y1={20} x2={29} y2={20} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
    </>
  ),

  Diagram: (
    <>
      <circle cx={10} cy={15} r={5} stroke={line} strokeWidth={1.5} fill="none" />
      <circle cx={34} cy={8} r={5} stroke={line} strokeWidth={1.5} fill="none" />
      <circle cx={34} cy={23} r={5} stroke={line} strokeWidth={1.5} fill="none" />
      <path d="M15 14 L29 9" stroke={line} strokeWidth={1.5} />
      <path d="M15 17 L29 22" stroke={line} strokeWidth={1.5} />
    </>
  ),

  SystemDiagram: (
    <>
      <rect x={3} y={11} width={10} height={9} rx={1.5} stroke="var(--color-signal)" strokeWidth={1.5} fill="none" />
      <rect x={17} y={11} width={10} height={9} rx={1.5} stroke="var(--color-deep)" strokeWidth={1.5} fill="none" />
      <rect x={31} y={4} width={10} height={9} rx={1.5} stroke="var(--color-warn)" strokeWidth={1.5} fill="none" />
      <rect x={31} y={18} width={10} height={9} rx={1.5} stroke="var(--color-warn)" strokeWidth={1.5} fill="none" />
      <path d="M13 15.5 L17 15.5" stroke={line} strokeWidth={1.5} />
      <path d="M27 15.5 L29 15.5 L29 8.5 L31 8.5" stroke={line} strokeWidth={1.5} fill="none" />
      <path d="M27 15.5 L29 15.5 L29 22.5 L31 22.5" stroke={line} strokeWidth={1.5} fill="none" />
    </>
  ),

  Simulator: (
    <>
      <path d="M5 24 C 14 24, 18 8, 39 6" stroke="var(--color-signal)" strokeWidth={1.5} fill="none" />
      <line x1={5} y1={28} x2={39} y2={28} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
      <circle cx={17} cy={28} r={3} fill="var(--color-node)" stroke="var(--color-signal)" strokeWidth={1.5} />
    </>
  ),

  FreeResponse: (
    <>
      <rect x={4} y={6} width={36} height={19} rx={2} stroke={line} strokeWidth={1.5} fill="none" />
      <Lines y={12} widths={[24, 14]} x={8} />
      <line x1={24} y1={14.5} x2={24} y2={21} stroke="var(--color-signal)" strokeWidth={1.5} />
    </>
  ),

  ProgressMeter: (
    <>
      {[
        { y: 6, w: 26, a: "var(--color-deep)" },
        { y: 14, w: 16, a: "var(--color-signal)" },
        { y: 22, w: 9, a: "var(--color-warn)" },
      ].map((bar) => (
        <g key={bar.y}>
          <rect x={5} y={bar.y} width={34} height={4} rx={2} fill="var(--color-line)" />
          <rect x={5} y={bar.y} width={bar.w} height={4} rx={2} fill={bar.a} />
        </g>
      ))}
    </>
  ),

  SessionRecap: (
    <>
      {[5, 14, 23].map((y) => (
        <g key={y}>
          <path
            d={`M5 ${y + 2.5} l2.5 2.5 l4.5 -5`}
            stroke="var(--color-deep)"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line x1={17} y1={y + 2} x2={38} y2={y + 2} stroke={line} strokeWidth={1.5} strokeLinecap="round" />
        </g>
      ))}
    </>
  ),

  Row: (
    <>
      {[4, 17, 30].map((x) => (
        <rect key={x} x={x} y={6} width={10} height={18} rx={1.5} stroke={line} strokeWidth={1.5} fill="none" />
      ))}
    </>
  ),

  Column: (
    <>
      {[4, 12, 20].map((y) => (
        <rect key={y} x={6} y={y} width={32} height={6} rx={1.5} stroke={line} strokeWidth={1.5} fill="none" />
      ))}
    </>
  ),
};

export function WidgetGlyph({ name, className = "" }: { name: WidgetName; className?: string }) {
  return (
    <svg viewBox={VB} aria-hidden className={`w-11 shrink-0 ${className}`}>
      {GLYPHS[name]}
    </svg>
  );
}
