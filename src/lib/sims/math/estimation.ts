/**
 * Back-of-envelope capacity estimation — the arithmetic every system design
 * interview opens with, made adjustable.
 *
 * Pure and dependency-free so it can be unit-tested directly.
 */

export interface EstimationInput {
  /** Daily active users. */
  dau: number;
  /** Write actions per active user per day. */
  writesPerUserPerDay: number;
  /** Reads for every write — the shape that decides cache and replica strategy. */
  readWriteRatio: number;
  /** Average stored bytes per write. */
  bytesPerWrite: number;
  /** How many years of data are retained. */
  retentionYears: number;
  /** Peak-to-average traffic multiplier. Real traffic is never flat. */
  peakMultiplier: number;
}

export interface EstimationOutput {
  writesPerSec: number;
  readsPerSec: number;
  peakReadsPerSec: number;
  bytesPerDay: number;
  totalBytes: number;
  /** Write bandwidth in bytes/sec — what the ingest path has to absorb. */
  writeBandwidthBytesPerSec: number;
}

const SECONDS_PER_DAY = 86_400;

export function estimateCapacity(input: EstimationInput): EstimationOutput {
  const writesPerDay = input.dau * input.writesPerUserPerDay;
  const writesPerSec = writesPerDay / SECONDS_PER_DAY;
  const readsPerSec = writesPerSec * input.readWriteRatio;
  const bytesPerDay = writesPerDay * input.bytesPerWrite;

  return {
    writesPerSec,
    readsPerSec,
    peakReadsPerSec: readsPerSec * input.peakMultiplier,
    bytesPerDay,
    totalBytes: bytesPerDay * 365 * input.retentionYears,
    writeBandwidthBytesPerSec: writesPerSec * input.bytesPerWrite,
  };
}

/** Human-readable byte count — the unit is the point, so it's chosen per magnitude. */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

/** Human-readable rate, e.g. "1.2K/s". */
export function formatRate(perSec: number): string {
  if (perSec >= 1_000_000) return `${(perSec / 1_000_000).toFixed(1)}M/s`;
  if (perSec >= 1_000) return `${(perSec / 1_000).toFixed(1)}K/s`;
  if (perSec >= 10) return `${perSec.toFixed(0)}/s`;
  return `${perSec.toFixed(1)}/s`;
}
