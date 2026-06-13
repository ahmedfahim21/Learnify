"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";

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
}

export function Classroom({
  sessionId,
  topicTitle,
  initialMessages,
  sessionStatus,
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
  const startedRef = useRef(false);

  const postTurn = useCallback(
    async (body: { message?: string }) => {
      setStatus("streaming");
      setError(null);
      let completed = false;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
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
      // The /turn route consumes the next learner turn as text, so translate
      // the interaction into a message the tutor can grade.
      const label =
        typeof action.payload?.label === "string"
          ? action.payload.label
          : JSON.stringify(action.payload ?? {});
      void postTurn({ message: label });
    },
    [postTurn],
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40">
            Live session
          </p>
          <h1 className="text-2xl font-semibold">{topicTitle}</h1>
        </div>
        <StatusBadge status={status} />
      </header>

      <SurfaceRenderer
        state={state}
        onAction={onAction}
        interactive={status === "idle"}
      />

      {status === "streaming" && (
        <p className="text-sm text-white/40">The tutor is working…</p>
      )}

      {status === "completed" && (
        <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.06] px-4 py-3 text-sm text-emerald-200">
          Session complete.
        </p>
      )}

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-red-400/30 bg-red-400/[0.06] px-4 py-3 text-sm text-red-200">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void postTurn({})}
            className="rounded border border-red-400/40 px-2 py-1 text-xs hover:bg-red-400/10"
          >
            Retry
          </button>
        </div>
      )}
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
    <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
      {label}
    </span>
  );
}
