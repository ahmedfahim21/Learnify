import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { MARK } from "@/components/site/Logo";

/**
 * The link preview card: the headline, what you get, and the mark on an
 * indigo band. No URL and no language list, so it stays readable as a thumbnail.
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

export const alt = "Learnify: pause any NPTEL lecture and ask, answers in your language";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#f6f9f8";
const FG = "#13201c";
const MIST = "#4f625b";
const SIGNAL = "#2e3f8f";


const font = (file: string) => readFile(join(process.cwd(), "src/app/_fonts", file));

export default async function OpengraphImage() {
  const [sans, mono] = await Promise.all([font("plex-sans-400.ttf"), font("plex-mono-400.ttf")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: INK, fontFamily: "Plex Sans", color: FG }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "72px 64px 72px 80px",
          }}
        >
          <div style={{ display: "flex", fontSize: 32, letterSpacing: -0.5 }}>
            Learn<span style={{ color: SIGNAL }}>ify</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 64, lineHeight: 1.1, letterSpacing: -1.5 }}>
            <span>Pause any NPTEL lecture and ask.</span>
            <span style={{ color: SIGNAL }}>Answers in your language.</span>
          </div>
          <div style={{ display: "flex", fontFamily: "Plex Mono", fontSize: 22, color: MIST }}>
            Voice doubts · Quizzes · Flashcards · Notes
          </div>
        </div>

        {/* The mark, large, on its own indigo band. */}
        <div style={{ width: 340, display: "flex", alignItems: "center", justifyContent: "center", background: MARK.tile }}>
          <svg viewBox="0 0 32 32" width={220} height={220}>
            <rect x="6" y="8" width="20" height="3.2" rx="1.6" fill={MARK.bar} />
            <path d="M11.5 11.2 V24.6 L22.6 17.9 Z" fill={MARK.play} stroke={MARK.play} strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
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
