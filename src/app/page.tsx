import Link from "next/link";

import { getPrimaryDiagram, PROBLEMS } from "@/content/systemDesign";
import { QUIZ_BANK } from "@/content/systemDesign/quizzes";
import { A2UI_LOOP } from "@/content/site/architecture";
import { WIDGET_KIND, WIDGET_NAMES, type WidgetName } from "@/lib/a2ui/catalog";
import { GRADED_WIDGETS } from "@/lib/agent/grading";
import { SIMULATOR_IDS } from "@/lib/sims/ids";
import { DiagramThumbnail } from "@/components/course/DiagramThumbnail";
import { WidgetGlyph } from "@/components/site/WidgetGlyph";
import { GuaranteeFigure, type GuaranteeFigureId } from "@/components/site/GuaranteeFigure";
import { ChapterBlockRenderer } from "@/components/course/ChapterBlockRenderer";

const ACCENTS = ["signal", "deep", "warn", "flow", "accent", "alert"] as const;

/** Counted from the source at build time, so nothing here can drift into a
 *  claim the code no longer supports. */
const blocks = PROBLEMS.flatMap((p) => p.chapters.flatMap((c) => c.blocks));
const QUESTION_COUNT =
  Object.values(QUIZ_BANK).reduce((n, q) => n + q.length, 0) +
  blocks.filter((b) => b.type === "quiz").length;

/** One line per widget, saying what the tutor reaches for it to do. */
const WIDGET_ROLE: Record<WidgetName, string> = {
  Narration: "Explains, in prose",
  ExplanationCard: "Isolates one idea",
  MultipleChoiceCheck: "Asks, with distractors",
  Flashcard: "Recall, self-rated",
  OrderingExercise: "Put a sequence right",
  MatchingPairs: "Connect two columns",
  CodeSnippet: "Shows the code",
  Diagram: "Sketches a relationship",
  SystemDiagram: "Walks a request path",
  Simulator: "Hands over the knobs",
  FreeResponse: "Asks you to write it",
  ProgressMeter: "Where you stand",
  SessionRecap: "What the session covered",
  Row: "Side by side",
  Column: "Stacked",
};

const GRADED = new Set<string>(GRADED_WIDGETS);

const GUARANTEES = [
  {
    figure: "composes" as GuaranteeFigureId,
    title: "It composes, it does not template",
    body: "Each turn the model emits a fresh component tree — which check to run, whether an idea needs a diagram or a simulator, what to do about the last wrong answer. Nothing is selected from prewritten screens.",
  },
  {
    figure: "catalog" as GuaranteeFigureId,
    title: "It cannot leave the catalog",
    body: `Output is parsed against a ${WIDGET_NAMES.length}-branch discriminated union plus referential checks Zod cannot express. Anything invalid goes back as an error result for one repair round trip and never reaches the browser.`,
  },
  {
    figure: "renderer" as GuaranteeFigureId,
    title: "The renderer executes nothing",
    body: "Validated component definitions are mapped onto React components from a fixed registry. The browser reads values the model chose; it never evaluates anything the model wrote. That is what makes model-composed UI safe to render at all.",
  },
  {
    figure: "grading" as GuaranteeFigureId,
    title: "Correctness is not the model's job",
    body: "Multiple choice, ordering and matching are graded on the server against the answer key embedded in the original payload. The verdict is injected into the next turn, so the tutor reacts to a fact rather than re-deriving one.",
  },
];

export default function Home() {
  const heroDiagram = { type: "diagram" as const, diagram: A2UI_LOOP };

  return (
    <main className="pb-24">
      <section className="wrap grid gap-12 pt-20 pb-14 lg:grid-cols-[1fr_1.15fr] lg:items-center">
        <div className="min-w-0 space-y-7 rise">
          <p className="label">Generative UI · Next.js · Claude on Bedrock</p>
          <h1 className="text-4xl leading-[1.1] sm:text-[3.25rem]">
            A tutor that builds
            <br />
            <span className="text-(--color-signal)">its own interface.</span>
          </h1>
          <p className="max-w-prose text-lg leading-relaxed text-(--color-mist)">
            Learnify.sd teaches system design without a chat box. The model never returns prose to
            display — it calls a tool that emits declarative UI, which is validated against a
            fixed catalog before the browser sees it. The renderer interprets that data and
            executes none of it.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/concepts" className="btn">
              Read the curriculum
              <span className="arr arr-r">→</span>
            </Link>
            <Link href="/concepts/url-shortener" className="btn-quiet">
              See a concept
            </Link>
          </div>
        </div>

        {/* The page explains the loop using the loop's own renderer. */}
        <div className="min-w-0 rise rise-2">
          <ChapterBlockRenderer block={heroDiagram} blockId="a2ui-loop" diagramVariant="static" />
        </div>
      </section>

      <section className="wrap border-y border-(--color-line)">
        <dl className="grid grid-cols-2 divide-(--color-line) sm:grid-cols-4 sm:divide-x">
          {[
            { value: WIDGET_NAMES.length, label: "widgets in the catalog" },
            { value: SIMULATOR_IDS.length, label: "simulators" },
            { value: PROBLEMS.length, label: "concepts" },
            { value: QUESTION_COUNT, label: "questions" },
          ].map((stat) => (
            <div key={stat.label} className="px-3 py-7 text-center">
              <dt className="sr-only">{stat.label}</dt>
              <dd>
                <span className="block text-4xl tabular-nums">{stat.value}</span>
                <span className="label mt-1 block">{stat.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="wrap space-y-8 py-16">
        <div className="max-w-(--measure-prose) space-y-3">
          <div className="label-rule">
            <span className="label">The interesting part</span>
          </div>
          <p className="text-(--color-mist)">
            Letting a model decide what appears on screen is the easy half. The half worth
            building carefully is making that safe and correct without taking away what makes it
            useful.
          </p>
        </div>
        <div className="grid gap-px border border-(--color-line) bg-(--color-line) sm:grid-cols-2">
          {GUARANTEES.map((item, i) => (
            <div
              key={item.title}
              className="flex flex-col gap-4 bg-(--color-ink) p-6 sm:flex-row sm:items-start"
            >
              <div className="flex justify-center bg-(--color-canvas) p-3 sm:w-[240px] sm:shrink-0">
                <GuaranteeFigure id={item.figure} />
              </div>
              <div className="min-w-0 space-y-2">
                <span
                  className="label tabular-nums"
                  style={{ color: `var(--color-${ACCENTS[i % ACCENTS.length]})` }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="text-lg">{item.title}</h2>
                <p className="text-sm leading-relaxed text-(--color-mist)">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="wrap space-y-6 border-t border-(--color-line) py-16">
        <div className="label-rule">
          <span className="label">The catalog</span>
        </div>
        <p className="max-w-(--measure-prose) text-(--color-mist)">
          The whole vocabulary the tutor composes from — every screen it can build is some
          arrangement of these. Adding one threads it through the tool schema, server validation
          and the renderer at once, because all three read the same definition.
        </p>
        <ul className="grid gap-px border border-(--color-line) bg-(--color-line) sm:grid-cols-2 lg:grid-cols-3">
          {WIDGET_NAMES.map((name) => (
            <li key={name} className="flex items-center gap-4 bg-(--color-ink) px-4 py-4">
              <WidgetGlyph name={name} />
              <div className="min-w-0 space-y-0.5">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="font-mono text-sm text-(--color-fg)">{name}</span>
                  {GRADED.has(name) && (
                    <span className="label text-(--color-deep)">graded</span>
                  )}
                  {WIDGET_KIND[name] === "container" && (
                    <span className="label">layout</span>
                  )}
                </p>
                <p className="text-sm text-(--color-mist)">{WIDGET_ROLE[name]}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="max-w-(--measure-prose) text-sm text-(--color-mist)">
          The three marked <span className="text-(--color-deep)">graded</span> are scored by the
          server against the answer key in the model&rsquo;s own payload, so the tutor is told
          whether you were right rather than deciding it.
        </p>
      </section>

      <section className="wrap space-y-8 border-t border-(--color-line) py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="label-rule">
              <span className="label">What it teaches</span>
            </div>
            <p className="max-w-prose text-(--color-mist)">
              {PROBLEMS.length} concepts, fundamentals first. Every one is readable without an
              account and without invoking a model at all — the generated path is the upgrade,
              not the entry fee.
            </p>
          </div>
          <Link href="/concepts" className="link text-sm">
            All {PROBLEMS.length} with descriptions
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((problem, i) => {
            const diagram = getPrimaryDiagram(problem);
            return (
              <Link
                key={problem.slug}
                href={`/concepts/${problem.slug}`}
                className="group flex flex-col border border-(--color-line) transition-colors hover:border-(--color-faint) hover:bg-(--color-surface)"
              >
                {diagram && (
                  <div className="border-b border-(--color-line) bg-(--color-canvas) px-3 py-3">
                    <DiagramThumbnail
                      diagram={diagram}
                      className="h-16 opacity-80 transition-opacity group-hover:opacity-100"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col gap-2 p-4 pt-3">
                  <span
                    className="dot"
                    style={{ ["--scoop" as string]: `var(--color-${ACCENTS[i % ACCENTS.length]})` }}
                  />
                  <span className="text-sm text-(--color-fg)">{problem.title}</span>
                  <span className="label mt-auto">{problem.estimatedMinutes} min</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
