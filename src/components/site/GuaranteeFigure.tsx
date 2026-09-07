import type { ReactNode } from "react";

/**
 * A small figure for each of the four claims on the landing page.
 *
 * Four paragraphs in a row is a wall — and these are claims about mechanism,
 * which is exactly the thing a picture carries better than a sentence. Each
 * one draws the shape of what it asserts: a branch, a gate, a boundary, a
 * loop. Deliberately plain SVG at a fixed viewBox: they sit above the fold on
 * every page load and have no reason to be a React Flow instance.
 */

export type GuaranteeFigureId = "composes" | "catalog" | "renderer" | "grading";

const line = "var(--color-faint)";
const dim = "var(--color-line)";

function Box({
  x,
  y,
  w = 46,
  h = 20,
  stroke = line,
  label,
  dashed = false,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  stroke?: string;
  label?: string;
  dashed?: boolean;
}) {
  return (
    <>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={2}
        fill="var(--color-node)"
        stroke={stroke}
        strokeWidth={1.25}
        strokeDasharray={dashed ? "3 3" : undefined}
      />
      {label && (
        <text
          x={x + w / 2}
          y={y + h / 2 + 3}
          textAnchor="middle"
          fontSize={7.5}
          fill="var(--color-mist)"
          fontFamily="var(--font-mono)"
        >
          {label}
        </text>
      )}
    </>
  );
}

/** One marker per stroke colour. `context-stroke` would be tidier but is not
 *  universally supported, and an arrowhead that silently falls back to black
 *  is worse than four defs. */
const MARKERS = {
  "var(--color-faint)": "gf-a-faint",
  "var(--color-signal)": "gf-a-signal",
  "var(--color-deep)": "gf-a-deep",
  "var(--color-alert)": "gf-a-alert",
} as const;

type ArrowStroke = keyof typeof MARKERS;

function Arrow({
  d,
  stroke = line,
  dashed = false,
}: {
  d: string;
  stroke?: ArrowStroke;
  dashed?: boolean;
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.25}
      strokeDasharray={dashed ? "3 3" : undefined}
      markerEnd={`url(#${MARKERS[stroke]})`}
    />
  );
}

const FIGURES: Record<GuaranteeFigureId, ReactNode> = {
  // One turn in, three different screens out — the branch is the point.
  composes: (
    <>
      <Box x={2} y={38} label="turn" />
      <Arrow d="M50 46 L66 22" />
      <Arrow d="M50 48 L66 48" />
      <Arrow d="M50 50 L66 74" />
      <rect x={70} y={12} width={44} height={20} rx={2} fill="none" stroke="var(--color-signal)" strokeWidth={1.25} />
      <line x1={75} y1={19} x2={97} y2={19} stroke={line} strokeWidth={1.25} />
      <line x1={75} y1={25} x2={89} y2={25} stroke={line} strokeWidth={1.25} />
      <rect x={70} y={38} width={20} height={20} rx={2} fill="none" stroke="var(--color-deep)" strokeWidth={1.25} />
      <rect x={94} y={38} width={20} height={20} rx={2} fill="none" stroke="var(--color-deep)" strokeWidth={1.25} />
      <path d="M90 48 L94 48" stroke={line} strokeWidth={1.25} />
      <rect x={70} y={64} width={44} height={20} rx={2} fill="none" stroke="var(--color-warn)" strokeWidth={1.25} />
      <path d="M74 80 C 84 80, 88 70, 110 68" fill="none" stroke="var(--color-warn)" strokeWidth={1.25} />
    </>
  ),

  // A gate: valid passes, invalid turns back once and only once.
  catalog: (
    <>
      <Box x={2} y={38} label="output" />
      <Arrow d="M50 48 L64 48" />
      {/* The union, drawn as the branch stack it is. */}
      <g>
        {[26, 38, 50, 62].map((y, i) => (
          <rect
            key={y}
            x={66}
            y={y}
            width={26}
            height={9}
            rx={1.5}
            fill="none"
            stroke={i === 1 ? "var(--color-signal)" : dim}
            strokeWidth={1.25}
          />
        ))}
      </g>
      <Arrow d="M92 44 L114 30" stroke="var(--color-signal)" />
      <text x={116} y={26} fontSize={7.5} fill="var(--color-mist)" fontFamily="var(--font-mono)">
        ok
      </text>
      <Arrow d="M92 56 C 100 76, 40 80, 24 62" stroke="var(--color-alert)" dashed />
      <text x={52} y={88} fontSize={7.5} fill="var(--color-alert)" fontFamily="var(--font-mono)">
        repair ×1
      </text>
    </>
  ),

  // A boundary with data crossing it and nothing else.
  renderer: (
    <>
      <line x1={62} y1={4} x2={62} y2={92} stroke={dim} strokeWidth={1.25} strokeDasharray="4 4" />
      <text x={6} y={12} fontSize={7.5} fill="var(--color-faint)" fontFamily="var(--font-mono)">
        model
      </text>
      <text x={70} y={12} fontSize={7.5} fill="var(--color-faint)" fontFamily="var(--font-mono)">
        browser
      </text>
      <Box x={4} y={30} w={48} label="values" />
      <Arrow d="M54 40 L86 40" stroke="var(--color-deep)" />
      <Box x={4} y={62} w={48} label="code" stroke="var(--color-alert)" dashed />
      {/* The blocked path: drawn and struck through, because the claim is
          about what does not cross, not about what does. */}
      <path d="M54 72 L80 72" stroke="var(--color-alert)" strokeWidth={1.25} strokeDasharray="3 3" />
      <path d="M78 66 L88 78 M88 66 L78 78" stroke="var(--color-alert)" strokeWidth={1.5} />
      <rect x={86} y={26} width={30} height={28} rx={2} fill="none" stroke="var(--color-deep)" strokeWidth={1.25} />
      <line x1={91} y1={36} x2={111} y2={36} stroke={line} strokeWidth={1.25} />
      <line x1={91} y1={44} x2={104} y2={44} stroke={line} strokeWidth={1.25} />
    </>
  ),

  // The verdict comes from the key, not from the model.
  grading: (
    <>
      <Box x={2} y={14} w={48} label="answer" />
      <Box x={2} y={58} w={48} label="key" stroke="var(--color-deep)" />
      <Arrow d="M52 24 L76 40" />
      <Arrow d="M52 68 L76 52" stroke="var(--color-deep)" />
      <circle cx={88} cy={46} r={11} fill="none" stroke="var(--color-deep)" strokeWidth={1.25} />
      <path
        d="M83 46 l3.5 3.5 l6.5 -7"
        fill="none"
        stroke="var(--color-deep)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Arrow d="M100 46 L114 46" stroke="var(--color-deep)" />
      <text x={70} y={90} fontSize={7.5} fill="var(--color-mist)" fontFamily="var(--font-mono)">
        next turn
      </text>
    </>
  ),
};

export function GuaranteeFigure({ id }: { id: GuaranteeFigureId }) {
  return (
    <svg viewBox="0 0 140 96" aria-hidden className="w-full max-w-[220px]">
      <defs>
        {Object.entries(MARKERS).map(([color, markerId]) => (
          <marker
            key={markerId}
            id={markerId}
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={5}
            markerHeight={5}
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" fill={color} />
          </marker>
        ))}
      </defs>
      {FIGURES[id]}
    </svg>
  );
}
