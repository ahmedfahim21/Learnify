"use client";

import { useEffect, useState } from "react";

import { LANGUAGES } from "@/lib/languages";

/**
 * The hero's last words, cycling through each language in its own script:
 * "learn it in தமிழ்", "learn it in తెలుగు", … Screen readers get the plain
 * sentence once (the parent renders it sr-only); this is decoration.
 * Holds still under reduced motion.
 */

const NAMES = Object.values(LANGUAGES).filter((l) => l.name !== "English");

export function CyclingLanguage() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % NAMES.length), 2200);
    return () => clearInterval(id);
  }, []);

  const lang = NAMES[index];
  return (
    <span aria-hidden className="text-(--color-signal)">
      <span key={lang.sarvam} lang={lang.sarvam} className="lipi-in">
        {lang.native}
      </span>
    </span>
  );
}
