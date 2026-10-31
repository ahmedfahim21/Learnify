import { z } from "zod";

import { isLang, type Lang } from "@/lib/languages";

/**
 * How a student wants to learn. Asked once, before anything is generated for
 * them, and used to shape every lecture after:
 *   lang    the language study screens are written in
 *   goal    what they're here for, which picks the study mode that opens first
 *   level   how hard to pitch it, which picks the screen variant
 *   checks  whether quick checks pause the video (these need the study pack)
 */

export const GOALS = ["understand", "practise", "revise"] as const;
export const LEVELS = ["simpler", "standard", "harder"] as const;

export type Goal = (typeof GOALS)[number];
export type Level = (typeof LEVELS)[number];

export const preferencesSchema = z
  .object({
    lang: z.string().refine(isLang, "Unsupported language."),
    goal: z.enum(GOALS),
    level: z.enum(LEVELS),
    checks: z.boolean(),
  })
  .strict();

export interface Preferences {
  lang: Lang;
  goal: Goal;
  level: Level;
  checks: boolean;
}

/** The study mode each goal opens on. */
export const FIRST_MODE: Record<Goal, "notes" | "quiz" | "cards"> = {
  understand: "notes",
  practise: "quiz",
  revise: "cards",
};

/** Parse stored or sent preferences; null when they aren't a complete, valid set. */
export function parsePreferences(value: unknown): Preferences | null {
  const parsed = preferencesSchema.safeParse(value);
  return parsed.success ? (parsed.data as Preferences) : null;
}
