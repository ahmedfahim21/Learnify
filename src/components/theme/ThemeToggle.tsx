"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { useTheme } from "./theme";

export function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  // The server can't know the theme, so render the control only once mounted
  // rather than guessing and flipping the icon a moment later.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <span className="h-7 w-7" aria-hidden />;

  const next = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-7 w-7 items-center justify-center text-(--color-mist) transition-colors hover:text-(--color-fg)"
    >
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </button>
  );
}
