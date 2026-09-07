import { ImageResponse } from "next/og";

/**
 * The link preview card.
 *
 * Mostly picture: a wordmark, one line, and a drawing of a screen mid-assembly
 * — a heading, a rule, an answered check, and a diagram row. A preview is seen
 * at thumbnail size in a feed, where a paragraph is unreadable and a shape is
 * not, so nothing here is longer than it can afford to be.
 *
 * Built from divs rather than SVG because next/og rasterises with Satori,
 * whose flexbox is complete and whose SVG support is not.
 */

export const alt = "Learnify.sd — a tutor that builds its own interface";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#ffffff";
const CANVAS = "#f7f8fa";
const NODE = "#ffffff";
const FG = "#0f1117";
const FAINT = "#8a8f9c";
const LINE = "#e3e4e8";
const SIGNAL = "#0b63d6";
const DEEP = "#0a7d76";
const WARN = "#a8620a";

/** A block of "text" — the drawing's stand-in for a line of prose. */
function Rule({ w, color = LINE, h = 10 }: { w: number; color?: string; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: h / 2, background: color }} />;
}

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: INK,
          color: FG,
          display: "flex",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            width: 620,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 60,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 8,
                border: `3px solid ${LINE}`,
                display: "flex",
                flexDirection: "column",
                gap: 5,
                padding: 8,
              }}
            >
              <Rule w={21} h={6} color={SIGNAL} />
              <Rule w={13} h={4} color={FAINT} />
              <div style={{ display: "flex", gap: 5 }}>
                <div style={{ width: 9, height: 9, borderRadius: 2, background: DEEP }} />
                <div
                  style={{ width: 14, height: 9, borderRadius: 2, border: `3px solid ${WARN}` }}
                />
              </div>
            </div>
            <div style={{ display: "flex", fontSize: 30 }}>
              <span>Learnify</span>
              <span style={{ color: SIGNAL }}>.sd</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", fontSize: 50, lineHeight: 1.15 }}>
            <span>A tutor that builds</span>
            <span style={{ color: SIGNAL }}>its own interface.</span>
          </div>

          <div style={{ display: "flex", fontSize: 22, color: FAINT }}>System design</div>
        </div>

        {/* The screen being assembled. */}
        <div
          style={{
            flex: 1,
            background: CANVAS,
            borderLeft: `2px solid ${LINE}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 56,
          }}
        >
          <div
            style={{
              width: 470,
              background: NODE,
              border: `2px solid ${LINE}`,
              borderRadius: 6,
              display: "flex",
              flexDirection: "column",
              gap: 22,
              padding: 34,
            }}
          >
            {/* heading + prose */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Rule w={210} h={16} color={FG} />
              <Rule w={380} />
              <Rule w={300} />
            </div>

            {/* a diagram row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{ width: 74, height: 42, borderRadius: 4, border: `3px solid ${SIGNAL}` }}
              />
              <Rule w={22} h={3} color={FAINT} />
              <div style={{ width: 74, height: 42, borderRadius: 4, border: `3px solid ${DEEP}` }} />
              <Rule w={22} h={3} color={FAINT} />
              <div style={{ width: 74, height: 42, borderRadius: 4, border: `3px solid ${WARN}` }} />
            </div>

            {/* an answered check */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 12,
                  borderRadius: 4,
                  border: `3px solid ${LINE}`,
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 3, border: `3px solid ${LINE}` }} />
                <Rule w={230} />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 12,
                  borderRadius: 4,
                  border: `3px solid ${DEEP}`,
                  background: "rgba(10,125,118,0.08)",
                }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 3, background: DEEP }} />
                <Rule w={190} />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
