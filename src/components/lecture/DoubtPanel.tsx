"use client";

import { Renderer } from "@openuidev/react-lang";
import { Loader2, Mic, RotateCcw, Send, Square, Volume2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/lib/authClient";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { doubtLibrary } from "@/lib/openui/doubtLibrary";

import { MAX_RECORDING_SEC, useRecorder } from "./useRecorder";

/**
 * Ask a doubt at the moment the video was paused: speak or type it, check the
 * transcription, and read the answer as it streams in, grounded in what the
 * lecturer just said. Answers can be read aloud. Lives in the lecture page's
 * side panel, which scrolls on its own, never over the video.
 */

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Phase =
  | { kind: "compose" }
  | { kind: "transcribing" }
  | { kind: "answering"; question: string; answer: string; status?: string }
  | { kind: "answered"; question: string; answer: string; doubtId: string }
  | { kind: "failed"; question: string; message: string };

interface Earlier {
  id: string;
  atSec: number;
  question: string;
  answer: string;
}

interface Props {
  lectureId: string;
  lang: Lang;
  atSec: number;
  onClose: () => void;
}

export function DoubtPanel({ lectureId, lang, atSec, onClose }: Props) {
  const { user, isPending } = useSession();
  const recorder = useRecorder();
  const [phase, setPhase] = useState<Phase>({ kind: "compose" });
  const [question, setQuestion] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [earlier, setEarlier] = useState<Earlier[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const textLang = LANGUAGES[lang].sarvam;

  useEffect(() => heading.current?.focus({ preventScroll: true }), []);

  // Budget and earlier doubts, once signed in.
  useEffect(() => {
    if (!user) return;
    fetch("/api/budget")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`budget HTTP ${r.status}`))))
      .then((b: { remaining: number }) => setRemaining(b.remaining))
      .catch((err) => console.error("loading the doubt budget failed:", err));
    fetch(`/api/doubts?lectureId=${lectureId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`doubts HTTP ${r.status}`))))
      .then((b: { doubts: Earlier[] }) => setEarlier(b.doubts))
      .catch((err) => console.error("loading earlier doubts failed:", err));
  }, [user, lectureId]);

  // A finished recording goes straight to transcription.
  const audio = recorder.state.phase === "done" ? recorder.state.audio : null;
  useEffect(() => {
    if (!audio) return;
    setPhase({ kind: "transcribing" });
    setNotice(null);
    const form = new FormData();
    form.set("audio", audio, "doubt");
    fetch(`/api/voice/transcribe?lang=${lang}&lectureId=${lectureId}&at=${Math.round(atSec)}`, { method: "POST", body: form })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setQuestion((q) => (q ? `${q} ${body.text}` : body.text));
      })
      .catch((err: Error) => {
        console.error("transcription failed:", err);
        setNotice(err.message);
      })
      .finally(() => {
        setPhase({ kind: "compose" });
        recorder.reset();
        requestAnimationFrame(() => textarea.current?.focus());
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per recording
  }, [audio]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (q.length < 2) return;
    setNotice(null);
    setPhase({ kind: "answering", question: q, answer: "" });
    try {
      const res = await fetch("/api/doubts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lectureId, lang, atSec, question: q }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const left = Number(res.headers.get("x-doubts-remaining"));
      if (Number.isFinite(left)) setRemaining(left);

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let answer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const event = JSON.parse(line) as
            | { type: "delta"; text: string }
            | { type: "status"; text: string }
            | { type: "program"; text: string }
            | { type: "done"; doubtId: string }
            | { type: "error"; message: string };
          if (event.type === "delta") {
            answer += event.text;
            setPhase({ kind: "answering", question: q, answer });
          } else if (event.type === "status") {
            // Languages the model can't write arrive whole, after translation.
            setPhase({ kind: "answering", question: q, answer, status: event.text });
          } else if (event.type === "program") {
            answer = event.text;
            setPhase({ kind: "answering", question: q, answer });
          } else if (event.type === "done") {
            setPhase({ kind: "answered", question: q, answer, doubtId: event.doubtId });
            setEarlier((e) => [{ id: event.doubtId, atSec, question: q, answer }, ...e]);
            setQuestion("");
          } else {
            setRemaining((r) => (r === null ? r : r + 1));
            setPhase({ kind: "failed", question: q, message: event.message });
          }
        }
      }
    } catch (err) {
      console.error("asking the doubt failed:", err);
      setPhase({ kind: "failed", question: q, message: err instanceof Error ? err.message : String(err) });
    }
  }, [atSec, lang, lectureId, question]);

  const recording = recorder.state.phase === "recording";
  const outOfDoubts = remaining === 0;

  return (
    <section aria-labelledby="doubt-heading" className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label">Ask a doubt · at {formatTime(atSec)}</p>
          <h2 id="doubt-heading" ref={heading} tabIndex={-1} className="mt-1 text-xl outline-none">
            {phase.kind === "answering" || phase.kind === "answered" || phase.kind === "failed"
              ? "Your doubt"
              : `What didn't make sense?`}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => {
            recorder.reset();
            onClose();
          }}
          aria-label="Close and keep watching"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-(--color-mist) hover:text-(--color-fg)"
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {isPending ? (
        <div className="h-24 animate-pulse rounded-lg bg-(--color-raised)" />
      ) : !user ? (
        <p className="text-(--color-mist)">
          Doubts are answered by a model, so they need an account.{" "}
          <Link href={`/signin?next=/lecture/${lectureId}`} className="link">
            Sign in
          </Link>{" "}
          to ask one.
        </p>
      ) : phase.kind === "compose" || phase.kind === "transcribing" ? (
        <div className="space-y-4">
          <p className="text-sm text-(--color-mist)">
            Speak or type in {LANGUAGES[lang].name}, English, or a mix. The answer comes from what the lecturer said around{" "}
            {formatTime(atSec)}.
          </p>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={recording ? recorder.stop : recorder.start}
              disabled={phase.kind === "transcribing" || outOfDoubts}
              aria-label={recording ? "Stop recording" : "Record your doubt"}
              className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                recording ? "bg-(--color-alert) text-white" : "bg-(--color-signal) text-white hover:opacity-90"
              }`}
            >
              {recording && <CountdownRing startedAt={recorder.state.phase === "recording" ? recorder.state.startedAt : 0} />}
              {phase.kind === "transcribing" ? (
                <Loader2 size={22} className="animate-spin" aria-hidden />
              ) : recording ? (
                <Square size={18} fill="currentColor" aria-hidden />
              ) : (
                <Mic size={22} aria-hidden />
              )}
            </button>
            <div className="min-w-0 flex-1" aria-live="polite">
              {recording ? (
                <div className="space-y-1.5">
                  <LevelMeter level={recorder.level} />
                  <p className="text-sm text-(--color-mist)">Listening. Tap to stop.</p>
                </div>
              ) : phase.kind === "transcribing" ? (
                <p className="text-sm text-(--color-mist)">Writing down what you said…</p>
              ) : (
                <p className="text-sm text-(--color-mist)">Tap to speak, up to {MAX_RECORDING_SEC} seconds.</p>
              )}
            </div>
          </div>

          {(recorder.state.phase === "denied" || recorder.state.phase === "error") && (
            <p role="alert" className="text-sm text-(--color-warn)">
              {recorder.state.message}
            </p>
          )}
          {notice && (
            <p role="alert" className="text-sm text-(--color-warn)">
              {notice}
            </p>
          )}

          <label className="block space-y-1.5">
            <span className="sr-only">Your doubt</span>
            <textarea
              ref={textarea}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) ask();
              }}
              rows={3}
              maxLength={500}
              lang={textLang}
              placeholder="…or type it here"
              className="w-full resize-y rounded-xl border border-(--color-line) bg-(--color-node) px-4 py-3 outline-none focus:border-(--color-signal)"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className={`text-sm ${remaining !== null && remaining <= 5 ? "text-(--color-warn)" : "text-(--color-faint)"}`}>
              {remaining === null ? " " : outOfDoubts ? "No doubts left today. They reset at midnight UTC." : `${remaining} doubts left today`}
            </p>
            <button
              type="button"
              onClick={ask}
              disabled={question.trim().length < 2 || outOfDoubts || phase.kind === "transcribing"}
              className="btn btn-primary min-h-11 px-5 text-sm disabled:opacity-40"
            >
              Ask <Send size={15} aria-hidden />
            </button>
          </div>

          {earlier.length > 0 && (
            <div className="space-y-2 border-t border-(--color-line) pt-3">
              <p className="label">Your earlier doubts here</p>
              <ul className="space-y-1">
                {earlier.slice(0, 5).map((d) => (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => setPhase({ kind: "answered", question: d.question, answer: d.answer, doubtId: d.id })}
                      className="flex min-h-11 w-full items-baseline gap-3 rounded-xl px-3 text-left text-(--color-mist) hover:bg-(--color-raised) hover:text-(--color-fg)"
                    >
                      <span className="font-mono text-xs text-(--color-faint)">{formatTime(d.atSec)}</span>
                      <span lang={textLang} className="line-clamp-1">
                        {d.question}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p lang={textLang} className="border-l-2 border-(--color-warn) pl-3 text-(--color-mist)">
            {phase.question}
          </p>

          {phase.kind === "failed" ? (
            <div className="space-y-3" role="alert">
              <p className="text-(--color-alert)">Couldn&apos;t answer that: {phase.message}</p>
              <p className="text-sm text-(--color-mist)">It didn&apos;t count against today&apos;s doubts.</p>
              <button
                type="button"
                onClick={() => {
                  setQuestion(phase.question);
                  setPhase({ kind: "compose" });
                }}
                className="btn btn-secondary min-h-11 border border-(--color-line) px-4 text-sm"
              >
                <RotateCcw size={15} aria-hidden /> Try again
              </button>
            </div>
          ) : (
            <div lang={textLang} className="doubt-answer min-h-24" aria-live="polite" aria-busy={phase.kind === "answering"}>
              {phase.answer ? (
                <Renderer
                  response={phase.answer}
                  library={doubtLibrary}
                  isStreaming={phase.kind === "answering"}
                  onError={(errors) => {
                    if (errors.length && phase.kind === "answered") console.error("doubt render errors:", errors);
                  }}
                />
              ) : (
                <div className="space-y-2">
                  <div className="h-5 w-3/4 animate-pulse rounded-lg bg-(--color-raised)" />
                  <div className="h-4 w-full animate-pulse rounded-lg bg-(--color-raised)" />
                  <div className="h-4 w-5/6 animate-pulse rounded-lg bg-(--color-raised)" />
                  {phase.kind === "answering" && phase.status && (
                    <p className="pt-1 text-sm text-(--color-signal)">{phase.status}…</p>
                  )}
                </div>
              )}
            </div>
          )}

          {phase.kind === "answered" && (
            <div className="flex flex-wrap items-center gap-2 border-t border-(--color-line) pt-3">
              {/* Bulbul reads eleven languages aloud; the rest have no voice yet. */}
              {LANGUAGES[lang].speaks && <ReadAloud doubtId={phase.doubtId} />}
              <button
                type="button"
                onClick={() => setPhase({ kind: "compose" })}
                className="btn btn-secondary min-h-11 border border-(--color-line) px-4 text-sm"
              >
                Ask another
              </button>
              <button type="button" onClick={onClose} className="btn btn-primary ml-auto min-h-11 px-5 text-sm">
                Back to the lecture
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function CountdownRing({ startedAt }: { startedAt: number }) {
  const [left, setLeft] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, 1 - (performance.now() - startedAt) / (MAX_RECORDING_SEC * 1000))), 100);
    return () => clearInterval(id);
  }, [startedAt]);
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 64 64" className="absolute inset-0 h-16 w-16 -rotate-90" aria-hidden>
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={c} strokeDashoffset={c * (1 - left)} />
    </svg>
  );
}

/** Five bars that rise with the input level, so a student can see they're being heard. */
function LevelMeter({ level }: { level: number }) {
  return (
    <div className="flex h-6 items-end gap-1" aria-hidden>
      {[0.15, 0.35, 0.55, 0.75, 0.9].map((threshold, n) => (
        <span
          key={n}
          className="w-1.5 rounded-full transition-[height,background-color] duration-75"
          style={{
            height: `${30 + n * 17}%`,
            background: level >= threshold ? "var(--color-signal)" : "var(--color-line)",
          }}
        />
      ))}
    </div>
  );
}

function ReadAloud({ doubtId }: { doubtId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const [error, setError] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      audio.current?.pause();
      if (audio.current?.src) URL.revokeObjectURL(audio.current.src);
    },
    [],
  );

  const play = async () => {
    if (state === "playing") {
      audio.current?.pause();
      setState("idle");
      return;
    }
    setState("loading");
    setError(null);
    try {
      if (!audio.current) {
        const res = await fetch("/api/voice/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ doubtId }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        const el = new Audio(URL.createObjectURL(await res.blob()));
        el.onended = () => setState("idle");
        audio.current = el;
      }
      audio.current.currentTime = 0;
      await audio.current.play();
      setState("playing");
    } catch (err) {
      console.error("read aloud failed:", err);
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={play}
        disabled={state === "loading"}
        className="btn btn-secondary min-h-11 border border-(--color-line) px-4 text-sm text-(--color-signal) disabled:opacity-60"
      >
        {state === "loading" ? (
          <Loader2 size={15} className="animate-spin" aria-hidden />
        ) : state === "playing" ? (
          <Square size={13} fill="currentColor" aria-hidden />
        ) : (
          <Volume2 size={16} aria-hidden />
        )}
        {state === "playing" ? "Stop" : "Read aloud"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-(--color-alert)">
          Couldn&apos;t read it aloud: {error}
        </p>
      )}
    </>
  );
}
