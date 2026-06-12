/**
 * Rebuild the Claude `messages[]` array from the append-only `session_events`
 * transcript, replaying tool_use / tool_result pairs faithfully.
 *
 * This is what makes a turn resumable: if a stream drops, re-POSTing rebuilds
 * the exact conversation state from persisted events and continues from the
 * last one — no duplicated or lost turns.
 */

/** Discriminated event payloads, persisted in `session_events.payload`. */
export const EventKind = {
  /** A user/learner message (the opening snapshot, or an interaction). */
  UserMessage: "user_message",
  /** Assistant prose (one consolidated text block per model turn). */
  TutorText: "tutor_text",
  /** Assistant tool call (present_ui / end_session). */
  TutorToolUse: "tutor_tool_use",
  /** The tool_result we send back after rendering / acting. */
  ToolResult: "tool_result",
} as const;

export type EventKind = (typeof EventKind)[keyof typeof EventKind];

export interface UserMessagePayload {
  kind: typeof EventKind.UserMessage;
  text: string;
}
export interface TutorTextPayload {
  kind: typeof EventKind.TutorText;
  text: string;
}
export interface TutorToolUsePayload {
  kind: typeof EventKind.TutorToolUse;
  id: string;
  name: string;
  input: unknown;
}
export interface ToolResultPayload {
  kind: typeof EventKind.ToolResult;
  toolUseId: string;
  content: string;
  isError?: boolean;
}

export type EventPayload =
  | UserMessagePayload
  | TutorTextPayload
  | TutorToolUsePayload
  | ToolResultPayload;

/** A row from `session_events` (only the fields transcript replay needs). */
export interface StoredEvent {
  seq: number;
  role: "tutor" | "user" | "system";
  payload: EventPayload;
}

export type ContentBlockParam =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | {
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    };

export interface MessageParam {
  role: "user" | "assistant";
  content: ContentBlockParam[];
}

const roleForEvent = (e: StoredEvent): "user" | "assistant" =>
  e.role === "tutor" ? "assistant" : "user";

function blockForEvent(e: StoredEvent): ContentBlockParam | null {
  switch (e.payload.kind) {
    case EventKind.UserMessage:
      return { type: "text", text: e.payload.text };
    case EventKind.TutorText:
      return e.payload.text.trim()
        ? { type: "text", text: e.payload.text }
        : null;
    case EventKind.TutorToolUse:
      return {
        type: "tool_use",
        id: e.payload.id,
        name: e.payload.name,
        input: e.payload.input,
      };
    case EventKind.ToolResult:
      return {
        type: "tool_result",
        tool_use_id: e.payload.toolUseId,
        content: e.payload.content,
        is_error: e.payload.isError,
      };
    default:
      return null;
  }
}

/**
 * Fold the ordered event log into alternating user/assistant messages.
 * Consecutive same-side events merge into one message (so an assistant turn's
 * text + tool_use blocks live together, and the following tool_results + any
 * user action live in the next user message).
 */
export function buildMessages(events: StoredEvent[]): MessageParam[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const messages: MessageParam[] = [];

  for (const e of ordered) {
    if (e.role === "system") continue;
    const block = blockForEvent(e);
    if (!block) continue;
    const role = roleForEvent(e);
    const last = messages[messages.length - 1];
    if (last && last.role === role) {
      last.content.push(block);
    } else {
      messages.push({ role, content: [block] });
    }
  }

  return messages;
}
