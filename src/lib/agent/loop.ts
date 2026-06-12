import { getBedrock, TUTOR_MODEL } from "../bedrock";
import { A2UI_VERSION, type A2UIServerMessage } from "../a2ui/messages";
import {
  A2UIValidationError,
  narrationEnvelope,
  toEnvelope,
  validatePresentUi,
} from "../a2ui/emit";
import {
  END_SESSION_TOOL_NAME,
  PRESENT_UI_TOOL_NAME,
  TUTOR_TOOLS,
} from "./tools";
import { TUTOR_SYSTEM_PROMPT } from "./prompts";
import { EventKind, type EventPayload } from "./transcript";

/**
 * The streaming tutor loop.
 *
 * For each model call it streams text deltas (→ A2UI Narration frames),
 * resolves `present_ui` tool calls (validate → A2UI frames → tool_result
 * "rendered"), and loops while `stop_reason === "tool_use"`. Guards:
 *   - at most `maxModelCalls` (default 6) model calls per turn,
 *   - `stop_reason: "refusal"` → apology widget, end turn (HTTP 200),
 *   - invalid tool input → `is_error` tool_result, one retry, then apology.
 */

/** Server → client SSE frame. */
export type TurnFrame =
  | { type: "a2ui"; message: A2UIServerMessage }
  | { type: "session_end"; reason?: string }
  | { type: "error"; message: string }
  | { type: "done" };

/** A message in the model conversation (content is opaque API blocks). */
export interface ConversationMessage {
  role: "user" | "assistant";
  content: unknown;
}

export interface RunTurnOptions {
  /** Prior transcript, already rebuilt into API messages. */
  messages: ConversationMessage[];
  /** The session's main surface id. */
  surfaceId: string;
  /** Emit an SSE frame to the client. */
  emit: (frame: TurnFrame) => void;
  /** Persist a transcript event (assigns the next `seq`). */
  persist: (role: "tutor" | "user", payload: EventPayload) => Promise<void>;
  /** Report token usage for one model call (for cost tracking). */
  onUsage?: (usage: unknown) => void | Promise<void>;
  maxModelCalls?: number;
  model?: string;
  maxTokens?: number;
}

interface StreamResultBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
}

function apologyEnvelope(
  surfaceId: string,
  title: string,
  body: string,
): A2UIServerMessage {
  return {
    type: "updateComponents",
    version: A2UI_VERSION,
    surfaceId,
    components: [
      {
        id: `${surfaceId}:apology`,
        component: "ExplanationCard",
        properties: { title, body, emoji: "⚠️" },
      },
    ],
  };
}

export async function runTurn(opts: RunTurnOptions): Promise<void> {
  const {
    messages,
    surfaceId,
    emit,
    persist,
    maxModelCalls = 6,
    model = TUTOR_MODEL,
    maxTokens = 8192,
  } = opts;

  const client = getBedrock();
  const convo: ConversationMessage[] = [...messages];
  let invalidRetries = 0;

  for (let call = 0; call < maxModelCalls; call++) {
    // --- stream one model call ---
    const stream = client.messages.stream({
      model,
      max_tokens: maxTokens,
      system: [
        {
          type: "text",
          text: TUTOR_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      // The catalog-derived tools are part of the cached prefix (rendered
      // before system), so the tool set must stay stable across the turn.
      tools: TUTOR_TOOLS,
      messages: convo,
    } as Parameters<typeof client.messages.stream>[0]);

    // Accumulate streamed narration text per content block index.
    const narrationText = new Map<number, string>();
    for await (const event of stream) {
      if (
        event.type === "content_block_start" &&
        event.content_block.type === "text"
      ) {
        narrationText.set(event.index, "");
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const acc = (narrationText.get(event.index) ?? "") + event.delta.text;
        narrationText.set(event.index, acc);
        emit({
          type: "a2ui",
          message: narrationEnvelope(
            surfaceId,
            `${surfaceId}:narration:${call}:${event.index}`,
            acc,
          ),
        });
      }
    }

    const final = await stream.finalMessage();
    await opts.onUsage?.(final.usage);
    const blocks = final.content as StreamResultBlock[];

    // Persist + replay the assistant turn exactly as received.
    convo.push({ role: "assistant", content: final.content });
    for (const block of blocks) {
      if (block.type === "text" && block.text) {
        await persist("tutor", { kind: EventKind.TutorText, text: block.text });
      } else if (block.type === "tool_use") {
        await persist("tutor", {
          kind: EventKind.TutorToolUse,
          id: block.id!,
          name: block.name!,
          input: block.input,
        });
      }
    }

    // --- refusal: HTTP 200, render an apology, end the turn ---
    if (final.stop_reason === "refusal") {
      emit({
        type: "a2ui",
        message: apologyEnvelope(
          surfaceId,
          "I can't help with that",
          "Let's keep this session focused on learning the topic. Try rephrasing, or ask about something else.",
        ),
      });
      emit({ type: "session_end", reason: "refusal" });
      emit({ type: "done" });
      return;
    }

    if (final.stop_reason !== "tool_use") {
      // end_turn / max_tokens — the model is done talking for this turn.
      emit({ type: "done" });
      return;
    }

    // --- resolve tool calls; collect tool_results for the next model call ---
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];
    let ended = false;
    let hadInvalid = false;

    for (const tu of toolUses) {
      if (tu.name === END_SESSION_TOOL_NAME) {
        const reason =
          (tu.input as { reason?: string } | undefined)?.reason ?? undefined;
        const content = "Session ended.";
        toolResults.push({
          type: "tool_result",
          tool_use_id: tu.id!,
          content,
        });
        await persist("user", {
          kind: EventKind.ToolResult,
          toolUseId: tu.id!,
          content,
        });
        emit({ type: "session_end", reason });
        ended = true;
        continue;
      }

      if (tu.name === PRESENT_UI_TOOL_NAME) {
        try {
          const validated = validatePresentUi(
            (tu.input ?? {}) as Parameters<typeof validatePresentUi>[0],
            surfaceId,
          );
          const envelope = toEnvelope(validated);
          emit({ type: "a2ui", message: envelope });
          const content = "rendered";
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id!,
            content,
          });
          await persist("user", {
            kind: EventKind.ToolResult,
            toolUseId: tu.id!,
            content,
          });
        } catch (err) {
          hadInvalid = true;
          const message =
            err instanceof A2UIValidationError
              ? err.message
              : "Invalid present_ui input.";
          const content = `error: ${message} Fix the component(s) and call present_ui again.`;
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id!,
            content,
            is_error: true,
          });
          await persist("user", {
            kind: EventKind.ToolResult,
            toolUseId: tu.id!,
            content,
            isError: true,
          });
        }
        continue;
      }

      // Unknown tool — should not happen with a fixed tool set.
      const content = `error: unknown tool "${tu.name}".`;
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id!,
        content,
        is_error: true,
      });
      await persist("user", {
        kind: EventKind.ToolResult,
        toolUseId: tu.id!,
        content,
        isError: true,
      });
    }

    convo.push({ role: "user", content: toolResults });

    if (ended) {
      emit({ type: "done" });
      return;
    }

    if (hadInvalid) {
      invalidRetries++;
      if (invalidRetries > 1) {
        emit({
          type: "a2ui",
          message: apologyEnvelope(
            surfaceId,
            "Something went wrong rendering this",
            "The tutor had trouble building the screen. Let's try continuing the session.",
          ),
        });
        emit({ type: "done" });
        return;
      }
    }
    // else: loop again to let the model continue after rendering.
  }

  // Hit the model-call ceiling.
  emit({ type: "done" });
}
