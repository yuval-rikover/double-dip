import { beforeEach, describe, expect, it } from 'vitest';
import {
  cacheKey,
  parseItadSteamIds,
  pickExactMatch,
  resolveSteamTitles,
  type CachedRef,
  type TitleCache,
} from '../lib/steam-resolve';

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function memoryCache(initial: Record<string, CachedRef> = {}): TitleCache & { store: Record<string, CachedRef> } {
  const store = { ...initial };
  return {
    store,
    get: async (keys) => Object.fromEntries(keys.map((key) => [key, store[key]])),
    set: async (entries) => void Object.assign(store, entries),
  };
}

/** One package or bundle as GetItems lists it: its contents, by app id and type (0: game, 4: DLC). */
type FakeGroup = { apps: [appid: number, type: number][] } | 'unavailable';

/**
 * Fake network: Steam search answers from `steam`, ITAD from `itadIds`/`itadSteam`,
 * Steam's GetItems from `groups` ("sub/62118").
 */
function fakeFetch(opts: {
  steam?: Record<string, { type: string; id: number; name: string }[]>;
  groups?: Record<string, FakeGroup>;
  failItems?: boolean;
  itadIds?: Record<string, string | null>;
  itadSteam?: Record<string, string[] | null>;
  failSteam?: boolean;
  failItad?: boolean;
}) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
    if (url.includes('store.steampowered.com/api/storesearch')) {
      if (opts.failSteam) return json({}, 500);
      const term = new URL(url).searchParams.get('term')!;
      return json({ items: opts.steam?.[term] ?? [] });
    }
    if (url.includes('IStoreBrowseService/GetItems')) {
      if (opts.failItems) return json({}, 500);
      const input = JSON.parse(new URL(url).searchParams.get('input_json')!) as {
        ids: { packageid?: number; bundleid?: number }[];
      };
      const store_items = input.ids.map(({ packageid, bundleid }) => {
        const [type, itemType, id] = packageid ? ['sub', 1, packageid] : ['bundle', 2, bundleid!];
        const group = opts.groups?.[`${type}/${id}`];
        if (!group || group === 'unavailable') return { item_type: itemType, id, success: 15 };
        const included_apps = group.apps.map(([appid, appType]) => ({ appid, type: appType }));
        return { item_type: itemType, id, success: 1, included_items: { included_apps } };
      });
      return json({ response: { store_items } });
    }
    if (opts.failItad) return json({}, 503);
    const body = JSON.parse(String(init?.body)) as string[];
    if (url.endsWith('/lookup/id/title/v1')) return json(Object.fromEntries(body.map((t) => [t, opts.itadIds?.[t] ?? null])));
    if (url.endsWith('/lookup/shop/61/id/v1')) return json(Object.fromEntries(body.map((id) => [id, opts.itadSteam?.[id] ?? null])));
    return json({}, 404);
  }) as typeof fetch;
  return { fn, calls };
}

describe('pickExactMatch', () => {
  it('skips a closer-ranked but different game', () => {
    const items = [
      { type: 'app', id: 2162800, name: 'shapez 2 - Factory' },
      { type: 'app', id: 1318690, name: 'shapez' },
    ];
    expect(pickExactMatch(items, 'shapez')).toEqual({ type: 'app', id: 1318690 });
  });

  it('matches across accents and punctuation', () => {
    expect(pickExactMatch([{ type: 'app', id: 225260, name: 'Brutal Legend' }], 'Brütal Legend')).toEqual({
      type: 'app',
      id: 225260,
    });
  });

  it('returns null when nothing matches exactly', () => {
    expect(pickExactMatch([{ type: 'app', id: 1, name: 'Breath of Fire IV Original Soundtrack' }], 'Breath of Fire')).toBeNull();
  });
});

describe('parseItadSteamIds', () => {
  it('prefers the app over the package', () => {
    expect(parseItadSteamIds(['sub/25920', 'app/225260'])).toEqual({ type: 'app', id: 225260 });
  });

  it('falls back to a package, or null', () => {
    expect(parseItadSteamIds(['sub/7'])).toEqual({ type: 'sub', id: 7 });
    expect(parseItadSteamIds(null)).toBeNull();
  });
});

describe('resolveSteamTitles', () => {
  let cache: ReturnType<typeof memoryCache>;
  beforeEach(() => {
    cache = memoryCache();
  });

  it('resolves through Steam search and caches the hit', async () => {
    const { fn } = fakeFetch({ steam: { Kiln: [{ type: 'app', id: 1165990, name: 'Kiln' }] } });
    expect(await resolveSteamTitles(['Kiln'], { fetch: fn, cache, now: () => NOW })).toEqual({
      Kiln: { type: 'app', id: 1165990 },
    });
    expect(cache.store[cacheKey('Kiln')]).toEqual({ ref: { type: 'app', id: 1165990 }, at: NOW });
  });

  it('searches without a " DLC" suffix or " - ", which Steam search finds nothing for', async () => {
    const { fn } = fakeFetch({ steam: { 'Redout Mars Pack': [{ type: 'app', id: 627440, name: 'Redout - Mars Pack' }] } });
    expect(await resolveSteamTitles(['Redout - Mars Pack DLC'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'Redout - Mars Pack DLC': { type: 'app', id: 627440 },
    });
  });

  it('searches without " + ", which Steam search finds nothing for either', async () => {
    const { fn } = fakeFetch({ steam: { 'DOOM DOOM II': [{ type: 'app', id: 2280, name: 'DOOM + DOOM II' }] } });
    expect(await resolveSteamTitles(['DOOM + DOOM II'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'DOOM + DOOM II': { type: 'app', id: 2280 },
    });
  });

  it('falls back to ITAD when Steam has no exact match', async () => {
    const { fn } = fakeFetch({
      itadIds: { 'Brütal Legend': 'itad-1' },
      itadSteam: { 'itad-1': ['app/225260', 'sub/25920'] },
    });
    expect(await resolveSteamTitles(['Brütal Legend'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'Brütal Legend': { type: 'app', id: 225260 },
    });
  });

  it('caches a miss only when both sources answered', async () => {
    const answered = fakeFetch({});
    expect(await resolveSteamTitles(['Nope'], { fetch: answered.fn, cache, now: () => NOW })).toEqual({ Nope: null });
    expect(cache.store[cacheKey('Nope')]).toEqual({ ref: null, at: NOW });

    const fresh = memoryCache();
    const itadDown = fakeFetch({ failItad: true });
    expect(await resolveSteamTitles(['Nope'], { fetch: itadDown.fn, cache: fresh, now: () => NOW })).toEqual({ Nope: null });
    expect(fresh.store).toEqual({});
  });

  it('does not cache when Steam search fails', async () => {
    const { fn } = fakeFetch({ failSteam: true });
    await resolveSteamTitles(['Kiln'], { fetch: fn, cache, now: () => NOW });
    expect(cache.store).toEqual({});
  });

  it('answers fresh cache entries without the network', async () => {
    cache = memoryCache({ [cacheKey('Kiln')]: { ref: { type: 'app', id: 1165990 }, at: NOW - 29 * DAY } });
    const { fn, calls } = fakeFetch({});
    expect(await resolveSteamTitles(['Kiln'], { fetch: fn, cache, now: () => NOW })).toEqual({
      Kiln: { type: 'app', id: 1165990 },
    });
    expect(calls).toEqual([]);
  });

  it('re-checks misses after a day and hits after 30 days', async () => {
    cache = memoryCache({
      [cacheKey('Old miss')]: { ref: null, at: NOW - 2 * DAY },
      [cacheKey('Old hit')]: { ref: { type: 'app', id: 1 }, at: NOW - 31 * DAY },
    });
    const { fn, calls } = fakeFetch({});
    await resolveSteamTitles(['Old miss', 'Old hit'], { fetch: fn, cache, now: () => NOW });
    expect(calls.filter((url) => url.includes('storesearch'))).toHaveLength(2);
  });

  it('looks each title up once, with one batched ITAD round', async () => {
    const { fn, calls } = fakeFetch({});
    await resolveSteamTitles(['A', 'B', 'A'], { fetch: fn, cache, now: () => NOW });
    expect(calls.filter((url) => url.includes('storesearch'))).toHaveLength(2);
    expect(calls.filter((url) => url.includes('isthereanydeal'))).toHaveLength(1); // no ITAD ids → no second call
  });

  it('maps an edition sold only as packages to the one game in the first one still sold', async () => {
    // Resident Evil 6 Complete, as ITAD and Steam listed it in 2026-11.
    const { fn } = fakeFetch({
      itadIds: { 'Resident Evil 6 Complete': 'itad-re6' },
      itadSteam: { 'itad-re6': ['sub/32963', 'sub/50980'] },
      groups: { 'sub/32963': 'unavailable', 'sub/50980': { apps: [[221040, 0]] } },
    });
    expect(await resolveSteamTitles(['Resident Evil 6 Complete'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'Resident Evil 6 Complete': { type: 'app', id: 221040 },
    });
  });

  it('maps an edition sold only as bundles to its game, past the DLC in it', async () => {
    const { fn } = fakeFetch({
      itadIds: { 'RESIDENT EVIL 7 biohazard Gold Edition': 'itad-re7' },
      itadSteam: { 'itad-re7': ['bundle/5837', 'bundle/18463'] },
      groups: { 'bundle/18463': { apps: [[418370, 0], [529930, 4], [540340, 4]] } },
    });
    expect(await resolveSteamTitles(['RESIDENT EVIL 7 biohazard Gold Edition'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'RESIDENT EVIL 7 biohazard Gold Edition': { type: 'app', id: 418370 },
    });
  });

  it('keeps a package of several games, which no one game stands for', async () => {
    const { fn } = fakeFetch({
      steam: { 'Two Pack': [{ type: 'sub', id: 9, name: 'Two Pack' }] },
      groups: { 'sub/9': { apps: [[1, 0], [2, 0]] } },
    });
    expect(await resolveSteamTitles(['Two Pack'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'Two Pack': { type: 'sub', id: 9 },
    });
  });

  it('caches a bundle-only title with no single game as a miss', async () => {
    const { fn } = fakeFetch({ itadIds: { Gone: 'itad-gone' }, itadSteam: { 'itad-gone': ['bundle/1'] } });
    expect(await resolveSteamTitles(['Gone'], { fetch: fn, cache, now: () => NOW })).toEqual({ Gone: null });
    expect(cache.store[cacheKey('Gone')]).toEqual({ ref: null, at: NOW });
  });

  it("doesn't cache a package match while Steam can't say what's in it", async () => {
    const { fn } = fakeFetch({ steam: { Pack: [{ type: 'sub', id: 9, name: 'Pack' }] }, failItems: true });
    expect(await resolveSteamTitles(['Pack'], { fetch: fn, cache, now: () => NOW })).toEqual({ Pack: { type: 'sub', id: 9 } });
    expect(cache.store).toEqual({});
  });
});
