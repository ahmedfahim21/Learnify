/**
 * A counting semaphore: at most `max` tasks run at once, the rest queue in
 * order. Used to cap Sarvam calls in flight per server instance, so many
 * students opening new lectures at once queue here instead of piling 429s and
 * retries onto Sarvam.
 */
export interface Limiter {
  run<T>(task: () => Promise<T>): Promise<T>;
  readonly active: number;
  readonly waiting: number;
}

export function createLimiter(max: number): Limiter {
  if (!Number.isInteger(max) || max < 1) throw new Error(`limiter size must be a positive integer, got ${max}`);
  let active = 0;
  const queue: (() => void)[] = [];

  const release = () => {
    active--;
    queue.shift()?.();
  };

  return {
    async run(task) {
      if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
      active++;
      try {
        return await task();
      } finally {
        release();
      }
    },
    get active() {
      return active;
    },
    get waiting() {
      return queue.length;
    },
  };
}
