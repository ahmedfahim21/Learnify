/**
 * Thin fetch client for the Sarvam APIs Learnify uses: chat completions
 * (sarvam-105b), text translation, speech-to-text (Saaras) and text-to-speech
 * (Bulbul). No SDK — four endpoints don't justify a dependency.
 *
 * Server-only: reads SARVAM_API_KEY from the environment. 5xx and dropped
 * connections are retried with exponential backoff, and 429 with more
 * attempts and a slower one (all honouring Retry-After);
 * every other failure throws a SarvamError carrying the endpoint, status and
 * Sarvam's own message. A timeout is not retried: the long calls (study packs)
 * are the ones that time out, and retrying them doubles the cost.
 *
 * At most SARVAM_MAX_CONCURRENCY calls (default 4) are in flight per server
 * instance; the rest queue. Every attempt logs one line, without secrets.
 */

import { createLimiter } from "./limiter";

const BASE = "https://api.sarvam.ai";
const MAX_RETRY_WAIT_MS = 30_000;
const RATE_LIMIT_ATTEMPTS = 6;

const limiter = createLimiter(
  Number.isInteger(Number(process.env.SARVAM_MAX_CONCURRENCY)) && Number(process.env.SARVAM_MAX_CONCURRENCY) > 0
    ? Number(process.env.SARVAM_MAX_CONCURRENCY)
    : 4,
);

export class SarvamError extends Error {
  constructor(
    readonly endpoint: string,
    readonly status: number,
    readonly detail: string,
  ) {
    super(`Sarvam ${endpoint} failed (HTTP ${status}): ${detail}`);
    this.name = "SarvamError";
  }
}

function apiKey(): string {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error("SARVAM_API_KEY is not set. See .env.example.");
  return key;
}

export interface RequestOptions {
  timeoutMs?: number;
  retries?: number;
  /** What the call is for, e.g. "lecture 325080ef/hi translate", so logs can be traced to work. */
  tag?: string;
  /** Injected for tests; defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function errorDetail(res: Response): Promise<string> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return body.error?.message ?? body.message ?? text.slice(0, 500);
  } catch {
    // Not JSON (gateway HTML, plain text): report the raw body instead.
    return text.slice(0, 500) || res.statusText;
  }
}

/** One structured log line per Sarvam attempt. Never includes the key or the payload. */
export function logCall(entry: {
  endpoint: string;
  status: number | "timeout" | "network";
  ms: number;
  attempt: number;
  tag?: string;
}) {
  console.info(`sarvam ${JSON.stringify(entry)}`);
}

/** Seconds or an HTTP date, per RFC 9110; null when absent or unparseable. */
export function retryAfterMs(header: string | null, now: number = Date.now()): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

/** POST with retry on 429/5xx/dropped connection. Returns the successful Response unread. */
export async function sarvamFetch(
  endpoint: string,
  body: BodyInit,
  { timeoutMs = 60_000, retries = 3, sleep = defaultSleep, tag }: RequestOptions = {},
  headers: Record<string, string> = { "content-type": "application/json" },
): Promise<Response> {
  const key = apiKey();
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let res: Response;
    try {
      // The slot is held until the response headers arrive; callers read the
      // body straight away, and a stream holding a slot for its whole length
      // would starve short calls behind one long answer.
      res = await limiter.run(() =>
        fetch(`${BASE}${endpoint}`, {
          method: "POST",
          headers: { "api-subscription-key": key, ...headers },
          body,
          signal: AbortSignal.timeout(timeoutMs),
        }),
      );
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      logCall({ endpoint, status: timedOut ? "timeout" : "network", ms: Date.now() - started, attempt, tag });
      if (timedOut) throw new SarvamError(endpoint, 0, `timed out after ${timeoutMs}ms`);
      if (attempt >= retries) {
        throw new SarvamError(endpoint, 0, `network error: ${err instanceof Error ? err.message : String(err)}`);
      }
      await sleep(500 * 2 ** (attempt - 1) + Math.random() * 250);
      continue;
    }

    logCall({ endpoint, status: res.status, ms: Date.now() - started, attempt, tag });
    if (res.ok) return res;
    // A rate limit clears with time, not with a quick second try: it gets more
    // attempts and a slower backoff (1, 2, 4, 8, 16 s) than a server error.
    const limited = res.status === 429;
    const retriable = limited || res.status >= 500;
    if (!retriable || attempt >= (limited ? Math.max(retries, RATE_LIMIT_ATTEMPTS) : retries)) {
      throw new SarvamError(endpoint, res.status, await errorDetail(res));
    }
    const backoff = (limited ? 1000 : 500) * 2 ** (attempt - 1) + Math.random() * 250;
    const wait = Math.min(MAX_RETRY_WAIT_MS, Math.max(backoff, retryAfterMs(res.headers.get("retry-after")) ?? 0));
    await res.body?.cancel();
    await sleep(wait);
  }
}

// --- Chat (sarvam-105b) -----------------------------------------------------

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * sarvam-105b always reasons before answering (reasoning is ~95% of its
 * completion tokens and counts against max_tokens), so it suits one-off
 * offline work like study packs. sarvam-105b-conversations answers in well
 * under a second with no reasoning, so it serves subtitles and doubts.
 */
export type ChatModel = "sarvam-105b" | "sarvam-105b-conversations";

export interface ChatRequest {
  messages: ChatMessage[];
  model?: ChatModel;
  /** Strict structured output: the reply is guaranteed to match this JSON Schema. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  maxTokens?: number;
  temperature?: number;
  /** sarvam-105b only. The API rejects "none" despite the docs listing it. */
  reasoningEffort?: "low" | "medium" | "high";
}

export interface ChatResult {
  content: string;
  finishReason: string | null;
  usage: { promptTokens: number; completionTokens: number } | null;
}

function chatBody(req: ChatRequest, stream: boolean) {
  return JSON.stringify({
    model: req.model ?? "sarvam-105b",
    messages: req.messages,
    max_tokens: req.maxTokens ?? 4096,
    temperature: req.temperature ?? 0.2,
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
    ...(req.jsonSchema
      ? {
          response_format: {
            type: "json_schema",
            json_schema: { name: req.jsonSchema.name, schema: req.jsonSchema.schema, strict: true },
          },
        }
      : {}),
    stream,
  });
}

interface ChatResponseBody {
  choices?: { message?: { content?: string | null }; finish_reason?: string | null }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export async function chat(req: ChatRequest, opts?: RequestOptions): Promise<ChatResult> {
  const res = await sarvamFetch("/v1/chat/completions", chatBody(req, false), opts);
  const body = (await res.json()) as ChatResponseBody;
  if (body.usage) {
    console.info(
      `sarvam ${JSON.stringify({ endpoint: "/v1/chat/completions", model: req.model ?? "sarvam-105b", tag: opts?.tag, tokens: { prompt: body.usage.prompt_tokens ?? 0, completion: body.usage.completion_tokens ?? 0 } })}`,
    );
  }
  const choice = body.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string") {
    throw new SarvamError(
      "/v1/chat/completions",
      200,
      `response had no message content (finish_reason ${choice?.finish_reason ?? "none"}, completion tokens ${body.usage?.completion_tokens ?? "?"})`,
    );
  }
  return {
    content,
    finishReason: choice?.finish_reason ?? null,
    usage: body.usage
      ? {
          promptTokens: body.usage.prompt_tokens ?? 0,
          completionTokens: body.usage.completion_tokens ?? 0,
        }
      : null,
  };
}

/** Chat that must come back as JSON matching `jsonSchema`; parses it for you. */
export async function chatJson<T>(
  req: ChatRequest & { jsonSchema: NonNullable<ChatRequest["jsonSchema"]> },
  opts?: RequestOptions,
): Promise<{ value: T; result: ChatResult }> {
  const result = await chat(req, opts);
  if (result.finishReason === "length") {
    throw new SarvamError("/v1/chat/completions", 200, `output truncated at max_tokens (${req.maxTokens ?? 4096})`);
  }
  try {
    return { value: JSON.parse(result.content) as T, result };
  } catch {
    throw new SarvamError(
      "/v1/chat/completions",
      200,
      `structured output was not valid JSON: ${result.content.slice(0, 200)}`,
    );
  }
}

/**
 * Split an SSE byte stream into `data:` payloads. Frames can arrive split
 * across chunks, so a partial trailing line is held until the next chunk.
 */
export async function* sseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).replace(/\r$/, "");
      buffer = buffer.slice(newline + 1);
      if (line.startsWith("data:")) yield line.slice(5).trimStart();
    }
  }
  const rest = buffer.trim();
  if (rest.startsWith("data:")) yield rest.slice(5).trimStart();
}

/** Stream content deltas from sarvam-105b (OpenAI-style `choices[0].delta.content` frames). */
export async function* chatStream(req: ChatRequest, opts?: RequestOptions): AsyncGenerator<string> {
  const res = await sarvamFetch("/v1/chat/completions", chatBody(req, true), opts);
  if (!res.body) throw new SarvamError("/v1/chat/completions", 200, "stream had no body");
  for await (const data of sseData(res.body)) {
    if (data === "[DONE]") return;
    let frame: { choices?: { delta?: { content?: string | null } }[]; error?: { message?: string } };
    try {
      frame = JSON.parse(data);
    } catch {
      throw new SarvamError("/v1/chat/completions", 200, `malformed stream frame: ${data.slice(0, 200)}`);
    }
    if (frame.error) throw new SarvamError("/v1/chat/completions", 200, frame.error.message ?? "stream error");
    const delta = frame.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}

// --- Translate --------------------------------------------------------------

export interface TranslateRequest {
  input: string;
  source: string;
  target: string;
  model?: "mayura:v1" | "sarvam-translate:v1";
  mode?: "formal" | "modern-colloquial" | "classic-colloquial" | "code-mixed";
}

export async function translate(req: TranslateRequest, opts?: RequestOptions): Promise<string> {
  const res = await sarvamFetch(
    "/translate",
    JSON.stringify({
      input: req.input,
      source_language_code: req.source,
      target_language_code: req.target,
      model: req.model ?? "mayura:v1",
      mode: req.mode ?? "code-mixed",
    }),
    { timeoutMs: 30_000, ...opts },
  );
  const body = (await res.json()) as { translated_text?: string };
  if (typeof body.translated_text !== "string") {
    throw new SarvamError("/translate", 200, "response had no translated_text");
  }
  return body.translated_text;
}

// --- Speech to text (Saaras) ------------------------------------------------

export async function transcribe(
  audio: Blob,
  languageCode: string,
  opts?: RequestOptions,
): Promise<{ transcript: string; languageCode: string | null }> {
  const form = new FormData();
  form.set("file", audio, "doubt");
  form.set("model", "saaras:v3");
  form.set("mode", "codemix");
  form.set("language_code", languageCode);
  const res = await sarvamFetch("/speech-to-text", form, { timeoutMs: 30_000, ...opts }, {});
  const body = (await res.json()) as { transcript?: string; language_code?: string | null };
  if (typeof body.transcript !== "string") {
    throw new SarvamError("/speech-to-text", 200, "response had no transcript");
  }
  return { transcript: body.transcript, languageCode: body.language_code ?? null };
}

// --- Text to speech (Bulbul) ------------------------------------------------

export async function speak(
  text: string,
  languageCode: string,
  opts?: RequestOptions,
): Promise<Uint8Array> {
  if (text.length > 2500) throw new Error(`Bulbul input is ${text.length} chars; the limit is 2500`);
  const res = await sarvamFetch(
    "/text-to-speech",
    JSON.stringify({ text, target_language_code: languageCode, model: "bulbul:v3" }),
    { timeoutMs: 30_000, ...opts },
  );
  const body = (await res.json()) as { audios?: string[] };
  const audio = body.audios?.[0];
  if (!audio) throw new SarvamError("/text-to-speech", 200, "response had no audio");
  return Uint8Array.from(Buffer.from(audio, "base64"));
}
