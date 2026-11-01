"use client";

import { Renderer } from "@openuidev/react-lang";
import { RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useSession } from "@/lib/authClient";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { StudyActionsContext } from "@/lib/openui/contexts";
import { screenLibrary } from "@/lib/openui/screenLibrary";
import { PoweredBy } from "@/components/site/Brands";

/**
 * A study screen the model writes for this lecture — interactive notes or a
 * practice quiz — in the student's language, streamed in as it's built and
 * then shared with every student. Loads OpenUI only with the tab (dynamic).
 *
 * A screen nobody has asked for yet is never written automatically: the
 * student presses the button, because each one costs a generation.
 */

type Kind = "notes" | "quiz";
type Variant = "standard" | "simpler" | "harder";

type State =
  | { phase: "loading" }
  | { phase: "missing" }
  | { phase: "generating"; program: string; status?: string }
  | { phase: "ready"; program: string }
  | { phase: "error"; message: string; program: string | null };

const VARIANTS: { variant: Variant; label: string }[] = [
  { variant: "simpler", label: "Simpler" },
  { variant: "standard", label: "Standard" },
  { variant: "harder", label: "Harder" },
];

const COPY: Record<Kind, { what: string; building: string; make: string }> = {
  notes: { what: "notes", building: "Writing notes from the lecture", make: "Write my notes" },
  quiz: { what: "quiz", building: "Writing a quiz from the lecture", make: "Make my quiz" },
};

const STYLE: Record<Variant, string> = { simpler: "the simpler style", standard: "the standard style", harder: "the harder style" };

export default function GeneratedScreen({ lectureId, lang, kind, level }: { lectureId: string; lang: Lang; kind: Kind; level: Variant }) {
  const { user, isPending } = useSession();
  const [variant, setVariant] = useState<Variant>(level);
  const [state, setState] = useState<State>({ phase: "loading" });
  const busy = useRef(false);
  const query = `lang=${lang}&variant=${variant}`;
  const url = `/api/lectures/${lectureId}/screens/${kind}?${query}`;

  const generate = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setState({ phase: "generating", program: "" });
    try {
      const res = await fetch(url, { method: "POST" });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let program = "";
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
            | { type: "done" }
            | { type: "error"; message: string };
          if (event.type === "delta") {
            program += event.text;
            setState({ phase: "generating", program });
          } else if (event.type === "status") {
            // Languages the model can't write arrive whole, after translation; say what's happening meanwhile.
            setState({ phase: "generating", program, status: event.text });
          } else if (event.type === "program") {
            program = event.text;
            setState({ phase: "generating", program });
          } else if (event.type === "done") {
            setState({ phase: "ready", program });
          } else {
            setState({ phase: "error", message: event.message, program: null });
          }
        }
      }
    } catch (err) {
      console.error(`generating ${kind} failed:`, err);
      setState({ phase: "error", message: err instanceof Error ? err.message : String(err), program: null });
    } finally {
      busy.current = false;
    }
  }, [kind, url]);

  // Load the shared screen, if anyone has made one; never build it unasked.
  useEffect(() => {
    if (isPending) return;
    let cancelled = false;
    setState({ phase: "loading" });
    fetch(url, { cache: "no-store" })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) {
          setState({ phase: "missing" });
          return;
        }
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setState({ phase: "ready", program: body.program });
      })
      .catch((err: Error) => {
        console.error(`loading ${kind} failed:`, err);
        if (!cancelled) setState({ phase: "error", message: err.message, program: null });
      });
    return () => {
      cancelled = true;
    };
  }, [url, isPending, kind]);

  const generating = state.phase === "generating";
  const program = state.phase === "ready" || state.phase === "generating" ? state.program : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="group" aria-label="Style" className="flex rounded-full border border-(--color-line) bg-(--color-node) p-1">
          {VARIANTS.map((v) => (
            <button
              key={v.variant}
              type="button"
              aria-pressed={variant === v.variant}
              disabled={generating}
              onClick={() => setVariant(v.variant)}
              className={`min-h-9 rounded-full px-4 text-sm transition-colors disabled:opacity-50 ${
                variant === v.variant ? "bg-(--color-signal) text-white" : "text-(--color-mist) hover:text-(--color-fg)"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        {user && state.phase === "ready" && (
          <button
            type="button"
            onClick={generate}
            className="inline-flex min-h-9 items-center gap-1.5 text-sm text-(--color-mist) hover:text-(--color-signal)"
          >
            <RefreshCw size={14} aria-hidden /> {kind === "quiz" ? "New quiz" : "Rewrite"}
          </button>
        )}
      </div>

      {generating && (
        <p className="flex items-center gap-2 text-sm text-(--color-signal)" aria-live="polite">
          <Sparkles size={15} className="animate-pulse" aria-hidden />
          {state.status ?? `${COPY[kind].building} in ${LANGUAGES[lang].native}`}…
        </p>
      )}

      {program ? (
        <div lang={LANGUAGES[lang].sarvam} aria-busy={generating}>
          <WithVariant variant={variant}>
          <Renderer
            response={program}
            library={screenLibrary}
            isStreaming={generating}
            onError={(errors) => {
              if (errors.length && !generating) console.error(`${kind} render errors:`, errors);
            }}
          />
          </WithVariant>
          {state.phase === "ready" && (
            <div className="mt-6 border-t border-(--color-line) pt-3">
              <PoweredBy />
            </div>
          )}
        </div>
      ) : state.phase === "loading" || (generating && !program) ? (
        <div className="space-y-3">
          <div className="h-7 w-2/3 animate-pulse rounded-xl bg-(--color-raised)" />
          <div className="h-24 animate-pulse rounded-xl bg-(--color-raised)" />
          <div className="h-24 animate-pulse rounded-xl bg-(--color-raised)" />
        </div>
      ) : state.phase === "missing" ? (
        <div className="kolam flex flex-col items-start gap-4 rounded-2xl border border-(--color-line) p-6">
          <p className="text-xl">
            No {COPY[kind].what} in <span lang={LANGUAGES[lang].sarvam}>{LANGUAGES[lang].native}</span> in {STYLE[variant]} yet.
          </p>
          {user ? (
            <>
              <p className="text-(--color-mist)">
                It&apos;s written from the lecture in a few seconds, uses one of today&apos;s AI generations, and is then shared with everyone.
              </p>
              <button
                type="button"
                onClick={generate}
                className="tile inline-flex min-h-12 items-center gap-2 rounded-full bg-(--color-signal) px-6 text-white"
              >
                <Sparkles size={16} aria-hidden /> {COPY[kind].make}
              </button>
            </>
          ) : (
            <p className="text-(--color-mist)">
              <Link href={`/signin?next=/lecture/${lectureId}`} className="link">
                Sign in
              </Link>{" "}
              to have it written from the lecture; it&apos;s then shared with everyone.
            </p>
          )}
        </div>
      ) : state.phase === "error" ? (
        <div className="space-y-3" role="alert">
          <p className="text-(--color-alert)">Couldn&apos;t build this: {state.message}</p>
          {user && (
            <button
              type="button"
              onClick={generate}
              className="btn btn-secondary min-h-11 border border-(--color-line) px-4 text-sm"
            >
              <RefreshCw size={14} aria-hidden /> Try again
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Passes the style that's showing to whatever a finished quiz saves. */
function WithVariant({ variant, children }: { variant: Variant; children: ReactNode }) {
  const parent = useContext(StudyActionsContext);
  const value = useMemo(
    () => (parent ? { ...parent, quizFinished: (r: Parameters<typeof parent.quizFinished>[0]) => parent.quizFinished({ ...r, variant }) } : null),
    [parent, variant],
  );
  return <StudyActionsContext.Provider value={value}>{children}</StudyActionsContext.Provider>;
}
