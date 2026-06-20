import { getDemoUserId } from "@/lib/demo";
import { getTodaySnapshot } from "@/lib/mastery/engine";
import { TodayClient } from "@/components/today/TodayClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The daily-habit surface (#43): what's due for spaced-repetition review, which
 * concepts are still weak, and the learner's streak — the reason to come back
 * that chat tools structurally lack.
 */
export default async function TodayPage() {
  const userId = await getDemoUserId();
  const snapshot = await getTodaySnapshot(userId);

  return (
    <main className="min-h-screen">
      <TodayClient snapshot={snapshot} />
    </main>
  );
}
