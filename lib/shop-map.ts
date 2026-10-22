import type { KeyValueCache } from './cache';
import { ITAD_SHOP, itadIdsByShopId, shopIdsByItadId } from './itad';

/** A game's ids in the other stores, keyed off its Steam id. */
export interface ShopIds {
  /** GOG product ids. */
  gog: string[];
  /** Epic offer ids — the 32-hex form; ITAD's slug-style Epic ids are dropped. */
  epic: string[];
}

export interface CachedShopIds extends ShopIds {
  at: number;
}

export interface ShopMapDeps {
  fetch: typeof fetch;
  cache: KeyValueCache<CachedShopIds>;
  now?: () => number;
}

const DAY = 24 * 60 * 60 * 1000;
const HIT_TTL = 30 * DAY;
// Games come to GOG and Epic over time; re-check "on neither" weekly.
const MISS_TTL = 7 * DAY;
const EPIC_OFFER_ID = /^[0-9a-f]{32}$/;

const cacheKey = (steamRef: string) => `shop-ids:${steamRef}`;

/**
 * Maps Steam ids ("app/225260") to the game's GOG and Epic ids via ITAD:
 * Steam id → ITAD id, then ITAD id → each store's ids, three batched calls.
 * A Steam id ITAD doesn't know maps to no ids. If ITAD fails, only cached
 * answers are returned.
 */
export async function steamRefsToShopIds(steamRefs: string[], deps: ShopMapDeps): Promise<Record<string, ShopIds>> {
  const now = (deps.now ?? Date.now)();
  const unique = [...new Set(steamRefs)];
  const cached = await deps.cache.get(unique.map(cacheKey));
  const result: Record<string, ShopIds> = {};
  const pending: string[] = [];
  for (const ref of unique) {
    const entry = cached[cacheKey(ref)];
    const found = entry && (entry.gog.length > 0 || entry.epic.length > 0);
    if (entry && now - entry.at < (found ? HIT_TTL : MISS_TTL)) result[ref] = { gog: entry.gog, epic: entry.epic };
    else pending.push(ref);
  }
  if (pending.length === 0) return result;

  try {
    const itadIds = await itadIdsByShopId(deps.fetch, ITAD_SHOP.steam, pending);
    const known = [...new Set(Object.values(itadIds).filter((id): id is string => !!id))];
    const [gogIds, epicIds] =
      known.length > 0
        ? await Promise.all([
            shopIdsByItadId(deps.fetch, ITAD_SHOP.gog, known),
            shopIdsByItadId(deps.fetch, ITAD_SHOP.epic, known),
          ])
        : [{}, {}];
    const toCache: Record<string, CachedShopIds> = {};
    for (const ref of pending) {
      const itadId = itadIds[ref];
      const ids: ShopIds = {
        gog: (itadId && gogIds[itadId]) || [],
        epic: ((itadId && epicIds[itadId]) || []).filter((id) => EPIC_OFFER_ID.test(id)),
      };
      result[ref] = ids;
      toCache[cacheKey(ref)] = { ...ids, at: now };
    }
    await deps.cache.set(toCache);
  } catch (error) {
    console.warn('[Double Dip] store id lookup failed', error);
  }
  return result;
}
