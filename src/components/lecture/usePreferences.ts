"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/lib/authClient";
import { parsePreferences, type Preferences } from "@/lib/preferences";

/**
 * The student's learning preferences. Signed in, they live on the server
 * (GET/PUT /api/me/preferences) so they follow the student across devices;
 * signed out, in this browser. A copy is always kept locally, so a choice
 * made before signing in carries over the first time they sign in.
 *
 * `unset` means the student hasn't chosen yet: nothing is generated for them
 * until they do.
 */

const KEY = "learnify.prefs";

export type PrefsState =
  | { phase: "loading" }
  | { phase: "unset" }
  | { phase: "ready"; prefs: Preferences }
  /** Changing them: the lecture keeps using `prefs` until the new choice is saved. */
  | { phase: "editing"; prefs: Preferences }
  | { phase: "error"; message: string };

function readLocal(): Preferences | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parsePreferences(JSON.parse(raw)) : null;
  } catch {
    // Storage blocked (private mode) or a corrupt value: ask again.
    return null;
  }
}

function writeLocal(prefs: Preferences) {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Not remembered in this browser; the server copy (when signed in) still is.
  }
}

async function putServer(prefs: Preferences): Promise<Preferences> {
  const res = await fetch("/api/me/preferences", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(prefs),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as Preferences;
}

export function usePreferences() {
  const { user, isPending } = useSession();
  const [state, setState] = useState<PrefsState>({ phase: "loading" });

  useEffect(() => {
    if (isPending) return;
    const local = readLocal();
    if (!user) {
      setState(local ? { phase: "ready", prefs: local } : { phase: "unset" });
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/me/preferences", { cache: "no-store" });
      if (res.status === 404) {
        // Chosen before signing in: those choices were the student's, so keep them.
        if (local) return { phase: "ready", prefs: await putServer(local) } as const;
        return { phase: "unset" } as const;
      }
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      const prefs = parsePreferences(body);
      if (!prefs) throw new Error("The saved preferences came back malformed.");
      writeLocal(prefs);
      return { phase: "ready", prefs } as const;
    })()
      .then((next) => !cancelled && setState(next))
      .catch((err: Error) => {
        console.error("loading preferences failed:", err);
        if (!cancelled) setState({ phase: "error", message: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, [user, isPending]);

  const save = useCallback(
    async (prefs: Preferences) => {
      writeLocal(prefs);
      const saved = user ? await putServer(prefs) : prefs;
      setState({ phase: "ready", prefs: saved });
      return saved;
    },
    [user],
  );

  /** Reopen the setup with the current choices filled in. */
  const edit = useCallback(() => {
    setState((s) => (s.phase === "ready" ? { phase: "editing", prefs: s.prefs } : s));
  }, []);

  /** Close the setup without changing anything. */
  const cancel = useCallback(() => {
    setState((s) => (s.phase === "editing" ? { phase: "ready", prefs: s.prefs } : s));
  }, []);

  return { state, save, edit, cancel };
}
