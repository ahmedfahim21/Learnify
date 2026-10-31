"use client";

import { Renderer } from "@openuidev/react-lang";
import { useMemo } from "react";

import type { ViewPack } from "@/lib/lectures/view";
import { serializeStudy } from "@/lib/openui/serializeStudy";
import { studyLibrary } from "@/lib/openui/studyLibrary";

/**
 * One study tab rendered through OpenUI. Its own module so the lecture page
 * loads OpenUI and React Flow only when a study tab is opened.
 */
export default function StudyProgram({ pack, tab }: { pack: ViewPack; tab: "map" | "cards" | "recap" }) {
  const programs = useMemo(() => serializeStudy(pack), [pack]);
  return (
    <Renderer
      response={programs[tab]}
      library={studyLibrary}
      isStreaming={false}
      onError={(errors) => {
        if (errors.length) console.error(`study ${tab} render errors:`, errors);
      }}
    />
  );
}
