"use client";

import type { ChapterBlock } from "@/content/systemDesign/types";
import type { ComponentDef } from "@/lib/a2ui/messages";

import { Markdown } from "../classroom/Markdown";
import { SystemDiagram, type DiagramVariant } from "../classroom/diagram/SystemDiagram";
import { SimulatorWidget } from "../classroom/simulators/SimulatorWidget";
import { ChapterQuiz } from "./ChapterQuiz";

/** No-op action channel: the course reader is static content, not a live A2UI
 *  surface — a diagram's step player still works (that's local state), but
 *  node clicks have nothing to report back to, so those buttons render
 *  disabled (`interactive: false`) rather than pretending to do something. */
const noopContext = {
  surfaceId: "course-reader",
  resolve: () => undefined,
  onAction: () => {},
  interactive: false,
};

const CALLOUT_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  note: { border: "border-sky-400/25", bg: "bg-sky-400/[0.06]", label: "Note" },
  tradeoff: { border: "border-purple-400/25", bg: "bg-purple-400/[0.06]", label: "Trade-off" },
  pitfall: { border: "border-rose-400/25", bg: "bg-rose-400/[0.06]", label: "Pitfall" },
};

export function ChapterBlockRenderer({
  block,
  blockId,
  diagramVariant,
}: {
  block: ChapterBlock;
  blockId: string;
  /** "static" fixes the diagram's camera — see SystemDiagram. */
  diagramVariant?: DiagramVariant;
}) {
  switch (block.type) {
    case "prose":
      return (
        <div className="max-w-(--measure-prose) space-y-2">
          {/* Hierarchy from size and colour, not weight — house style. */}
          {block.heading && <h3 className="text-xl text-(--color-fg)">{block.heading}</h3>}
          <div className="prose">
            <Markdown text={block.body} />
          </div>
        </div>
      );

    case "diagram": {
      const def: ComponentDef = {
        id: blockId,
        component: "SystemDiagram",
        properties: block.diagram as unknown as Record<string, unknown>,
      };
      return <SystemDiagram def={def} ctx={noopContext} variant={diagramVariant} />;
    }

    case "simulator": {
      const def: ComponentDef = {
        id: blockId,
        component: "Simulator",
        properties: {
          simulatorId: block.simulatorId,
          title: block.title,
          intro: block.intro,
          notice: block.notice,
          params: block.params,
        },
      };
      return <SimulatorWidget def={def} />;
    }

    case "callout": {
      const style = CALLOUT_STYLES[block.tone];
      return (
        <div
          className={`max-w-(--measure-prose) space-y-1 border ${style.border} ${style.bg} p-4`}
        >
          <p className="label">{style.label}</p>
          <div className="prose text-[0.98rem]">
            <Markdown text={block.body} />
          </div>
        </div>
      );
    }

    case "quiz":
      return (
        <ChapterQuiz
          question={block.question}
          options={block.options}
          correctOptionId={block.correctOptionId}
          explanation={block.explanation}
        />
      );

    default:
      return null;
  }
}
