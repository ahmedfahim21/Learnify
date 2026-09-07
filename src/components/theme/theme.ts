"use client";

import { useEffect, useState } from "react";

/**
 * Theme state, read from and written to `data-theme` on <html>.
 *
 * The attribute is the single source of truth — CSS keys off it, the boot
 * script in layout.tsx sets it before first paint, and Tailwind's `dark:`
 * variant is bound to it. Nothing here infers the theme independently, so
 * there is only ever one answer.
 */
export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "learnify-theme";

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing or blocked storage: the choice just won't persist,
    // which is a far better outcome than the toggle throwing.
  }
}

/** The current theme, kept in sync if it changes anywhere else on the page. */
export function useTheme(): [Theme, (next: Theme) => void] {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  return [theme, (next: Theme) => applyTheme(next)];
}
