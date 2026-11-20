import type { KeyValueCache } from './cache';
import { createLimiter, type Limiter } from './concurrency';
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
  /**
   * Caps parallel Steam searches. Pass one shared limiter when titles arrive
   * in separate calls; Steam queues anything past about 4 at once.
   */
  limit?: Limiter;
}

const DAY = 24 * 60 * 60 * 1000;
const HIT_TTL = 30 * DAY;
// Misses expire sooner: Steam or ITAD may add the game later.
const MISS_TTL = 1 * DAY;
export const SEARCH_CONCURRENCY = 4;

/**
 * Up to 0.1.5 the cache was "steam-title:", which could hold a package where
 * there is now the game itself; the background clears those on update.
 */
export const cacheKey = (title: string) => `steam-ref:${normalizeTitle(title)}`;
export const OLD_CACHE_PREFIX = 'steam-title:';
/** Steam's GetItems takes up to this many ids per request. */
const ITEMS_BATCH = 50;

/**
 * Finds the Steam store entry for each title: Steam's store search first,
 * taking only a result whose name matches exactly after normalizing (the top
 * result for "shapez" is "shapez 2"); then IsThereAnyDeal's exact-title lookup
 * for the rest. Titles that neither finds map to null. An edition Steam sells
 * only as a package or bundle ("Resident Evil 5 Gold Edition") maps to the one
 * game in it, which has the reviews and is what a library owns. Results are
 * cached; failed requests are not, so the next page load retries them.
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
  // Titles matched only to packages or bundles, which may hold a single game.
  const groups = new Map<string, SteamGroup[]>();
  const confirmedMiss = new Set<string>();
  const retry = new Set<string>();
  const limit = deps.limit ?? createLimiter(SEARCH_CONCURRENCY);
  await Promise.all(
    pending.map(async (title) => {
      const ref = await limit(() => searchSteam(title, deps.fetch)).catch(() => undefined);
      if (ref) found.set(title, ref);
      if (ref?.type === 'sub') groups.set(title, [{ type: 'sub', id: ref.id }]);
      else if (ref === null) confirmedMiss.add(title);
    }),
  );

  const leftover = pending.filter((title) => !found.has(title));
  if (leftover.length > 0) {
    const viaItad = await lookupViaItad(leftover, deps.fetch).catch(() => undefined);
    for (const title of leftover) {
      const ids = viaItad?.get(title);
      const ref = parseItadSteamIds(ids);
      if (ref) found.set(title, ref);
      const titleGroups = ref?.type === 'app' ? [] : parseSteamGroups(ids);
      if (titleGroups.length > 0) groups.set(title, titleGroups);
      // A miss is only certain when both sources answered.
      if (!viaItad) confirmedMiss.delete(title);
      else if (!ref && titleGroups.length > 0) confirmedMiss.delete(title);
    }
  }

  if (groups.size > 0) {
    const all = [...new Map([...groups.values()].flat().map((group) => [groupKey(group), group])).values()];
    const soleGames = await soleGameApps(all, deps.fetch).catch(() => undefined);
    for (const [title, titleGroups] of groups) {
      if (!soleGames) {
        retry.add(title);
        continue;
      }
      const appId = titleGroups.map((group) => soleGames.get(groupKey(group))).find((id) => id !== undefined);
      if (appId !== undefined) found.set(title, { type: 'app', id: appId });
      else if (!found.has(title)) confirmedMiss.add(title);
    }
  }

  const toCache: Record<string, CachedRef> = {};
  for (const title of pending) {
    const ref = found.get(title) ?? null;
    result[title] = ref;
    if (!retry.has(title) && (ref || confirmedMiss.has(title))) toCache[cacheKey(title)] = { ref, at: now };
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
  // Fanatical names DLC "Redout - Mars Pack DLC"; Steam's name has no such
  // suffix. Steam's search also finds nothing for a term with " - " in it
  // ("Redout - Mars Pack"), though it finds "Redout Mars Pack". Same for " + "
  // ("DOOM + DOOM II").
  const withoutSuffix = title.replace(/\s+DLC$/i, '');
  const term = withoutSuffix.replace(/\s+[-+]\s+/g, ' ');
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`Steam search returned ${response.status}`);
  const { items = [] } = (await response.json()) as { items?: SteamSearchItem[] };
  return pickExactMatch(items, title) ?? (withoutSuffix === title ? null : pickExactMatch(items, withoutSuffix));
}

export function pickExactMatch(items: SteamSearchItem[], title: string): SteamRef | null {
  const key = normalizeTitle(title);
  for (const item of items) {
    if (!item.id || !item.name || normalizeTitle(item.name) !== key) continue;
    if (item.type === 'app' || item.type === 'sub') return { type: item.type, id: item.id };
  }
  return null;
}

/** Title → ITAD game id → its Steam ids ("app/…", "sub/…", "bundle/…"), two batched calls. */
async function lookupViaItad(titles: string[], fetchFn: typeof fetch): Promise<Map<string, string[]>> {
  const ids = await itadIdsByTitle(fetchFn, titles);
  const itadIds = [...new Set(Object.values(ids).filter((id): id is string => !!id))];
  const found = new Map<string, string[]>();
  if (itadIds.length === 0) return found;
  const steamIds = await shopIdsByItadId(fetchFn, ITAD_SHOP.steam, itadIds);
  for (const title of titles) {
    const itadId = ids[title];
    const titleIds = itadId ? steamIds[itadId] : null;
    if (titleIds?.length) found.set(title, titleIds);
  }
  return found;
}

/** ITAD lists every Steam id for a game ("app/225260", "sub/25920"); prefer the app. */
export function parseItadSteamIds(ids: string[] | null | undefined): SteamRef | null {
  const refs = (ids ?? []).map(parseSteamRef).filter((ref): ref is SteamRef => ref !== null);
  return refs.find((ref) => ref.type === 'app') ?? refs[0] ?? null;
}

/** A Steam package or bundle: how Steam sells editions and collections. */
interface SteamGroup {
  type: 'sub' | 'bundle';
  id: number;
}

const groupKey = (group: SteamGroup) => `${group.type}/${group.id}`;

function parseSteamGroups(ids: string[] | null | undefined): SteamGroup[] {
  return (ids ?? []).flatMap((value) => {
    const match = value.match(/^(sub|bundle)\/(\d+)$/);
    return match ? [{ type: match[1] as SteamGroup['type'], id: Number(match[2]) }] : [];
  });
}

interface GetItemsGroupResponse {
  response?: {
    store_items?: {
      item_type?: number;
      id?: number;
      success?: number;
      included_items?: { included_apps?: { appid?: number; type?: number }[] };
    }[];
  };
}

/** GetItems' item types and app type for a game (DLC, soundtracks and the like are others). */
const ITEM_TYPE = { 1: 'sub', 2: 'bundle' } as const;
const APP_TYPE_GAME = 0;

/**
 * Packages and bundles that hold exactly one game, keyed "sub/62118", mapped
 * to that game's app id: one GetItems call (no key or sign-in) per 50.
 * Packages no longer sold come back without contents, and are left out.
 */
export async function soleGameApps(groups: SteamGroup[], fetchFn: typeof fetch): Promise<Map<string, number>> {
  const games = new Map<string, number>();
  const batches = Array.from({ length: Math.ceil(groups.length / ITEMS_BATCH) }, (_, i) =>
    groups.slice(i * ITEMS_BATCH, (i + 1) * ITEMS_BATCH),
  );
  await Promise.all(
    batches.map(async (batch) => {
      const input = {
        ids: batch.map((group) => (group.type === 'sub' ? { packageid: group.id } : { bundleid: group.id })),
        context: { language: 'english', country_code: 'US' },
        data_request: { include_included_items: true },
      };
      const url = `https://api.steampowered.com/IStoreBrowseService/GetItems/v1?input_json=${encodeURIComponent(JSON.stringify(input))}`;
      const response = await fetchFn(url);
      if (!response.ok) throw new Error(`Steam GetItems returned ${response.status}`);
      const body = (await response.json()) as GetItemsGroupResponse;
      for (const item of body.response?.store_items ?? []) {
        const type = ITEM_TYPE[item.item_type as keyof typeof ITEM_TYPE];
        const apps = item.included_items?.included_apps ?? [];
        const gameApps = apps.filter((app) => app.type === APP_TYPE_GAME && app.appid);
        if (type && item.id && gameApps.length === 1) games.set(`${type}/${item.id}`, gameApps[0]!.appid!);
      }
    }),
  );
  return games;
}
