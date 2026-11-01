"use client";

import "@xyflow/react/dist/style.css";

import { createLibrary, defineComponent } from "@openuidev/react-lang";
import { Background, type Edge, MarkerType, type Node, Position, ReactFlow } from "@xyflow/react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useContext, useEffect, useMemo, useState } from "react";
import { z } from "zod";

import { layoutConcepts, NODE_WIDTH } from "@/lib/study/layout";

import { LectureClockContext, type Rating, StudyActionsContext } from "./contexts";
import { TimeChip } from "./parts";

/**
 * The OpenUI component library for a lecture's study screens: concept map,
 * flashcards and recap. Programs come from lib/openui/serializeStudy.ts (a
 * typed serializer over the validated pack, never a model at render time), so
 * the same Renderer and library path serves study screens and doubt answers.
 *
 * Text arrives in the student's language; the chrome (counters, buttons) is
 * English for now.
 */

const RATING_LABELS: { rating: Rating; label: string; hint: string }[] = [
  { rating: "again", label: "Again", hint: "Didn't know it" },
  { rating: "hard", label: "Hard", hint: "Got it, barely" },
  { rating: "good", label: "Good", hint: "Got it" },
  { rating: "easy", label: "Easy", hint: "Knew it cold" },
];

function untilLabel(dueAt: string): string {
  const hours = (new Date(dueAt).getTime() - Date.now()) / 3_600_000;
  if (hours < 20) return "later today";
  const days = Math.round(hours / 24);
  return days <= 1 ? "tomorrow" : `in ${days} days`;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// --- Concept map -------------------------------------------------------------

export const ConceptNode = defineComponent({
  name: "ConceptNode",
  description: "One concept the lecture teaches, with when it's explained and what it builds on.",
  props: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    startSec: z.number(),
    endSec: z.number(),
    prereqIds: z.array(z.string()),
  }),
  // Drawn by ConceptMap, which needs every node at once to lay them out.
  component: () => null,
});

type ConceptProps = z.infer<typeof ConceptNode.props>;

function ConceptMapView({ concepts }: { concepts: ConceptProps[] }) {
  const clock = useContext(LectureClockContext);
  const [selected, setSelected] = useState<string | null>(concepts[0]?.id ?? null);
  const placed = useMemo(() => layoutConcepts(concepts), [concepts]);

  const nodes: Node[] = useMemo(
    () =>
      concepts.map((c, n) => ({
        id: c.id,
        position: { x: placed[n].x, y: placed[n].y },
        data: { label: c.title },
        draggable: false,
        selected: c.id === selected,
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
        ariaLabel: `${c.title}, explained at ${formatTime(c.startSec)}`,
        className: "concept-node",
        style: { width: NODE_WIDTH },
      })),
    [concepts, placed, selected],
  );
  const edges: Edge[] = useMemo(
    () =>
      concepts.flatMap((c) =>
        c.prereqIds
          .filter((p) => concepts.some((o) => o.id === p))
          .map((p) => ({
            id: `${p}->${c.id}`,
            source: p,
            target: c.id,
            type: "smoothstep",
            markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
            className: "concept-edge",
          })),
      ),
    [concepts],
  );

  const current = concepts.find((c) => c.id === selected) ?? null;
  return (
    <div className="space-y-3">
      <div className="h-[24rem] overflow-hidden rounded-xl border border-(--color-line) bg-(--color-canvas)">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setSelected(node.id)}
          fitView
          fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
          nodesConnectable={false}
          proOptions={{ hideAttribution: false }}
          minZoom={0.55}
        >
          {/* Kolam pulli dots behind the map. */}
          <Background gap={22} size={1.4} color="color-mix(in srgb, var(--color-deep) 28%, transparent)" />
        </ReactFlow>
      </div>
      {current && (
        <div className="space-y-2" aria-live="polite">
          <p className="text-lg">{current.title}</p>
          <p className="text-(--color-mist)">{current.summary}</p>
          <button
            type="button"
            disabled={!clock}
            onClick={() => clock?.seekTo(current.startSec)}
            className="btn btn-secondary min-h-11 border border-(--color-line) px-4 text-sm text-(--color-signal) hover:border-(--color-signal) disabled:opacity-50"
          >
            <span className="font-mono">{formatTime(current.startSec)}</span>
            <span>Watch this part</span>
          </button>
        </div>
      )}
    </div>
  );
}

export const ConceptMap = defineComponent({
  name: "ConceptMap",
  description: "The lecture's concepts as a map: each points to the concepts it builds on.",
  props: z.object({ concepts: z.array(ConceptNode.ref) }),
  component: ({ props }) => {
    const concepts = (props.concepts as unknown as { props: ConceptProps }[]).map((n) => n.props);
    if (concepts.length === 0) return <p className="text-(--color-mist)">No concepts for this lecture.</p>;
    return <ConceptMapView concepts={concepts} />;
  },
});

// --- Flashcards --------------------------------------------------------------

export const Flashcard = defineComponent({
  name: "Flashcard",
  description: "A question on the front, its answer on the back, and where the lecture covers it.",
  props: z.object({ id: z.string(), front: z.string(), back: z.string(), startSec: z.number() }),
  component: () => null,
});

type CardProps = z.infer<typeof Flashcard.props>;

function DeckView({ cards }: { cards: CardProps[] }) {
  const clock = useContext(LectureClockContext);
  const actions = useContext(StudyActionsContext);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [rated, setRated] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = cards[index];

  const rate = async (rating: Rating) => {
    if (!actions) return;
    setSaving(true);
    setError(null);
    try {
      const { dueAt } = await actions.rate(card.id, rating);
      setRated((r) => ({ ...r, [card.id]: untilLabel(dueAt) }));
      if (index < cards.length - 1) go(1);
    } catch (err) {
      console.error("rating the flashcard failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const go = (delta: number) => {
    setIndex((i) => Math.min(cards.length - 1, Math.max(0, i + delta)));
    setFlipped(false);
  };

  useEffect(() => setFlipped(false), [index]);

  return (
    <div
      className="space-y-3"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-label={flipped ? "Show the question" : "Show the answer"}
        className="flex min-h-48 w-full flex-col justify-between gap-6 rounded-xl border border-(--color-line) bg-(--color-surface) p-5 text-left transition-colors hover:border-(--color-faint)"
      >
        <span className="label">{flipped ? "Answer" : "Question"}</span>
        <span className="text-lg">{flipped ? card.back : card.front}</span>
        <span className="label inline-flex items-center gap-1.5 text-(--color-faint)">
          <RotateCcw size={12} aria-hidden /> {flipped ? "Tap for the question" : "Tap to reveal"}
        </span>
      </button>

      {actions && flipped && (
        <div className="space-y-1.5">
          <p className="label">How well did you know it?</p>
          <div className="grid grid-cols-4 gap-1.5">
            {RATING_LABELS.map(({ rating, label, hint }) => (
              <button
                key={rating}
                type="button"
                disabled={saving}
                onClick={() => rate(rating)}
                title={hint}
                className={`min-h-11 rounded-full border px-3 text-sm transition-colors disabled:opacity-50 ${
                  rating === "again"
                    ? "border-(--color-line) text-(--color-warn) hover:border-(--color-warn)"
                    : "border-(--color-line) hover:border-(--color-signal) hover:text-(--color-signal)"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-sm text-(--color-alert)">
              Couldn&apos;t save that: {error}
            </p>
          )}
        </div>
      )}
      {rated[card.id] && !flipped && (
        <p className="text-sm text-(--color-deep)" aria-live="polite">
          Reviewed · back {rated[card.id]}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Previous card"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-(--color-line) bg-(--color-node) disabled:opacity-40"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={index === cards.length - 1}
            aria-label="Next card"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-(--color-line) bg-(--color-node) disabled:opacity-40"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
          <span className="ml-2 font-mono text-sm text-(--color-mist)" aria-live="polite">
            {index + 1} / {cards.length}
          </span>
        </div>
        <button
          type="button"
          disabled={!clock}
          onClick={() => clock?.seekTo(card.startSec)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-(--color-signal) hover:bg-(--color-signal)/[0.06] disabled:opacity-50"
        >
          <span className="font-mono">{formatTime(card.startSec)}</span>
          <span>Watch the moment</span>
        </button>
      </div>
    </div>
  );
}

export const FlashcardDeck = defineComponent({
  name: "FlashcardDeck",
  description: "The lecture's flashcards, one at a time.",
  props: z.object({ cards: z.array(Flashcard.ref) }),
  component: ({ props }) => {
    const cards = (props.cards as unknown as { props: CardProps }[]).map((n) => n.props);
    if (cards.length === 0) return <p className="text-(--color-mist)">No flashcards for this lecture.</p>;
    return <DeckView cards={cards} />;
  },
});

// --- Recap -------------------------------------------------------------------

export const RecapPoint = defineComponent({
  name: "RecapPoint",
  description: "One key point from the lecture and where it's made.",
  props: z.object({ text: z.string(), startSec: z.number() }),
  component: function RecapPointView({ props }) {
    const clock = useContext(LectureClockContext);
    return (
      <li className="flex items-baseline gap-3">
        <button
          type="button"
          disabled={!clock}
          onClick={() => clock?.seekTo(props.startSec)}
          aria-label={`Jump to ${formatTime(props.startSec)}`}
          className="min-h-11 shrink-0 font-mono text-sm text-(--color-signal) disabled:opacity-50"
        >
          {formatTime(props.startSec)}
        </button>
        <span>{props.text}</span>
      </li>
    );
  },
});

export const Recap = defineComponent({
  name: "Recap",
  description: "A short summary of the lecture and its key points.",
  props: z.object({ summary: z.string(), points: z.array(RecapPoint.ref) }),
  component: ({ props, renderNode }) => (
    <div className="space-y-4">
      <p className="text-lg leading-relaxed">{props.summary}</p>
      <ul className="space-y-1 border-t border-(--color-line) pt-3">{renderNode(props.points)}</ul>
    </div>
  ),
});

export const Study = defineComponent({
  name: "Study",
  description: "A study screen.",
  props: z.object({ parts: z.array(z.union([ConceptMap.ref, FlashcardDeck.ref, Recap.ref, TimeChip.ref])) }),
  component: ({ props, renderNode }) => <div className="space-y-4">{renderNode(props.parts)}</div>,
});

export const studyLibrary = createLibrary({
  root: "Study",
  components: [Study, ConceptMap, ConceptNode, FlashcardDeck, Flashcard, Recap, RecapPoint, TimeChip],
});
