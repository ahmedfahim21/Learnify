import {
  narrationEnvelope,
  toEnvelope,
  validatePresentUi,
  type ValidatePresentUiInput,
} from "../a2ui/emit";
import type { A2UIServerMessage } from "../a2ui/messages";

import { PRESENT_UI_TOOL_NAME } from "./tools";
import { EventKind, type StoredEvent } from "./transcript";

/**
 * The session's single surface id. Must match the `/turn` route's
 * `SURFACE_PREFIX:sessionId` convention so replayed and live envelopes target
 * the same surface.
 */
export function sessionSurfaceId(sessionId: string): string {
  return `session:${sessionId}`;
}

/**
 * Reconstruct the A2UI envelopes for a session from its event log.
 *
 * The transcript stores tutor prose (`TutorText`) and `present_ui` tool calls,
 * not the rendered envelopes — so we re-derive the surface the same way the
 * live loop did: prose → Narration, `present_ui` input → validated envelope.
 * This is what lets a page refresh restore the exact screen.
 */
export function replaySurfaceMessages(
  events: StoredEvent[],
  surfaceId: string,
): A2UIServerMessage[] {
  const ordered = [...events].sort((a, b) => a.seq - b.seq);
  const messages: A2UIServerMessage[] = [];

  for (const event of ordered) {
    const payload = event.payload;
    if (payload.kind === EventKind.TutorText) {
      if (payload.text.trim()) {
        messages.push(
          narrationEnvelope(
            surfaceId,
            `${surfaceId}:narration:${event.seq}`,
            payload.text,
          ),
        );
      }
    } else if (
      payload.kind === EventKind.TutorToolUse &&
      payload.name === PRESENT_UI_TOOL_NAME
    ) {
      try {
        const validated = validatePresentUi(
          payload.input as ValidatePresentUiInput,
          surfaceId,
        );
        messages.push(toEnvelope(validated));
      } catch {
        // Skip a component that no longer validates rather than break resume.
      }
    }
  }

  return messages;
}
