export type Limiter = <T>(task: () => Promise<T>) => Promise<T>;

/** Runs at most `max` tasks at once, across every caller sharing the limiter. */
export function createLimiter(max: number): Limiter {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (active >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      waiting.shift()?.();
    }
  };
}

/** Wraps `fn` so concurrent calls share one in-flight run instead of each starting their own. */
export function shareInFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let running: Promise<T> | null = null;
  return () => (running ??= fn().finally(() => (running = null)));
}
