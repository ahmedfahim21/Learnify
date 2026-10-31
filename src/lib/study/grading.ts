import type { StudyPack } from "./pack";

/**
 * Checks are graded on the server: the browser gets a pack without answer
 * keys or explanations, and asks /api/checkpoints/answer whether a choice is
 * right. The explanation is released when the answer is right, or after the
 * second try, matching the player's flow (wrong once → replay → ask again).
 */

export type PublicCheckpoint = Omit<StudyPack["checkpoints"][number], "answerIndex" | "explanation">;
export type PublicPack = Omit<StudyPack, "checkpoints"> & { checkpoints: PublicCheckpoint[] };

export function publicPack(pack: StudyPack): PublicPack {
  return {
    ...pack,
    checkpoints: pack.checkpoints.map((cp) => ({
      id: cp.id,
      atSec: cp.atSec,
      conceptId: cp.conceptId,
      question: cp.question,
      options: cp.options,
      replayFrom: cp.replayFrom,
      replayTo: cp.replayTo,
    })),
  };
}

export interface Grade {
  correct: boolean;
  /** Where to replay from and to before asking again; sent for every answer. */
  replayFrom: number;
  replayTo: number;
  /** Only once it's been earned: a right answer, or a second wrong one. */
  explanation: string | null;
  /** Revealed only after the second try, so a first guess can't be brute-forced. */
  answerIndex: number | null;
}

export function grade(pack: StudyPack, checkpointId: string, choice: number, attempt: number): Grade | null {
  const cp = pack.checkpoints.find((c) => c.id === checkpointId);
  if (!cp) return null;
  const correct = choice === cp.answerIndex;
  const reveal = correct || attempt >= 2;
  return {
    correct,
    replayFrom: cp.replayFrom,
    replayTo: cp.replayTo,
    explanation: reveal ? cp.explanation : null,
    answerIndex: attempt >= 2 ? cp.answerIndex : null,
  };
}
