import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('wxt/browser', () => ({ browser: {} }));
const { createBadgeDecorator } = await import('../lib/ownership-client');

describe('createBadgeDecorator', () => {
  let marked: Record<string, string | undefined>;
  let unchecked: string[];
  const setup = (ask: (refs: string[]) => Promise<Record<string, string> | undefined>) => {
    marked = {};
    return createBadgeDecorator<string>({
      mark: (lookup) => unchecked.forEach((ref) => (marked[ref] = lookup(ref))),
      unchecked: () => unchecked,
      ask,
      fallback: 'none',
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    unchecked = ['app/1', 'app/2'];
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('asks again after the background fails, instead of settling on "not owned"', async () => {
    const ask = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('Could not establish connection'))
      .mockResolvedValue({ 'app/1': 'steam' });
    setup(ask).decorate();
    await vi.advanceTimersByTimeAsync(100);
    expect(marked['app/1']).toBeUndefined();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(ask).toHaveBeenCalledTimes(3);
    expect(marked).toEqual({ 'app/1': 'steam', 'app/2': 'none' });
  });

  it('leaves the ids unanswered once out of tries, for the next round to ask about', async () => {
    const ask = vi.fn().mockResolvedValue(undefined);
    const { decorate } = setup(ask);
    decorate();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(ask).toHaveBeenCalledTimes(5);
    expect(marked).toEqual({ 'app/1': undefined, 'app/2': undefined });

    ask.mockResolvedValue({ 'app/2': 'gog' });
    decorate();
    await vi.advanceTimersByTimeAsync(100);
    expect(ask).toHaveBeenCalledTimes(6);
    expect(marked).toEqual({ 'app/1': 'none', 'app/2': 'gog' });
  });

  it('keeps the markers when asking again after a library change fails', async () => {
    const ask = vi.fn().mockResolvedValue({ 'app/1': 'steam' });
    const { decorate, reask } = setup(ask);
    decorate();
    await vi.advanceTimersByTimeAsync(100);
    ask.mockResolvedValue(undefined);
    reask();
    await vi.advanceTimersByTimeAsync(100);
    expect(marked['app/1']).toBe('steam');
  });
});
