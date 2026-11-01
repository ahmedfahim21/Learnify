import { consumeDoubt } from "@/lib/budget";
import { parseLectureRequest } from "@/lib/lectures/view";
import { generateScreen, getScreen, prepareScreen, ScreenNotReadyError } from "@/lib/screens/generate";
import type { ScreenKind, ScreenVariant } from "@/lib/screens/prompt";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
// Writing, checking a quiz's answers and translating can together pass two minutes.
export const maxDuration = 300;

const KINDS: ScreenKind[] = ["notes", "quiz"];
const VARIANTS: ScreenVariant[] = ["standard", "simpler", "harder"];

type RouteContext = { params: Promise<{ lectureId: string; kind: string }> };

async function parse(request: Request, context: RouteContext) {
  const { lectureId, kind } = await context.params;
  const url = new URL(request.url);
  const base = parseLectureRequest(lectureId, url.searchParams.get("lang"));
  if (base instanceof Response) return base;
  if (!KINDS.includes(kind as ScreenKind)) return Response.json({ error: `Unknown screen "${kind}".` }, { status: 404 });
  const variant = url.searchParams.get("variant") ?? "standard";
  if (!VARIANTS.includes(variant as ScreenVariant)) return Response.json({ error: `Unknown style "${variant}".` }, { status: 400 });
  return { ...base, kind: kind as ScreenKind, variant: variant as ScreenVariant };
}

/** A generated study screen, if one exists. Public: screens are shared by everyone. */
export async function GET(request: Request, context: RouteContext): Promise<Response> {
  const parsed = await parse(request, context);
  if (parsed instanceof Response) return parsed;
  const row = await getScreen(parsed.lectureId, parsed.lang, parsed.kind, parsed.variant);
  if (!row) return Response.json({ error: "Not generated yet." }, { status: 404 });
  return Response.json(
    { screenId: row.id, program: row.program, createdAt: row.createdAt },
    // max-age=0: a rewritten screen must show on the next open; the edge may serve it a minute stale.
    { headers: { "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=600" } },
  );
}

/**
 * Generate (or regenerate) a study screen, streamed as NDJSON events. Uses one
 * of the student's daily AI generations (shared with doubts), refunded if it
 * fails. The result replaces the shared screen for that language and style.
 */
export async function POST(request: Request, context: RouteContext): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const parsed = await parse(request, context);
  if (parsed instanceof Response) return parsed;

  let messages;
  try {
    messages = await prepareScreen(parsed);
  } catch (err) {
    if (err instanceof ScreenNotReadyError) return Response.json({ error: err.message }, { status: 409 });
    throw err;
  }

  const { allowed, state } = await consumeDoubt(userId);
  if (!allowed) {
    return Response.json(
      { error: `You've used all ${state.limit} AI generations for today. They reset at midnight UTC.`, budget: state },
      { status: 429 },
    );
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for await (const event of generateScreen({ userId, ...parsed }, messages)) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }
      controller.close();
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-generations-remaining": String(state.remaining) },
  });
}
