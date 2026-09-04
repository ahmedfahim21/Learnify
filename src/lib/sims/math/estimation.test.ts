import { describe, expect, it } from "vitest";

import { estimateCapacity, formatBytes, formatRate } from "./estimation";

const base = {
  dau: 1_000_000,
  writesPerUserPerDay: 2,
  readWriteRatio: 100,
  bytesPerWrite: 1_000,
  retentionYears: 5,
  peakMultiplier: 3,
};

describe("estimateCapacity", () => {
  it("derives writes/sec from daily volume over a full day", () => {
    // 1M users x 2 writes = 2M writes/day over 86,400 seconds.
    expect(estimateCapacity(base).writesPerSec).toBeCloseTo(2_000_000 / 86_400, 6);
  });

  it("scales reads by the read:write ratio", () => {
    const out = estimateCapacity(base);
    expect(out.readsPerSec).toBeCloseTo(out.writesPerSec * 100, 6);
  });

  it("applies the peak multiplier to reads only", () => {
    const out = estimateCapacity(base);
    expect(out.peakReadsPerSec).toBeCloseTo(out.readsPerSec * 3, 6);
  });

  it("compounds storage across the retention window", () => {
    const out = estimateCapacity(base);
    expect(out.bytesPerDay).toBe(2_000_000 * 1_000);
    expect(out.totalBytes).toBe(out.bytesPerDay * 365 * 5);
  });

  it("scales linearly with DAU", () => {
    const single = estimateCapacity(base);
    const double = estimateCapacity({ ...base, dau: base.dau * 2 });
    expect(double.writesPerSec).toBeCloseTo(single.writesPerSec * 2, 6);
    expect(double.totalBytes).toBe(single.totalBytes * 2);
  });

  it("ties write bandwidth to payload size, not user count alone", () => {
    const out = estimateCapacity({ ...base, bytesPerWrite: 2_000 });
    expect(out.writeBandwidthBytesPerSec).toBeCloseTo(out.writesPerSec * 2_000, 6);
  });
});

describe("formatBytes", () => {
  it.each([
    [512, "512 B"],
    [1024, "1.0 KB"],
    [1024 ** 3, "1.0 GB"],
    [1024 ** 5, "1.0 PB"],
  ])("formats %i as %s", (input, expected) => {
    expect(formatBytes(input)).toBe(expected);
  });

  it("caps at the largest unit rather than inventing one", () => {
    expect(formatBytes(1024 ** 7)).toContain("EB");
  });
});

describe("formatRate", () => {
  it.each([
    [2.5, "2.5/s"],
    [250, "250/s"],
    [2_500, "2.5K/s"],
    [2_500_000, "2.5M/s"],
  ])("formats %f as %s", (input, expected) => {
    expect(formatRate(input)).toBe(expected);
  });
});
