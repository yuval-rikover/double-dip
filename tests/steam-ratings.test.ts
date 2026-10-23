import { beforeEach, describe, expect, it } from 'vitest';
import { getSteamRatings, ratingCacheKey, type CachedRating, type RatingCache } from '../lib/steam-ratings';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function memoryCache(initial: Record<string, CachedRating> = {}): RatingCache & { store: Record<string, CachedRating> } {
  const store = { ...initial };
  return {
    store,
    get: async (keys) => Object.fromEntries(keys.map((key) => [key, store[key]])),
    set: async (entries) => void Object.assign(store, entries),
  };
}

const summary = (count: number, percent: number, score: number, label: string) => ({
  reviews: { summary_filtered: { review_count: count, percent_positive: percent, review_score: score, review_score_label: label } },
});

/** Fake GetItems: answers each requested app id from `items`; records the requested ids per call. */
function fakeFetch(items: Record<number, object>, fail = false) {
  const calls: number[][] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const input_json = JSON.parse(new URL(String(input)).searchParams.get('input_json')!) as { ids: { appid: number }[] };
    const ids = input_json.ids.map((id) => id.appid);
    calls.push(ids);
    if (fail) return new Response('{}', { status: 503 });
    const store_items = ids.map((appid) => ({ appid, ...items[appid] }));
    return new Response(JSON.stringify({ response: { store_items } }));
  }) as typeof fetch;
  return { fn, calls };
}

describe('getSteamRatings', () => {
  let cache: ReturnType<typeof memoryCache>;
  beforeEach(() => {
    cache = memoryCache();
  });

  it('reads the "All reviews" summary and caches it', async () => {
    const { fn } = fakeFetch({ 673130: summary(6681, 93, 8, 'Very Positive') });
    const rating = { percent: 93, score: 8, label: 'Very Positive', count: 6681 };
    expect(await getSteamRatings(['app/673130'], { fetch: fn, cache, now: () => NOW })).toEqual({ 'app/673130': rating });
    expect(cache.store[ratingCacheKey('app/673130')]).toEqual({ rating, at: NOW });
  });

  it('maps games without reviews, and packages, to null without asking about packages', async () => {
    const { fn, calls } = fakeFetch({ 3284450: summary(0, 0, 0, 'No user reviews') });
    expect(await getSteamRatings(['app/3284450', 'sub/25920'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'app/3284450': null,
      'sub/25920': null,
    });
    expect(calls).toEqual([[3284450]]);
    expect(cache.store[ratingCacheKey('app/3284450')]).toEqual({ rating: null, at: NOW });
  });

  it('asks about many games in a few batched calls', async () => {
    const { fn, calls } = fakeFetch({});
    const refs = Array.from({ length: 120 }, (_, i) => `app/${i + 1}`);
    await getSteamRatings(refs, { fetch: fn, cache, now: () => NOW });
    expect(calls.map((ids) => ids.length)).toEqual([50, 50, 20]);
  });

  it('answers from the cache, re-checking games without reviews after a day and ratings after a week', async () => {
    const rating = { percent: 74, score: 6, label: 'Mostly Positive', count: 21076 };
    cache = memoryCache({
      [ratingCacheKey('app/1')]: { rating, at: NOW - 6 * DAY },
      [ratingCacheKey('app/2')]: { rating, at: NOW - 8 * DAY },
      [ratingCacheKey('app/3')]: { rating: null, at: NOW - 2 * DAY },
    });
    const { fn, calls } = fakeFetch({});
    expect((await getSteamRatings(['app/1', 'app/2', 'app/3'], { fetch: fn, cache, now: () => NOW }))['app/1']).toEqual(rating);
    expect(calls).toEqual([[2, 3]]);
  });

  it('does not cache a failed call, and answers null for now', async () => {
    const { fn } = fakeFetch({}, true);
    expect(await getSteamRatings(['app/1'], { fetch: fn, cache, now: () => NOW })).toEqual({ 'app/1': null });
    expect(cache.store).toEqual({});
  });
});
