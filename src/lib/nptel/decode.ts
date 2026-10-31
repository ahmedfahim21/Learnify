import { z } from "zod";

/**
 * Decoder for nptel.ac.in's SvelteKit `__data.json` payloads.
 *
 * Every NPTEL page has a `__data.json` twin carrying the page's load data in
 * SvelteKit's devalue encoding: one flat array where objects and arrays hold
 * *indices* into that array instead of values. The endpoint is undocumented,
 * so the decoded shape is checked with Zod and any drift fails loudly with the
 * path that broke, instead of rendering empty course pages.
 */

export class NptelFormatError extends Error {
  constructor(message: string) {
    super(`NPTEL data format changed: ${message}`);
    this.name = "NptelFormatError";
  }
}

const envelope = z.object({
  type: z.literal("data"),
  nodes: z.array(z.unknown()),
});

/** Resolve a devalue flat array into plain values. Shared refs resolve to the same object. */
export function unflatten(flat: unknown[]): unknown {
  const memo = new Map<number, unknown>();

  function hydrate(index: number): unknown {
    // devalue reserves negative indices for undefined / NaN / ±Infinity / -0.
    if (index < 0) return undefined;
    if (memo.has(index)) return memo.get(index);
    const value = flat[index];

    if (Array.isArray(value)) {
      // A string head marks a devalue custom type (Date, Map, Set, …). NPTEL
      // doesn't send any today; if it starts to, decode them properly then.
      if (typeof value[0] === "string") {
        throw new NptelFormatError(`unsupported devalue type "${value[0]}" at index ${index}`);
      }
      const out: unknown[] = [];
      memo.set(index, out);
      for (const i of value as number[]) out.push(hydrate(i));
      return out;
    }
    if (value !== null && typeof value === "object") {
      const out: Record<string, unknown> = {};
      memo.set(index, out);
      for (const [key, i] of Object.entries(value as Record<string, number>)) {
        out[key] = hydrate(i);
      }
      return out;
    }
    memo.set(index, value);
    return value;
  }

  return hydrate(0);
}

/** Pull the first `data` node out of a `__data.json` body and hydrate it. */
export function decodeDataJson(body: unknown): unknown {
  const parsed = envelope.safeParse(body);
  if (!parsed.success) throw new NptelFormatError("missing { type: 'data', nodes }");
  const node = parsed.data.nodes.find(
    (n): n is { type: "data"; data: unknown[] } =>
      typeof n === "object" && n !== null && (n as { type?: unknown }).type === "data",
  );
  if (!node || !Array.isArray(node.data)) throw new NptelFormatError("no data node");
  return unflatten(node.data);
}

function check<T>(schema: z.ZodType<T>, value: unknown, what: string): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new NptelFormatError(`${what}: ${issue.path.join(".") || "(root)"} ${issue.message}`);
  }
  return result.data;
}

// --- Course list: nptel.ac.in/courses/__data.json ---------------------------

const courseListSchema = z.object({
  courses: z.array(
    z.object({
      id: z.number().int(),
      title: z.string(),
      professor: z.string(),
      instituteName: z.string(),
      contentType: z.string(),
      disciplineId: z.number().int(),
    }),
  ),
  disciplines: z.array(z.object({ id: z.string(), name: z.string() })),
});

export type NptelCourseList = z.infer<typeof courseListSchema>;
export type NptelCourse = NptelCourseList["courses"][number];

export function decodeCourseList(body: unknown): NptelCourseList {
  return check(courseListSchema, decodeDataJson(body), "course list");
}

// --- Course outline: nptel.ac.in/courses/{id}/__data.json -------------------

/** Language name → Google Drive file id (null when NPTEL has no track). */
const vttMap = z.record(z.string(), z.string().nullable());

const outlineSchema = z.object({
  courseOutline: z.object({
    title: z.string(),
    professor: z.string(),
    instituteName: z.string(),
    contentType: z.string(),
    units: z.array(
      z.object({
        id: z.number().int(),
        name: z.string(),
        lessons: z
          .array(
            z.object({
              id: z.number().int(),
              name: z.string(),
              youtube_id: z.string().nullable().optional(),
              concepts_covered: z.string().nullable().optional(),
              vtt_url: vttMap.nullable().optional(),
            }),
          )
          .nullable()
          .optional(),
      }),
    ),
  }),
});

export interface NptelLesson {
  /** NPTEL's lesson id — course-wide ordinal. */
  id: number;
  unitName: string;
  title: string;
  youtubeId: string | null;
  conceptsCovered: string | null;
  /** Language name ("English", "Tamil", …) → Drive file id, only tracks that exist. */
  vttIds: Record<string, string>;
}

export interface NptelOutline {
  title: string;
  professor: string;
  instituteName: string;
  contentType: string;
  lessons: NptelLesson[];
}

const YOUTUBE_ID = /^[\w-]{11}$/;

export function decodeCourseOutline(body: unknown): NptelOutline {
  const { courseOutline: o } = check(outlineSchema, decodeDataJson(body), "course outline");
  const lessons: NptelLesson[] = [];
  for (const unit of o.units) {
    for (const lesson of unit.lessons ?? []) {
      const vttIds: Record<string, string> = {};
      for (const [lang, id] of Object.entries(lesson.vtt_url ?? {})) {
        if (id) vttIds[lang] = id;
      }
      const yt = lesson.youtube_id?.trim() ?? "";
      lessons.push({
        id: lesson.id,
        unitName: unit.name,
        title: lesson.name.trim(),
        youtubeId: YOUTUBE_ID.test(yt) ? yt : null,
        conceptsCovered: lesson.concepts_covered?.trim() || null,
        vttIds,
      });
    }
  }
  return {
    title: o.title,
    professor: o.professor,
    instituteName: o.instituteName,
    contentType: o.contentType,
    lessons,
  };
}
