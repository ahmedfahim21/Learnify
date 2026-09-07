"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";

import type { A2UIActionMessage, A2UIServerMessage } from "@/lib/a2ui/messages";

import {
  initialRendererState,
  rendererReducer,
  SurfaceRenderer,
} from "./SurfaceRenderer";

type Status = "idle" | "streaming" | "completed" | "error";

/** SSE frame as serialized by the `/turn` route (see `lib/agent/loop.ts`). */
type TurnFrame =
  | { type: "a2ui"; message: A2UIServerMessage }
  | { type: "session_end"; reason?: string }
  | { type: "error"; message: string }
  | { type: "done" };

export interface ClassroomProps {
  sessionId: string;
  topicTitle: string;
  /** Surfaces rebuilt from the transcript, for resuming on refresh. */
  initialMessages: A2UIServerMessage[];
  /** Persisted session status from the server. */
  sessionStatus: string;
  /**
   * The screen on show is the authored starter, not model output — the learner
   * has not answered anything yet. Only affects framing; the answer travels
   * the same path as any other action.
   */
  awaitingStarter?: boolean;
}

export function Classroom({
  sessionId,
  topicTitle,
  initialMessages,
  sessionStatus,
  awaitingStarter = false,
}: ClassroomProps) {
  const [state, dispatch] = useReducer(
    rendererReducer,
    initialMessages,
    (messages) => messages.reduce(rendererReducer, initialRendererState),
  );

  const [status, setStatus] = useState<Status>(
    sessionStatus === "completed" ? "completed" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  // Running out of budget isn't a failure — it's an expected limit with a
  // different remedy, so it gets its own state and its own message.
  const [budgetSpent, setBudgetSpent] = useState(false);
  const startedRef = useRef(false);

  const postTurn = useCallback(
    async (body: {
      message?: string;
      action?: {
        componentId: string;
        name: string;
        payload?: Record<string, unknown>;
      };
    }) => {
      setStatus("streaming");
      setError(null);
      let completed = false;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (response.status === 429) {
          const body = (await response.json().catch(() => ({}))) as { error?: string };
          setBudgetSpent(true);
          setError(body.error ?? "You've used today's tutor turns.");
          setStatus("error");
          return;
        }
        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => "");
          throw new Error(detail || `turn failed (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const chunk = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const line = chunk.split("\n").find((l) => l.startsWith("data:"));
            if (line) {
              const frame = JSON.parse(line.slice(5).trim()) as TurnFrame;
              if (frame.type === "a2ui") {
                dispatch(frame.message);
              } else if (frame.type === "session_end") {
                completed = true;
                setStatus("completed");
              } else if (frame.type === "error") {
                setError(frame.message);
                setStatus("error");
              }
              // "done" is handled after the stream drains.
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "turn failed");
        setStatus("error");
        return;
      }
      setStatus((prev) =>
        prev === "error" ? prev : completed ? "completed" : "idle",
      );
    },
    [sessionId],
  );

  // Kick off the first turn when arriving at a fresh, active session.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (sessionStatus !== "completed" && initialMessages.length === 0) {
      void postTurn({});
    }
  }, [sessionStatus, initialMessages.length, postTurn]);

  const onAction = useCallback(
    (action: A2UIActionMessage) => {
      // Forward the structured interaction so the server can grade checks
      // (MCQ/ordering/matching) deterministically against the original payload.
      void postTurn({
        action: {
          componentId: action.componentId,
          name: action.action,
          payload: action.payload ?? {},
        },
      });
    },
    [postTurn],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-(--color-line) pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-(--color-faint)">
            Live session
          </p>
          <h1 className="text-2xl">{topicTitle}</h1>
        </div>
        <StatusBadge status={status} />
      </header>

      {awaitingStarter && status === "idle" && (
        <p className="border-l-2 border-(--color-signal) bg-(--color-surface) px-3 py-2 text-sm text-(--color-mist)">
          Starting with one question, so the tutor has something to work from.
          Your answer shapes what it does next.
        </p>
      )}

      <SurfaceRenderer
        state={state}
        onAction={onAction}
        interactive={status === "idle"}
      />

      {status === "streaming" && <TurnSkeleton />}

      {status === "completed" && (
        <p className="border border-(--color-signal)/30 bg-(--color-signal)/[0.06] px-4 py-3 text-sm text-(--color-signal)">
          Session complete.
        </p>
      )}

      {error && budgetSpent && (
        <div className="space-y-2 border border-(--color-warn)/30 bg-(--color-warn)/[0.06] px-4 py-3 text-sm text-(--color-warn)">
          <p>{error}</p>
          {/* No Retry here: retrying can only fail until the window resets, so
              the only useful action is the one that still works. */}
          <Link href="/concepts" className="underline underline-offset-4">
            Take a written quiz instead →
          </Link>
        </div>
      )}

      {error && !budgetSpent && (
        <div className="flex items-center justify-between gap-4 border border-(--color-alert)/30 bg-(--color-alert)/[0.06] px-4 py-3 text-sm text-(--color-alert)">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void postTurn({})}
            className="border border-(--color-alert)/40 px-2 py-1 text-xs hover:bg-(--color-alert)/10"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Shown while the model composes the next screen. A shaped placeholder rather
 * than a line of text: the wait is a couple of seconds of nothing on a page
 * that is otherwise entirely visual, and a skeleton says "a screen is coming"
 * where a sentence only says "wait".
 */
function TurnSkeleton() {
  return (
    <div aria-live="polite" className="space-y-3">
      <span className="sr-only">The tutor is composing the next screen.</span>
      <div className="space-y-2" aria-hidden>
        <div className="h-3 w-2/3 animate-pulse bg-(--color-raised)" />
        <div className="h-3 w-1/2 animate-pulse bg-(--color-raised)" />
      </div>
      <div className="space-y-2 border border-(--color-line) p-4" aria-hidden>
        <div className="h-3 w-1/3 animate-pulse bg-(--color-raised)" />
        <div className="h-8 w-full animate-pulse bg-(--color-raised)" />
        <div className="h-8 w-full animate-pulse bg-(--color-raised)" />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label =
    status === "streaming"
      ? "Streaming"
      : status === "completed"
        ? "Complete"
        : status === "error"
          ? "Error"
          : "Your turn";
  return (
    <span className="rounded-full border border-(--color-line) px-3 py-1 text-xs text-(--color-mist)">
      {label}
    </span>
  );
}
