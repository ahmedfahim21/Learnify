import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { MARK } from "@/components/site/Logo";

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

const INK = "#fbf8f2";
const FG = "#1d1914";
const MIST = "#6b6255";
const FAINT = "#82786a";
const LINE = "#e4dac9";
const SIGNAL = "#2e3f8f";
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
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34 }}>
          <svg viewBox="0 0 32 32" width={52} height={52}>
            <rect width="32" height="32" rx="8" fill={MARK.tile} />
            <rect x="6" y="8" width="20" height="3.2" rx="1.6" fill={MARK.bar} />
            <path d="M11.5 11.2 V24.6 L22.6 17.9 Z" fill={MARK.play} stroke={MARK.play} strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
          <span style={{ display: "flex" }}>
            Learn<span style={{ color: SIGNAL }}>ify</span>
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 68, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 980 }}>
            Watch an IIT lecture in English, learn it in your language.
          </div>
          <div style={{ fontSize: 28, color: MIST, maxWidth: 940, lineHeight: 1.4 }}>
            Notes, quizzes, flashcards and spoken doubts, written from NPTEL lectures in your language.
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
