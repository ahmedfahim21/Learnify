"use client";

import { Keyboard, Languages, Mic } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CheckpointPanel } from "@/components/lecture/CheckpointPanel";
import { StudyTabs, type Tab } from "@/components/lecture/StudyTabs";
import { useCheckpoints } from "@/components/lecture/useCheckpoints";
import { useYouTubePlayer } from "@/components/player/useYouTubePlayer";
import { isLang, LANGUAGES, type Lang } from "@/lib/languages";
import { describeStatus } from "@/lib/lectures/describeStatus";
import type { LectureView } from "@/lib/lectures/view";
import { useSession } from "@/lib/authClient";
import { LectureClockContext, type Rating, StudyActionsContext } from "@/lib/openui/contexts";

/**
 * The lecture player: the official video in YouTube's embedded player (its
 * own captions are the student's to turn on), checks that pause at the right
 * moments, a short rail beside it for whatever belongs to this moment (a
 * check, a doubt, the controls), and under it, full width, the study modes the
 * model writes in the student's language: notes, quiz, flashcards, map.
 *
 * Reads GET /api/lectures/[id]; while anything is missing it asks POST
 * /prepare to build it and polls again, backing off from 2 s to 10 s.
 */

// The doubt panel (recorder, OpenUI renderer) loads when a doubt is first opened.
const DoubtPanel = dynamic(() => import("@/components/lecture/DoubtPanel").then((m) => m.DoubtPanel), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-(--radius) bg-(--color-raised)" />,
});

const LANG_KEY = "learnify.lang";
const CHECKS_KEY = "learnify.checks";

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved && isLang(saved)) return saved;
  } catch {
    // Storage blocked (private mode): fall through to the browser's languages.
  }
  for (const tag of navigator.languages ?? []) {
    const code = tag.toLowerCase().split("-")[0];
    if (code !== "en" && isLang(code)) return code;
    if (code === "or") return "od";
  }
  return "ta";
}

function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not remembered across visits; still applies now.
  }
}

type Blocker = { kind: "signin" | "limit" | "error"; message: string } | null;

export default function LecturePage() {
  const { lectureId } = useParams<{ lectureId: string }>();
  const startAt = Number(useSearchParams().get("t"));
  const { user } = useSession();
  const [lang, setLang] = useState<Lang | null>(null);
  const [checksOn, setChecksOn] = useState(true);
  const [view, setView] = useState<LectureView | null>(null);
  const [blocker, setBlocker] = useState<Blocker>(null);
  const [now, setNow] = useState(0);
  const [tab, setTab] = useState<Tab>("notes");
  const [showKeys, setShowKeys] = useState(false);
  /** Where the video was paused to ask a doubt; null while no doubt is open. */
  const [doubtAt, setDoubtAt] = useState<number | null>(null);

  useEffect(() => {
    setLang(initialLang());
    try {
      setChecksOn(localStorage.getItem(CHECKS_KEY) !== "off");
    } catch {
      // Default (checks on) stands.
    }
  }, []);

  // Fetch, ask for whatever is missing, and poll with backoff until ready.
  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    let delay = 2000;
    let timer: ReturnType<typeof setTimeout>;
    setBlocker(null);

    async function tick() {
      const res = await fetch(`/api/lectures/${lectureId}?lang=${lang}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (cancelled) return;
      setView(body);
      if (body.status.ready) return;

      const prep = await fetch(`/api/lectures/${lectureId}/prepare?lang=${lang}`, { method: "POST" });
      if (cancelled) return;
      if (prep.status === 401) return setBlocker({ kind: "signin", message: "Sign in to prepare this lecture in your language." });
      if (prep.status === 429) return setBlocker({ kind: "limit", message: (await prep.json()).error });
      if (!prep.ok) throw new Error((await prep.json()).error ?? `prepare → HTTP ${prep.status}`);
      timer = setTimeout(() => tick().catch(fail), delay);
      delay = Math.min(10_000, delay * 2);
    }
    const fail = (err: Error) => {
      console.error("lecture load failed:", err);
      if (!cancelled) setBlocker({ kind: "error", message: err.message });
    };
    tick().catch(fail);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lectureId, lang]);

  const player = useYouTubePlayer(view?.lecture.youtubeId ?? null);
  const controls = useMemo(() => ({ play: player.play, pause: player.pause, seek: player.seek }), [player.play, player.pause, player.seek]);
  const checks = view?.pack?.checkpoints ?? [];
  // Checks stay quiet while a doubt is open.
  const flow = useCheckpoints(lectureId, lang ?? "en", checks, controls, checksOn && doubtAt === null);

  // Sample the playhead. setInterval keeps ticking in background tabs; rAF doesn't.
  const onSample = flow.onSample;
  const sample = player.sample;
  useEffect(() => {
    const id = setInterval(() => {
      const s = sample();
      if (!s) return;
      setNow(s.timeSec);
      onSample(s);
    }, 250);
    return () => clearInterval(id);
  }, [sample, onSample]);

  // Study screens sit below the video; jumping to a moment brings it back into view.
  const stageRef = useRef<HTMLDivElement>(null);
  const seekAndPlay = useCallback(
    (sec: number) => {
      player.seek(sec, { play: true });
      const r = stageRef.current?.getBoundingClientRect();
      if (r && (r.bottom < 120 || r.top > window.innerHeight)) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [player],
  );

  // ?t=123 (from Today's "watch the moment") starts the lecture there.
  const ready = player.ready;
  const seek = player.seek;
  useEffect(() => {
    if (ready && Number.isFinite(startAt) && startAt > 0) seek(startAt);
  }, [ready, seek, startAt]);

  // Flashcard ratings, only when they can be saved.
  const studyActions = useMemo(
    () =>
      user && lang
        ? {
            rate: async (cardId: string, rating: Rating) => {
              const res = await fetch("/api/flashcards/review", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ lectureId, lang, cardId, rating }),
              });
              const body = await res.json();
              if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
              return { dueAt: body.dueAt as string };
            },
          }
        : null,
    [user, lang, lectureId],
  );
  const english = view?.subtitles.en ?? null;
  const status = view ? describeStatus(view.status) : null;
  const clock = useMemo(
    () => ({ durationSec: english?.durationSec ?? Number.MAX_SAFE_INTEGER, seekTo: seekAndPlay }),
    [english?.durationSec, seekAndPlay],
  );
  const packFailed = view?.status.stages.find((s) => s.stage === "pack" && s.state === "failed" && !s.willRetry);

  const checkOpen = flow.state.mode !== "idle";
  const openDoubt = useCallback(() => {
    if (!english || checkOpen) return;
    player.pause();
    setDoubtAt(now);
  }, [english, checkOpen, player, now]);

  // Keyboard: on the page, not inside form controls or the open check.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || el?.closest("input, textarea, select, [role=radiogroup], button, a")) return;
      const k = e.key.toLowerCase();
      if (k === " " || k === "k") {
        e.preventDefault();
        if (player.playing) player.pause();
        else player.play();
      } else if (k === "j") player.seek(now - 10);
      else if (k === "l") player.seek(now + 10);
      else if (k === "n") setTab("notes");
      else if (k === "q") setTab("quiz");
      else if (k === "d") openDoubt();
      else if (k === "?") setShowKeys((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [now, player, openDoubt]);

  function closeDoubt() {
    setDoubtAt(null);
    player.play();
  }

  function chooseLang(next: Lang) {
    setLang(next);
    remember(LANG_KEY, next);
  }

  function toggleChecks() {
    setChecksOn((on) => {
      remember(CHECKS_KEY, on ? "off" : "on");
      return !on;
    });
  }

  const noTranscript = view?.status.stages.find((s) => s.lang === "en" && s.stage === "transcript" && s.state === "failed" && !s.willRetry);
  const active = flow.state.mode === "idle" ? null : flow.state.check.id;
  const checkIndex = active ? checks.findIndex((c) => c.id === active) + 1 : 0;

  const rail =
    flow.state.mode === "idle" && doubtAt !== null && lang ? (
      <DoubtPanel lectureId={lectureId} lang={lang} atSec={doubtAt} onClose={closeDoubt} />
    ) : flow.state.mode !== "idle" && lang ? (
      <CheckpointPanel
        state={flow.state}
        lang={lang}
        index={checkIndex}
        total={checks.length}
        onAnswer={flow.answer}
        onResume={flow.resume}
        onSkipReplay={flow.skipReplay}
      />
    ) : null;

  return (
    <LectureClockContext.Provider value={clock}>
      <StudyActionsContext.Provider value={studyActions}>
      <main className="wrap space-y-6 py-6">
        <div className="space-y-1">
          {view ? (
            <Link href={`/courses/${view.lecture.courseId}`} className="label hover:text-(--color-fg)">
              ← {view.lecture.unitName}
            </Link>
          ) : (
            <div className="h-4 w-24 animate-pulse rounded-(--radius) bg-(--color-raised)" />
          )}
          {view ? (
            <h1 className="text-3xl">{view.lecture.title}</h1>
          ) : (
            <div className="h-9 w-2/3 animate-pulse rounded-(--radius) bg-(--color-raised)" />
          )}
        </div>

        {/* One container for the stage and the study modes, so on phones the
            video stays pinned while you study; the grid dissolves into it there. */}
        <div className="flex flex-col gap-4 lg:gap-10">
        <div className="grid gap-4 max-lg:contents lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-6">
          {/* On phones the video stays on screen while everything under it scrolls. */}
          <div ref={stageRef} className="scroll-mt-20 bg-(--color-ink) max-lg:sticky max-lg:top-14 max-lg:z-10 max-lg:pb-2">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-(--color-raised) shadow-(--shadow-card)">
              {player.blocked && view?.lecture.youtubeId ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <p>This video can&apos;t play inside Learnify.</p>
                  <a href={`https://www.youtube.com/watch?v=${view.lecture.youtubeId}`} target="_blank" rel="noreferrer" className="link">
                    Open it on YouTube ↗
                  </a>
                  <p className="text-sm text-(--color-mist)">The study modes below still work here.</p>
                </div>
              ) : (
                <div ref={player.containerRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
              )}
              {player.error && <p className="absolute inset-x-0 bottom-0 bg-(--color-ink)/90 p-3 text-sm text-(--color-alert)">{player.error}</p>}
            </div>
          </div>

          <aside className="min-w-0 space-y-4">
            {rail ?? (
              <div className="space-y-4 rounded-2xl border border-(--color-line) bg-(--color-surface) p-4">
                <label className="block space-y-1.5">
                  <span className="label flex items-center gap-1.5">
                    <Languages size={14} aria-hidden /> Study in
                  </span>
                  <select
                    value={lang ?? "ta"}
                    onChange={(e) => chooseLang(e.target.value as Lang)}
                    className="min-h-11 w-full rounded-xl border border-(--color-line) bg-(--color-node) px-3 text-(--color-fg)"
                  >
                    {Object.entries(LANGUAGES).map(([code, l]) => (
                      <option key={code} value={code}>
                        {l.native}
                        {l.native !== l.name ? ` · ${l.name}` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={openDoubt}
                  disabled={!english || checkOpen}
                  title={!english ? "Doubts open once the lecture's transcript is ready" : undefined}
                  className="tile flex w-full items-center gap-3 rounded-xl bg-(--color-signal) p-3 text-left text-white disabled:bg-(--color-raised) disabled:text-(--color-faint)"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
                    <Mic size={18} aria-hidden />
                  </span>
                  <span>
                    <span className="block">Ask a doubt</span>
                    <span className="block text-sm opacity-75">Pause and ask out loud</span>
                  </span>
                </button>

                {checks.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleChecks}
                    aria-pressed={checksOn}
                    className="flex min-h-11 w-full items-center justify-between gap-3 text-sm text-(--color-mist) hover:text-(--color-fg)"
                  >
                    <span>
                      Pop-up checks {checksOn ? <span className="font-mono">· {flow.doneCount}/{checks.length}</span> : "off"}
                    </span>
                    <span
                      aria-hidden
                      className={`inline-block h-5 w-9 rounded-full border transition-colors ${checksOn ? "border-(--color-signal) bg-(--color-signal)" : "border-(--color-line) bg-(--color-node)"}`}
                    >
                      <span className={`block h-4 w-4 translate-y-px rounded-full bg-white shadow transition-transform ${checksOn ? "translate-x-4" : "translate-x-px"}`} />
                    </span>
                  </button>
                )}

                {status && !blocker && (
                  <p
                    className={`flex items-center gap-2 text-sm ${status.tone === "failed" ? "text-(--color-alert)" : status.tone === "retrying" ? "text-(--color-warn)" : "text-(--color-mist)"}`}
                    aria-live="polite"
                  >
                    {status.tone !== "failed" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
                    {status.text}
                  </p>
                )}
                {blocker && (
                  <p className={`text-sm ${blocker.kind === "error" ? "text-(--color-alert)" : "text-(--color-warn)"}`} role="status">
                    {blocker.message}{" "}
                    {blocker.kind === "signin" && (
                      <Link href={`/signin?next=/lecture/${lectureId}`} className="link">
                        Sign in
                      </Link>
                    )}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setShowKeys((v) => !v)}
                  aria-expanded={showKeys}
                  className="inline-flex min-h-9 items-center gap-2 text-sm text-(--color-mist) hover:text-(--color-fg)"
                >
                  <Keyboard size={16} aria-hidden /> Shortcuts
                </button>
                {showKeys && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {[
                      ["Space / K", "Play or pause"],
                      ["J / L", "Back or forward 10 s"],
                      ["N / Q", "Notes or quiz"],
                      ["D", "Ask a doubt"],
                      ["1–4, Enter", "Answer a check"],
                      ["?", "These shortcuts"],
                    ].map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt>
                          <kbd className="font-mono text-(--color-mist)">{k}</kbd>
                        </dt>
                        <dd className="text-(--color-mist)">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </aside>
        </div>

        {noTranscript ? (
          <p className="text-(--color-mist)">
            There&apos;s no transcript for this lecture yet, so checks and study modes aren&apos;t available. The video still plays.
          </p>
        ) : (
          <StudyTabs
            tab={tab}
            onTab={setTab}
            lectureId={lectureId}
            lang={lang ?? "en"}
            transcriptReady={Boolean(english)}
            pack={view?.pack ?? null}
            packNote={
              packFailed
                ? `Couldn't build the study material: ${packFailed.state === "failed" ? packFailed.error : ""}`
                : "Building the flashcards and concept map. This takes under a minute the first time anyone opens a lecture."
            }
          />
        )}
        </div>
      </main>
      </StudyActionsContext.Provider>
    </LectureClockContext.Provider>
  );
}
