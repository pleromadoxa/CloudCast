/** Limit parallel async work — keeps many simultaneous mesh handshakes stable. */
export function createConcurrencyQueue(maxConcurrent: number) {
  let active = 0;
  const pending: Array<() => void> = [];

  const pump = () => {
    while (active < maxConcurrent && pending.length > 0) {
      pending.shift()?.();
    }
  };

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        task()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            pump();
          });
      };

      if (active < maxConcurrent) run();
      else pending.push(run);
    });
  };
}

/** Serialize async steps per key (e.g. ICE for one peer). */
export function createKeyedChain() {
  const chains = new Map<string, Promise<void>>();

  return function runKeyed(key: string, task: () => Promise<void>): Promise<void> {
    const prev = chains.get(key) ?? Promise.resolve();
    const next = prev
      .then(task)
      .catch(() => {
        /* logged by caller */
      })
      .finally(() => {
        if (chains.get(key) === next) chains.delete(key);
      });
    chains.set(key, next);
    return next;
  };
}

/** Spread re-offers/joins across devices to avoid broadcast storms (0 … maxMs-1). */
export function staggerDelayMs(seed: string, maxMs: number): number {
  if (maxMs <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % maxMs;
}
