/**
 * Sarvam spike: does sarvam-105b hold up for subtitles, study packs and
 * OpenUI doubt answers on real NPTEL lectures?
 *
 *   OPENUI_TELEMETRY_DISABLED=1 npx tsx --env-file=.env scripts/spike.ts
 *
 * Writes spike-output/report.md plus raw JSON per lecture. Gates (from the
 * plan): ≥90% of doubt answers pass OpenUI validation, and ≥27/30 MCQ answer
 * keys are correct on hand grading (the report lists them for grading).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { doubtMessages } from "@/lib/doubts/prompt";
import { LANGUAGES, type Lang } from "@/lib/languages";
import { fetchCourseOutline } from "@/lib/nptel/client";
import { doubtLibrary } from "@/lib/openui/doubtLibrary";
import { checkOpenUi } from "@/lib/openui/validate";
import { chat, chatJson, chatStream } from "@/lib/sarvam/client";
import { translateSegments, type TranslatorName } from "@/lib/sarvam/translateSegments";
import { generateStudyPack } from "@/lib/study/generate";
import type { StudyPack } from "@/lib/study/pack";
import { fetchNptelVtt } from "@/lib/transcripts/nptelVtt";
import { mergeCues, segmentsBetween, type Segment } from "@/lib/transcripts/merge";
import { parseVtt } from "@/lib/transcripts/vtt";

const OUT = join(process.cwd(), "spike-output");
const TRANSLATE_SAMPLE = 30;
const DOUBTS_PER_LECTURE = 10;

const LECTURES: { courseId: number; lessonIndex: number; lang: Lang }[] = [
  { courseId: 106106127, lessonIndex: 0, lang: "ta" }, // PDSA in C — human Tamil exists
  { courseId: 111106146, lessonIndex: 0, lang: "hi" }, // Basic Calculus — English only
  { courseId: 106105166, lessonIndex: 0, lang: "kn" }, // Intro to IoT — human Kannada exists
];

const ms = async <T>(fn: () => Promise<T>): Promise<[T, number]> => {
  const t = Date.now();
  const v = await fn();
  return [v, Date.now() - t];
};

async function loadTrack(ref: string): Promise<Segment[]> {
  return mergeCues(parseVtt(await fetchNptelVtt(ref)));
}

/** Ask the model to play a student and write realistic code-mixed doubts at spread-out moments. */
async function makeDoubts(title: string, lang: Lang, english: Segment[]) {
  const duration = english.at(-1)!.endSec;
  const moments = Array.from({ length: DOUBTS_PER_LECTURE }, (_, n) =>
    Math.round(((n + 1) / (DOUBTS_PER_LECTURE + 1)) * duration),
  );
  const windows = moments
    .map((at) => {
      const text = segmentsBetween(english, at - 60, at)
        .map((s) => s.text)
        .join(" ");
      return `MOMENT ${at}s: ${text}`;
    })
    .join("\n\n");
  const { value } = await chatJson<{ doubts: { atSec: number; question: string }[] }>({
    messages: [
      {
        role: "system",
        content: `You play first-year engineering students watching the lecture "${title}". For each MOMENT, write one genuine doubt a student might ask right there, in ${LANGUAGES[lang].name} as students actually type it (code-mixed: English technical terms in Latin script). Keep each under 20 words. Return atSec exactly as given.`,
      },
      { role: "user", content: windows },
    ],
    jsonSchema: {
      name: "doubts",
      schema: {
        type: "object",
        properties: {
          doubts: {
            type: "array",
            items: {
              type: "object",
              properties: { atSec: { type: "number" }, question: { type: "string" } },
              required: ["atSec", "question"],
              additionalProperties: false,
            },
          },
        },
        required: ["doubts"],
        additionalProperties: false,
      },
    },
    model: "sarvam-105b-conversations",
  });
  return value.doubts;
}

async function main() {
  if (!process.env.SARVAM_API_KEY) {
    throw new Error("SARVAM_API_KEY is not set. Add it to .env, then rerun with --env-file=.env.");
  }
  mkdirSync(OUT, { recursive: true });
  const report: string[] = ["# Sarvam spike report", "", `Run: ${new Date().toISOString()}`, ""];
  let doubtsTotal = 0;
  let doubtsValid = 0;
  const mcqs: string[] = [];

  for (const { courseId, lessonIndex, lang } of LECTURES) {
    const outline = await fetchCourseOutline(courseId);
    // Drive links rot (Basic Calculus L1's English VTT 404s); record it and try the next lesson.
    let lesson = outline.lessons[lessonIndex];
    let english: Segment[] | null = null;
    for (const candidate of outline.lessons.slice(lessonIndex, lessonIndex + 3)) {
      const enId = candidate.vttIds.English;
      if (!enId) {
        report.push(`- ${courseId}/${candidate.id} "${candidate.title}": no English VTT listed`);
        continue;
      }
      try {
        english = await loadTrack(enId);
        lesson = candidate;
        break;
      } catch (err) {
        report.push(`- ${courseId}/${candidate.id} "${candidate.title}": ${(err as Error).message}`);
        console.error(`  ${candidate.title}: ${(err as Error).message}`);
      }
    }
    if (!english) {
      report.push(`- ${courseId}: no usable English transcript in the first 3 lessons; skipped`, "");
      continue;
    }
    const humanId = lesson.vttIds[LANGUAGES[lang].nptelName];
    let human: Segment[] | null = null;
    if (humanId) {
      try {
        human = await loadTrack(humanId);
      } catch (err) {
        report.push(`- human ${LANGUAGES[lang].name} track failed: ${(err as Error).message}`);
      }
    }
    const tag = `${courseId}-${lesson.id}-${lang}`;
    console.log(`\n▶ ${outline.title} — ${lesson.title} (${english.length} segments, ${lang})`);

    report.push(
      `## ${outline.title}: ${lesson.title}`,
      "",
      `youtube ${lesson.youtubeId} · ${english.length} English segments · ${Math.round(english.at(-1)!.endSec / 60)} min · target ${LANGUAGES[lang].name} · human track: ${human ? "yes" : "no"}`,
      "",
    );

    // 1. Translation A/B on a sample.
    const sample = english.slice(0, TRANSLATE_SAMPLE);
    const translations: Record<TranslatorName, Segment[]> = { hybrid: [], sarvam105b: [], mayura: [] };
    for (const translator of ["sarvam105b", "mayura"] as const) {
      try {
        const [out, t] = await ms(() => translateSegments(sample, lang, { translator }));
        translations[translator] = out;
        report.push(`- ${translator}: ${sample.length} segments in ${(t / 1000).toFixed(1)}s`);
        console.log(`  translate ${translator}: ${(t / 1000).toFixed(1)}s`);
      } catch (err) {
        report.push(`- ${translator}: **failed**: ${(err as Error).message}`);
        console.error(`  translate ${translator} failed:`, err);
      }
    }
    report.push("", "| t | English | 105b-conversations | Mayura code-mixed |", "|---|---|---|---|");
    for (const s of sample.slice(0, 8)) {
      const cell = (x?: string) => (x ?? "—").replace(/\|/g, "\\|");
      report.push(
        `| ${Math.round(s.startSec)}s | ${cell(s.text)} | ${cell(translations.sarvam105b[s.i]?.text)} | ${cell(translations.mayura[s.i]?.text)} |`,
      );
    }
    if (human) {
      report.push("", `Human NPTEL ${LANGUAGES[lang].name} for the same opening:`, "");
      for (const s of segmentsBetween(human, 0, sample[7]?.endSec ?? 60)) {
        report.push(`> [${Math.round(s.startSec)}s] ${s.text}`);
      }
    }
    report.push("");

    // 2. Study pack.
    let pack: StudyPack | null = null;
    try {
      const [res, t] = await ms(() => generateStudyPack(lesson.title, english));
      pack = res.pack;
      writeFileSync(join(OUT, `${tag}-pack.json`), JSON.stringify(res, null, 2));
      report.push(
        `Study pack: valid after ${res.attempts} attempt(s) in ${(t / 1000).toFixed(1)}s · ${pack.concepts.length} concepts, ${pack.checkpoints.length} checks, ${pack.flashcards.length} flashcards · tokens ${JSON.stringify(res.usage)}`,
        "",
      );
      console.log(`  pack: ${res.attempts} attempt(s), ${(t / 1000).toFixed(1)}s`);
      for (const cp of pack.checkpoints) {
        const ctxText = segmentsBetween(english, cp.replayFrom, cp.replayTo)
          .map((s) => s.text)
          .join(" ")
          .slice(0, 600);
        mcqs.push(
          `### ${tag} ${cp.id} @ ${Math.round(cp.atSec)}s`,
          "",
          `Q: ${cp.question}`,
          "",
          ...cp.options.map((o, n) => `${n === cp.answerIndex ? "- **[key]**" : "-"} ${o}`),
          "",
          `Replay ${Math.round(cp.replayFrom)}–${Math.round(cp.replayTo)}s says: ${ctxText}`,
          "",
          "Grade: [ ] key correct  [ ] answerable from replay",
          "",
        );
      }
    } catch (err) {
      report.push(`Study pack: **failed**: ${(err as Error).message}`, "");
      console.error("  pack failed:", err);
    }

    // 3. Doubts → OpenUI Lang.
    const doubts = await makeDoubts(lesson.title, lang, english);
    const concepts = pack?.concepts ?? [];
    const results: unknown[] = [];
    report.push("| at | doubt | valid | problems |", "|---|---|---|---|");
    for (const [n, d] of doubts.entries()) {
      const messages = doubtMessages(
        { lectureTitle: lesson.title, lang, atSec: d.atSec, question: d.question, english, concepts },
        doubtLibrary,
      );
      let text = "";
      let t: number;
      // The first doubt per lecture goes through the stream path to prove SSE parsing.
      if (n === 0) {
        [, t] = await ms(async () => {
          for await (const delta of chatStream({ messages, model: "sarvam-105b-conversations", maxTokens: 2048 })) text += delta;
        });
      } else {
        const [res, took] = await ms(() => chat({ messages, model: "sarvam-105b-conversations", maxTokens: 2048 }));
        text = res.content;
        t = took;
      }
      const check = checkOpenUi(text.trim(), doubtLibrary);
      doubtsTotal++;
      if (check.ok) doubtsValid++;
      results.push({ ...d, ms: t, streamed: n === 0, ok: check.ok, problems: check.problems, openui: text });
      report.push(
        `| ${Math.round(d.atSec)}s | ${d.question.replace(/\|/g, "\\|")} | ${check.ok ? "yes" : "**no**"} | ${check.problems.join("; ").replace(/\|/g, "\\|")} |`,
      );
      console.log(`  doubt ${n + 1}/${doubts.length}: ${check.ok ? "ok" : "INVALID"} (${t}ms)`);
    }
    writeFileSync(join(OUT, `${tag}-doubts.json`), JSON.stringify(results, null, 2));
    report.push("");
  }

  const rate = doubtsTotal ? doubtsValid / doubtsTotal : 0;
  report.splice(
    4,
    0,
    "## Gates",
    "",
    `- OpenUI doubt answers valid: ${doubtsValid}/${doubtsTotal} (${(rate * 100).toFixed(0)}%) — gate ≥ 90%: **${rate >= 0.9 ? "PASS" : "FAIL"}**`,
    `- MCQ answer keys: ${mcqs.filter((l) => l.startsWith("### ")).length} to hand-grade below — gate ≥ 90% correct`,
    "",
  );
  report.push("## MCQs to grade", "", ...mcqs);
  writeFileSync(join(OUT, "report.md"), report.join("\n"));
  console.log(`\nOpenUI valid ${doubtsValid}/${doubtsTotal}. Report: spike-output/report.md`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
