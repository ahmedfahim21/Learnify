import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { chat, chatJson, SarvamError, sseData, translate } from "./client";
import { AlignmentError, alignBatch, splitForLimit } from "./translateSegments";

const noSleep = { sleep: async () => {} };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

beforeEach(() => {
  process.env.SARVAM_API_KEY = "sk_test";
});
afterEach(() => {
  vi.unstubAllGlobals();
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
