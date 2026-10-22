import { describe, expect, it } from 'vitest';
import { createLimiter, shareInFlight } from '../lib/concurrency';

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createLimiter', () => {
  it('never runs more than the limit at once, across callers', async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;
    const task = async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
    };
    // Two "callers" sharing the limiter, like separate per-title messages.
    await Promise.all([...Array(5)].map(() => limit(task)).concat([...Array(5)].map(() => limit(task))));
    expect(peak).toBe(2);
  });

  it('keeps going after a task fails', async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(await limit(async () => 'next')).toBe('next');
  });
});

describe('shareInFlight', () => {
  it('shares one run between concurrent calls, then starts fresh', async () => {
    let runs = 0;
    const load = shareInFlight(async () => {
      runs++;
      await tick();
      return runs;
    });
    expect(await Promise.all([load(), load(), load()])).toEqual([1, 1, 1]);
    expect(await load()).toBe(2);
  });
});
