/**
 * How much of a course can be studied, as a sort key: 0 when at least 90% of
 * its lectures have a video and English captions, 2 when under half do
 * ("mostly video only"), 1 otherwise or while it's unknown. Shared by the
 * catalogue query and the course card, so it imports nothing server-side.
 */
export type CoverageTier = 0 | 1 | 2;
export const STUDYABLE_SHARE = 0.9;
export const VIDEO_ONLY_SHARE = 0.5;

export function coverageTier(captionShare: number | null): CoverageTier {
  if (captionShare === null) return 1;
  return captionShare >= STUDYABLE_SHARE ? 0 : captionShare < VIDEO_ONLY_SHARE ? 2 : 1;
}
