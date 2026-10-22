import type { KeyValueCache } from './cache';
import { ITAD_SHOP, itadIdsByTitle, shopIdsByItadId } from './itad';
import { normalizeTitle } from './normalize';
import { parseSteamRef, type SteamRef } from './steam';

/** Cached lookup result; `ref: null` records a confirmed miss. */
export interface CachedRef {
  ref: SteamRef | null;
  at: number;
}

export type TitleCache = KeyValueCache<CachedRef>;

export interface ResolveDeps {
  fetch: typeof fetch;
  cache: TitleCache;
  now?: () => number;
}

const DAY = 24 * 60 * 60 * 1000;
const HIT_TTL = 30 * DAY;
// Misses expire sooner: Steam or ITAD may add the game later.
const MISS_TTL = 1 * DAY;
const SEARCH_CONCURRENCY = 4;

export const cacheKey = (title: string) => `steam-title:${normalizeTitle(title)}`;

/**
 * Finds the Steam store entry for each title: Steam's store search first,
 * taking only a result whose name matches exactly after normalizing (the top
 * result for "shapez" is "shapez 2"); then IsThereAnyDeal's exact-title lookup
 * for the rest. Titles that neither finds map to null. Results are cached;
 * failed requests are not, so the next page load retries them.
 */
export async function resolveSteamTitles(titles: string[], deps: ResolveDeps): Promise<Record<string, SteamRef | null>> {
  const now = (deps.now ?? Date.now)();
  const unique = [...new Set(titles)];
  const cached = await deps.cache.get(unique.map(cacheKey));
  const result: Record<string, SteamRef | null> = {};
  const pending: string[] = [];
  for (const title of unique) {
    const entry = cached[cacheKey(title)];
    if (entry && now - entry.at < (entry.ref ? HIT_TTL : MISS_TTL)) result[title] = entry.ref;
    else pending.push(title);
  }
  if (pending.length === 0) return result;

  const found = new Map<string, SteamRef>();
  const confirmedMiss = new Set<string>();
  await mapLimit(pending, SEARCH_CONCURRENCY, async (title) => {
    const ref = await searchSteam(title, deps.fetch).catch(() => undefined);
    if (ref) found.set(title, ref);
    else if (ref === null) confirmedMiss.add(title);
  });

  const leftover = pending.filter((title) => !found.has(title));
  if (leftover.length > 0) {
    const viaItad = await lookupViaItad(leftover, deps.fetch).catch(() => undefined);
    for (const title of leftover) {
      const ref = viaItad?.get(title);
      if (ref) found.set(title, ref);
      // A miss is only certain when both sources answered.
      else if (!viaItad) confirmedMiss.delete(title);
    }
  }

  const toCache: Record<string, CachedRef> = {};
  for (const title of pending) {
    const ref = found.get(title) ?? null;
    result[title] = ref;
    if (ref || confirmedMiss.has(title)) toCache[cacheKey(title)] = { ref, at: now };
  }
  await deps.cache.set(toCache);
  return result;
}

interface SteamSearchItem {
  type?: string;
  id?: number;
  name?: string;
}

/** Returns the exact-name match, null when Steam answered without one. */
async function searchSteam(title: string, fetchFn: typeof fetch): Promise<SteamRef | null> {
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Steam search returned ${response.status}`);
  const { items = [] } = (await response.json()) as { items?: SteamSearchItem[] };
  return pickExactMatch(items, title);
}

export function pickExactMatch(items: SteamSearchItem[], title: string): SteamRef | null {
  const key = normalizeTitle(title);
  for (const item of items) {
    if (!item.id || !item.name || normalizeTitle(item.name) !== key) continue;
    if (item.type === 'app' || item.type === 'sub') return { type: item.type, id: item.id };
  }
  return null;
}

/** Title → ITAD game id → Steam id, two batched calls. */
async function lookupViaItad(titles: string[], fetchFn: typeof fetch): Promise<Map<string, SteamRef>> {
  const ids = await itadIdsByTitle(fetchFn, titles);
  const itadIds = [...new Set(Object.values(ids).filter((id): id is string => !!id))];
  const refs = new Map<string, SteamRef>();
  if (itadIds.length === 0) return refs;
  const steamIds = await shopIdsByItadId(fetchFn, ITAD_SHOP.steam, itadIds);
  for (const title of titles) {
    const itadId = ids[title];
    const ref = itadId ? parseItadSteamIds(steamIds[itadId]) : null;
    if (ref) refs.set(title, ref);
  }
  return refs;
}

/** ITAD lists every Steam id for a game ("app/225260", "sub/25920"); prefer the app. */
export function parseItadSteamIds(ids: string[] | null | undefined): SteamRef | null {
  const refs = (ids ?? []).map(parseSteamRef).filter((ref): ref is SteamRef => ref !== null);
  return refs.find((ref) => ref.type === 'app') ?? refs[0] ?? null;
}

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]!);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
