/**
 * M/M/1 and M/M/c (Erlang-C) queueing: utilisation, expected queue length, and
 * expected wait, from closed-form formulas. Backs the `queue-backpressure`
 * simulator's "rho=0.9 is 10x the rho=0.5 latency; Little's law L = lambda*W"
 * observation.
 */

export interface QueueingInput {
  /** Arrival rate, requests/sec. */
  arrivalRate: number;
  /** Per-worker service rate, requests/sec. */
  serviceRate: number;
  /** Number of parallel workers (servers). */
  workers: number;
}

export interface QueueingOutput {
  /** Utilisation per worker, 0..1 (clamped just under 1 to avoid a divide-by-zero blowup). */
  utilization: number;
  /** Expected number of requests in the system (queued + being served). */
  meanNumberInSystem: number;
  /** Expected wait in the system, seconds (Little's law: L = lambda * W). */
  meanWaitSec: number;
  /** True when arrival rate exceeds total service capacity — the system is unstable. */
  unstable: boolean;
}

/** Erlang C: probability an arriving request must wait for a free worker. */
function erlangC(offeredLoad: number, workers: number): number {
  // offeredLoad = arrivalRate / serviceRate (in "Erlangs").
  let sum = 0;
  let term = 1;
  for (let k = 0; k < workers; k++) {
    if (k > 0) term *= offeredLoad / k;
    sum += term;
  }
  const lastTerm = (term * offeredLoad) / workers;
  const denominator = sum * (1 - offeredLoad / workers) + lastTerm;
  return denominator > 0 ? lastTerm / denominator : 0;
}

export function simulateQueueing(input: QueueingInput): QueueingOutput {
  const workers = Math.max(1, Math.round(input.workers));
  const serviceRate = Math.max(1e-9, input.serviceRate);
  const arrivalRate = Math.max(0, input.arrivalRate);
  const offeredLoad = arrivalRate / serviceRate; // Erlangs
  const utilizationRaw = offeredLoad / workers;
  const unstable = utilizationRaw >= 1;
  // Clamp just under 1 so the formulas stay finite; `unstable` carries the truth.
  const utilization = Math.min(0.999, utilizationRaw);

  if (workers === 1) {
    // M/M/1 closed forms.
    const meanNumberInSystem = utilization / (1 - utilization);
    const meanWaitSec = meanNumberInSystem / arrivalRate || 0;
    return { utilization, meanNumberInSystem, meanWaitSec, unstable };
  }

  const pWait = erlangC(offeredLoad, workers);
  const meanWaitQueue = pWait / (workers * serviceRate - arrivalRate);
  const meanWaitSec = meanWaitQueue + 1 / serviceRate;
  const meanNumberInSystem = arrivalRate * meanWaitSec; // Little's law
  return { utilization, meanNumberInSystem, meanWaitSec, unstable };
}
