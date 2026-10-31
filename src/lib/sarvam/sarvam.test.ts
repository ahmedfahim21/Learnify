import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { chat, chatJson, retryAfterMs, SarvamError, sarvamFetch, sseData, translate } from "./client";
import { AlignmentError, alignBatch, splitForLimit, translateSegments } from "./translateSegments";

const noSleep = { sleep: async () => {} };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

let info: MockInstance<typeof console.info>;
beforeEach(() => {
  process.env.SARVAM_API_KEY = "sk_test";
  info = vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  info.mockRestore();
  delete process.env.SARVAM_API_KEY;
});

describe("sarvam client", () => {
  it("sends the key header and json_schema response_format, and returns content + usage", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      json({
        choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }],
        usage: { prompt_tokens: 12, completion_tokens: 3 },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { value, result } = await chatJson<{ ok: boolean }>({
      messages: [{ role: "user", content: "hi" }],
      jsonSchema: { name: "x", schema: { type: "object" } },
    });

    expect(value).toEqual({ ok: true });
    expect(result).toEqual({
      content: '{"ok":true}',
      finishReason: "stop",
      usage: { promptTokens: 12, completionTokens: 3 },
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.sarvam.ai/v1/chat/completions");
    expect((init.headers as Record<string, string>)["api-subscription-key"]).toBe("sk_test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("sarvam-105b");
    expect(body.response_format).toEqual({
      type: "json_schema",
      json_schema: { name: "x", schema: { type: "object" }, strict: true },
    });
  });

  it("retries 429 then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ error: { message: "slow down" } }, 429))
      .mockResolvedValueOnce(json({ choices: [{ message: { content: "hello" } }] }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await chat({ messages: [{ role: "user", content: "hi" }] }, noSleep);
    expect(result.content).toBe("hello");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after retries with endpoint, status and Sarvam's message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "upstream down" } }, 503)));
    const err = await chat({ messages: [{ role: "user", content: "hi" }] }, noSleep).catch((e) => e);
    expect(err).toBeInstanceOf(SarvamError);
    expect(err).toMatchObject({ endpoint: "/v1/chat/completions", status: 503, detail: "upstream down" });
  });

  it("does not retry a 400", async () => {
    const fetchMock = vi.fn(async () => json({ error: { message: "bad schema" } }, 400));
    vi.stubGlobal("fetch", fetchMock);
    await expect(chat({ messages: [] }, noSleep)).rejects.toThrow(/HTTP 400\): bad schema/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when structured output was truncated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ choices: [{ message: { content: '{"a":' }, finish_reason: "length" }] })),
    );
    await expect(
      chatJson({ messages: [], jsonSchema: { name: "x", schema: {} } }, noSleep),
    ).rejects.toThrow(/truncated/);
  });

  it("fails loudly without an API key", async () => {
    delete process.env.SARVAM_API_KEY;
    await expect(chat({ messages: [] })).rejects.toThrow(/SARVAM_API_KEY/);
  });

  it("maps translate fields both ways", async () => {
    const fetchMock = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      json({ translated_text: "வணக்கம்", source_language_code: "en-IN" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(translate({ input: "Hello", source: "en-IN", target: "ta-IN" })).resolves.toBe("வணக்கம்");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toEqual({
      input: "Hello",
      source_language_code: "en-IN",
      target_language_code: "ta-IN",
      model: "mayura:v1",
      mode: "code-mixed",
    });
  });
});

describe("sseData", () => {
  it("reassembles frames split across chunks", async () => {
    const enc = new TextEncoder();
    const parts = ['data: {"a":', '1}\n\ndata: [DO', "NE]\n"];
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        for (const p of parts) c.enqueue(enc.encode(p));
        c.close();
      },
    });
    const out: string[] = [];
    for await (const d of sseData(stream)) out.push(d);
    expect(out).toEqual(['{"a":1}', "[DONE]"]);
  });
});

describe("alignBatch", () => {
  const sent = [
    { i: 4, startSec: 0, endSec: 2, text: "Welcome to this online course on programming." },
    { i: 5, startSec: 2, endSec: 4, text: "OK." },
  ];

  it("maps ids to translations", () => {
    const out = alignBatch(sent, [
      { i: 5, text: "சரி." },
      { i: 4, text: "programming பற்றிய இந்த online course-க்கு வரவேற்கிறோம்." },
    ], "ta");
    expect([...out.keys()].sort()).toEqual([4, 5]);
  });

  it("allows a short line to stay in English", () => {
    expect(() => alignBatch(sent, [{ i: 4, text: "வரவேற்கிறோம்." }, { i: 5, text: "OK." }], "ta")).not.toThrow();
  });

  it.each([
    [[{ i: 4, text: "வரவேற்கிறோம்." }], /missing ids 5/],
    [[{ i: 4, text: "வரவேற்கிறோம்." }, { i: 5, text: "y" }, { i: 9, text: "z" }], /unexpected id 9/],
    [[{ i: 4, text: "வரவேற்கிறோம்." }, { i: 4, text: "வரவேற்கிறோம்." }, { i: 5, text: "y" }], /duplicate id 4/],
    [[{ i: 4, text: "  " }, { i: 5, text: "y" }], /empty translation for id 4/],
    [[{ i: 4, text: "Welcome to this online course on programming." }, { i: 5, text: "y" }], /untranslated/],
    [[{ i: 4, text: "प्रोग्रामिंग पर इस online course में स्वागत है।" }, { i: 5, text: "y" }], /untranslated/],
  ])("rejects a bad batch %#", (got, message) => {
    expect(() => alignBatch(sent, got, "ta")).toThrow(AlignmentError);
    expect(() => alignBatch(sent, got, "ta")).toThrow(message);
  });
});

describe("splitForLimit", () => {
  it("keeps short text whole and splits long text at word boundaries", () => {
    expect(splitForLimit("a b c", 10)).toEqual(["a b c"]);
    expect(splitForLimit("aaa bbb ccc ddd", 7)).toEqual(["aaa bbb", "ccc ddd"]);
    expect(splitForLimit("aaa bbb ccc ddd", 7).every((p) => p.length <= 7)).toBe(true);
  });

  it("refuses a word that can never fit instead of truncating it", () => {
    expect(() => splitForLimit("x".repeat(11), 10)).toThrow(/longer than 10/);
  });
});

describe("sarvamFetch resilience", () => {
  it("waits at least Retry-After before retrying a 429", async () => {
    const sleeps: number[] = [];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429, headers: { "retry-after": "7" } }))
      .mockResolvedValueOnce(json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await sarvamFetch("/translate", "{}", { sleep: async (ms) => void sleeps.push(ms) });
    expect(sleeps).toHaveLength(1);
    expect(sleeps[0]).toBeGreaterThanOrEqual(7000);
  });

  it("keeps retrying a rate limit longer than a server error, with slower backoff", async () => {
    const sleeps: number[] = [];
    const limited = vi.fn(async () => json({ error: { message: "Rate limit exceeded" } }, 429));
    vi.stubGlobal("fetch", limited);
    await expect(sarvamFetch("/translate", "{}", { sleep: async (ms) => void sleeps.push(ms) })).rejects.toThrow(
      /HTTP 429\): Rate limit exceeded/,
    );
    expect(limited).toHaveBeenCalledTimes(6);
    expect(sleeps.map((ms) => Math.floor(ms / 1000))).toEqual([1, 2, 4, 8, 16]);

    const down = vi.fn(async () => json({ error: { message: "down" } }, 503));
    vi.stubGlobal("fetch", down);
    await expect(sarvamFetch("/translate", "{}", noSleep)).rejects.toThrow(/HTTP 503/);
    expect(down).toHaveBeenCalledTimes(3);
  });

  it("caps a huge Retry-After at 30 s", async () => {
    const sleeps: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 503, headers: { "retry-after": "3600" } }))
        .mockResolvedValueOnce(json({})),
    );
    await sarvamFetch("/translate", "{}", { sleep: async (ms) => void sleeps.push(ms) });
    expect(sleeps).toEqual([30_000]);
  });

  it("retries a dropped connection, then succeeds", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")).mockResolvedValueOnce(json({}));
    vi.stubGlobal("fetch", fetchMock);
    const res = await sarvamFetch("/translate", "{}", noSleep);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up on repeated network errors with a SarvamError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    await expect(sarvamFetch("/translate", "{}", noSleep)).rejects.toMatchObject({
      name: "SarvamError",
      status: 0,
      detail: "network error: fetch failed",
    });
  });

  it("reports a timeout without retrying it", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal("fetch", fetchMock);
    await expect(sarvamFetch("/v1/chat/completions", "{}", { ...noSleep, timeoutMs: 1234 })).rejects.toMatchObject({
      endpoint: "/v1/chat/completions",
      status: 0,
      detail: "timed out after 1234ms",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("logs every attempt with endpoint, status, attempt and tag, never the key or body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({ translated_text: "x" })),
    );
    await translate({ input: "secret lecture text", source: "en-IN", target: "ta-IN" }, { ...noSleep, tag: "lecture abc/ta" });
    const lines = info.mock.calls.map((c) => String(c[0]));
    expect(lines).toHaveLength(2);
    const entries = lines.map((l) => JSON.parse(l.replace(/^sarvam /, "")));
    expect(entries.map(({ endpoint, status, attempt, tag }) => ({ endpoint, status, attempt, tag }))).toEqual([
      { endpoint: "/translate", status: 500, attempt: 1, tag: "lecture abc/ta" },
      { endpoint: "/translate", status: 200, attempt: 2, tag: "lecture abc/ta" },
    ]);
    expect(entries.every((e) => typeof e.ms === "number")).toBe(true);
    expect(lines.join("\n")).not.toMatch(/sk_test|secret lecture text/);
  });

  it("logs chat token usage", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ choices: [{ message: { content: "hi" } }], usage: { prompt_tokens: 10, completion_tokens: 2 } })),
    );
    await chat({ messages: [], model: "sarvam-105b-conversations" }, { tag: "doubt 1" });
    expect(info.mock.calls.map((c) => String(c[0]))).toContain(
      'sarvam {"endpoint":"/v1/chat/completions","model":"sarvam-105b-conversations","tag":"doubt 1","tokens":{"prompt":10,"completion":2}}',
    );
  });
});

describe("retryAfterMs", () => {
  it("reads seconds and HTTP dates, and ignores junk", () => {
    expect(retryAfterMs("5")).toBe(5000);
    expect(retryAfterMs("Sat, 31 Oct 2026 12:00:10 GMT", Date.parse("Sat, 31 Oct 2026 12:00:00 GMT"))).toBe(10_000);
    expect(retryAfterMs(null)).toBeNull();
    expect(retryAfterMs("soon")).toBeNull();
  });
});

describe("translateSegments: resuming", () => {
  const segs = [
    { i: 0, startSec: 0, endSec: 2, text: "one" },
    { i: 1, startSec: 2, endSec: 4, text: "two" },
    { i: 2, startSec: 4, endSec: 6, text: "three" },
  ];

  it("skips segments already translated and reports each new one", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      json({ translated_text: `ta:${JSON.parse(init.body as string).input}` }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const reported: { i: number; text: string }[] = [];

    const out = await translateSegments(segs, "ta", {
      already: new Map([[1, "இரண்டு"]]),
      onTranslated: (items) => void reported.push(...items),
    });

    expect(out).toEqual([
      { i: 0, startSec: 0, endSec: 2, text: "ta:one" },
      { i: 1, startSec: 2, endSec: 4, text: "இரண்டு" },
      { i: 2, startSec: 4, endSec: 6, text: "ta:three" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(reported.sort((a, b) => a.i - b.i)).toEqual([
      { i: 0, text: "ta:one" },
      { i: 2, text: "ta:three" },
    ]);
  });

  it("stops when saving progress fails, rather than translating on unsaved", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ translated_text: "x" })));
    await expect(
      translateSegments(segs, "ta", {
        onTranslated: async () => Promise.reject(new Error("db write failed")),
      }),
    ).rejects.toThrow("db write failed");
  });

  it("makes no calls when everything is already translated", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const out = await translateSegments(segs, "ta", { already: new Map(segs.map((s) => [s.i, `t${s.i}`])) });
    expect(out.map((s) => s.text)).toEqual(["t0", "t1", "t2"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
