/**
 * Serving the same asset from origin versus from a nearby edge.
 *
 * Distance is the part of latency you cannot optimise away in software: light
 * in fibre covers roughly 200 km per millisecond, and a request is a round
 * trip. An edge does not make the network faster — it makes the distance
 * shorter, which is why a CDN is a placement decision rather than a caching
 * one.
 */

/** Rough one-way distance from a single origin, in kilometres. */
export const REGIONS = [
  { id: "same-city", label: "Same city", km: 25 },
  { id: "same-country", label: "Same country", km: 800 },
  { id: "same-continent", label: "Same continent", km: 3000 },
  { id: "cross-ocean", label: "Cross-ocean", km: 9000 },
  { id: "antipodal", label: "Other side of the world", km: 17000 },
] as const;

/** Signal speed in fibre: about two-thirds of c, so ~200 km per ms. */
const KM_PER_MS = 200;

export interface CdnInput {
  /** Fraction of requests an edge can serve without going to origin, 0–1. */
  edgeHitRatio: number;
  /** Distance from the viewer to the nearest edge, in km. */
  edgeKm: number;
  /** Distance from the viewer to origin, in km. */
  originKm: number;
  /** Server-side time to produce the response, in milliseconds. */
  serverMs: number;
  /** Requests per second across all viewers. */
  requestsPerSec: number;
  /** Bytes per response. */
  bytesPerResponse: number;
}

export interface CdnOutput {
  edgeRoundTripMs: number;
  originRoundTripMs: number;
  /** Blended latency across hits and misses. */
  effectiveMs: number;
  /** What the same traffic would cost with no edge at all. */
  originOnlyMs: number;
  /** Requests per second still reaching origin. */
  originRequestsPerSec: number;
  /** Origin egress in bytes/sec, the number a CDN actually reduces. */
  originBytesPerSec: number;
  /** Fraction of origin egress removed by the edge. */
  egressSaved: number;
}

/** A round trip is out and back, plus the time to produce the response. */
function roundTripMs(km: number, serverMs: number): number {
  return (km / KM_PER_MS) * 2 + serverMs;
}

export function simulateCdn(input: CdnInput): CdnOutput {
  const hit = Math.min(1, Math.max(0, input.edgeHitRatio));
  const edgeRoundTripMs = roundTripMs(input.edgeKm, input.serverMs);
  // A miss pays the trip to the edge and then onward to origin.
  const originRoundTripMs = roundTripMs(input.originKm, input.serverMs);

  const effectiveMs = hit * edgeRoundTripMs + (1 - hit) * originRoundTripMs;
  const originRequestsPerSec = input.requestsPerSec * (1 - hit);

  return {
    edgeRoundTripMs,
    originRoundTripMs,
    effectiveMs,
    originOnlyMs: originRoundTripMs,
    originRequestsPerSec,
    originBytesPerSec: originRequestsPerSec * input.bytesPerResponse,
    egressSaved: hit,
  };
}
