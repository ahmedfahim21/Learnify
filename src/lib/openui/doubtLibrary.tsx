"use client";

import { createLibrary, defineComponent } from "@openuidev/react-lang";

import { AnswerSpec } from "./doubtSpec";
import { Callout, Compare, Formula, Paragraph, Steps, TimeChip } from "./parts";
import { Example, KeyIdea, Mcq, Reveal, TrueFalse } from "./screenLibrary";

export { type LectureClock, LectureClockContext } from "./contexts";

/**
 * The browser's doubt library: React components for the specs in
 * ./doubtSpec, which is also what the server prompts and validates against,
 * so the two can't drift apart. Rendered with `<Renderer library={doubtLibrary} />`.
 * Beyond prose it can lead with a key idea, work an example, compare things
 * side by side, and end with a flip card or a one-question check, reusing the
 * study screens' components.
 */

export const Answer = defineComponent({
  name: AnswerSpec.name,
  description: AnswerSpec.description,
  props: AnswerSpec.props,
  component: ({ props, renderNode }) => (
    <article className="space-y-3">
      <h3 className="text-lg">{props.title}</h3>
      {renderNode(props.parts)}
    </article>
  ),
});

export const doubtLibrary = createLibrary({
  root: "Answer",
  // Same order as DOUBT_SPECS, so the model's prompt matches the server's.
  components: [Answer, Paragraph, KeyIdea, Steps, Formula, Example, Compare, Reveal, Mcq, TrueFalse, TimeChip, Callout],
});
