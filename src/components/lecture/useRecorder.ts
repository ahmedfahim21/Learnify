"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tap-to-start, tap-to-stop voice recording for doubts, capped at 25 s.
 *
 * Tap rather than hold: holding fails on phones inside a scrolling sheet,
 * and budget Android devices drop long-press. Exposes a 0–1 input level for
 * the meter so a student can see the mic is hearing them.
 */

export const MAX_RECORDING_SEC = 25;

export type RecorderState =
  | { phase: "idle" }
  | { phase: "recording"; startedAt: number }
  | { phase: "done"; audio: Blob }
  | { phase: "denied"; message: string }
  | { phase: "error"; message: string };

/** Opus in WebM where supported (Chrome, Firefox, Android), AAC in MP4 on Safari. */
function pickMimeType(): string | undefined {
  for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>({ phase: "idle" });
  const [level, setLevel] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const frame = useRef<number | null>(null);
  const cap = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    if (cap.current) clearTimeout(cap.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    audioCtx.current?.close().catch((err) => console.warn("closing the audio context failed:", err));
    frame.current = null;
    cap.current = null;
    stream.current = null;
    audioCtx.current = null;
    setLevel(0);
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setState({ phase: "error", message: "This browser can't record audio. Type your doubt instead." });
      return;
    }
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      setState(
        name === "NotAllowedError" || name === "SecurityError"
          ? {
              phase: "denied",
              message:
                "Microphone access is blocked. Allow it from the icon at the left of the address bar, or type your doubt below.",
            }
          : { phase: "error", message: "Couldn't start the microphone. Type your doubt below instead." },
      );
      console.warn("getUserMedia failed:", err);
      return;
    }
    stream.current = media;

    // Input level for the meter.
    const ctx = new AudioContext();
    audioCtx.current = ctx;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(media).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      for (const s of samples) sum += ((s - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 4));
      frame.current = requestAnimationFrame(tick);
    };
    tick();

    const mimeType = pickMimeType();
    const rec = new MediaRecorder(media, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      cleanup();
      setState({ phase: "done", audio: new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }) });
    };
    recorder.current = rec;
    rec.start();
    setState({ phase: "recording", startedAt: performance.now() });
    cap.current = setTimeout(() => rec.state === "recording" && rec.stop(), MAX_RECORDING_SEC * 1000);
  }, [cleanup]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const reset = useCallback(() => {
    if (recorder.current?.state === "recording") {
      recorder.current.onstop = null;
      recorder.current.stop();
    }
    cleanup();
    setState({ phase: "idle" });
  }, [cleanup]);

  return { state, level, start, stop, reset };
}
