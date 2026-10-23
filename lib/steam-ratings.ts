import type { KeyValueCache } from './cache';
import { parseSteamRef } from './steam';

/** Steam's "All reviews" summary for a game, as its store page shows it. */
export interface SteamRating {
  /** Share of positive reviews, 0–100. */
  percent: number;
  /** Steam's 1–9 scale: 9 "Overwhelmingly Positive" … 5 "Mixed" … 1 "Overwhelmingly Negative". */
  score: number;
  label: string;
  count: number;
}

/** Cached result; `rating: null` records a game without reviews. */
export interface CachedRating {
  rating: SteamRating | null;
  at: number;
}

export type RatingCache = KeyValueCache<CachedRating>;

export interface RatingDeps {
  fetch: typeof fetch;
  cache: RatingCache;
  now?: () => number;
}

const DAY = 24 * 60 * 60 * 1000;
// Ratings drift slowly; a week keeps them close to what Steam shows.
const HIT_TTL = 7 * DAY;
const MISS_TTL = 1 * DAY;
/** Apps per GetItems call; a big bundle page still costs one or two calls. */
const BATCH_SIZE = 50;

export const ratingCacheKey = (steamRef: string) => `steam-rating:${steamRef}`;

/**
 * Steam review summaries for Steam ids ("app/225260"), from the store API
 * Steam's own pages use (`IStoreBrowseService/GetItems`; no key or sign-in).
 * Packages have no reviews of their own and map to null, as do apps without
 * reviews. Results are cached; failed requests are not, and their ids map to
 * null for now.
 */
export async function getSteamRatings(steamRefs: string[], deps: RatingDeps): Promise<Record<string, SteamRating | null>> {
  const now = (deps.now ?? Date.now)();
  const unique = [...new Set(steamRefs)];
  const cached = await deps.cache.get(unique.map(ratingCacheKey));
  const result: Record<string, SteamRating | null> = {};
  const pending = new Map<number, string>();
  for (const ref of unique) {
    const entry = cached[ratingCacheKey(ref)];
    const parsed = parseSteamRef(ref);
    result[ref] = null;
    if (entry && now - entry.at < (entry.rating ? HIT_TTL : MISS_TTL)) result[ref] = entry.rating;
    else if (parsed?.type === 'app') pending.set(parsed.id, ref);
  }
  if (pending.size === 0) return result;

  const appIds = [...pending.keys()];
  const batches = Array.from({ length: Math.ceil(appIds.length / BATCH_SIZE) }, (_, i) =>
    appIds.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
  );
  const toCache: Record<string, CachedRating> = {};
  await Promise.all(
    batches.map(async (batch) => {
      const ratings = await fetchRatings(batch, deps.fetch).catch((error) => {
        console.warn('[Double Dip]', error);
        return undefined;
      });
      if (!ratings) return;
      for (const appId of batch) {
        const ref = pending.get(appId)!;
        const rating = ratings.get(appId) ?? null;
        result[ref] = rating;
        toCache[ratingCacheKey(ref)] = { rating, at: now };
      }
    }),
  );
  await deps.cache.set(toCache);
  return result;
}

interface ReviewSummary {
  review_count?: number;
  percent_positive?: number;
  review_score?: number;
  review_score_label?: string;
}

interface GetItemsResponse {
  response?: { store_items?: { appid?: number; reviews?: { summary_filtered?: ReviewSummary } }[] };
}

async function fetchRatings(appIds: number[], fetchFn: typeof fetch): Promise<Map<number, SteamRating>> {
  const input = {
    ids: appIds.map((appid) => ({ appid })),
    context: { language: 'english', country_code: 'US' },
    data_request: { include_reviews: true },
  };
  const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Steam GetItems returned ${response.status}`);
  const body = (await response.json()) as GetItemsResponse;
  const ratings = new Map<number, SteamRating>();
  for (const item of body.response?.store_items ?? []) {
    const summary = item.reviews?.summary_filtered;
    if (!item.appid || !summary?.review_count || !summary.review_score_label) continue;
    ratings.set(item.appid, {
      percent: summary.percent_positive ?? 0,
      score: summary.review_score ?? 0,
      label: summary.review_score_label,
      count: summary.review_count,
    });
  }
  return ratings;
}
