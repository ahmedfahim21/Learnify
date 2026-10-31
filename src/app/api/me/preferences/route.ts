import { preferencesSchema, type Preferences } from "@/lib/preferences";
import { dbPreferences } from "@/lib/preferencesStore";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** The caller's learning preferences: 200 with them, or 404 before they've chosen any. */
export async function GET(): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const prefs = await dbPreferences.get(userId);
  if (!prefs) return Response.json({ error: "No preferences yet." }, { status: 404 });
  return Response.json(prefs);
}

/** Replace the caller's preferences. All four fields, every time. */
export async function PUT(request: Request): Promise<Response> {
  const { userId, response } = await requireUserId();
  if (response) return response;
  const body: unknown = await request.json().catch(() => null);
  const parsed = preferencesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") }, { status: 400 });
  }
  return Response.json(await dbPreferences.put(userId, parsed.data as Preferences));
}
