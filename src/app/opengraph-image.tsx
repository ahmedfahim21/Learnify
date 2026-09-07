import { ImageResponse } from "next/og";

import { PROBLEMS } from "@/content/systemDesign";
import { WIDGET_NAMES } from "@/lib/a2ui/catalog";
import { SIMULATOR_IDS } from "@/lib/sims/ids";

/**
 * The link preview card.
 *
 * Drawn rather than photographed, in the site's own palette, and carrying the
 * one sentence that says what this is. Counts come from the source modules, so
 * the card cannot claim something the code stopped supporting.
 *
 * next/og runs this at build time for a static route, so the fonts available
 * are the runtime's own — hence no font fetch and no custom face here.
 */

export const alt = "Learnify.sd — a tutor that builds its own interface";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#ffffff";
const FG = "#0f1117";
const MIST = "#656b78";
const LINE = "#e3e4e8";
const SIGNAL = "#0b63d6";
const DEEP = "#0a7d76";
const WARN = "#a8620a";

export default function OpengraphImage() {
  const facts = [
    `${PROBLEMS.length} concepts`,
    `${WIDGET_NAMES.length} widgets`,
    `${SIMULATOR_IDS.length} simulators`,
  ];

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
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* The mark, at card scale. */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              border: `3px solid ${LINE}`,
              display: "flex",
              flexDirection: "column",
              gap: 6,
              padding: 9,
            }}
          >
            <div style={{ width: 22, height: 7, borderRadius: 3, background: SIGNAL }} />
            <div style={{ width: 14, height: 4, borderRadius: 2, background: MIST }} />
            <div style={{ display: "flex", gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: 2, background: DEEP }} />
              <div style={{ width: 14, height: 9, borderRadius: 2, border: `3px solid ${WARN}` }} />
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 30 }}>
            <span>Learnify</span>
            <span style={{ color: SIGNAL }}>.sd</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.1 }}>
            <span>A tutor that builds</span>
            <span style={{ color: SIGNAL }}>its own interface.</span>
          </div>
          <div style={{ display: "flex", fontSize: 28, color: MIST, maxWidth: 900 }}>
            System design, taught without a chat box. The model emits declarative UI, validated
            against a fixed catalog before the browser renders it.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 22, color: MIST }}>
          {facts.map((fact, i) => (
            <div key={fact} style={{ display: "flex", alignItems: "center", gap: 16 }}>
              {i > 0 && <span style={{ color: LINE }}>·</span>}
              <span>{fact}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
