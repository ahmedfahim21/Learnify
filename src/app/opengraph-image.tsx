import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The link preview card.
 *
 * Held to the same rules as the site: IBM Plex, 3px corners, hairline rules in
 * the line token, accents used as accent, and hierarchy from size and colour
 * rather than weight. Language names are written in English because the
 * vendored Plex faces carry Latin glyphs only; Indic script here would render
 * as empty boxes.
 *
 * The faces are vendored under `_fonts` rather than fetched at build time, so
 * the card never silently falls back to a default sans.
 */

export const alt = "Learnify: watch an IIT lecture in English, learn it in your language";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#ffffff";
const FG = "#0f1117";
const MIST = "#656b78";
const FAINT = "#8a8f9c";
const LINE = "#e3e4e8";
const SIGNAL = "#0b63d6";
const RADIUS = 3;

const LANGS = ["Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Bengali", "Marathi", "Gujarati", "Odia", "Punjabi"];

const font = (file: string) => readFile(join(process.cwd(), "src/app/_fonts", file));

export default async function OpengraphImage() {
  const [sans, mono] = await Promise.all([font("plex-sans-400.ttf"), font("plex-mono-400.ttf")]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: INK,
          padding: 72,
          fontFamily: "Plex Sans",
          color: FG,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
          <div style={{ width: 22, height: 22, borderRadius: RADIUS, background: SIGNAL }} />
          <span>Learnify</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 980 }}>
            Watch an IIT lecture in English, learn it in your language.
          </div>
          <div style={{ fontSize: 28, color: MIST, maxWidth: 940, lineHeight: 1.4 }}>
            Subtitles, in-video checks, spoken doubts and study screens for NPTEL lectures.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            borderTop: `1px solid ${LINE}`,
            paddingTop: 28,
            fontFamily: "Plex Mono",
            fontSize: 20,
            color: FAINT,
          }}
        >
          {LANGS.map((l) => (
            <span key={l} style={{ border: `1px solid ${LINE}`, borderRadius: RADIUS, padding: "6px 12px" }}>
              {l}
            </span>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Plex Sans", data: sans, weight: 400, style: "normal" },
        { name: "Plex Mono", data: mono, weight: 400, style: "normal" },
      ],
    },
  );
}
