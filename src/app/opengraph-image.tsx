import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The link preview card.
 *
 * Held to the same rules as the site it links to: IBM Plex, 3px corners,
 * hairline rules in the line token, accents used as accent, and hierarchy from
 * size and colour rather than weight. An earlier version used the runtime's
 * default sans and 8px rounded grey boxes, which read as a wireframe of the
 * product rather than the product.
 *
 * The drawing is the flow the landing page leads with, redrawn in flexbox
 * because next/og rasterises through Satori, whose flexbox is complete and
 * whose SVG support is not.
 *
 * The two faces are vendored under `_fonts` rather than fetched at build time:
 * a card that silently falls back to Helvetica whenever a font CDN is
 * unreachable is exactly the quiet degradation worth 300KB to avoid.
 */

export const alt = "Learnify.sd — a tutor that builds its own interface";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#ffffff";
const CANVAS = "#f7f8fa";
const NODE = "#ffffff";
const FG = "#0f1117";
const MIST = "#656b78";
const FAINT = "#8a8f9c";
const LINE = "#e3e4e8";
const SIGNAL = "#0b63d6";
const DEEP = "#0a7d76";
const WARN = "#a8620a";
const FLOW = "#5b4bd6";

const RADIUS = 3;

const font = (file: string) => readFile(join(process.cwd(), "src/app/_fonts", file));

/** A node in the flow, drawn the way SystemDiagram draws one. */
function Box({ label, sub, accent, w }: { label: string; sub?: string; accent: string; w: number }) {
  return (
    <div
      style={{
        width: w,
        height: 74,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 3,
        background: NODE,
        border: `1px solid ${LINE}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: RADIUS,
        padding: "12px 14px",
      }}
    >
      <span style={{ fontSize: 19, color: FG }}>{label}</span>
      {sub ? <span style={{ fontSize: 14, color: FAINT, fontFamily: "Plex Mono" }}>{sub}</span> : null}
    </div>
  );
}

/** A numbered step badge on the run between two boxes. */
function Step({ n }: { n: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 4px" }}>
      <div style={{ width: 16, height: 1, background: FAINT }} />
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          border: `1px solid ${LINE}`,
          background: NODE,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: MIST,
          fontFamily: "Plex Mono",
        }}
      >
        {n}
      </div>
      <div style={{ width: 16, height: 1, background: FAINT }} />
    </div>
  );
}

export default async function OpengraphImage() {
  const [sans, mono] = await Promise.all([font("plex-sans-400.ttf"), font("plex-mono-400.ttf")]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: INK,
          color: FG,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          fontFamily: "Plex Sans",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "44px 64px 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: RADIUS,
                border: `1px solid ${LINE}`,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: 7,
              }}
            >
              <div style={{ width: 18, height: 5, borderRadius: 2, background: SIGNAL }} />
              <div style={{ width: 11, height: 3, borderRadius: 1, background: FAINT }} />
              <div style={{ display: "flex", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: DEEP }} />
                <div style={{ width: 12, height: 8, borderRadius: 2, border: `2px solid ${WARN}` }} />
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 27 }}>
              <span>Learnify</span>
              <span style={{ color: SIGNAL }}>.sd</span>
            </div>
          </div>

          <span style={{ fontFamily: "Plex Mono", fontSize: 15, letterSpacing: 1.6, color: FAINT }}>
            GENERATIVE UI · SYSTEM DESIGN
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 48,
            padding: "0 64px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", fontSize: 66, lineHeight: 1.1 }}>
            <span>A tutor that builds</span>
            <span style={{ color: SIGNAL }}>its own interface.</span>
          </div>

          {/* A slice of the catalog, so the right half is not dead space. */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
            {["SystemDiagram", "Simulator", "MatchingPairs", "Flashcard", "+11 more"].map(
              (name) => (
                <div
                  key={name}
                  style={{
                    display: "flex",
                    border: `1px solid ${LINE}`,
                    borderRadius: RADIUS,
                    background: NODE,
                    padding: "6px 12px",
                    fontFamily: "Plex Mono",
                    fontSize: 15,
                    color: MIST,
                  }}
                >
                  {name}
                </div>
              ),
            )}
          </div>
        </div>

        {/* The loop, as the landing page draws it. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: CANVAS,
            borderTop: `1px solid ${LINE}`,
            padding: "34px 64px",
          }}
        >
          <Box label="Model" sub="present_ui" accent={SIGNAL} w={186} />
          <Step n={1} />
          <Box label="Catalog" sub="15 widgets" accent={FLOW} w={186} />
          <Step n={2} />
          <Box label="Renderer" sub="no eval" accent={DEEP} w={186} />
          <Step n={3} />
          <Box label="Screen" sub="the learner" accent={WARN} w={168} />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex Sans", data: sans, style: "normal", weight: 400 },
        { name: "Plex Mono", data: mono, style: "normal", weight: 400 },
      ],
    },
  );
}
