"use client";

import { useCallback, useRef, useState } from "react";

import type { Lang } from "@/lib/languages";
import { dueCheckpoint, replayFinished } from "@/lib/player/checkpointClock";
import type { Grade, PublicCheckpoint } from "@/lib/study/grading";

import type { PlayerSample } from "../player/useYouTubePlayer";

/**
 * The in-video check flow:
 *
 *   playing ─(crosses a check)→ asking(1) ─right→ answered ─continue→ playing
 *                                         └wrong→ replaying ─(reaches end)→ asking(2)
 *   asking(2) ─right or wrong→ answered (explanation, and the right option on a miss)
 *
 * Every answer is graded by POST /api/checkpoints/answer; the browser never
 * has the key. Skipping, or turning checks off, marks a check done.
 */

export type CheckState =
  | { mode: "idle" }
  | { mode: "asking"; check: PublicCheckpoint; attempt: number; submitting: boolean; error: string | null }
  | { mode: "replaying"; check: PublicCheckpoint; from: number; to: number }
  | { mode: "answered"; check: PublicCheckpoint; attempt: number; choice: number; grade: Grade };

interface Controls {
  play: () => void;
  pause: () => void;
  seek: (sec: number, opts?: { play?: boolean }) => void;
}

export function useCheckpoints(lectureId: string, lang: Lang, checks: PublicCheckpoint[], player: Controls, enabled: boolean) {
  const [state, setState] = useState<CheckState>({ mode: "idle" });
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());
  const last = useRef<PlayerSample | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  /** Feed every player sample; fires checks and ends replays. */
  const onSample = useCallback(
    (s: PlayerSample) => {
      const prev = last.current;
      last.current = s;
      if (!prev) return;
      const sample = {
        prevSec: prev.timeSec,
        nowSec: s.timeSec,
        elapsedMs: s.at - prev.at,
        playbackRate: s.rate,
        playing: s.playing,
        msSinceOwnSeek: s.at - s.lastOwnSeekAt,
      };
      const current = stateRef.current;
      if (current.mode === "idle" && enabled) {
        const due = dueCheckpoint(sample, checks, done);
        if (due) {
          const check = checks.find((c) => c.id === due.id)!;
          player.pause();
          setState({ mode: "asking", check, attempt: 1, submitting: false, error: null });
        }
      } else if (current.mode === "replaying" && replayFinished(sample, current.to)) {
        player.pause();
        setState({ mode: "asking", check: current.check, attempt: 2, submitting: false, error: null });
      }
    },
    [checks, done, enabled, player],
  );

  const answer = useCallback(
    async (choice: number) => {
      const current = stateRef.current;
      if (current.mode !== "asking" || current.submitting) return;
      setState({ ...current, submitting: true, error: null });
      try {
        const res = await fetch("/api/checkpoints/answer", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lectureId, lang, checkpointId: current.check.id, choice, attempt: current.attempt }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        const grade = body as Grade;
        if (!grade.correct && current.attempt === 1) {
          setState({ mode: "replaying", check: current.check, from: grade.replayFrom, to: grade.replayTo });
          player.seek(grade.replayFrom, { play: true });
        } else {
          setState({ mode: "answered", check: current.check, attempt: current.attempt, choice, grade });
        }
      } catch (err) {
        console.error("checkpoint answer failed:", err);
        setState({ ...current, submitting: false, error: err instanceof Error ? err.message : String(err) });
      }
    },
    [lang, lectureId, player],
  );

  const finish = useCallback(
    (resume: boolean) => {
      const current = stateRef.current;
      if (current.mode === "idle") return;
      setDone((d) => new Set(d).add(current.check.id));
      if (current.mode === "replaying") {
        // Skipping the replay goes back to where the check was, ready to ask again.
        setState({ mode: "asking", check: current.check, attempt: 2, submitting: false, error: null });
        player.seek(current.check.atSec);
        player.pause();
        return;
      }
      setState({ mode: "idle" });
      if (resume) player.play();
    },
    [player],
  );

  return {
    state,
    doneCount: done.size,
    onSample,
    answer,
    /** Leave the check (skip or continue) and keep watching. */
    resume: () => finish(true),
    /** During a replay: stop replaying and go straight to the second try. */
    skipReplay: () => finish(false),
  };
}
