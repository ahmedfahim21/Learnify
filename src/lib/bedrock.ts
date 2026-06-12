import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

/**
 * AWS Bedrock client (Claude via `@anthropic-ai/bedrock-sdk`).
 *
 * Lazily constructed so importing this module never requires credentials —
 * `next build` and lint pass with no env vars set. Bedrock model IDs carry the
 * `anthropic.` provider prefix (e.g. `anthropic.claude-fable-5`).
 */

let cached: AnthropicBedrock | null = null;

export function getBedrock(): AnthropicBedrock {
  if (cached) return cached;
  cached = new AnthropicBedrock({
    awsRegion: process.env.AWS_REGION ?? "us-east-1",
    // Access keys are read from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (and
    // optional AWS_SESSION_TOKEN) via the SDK's standard credential resolution.
  });
  return cached;
}

/** The tutor model — drives the live teaching loop (A2UI emission). */
export const TUTOR_MODEL =
  process.env.TUTOR_MODEL ?? "anthropic.claude-fable-5";

/** The cheaper utility model — background summaries, grading, graphs. */
export const UTILITY_MODEL =
  process.env.UTILITY_MODEL ?? "anthropic.claude-haiku-4-5";
