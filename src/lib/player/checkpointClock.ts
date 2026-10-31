/**
 * When should a check pop up? Only when the video plays through its moment.
 *
 * The player is sampled every ~250 ms. Between two samples, playback moved
 * from `prev` to `now`. A check at `atSec` fires when `prev < atSec <= now`
 * and the move looks like playing, not seeking: forward, and no further than
 * the playback rate could cover in the gap (plus slack for a stalled sampler).
 * Jumping past a check never fires it, and nothing fires for a moment after
 * the player's own replay seek, so a replay that ends at the check doesn't
 * re-trigger it on the way.
 */

export interface ClockSample {
  prevSec: number;
  nowSec: number;
  /** Wall-clock ms between the two samples. */
  elapsedMs: number;
  playbackRate: number;
  playing: boolean;
  /** Wall-clock ms since the player last seeked on its own. */
  msSinceOwnSeek: number;
}

export interface ClockCheck {
  id: string;
  atSec: number;
}

const SLACK_SEC = 0.75;
const QUIET_AFTER_OWN_SEEK_MS = 1000;

export function isNaturalPlayback(s: ClockSample): boolean {
  if (!s.playing) return false;
  const moved = s.nowSec - s.prevSec;
  if (moved <= 0) return false;
  const couldCover = (s.elapsedMs / 1000) * s.playbackRate + SLACK_SEC;
  return moved <= couldCover;
}

/** The first not-yet-done check this sample crosses, or null. */
export function dueCheckpoint(sample: ClockSample, checks: readonly ClockCheck[], done: ReadonlySet<string>): ClockCheck | null {
  if (sample.msSinceOwnSeek < QUIET_AFTER_OWN_SEEK_MS) return null;
  if (!isNaturalPlayback(sample)) return null;
  let first: ClockCheck | null = null;
  for (const c of checks) {
    if (done.has(c.id)) continue;
    if (c.atSec > sample.prevSec && c.atSec <= sample.nowSec && (!first || c.atSec < first.atSec)) first = c;
  }
  return first;
}

/** Whether a replay has played through to its end (same natural-playback rule). */
export function replayFinished(sample: ClockSample, replayTo: number): boolean {
  return sample.prevSec < replayTo && sample.nowSec >= replayTo && isNaturalPlayback(sample);
}
