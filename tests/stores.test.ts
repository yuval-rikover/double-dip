import { describe, expect, it } from 'vitest';
import type { KeyValueCache } from '../lib/cache';
import { getGogLibrary, type OwnedGog } from '../lib/gog-library';
import { steamRefsToShopIds, type CachedShopIds } from '../lib/shop-map';
import type { LibraryStore } from '../lib/library-cache';
import { getOwnership } from '../lib/ownership';

const NOW = 1_800_000_000_000;
const DAY = 24 * 60 * 60 * 1000;

function memoryStore(initial?: OwnedGog): LibraryStore<OwnedGog> & { value?: OwnedGog } {
  const store: LibraryStore<OwnedGog> & { value?: OwnedGog } = {
    value: initial,
    get: async () => store.value,
    set: async (library) => void (store.value = library),
    clear: async () => void (store.value = undefined),
  };
  return store;
}

function memoryCache(initial: Record<string, CachedShopIds> = {}): KeyValueCache<CachedShopIds> & {
  store: Record<string, CachedShopIds>;
} {
  const store = { ...initial };
  return {
    store,
    get: async (keys) => Object.fromEntries(keys.map((key) => [key, store[key]])),
    set: async (entries) => void Object.assign(store, entries),
  };
}

describe('getGogLibrary', () => {
  it('reads owned product ids with the user session', async () => {
    const calls: RequestInit[] = [];
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init!);
      return new Response(JSON.stringify({ owned: [1207659253, 1359844055] }), {
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;
    expect(await getGogLibrary({ fetch: fetchFn, store: memoryStore(), now: () => NOW })).toEqual({
      status: 'ok',
      owned: [1207659253, 1359844055],
      fetchedAt: NOW,
    });
    expect(calls[0]!.credentials).toBe('include');
  });

  it('reads the wishlist too, and loads without it when GOG fails to answer', async () => {
    const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });
    const withWishlist = (async (url: RequestInfo | URL) =>
      String(url).endsWith('/user/wishlist.json')
        ? json({ wishlist: { '1207658890': true, '1207659253': false }, checksum: 'x' })
        : json({ owned: [1] })) as typeof fetch;
    expect(await getGogLibrary({ fetch: withWishlist, store: memoryStore(), now: () => NOW })).toEqual({
      status: 'ok',
      owned: [1],
      wishlist: [1207658890],
      fetchedAt: NOW,
    });
    const failing = (async (url: RequestInfo | URL) =>
      String(url).endsWith('/user/wishlist.json') ? new Response('', { status: 500 }) : json({ owned: [1] })) as typeof fetch;
    expect(await getGogLibrary({ fetch: failing, store: memoryStore(), now: () => NOW })).toEqual({
      status: 'ok',
      owned: [1],
      fetchedAt: NOW,
    });
  });

  it('reads the login-page redirect as signed out', async () => {
    const fetchFn = (async () =>
      new Response('<!DOCTYPE html><html>Redirecting to /en##openlogin</html>', {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      })) as typeof fetch;
    expect(await getGogLibrary({ fetch: fetchFn, store: memoryStore(), now: () => NOW })).toEqual({
      status: 'signed-out',
    });
  });
});

describe('steamRefsToShopIds', () => {
  const EPIC_A = '8a97a7d4d0e44523b9aa064f457627da';
  /** ITAD fake: Steam id → ITAD id, then ITAD id → GOG or Epic ids. */
  function itadFetch(
    tables: { steam?: Record<string, string | null>; gog?: Record<string, string[] | null>; epic?: Record<string, string[] | null> },
    fail = false,
  ) {
    const calls: string[] = [];
    const fn = (async (url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(String(url));
      if (fail) return new Response('{}', { status: 503 });
      const body = JSON.parse(String(init!.body)) as string[];
      const u = String(url);
      const table = u.includes('/lookup/id/shop/61/') ? tables.steam : u.includes('/lookup/shop/35/') ? tables.gog : tables.epic;
      return new Response(JSON.stringify(Object.fromEntries(body.map((key) => [key, table?.[key] ?? null]))));
    }) as typeof fetch;
    return { fn, calls };
  }

  it('maps to GOG and Epic ids through ITAD, keeping only Epic offer ids', async () => {
    const cache = memoryCache();
    const { fn } = itadFetch({
      steam: { 'app/225260': 'itad-bl', 'app/1': null },
      gog: { 'itad-bl': ['1207659253'] },
      epic: { 'itad-bl': ['brutal-legend/home', EPIC_A] },
    });
    expect(await steamRefsToShopIds(['app/225260', 'app/1'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'app/225260': { gog: ['1207659253'], epic: [EPIC_A] },
      'app/1': { gog: [], epic: [] },
    });
    expect(cache.store['shop-ids:app/1']).toEqual({ gog: [], epic: [], at: NOW });
  });

  it('answers from cache, re-checking "on neither store" after a week', async () => {
    const cache = memoryCache({
      'shop-ids:app/225260': { gog: [], epic: [EPIC_A], at: NOW - 20 * DAY },
      'shop-ids:app/2': { gog: [], epic: [], at: NOW - 8 * DAY },
    });
    const { fn, calls } = itadFetch({});
    await steamRefsToShopIds(['app/225260', 'app/2'], { fetch: fn, cache, now: () => NOW });
    expect(calls).toHaveLength(1); // only app/2 goes to ITAD, and it has no ITAD id
  });

  it('returns only cached answers when ITAD fails', async () => {
    const cache = memoryCache({ 'shop-ids:app/3830': { gog: ['1207658890'], epic: [], at: NOW } });
    const { fn } = itadFetch({}, true);
    expect(await steamRefsToShopIds(['app/3830', 'app/9'], { fetch: fn, cache, now: () => NOW })).toEqual({
      'app/3830': { gog: ['1207658890'], epic: [] },
    });
    expect(cache.store['shop-ids:app/9']).toBeUndefined();
  });
});

describe('getOwnership', () => {
  const EPIC_A = '8a97a7d4d0e44523b9aa064f457627da';
  const steamOk = async () => ({ status: 'ok' as const, apps: [225260], packages: [25920], fetchedAt: NOW });
  const gogOk = async () => ({ status: 'ok' as const, owned: [1207658890], fetchedAt: NOW });
  const epicOk = async () =>
    ({ status: 'ok' as const, offers: [EPIC_A], newestOrderId: 'o1', fullSyncAt: NOW, fetchedAt: NOW });

  it('combines Steam, GOG and Epic per Steam id', async () => {
    const result = await getOwnership(['app/225260', 'app/3830', 'sub/25920', 'app/5'], {
      steam: steamOk,
      gog: gogOk,
      epic: epicOk,
      shopIds: async () => ({
        'app/225260': { gog: ['1207659253'], epic: [EPIC_A] },
        'app/3830': { gog: ['1207658890'], epic: [] },
      }),
    });
    expect(result).toEqual({
      owned: { 'app/225260': ['steam', 'epic'], 'app/3830': ['gog'], 'sub/25920': ['steam'], 'app/5': [] },
      wishlisted: {},
      status: { steam: 'ok', gog: 'ok', epic: 'ok' },
    });
  });

  it('reports Steam and GOG wishlists for games owned nowhere', async () => {
    const result = await getOwnership(['app/225260', 'app/7', 'app/8', 'sub/9'], {
      steam: async () => ({ status: 'ok' as const, apps: [225260], packages: [], wishlist: [225260, 7, 9], fetchedAt: NOW }),
      gog: async () => ({ status: 'ok' as const, owned: [], wishlist: [1207658890], fetchedAt: NOW }),
      epic: async () => ({ status: 'signed-out' as const }),
      shopIds: async () => ({ 'app/7': { gog: ['1207658890'], epic: [] }, 'app/8': { gog: ['1207658890'], epic: [] } }),
    });
    // Owned wins; Steam wishlists hold apps, not packages.
    expect(result.wishlisted).toEqual({ 'app/7': ['steam', 'gog'], 'app/8': ['gog'] });
  });

  it('skips the store id lookup when there is no GOG or Epic library', async () => {
    let looked = false;
    const result = await getOwnership(['app/225260'], {
      steam: steamOk,
      gog: async () => ({ status: 'signed-out' }),
      epic: async () => ({ status: 'syncing' }),
      shopIds: async () => {
        looked = true;
        return {};
      },
    });
    expect(looked).toBe(false);
    expect(result.owned).toEqual({ 'app/225260': ['steam'] });
    expect(result.status).toEqual({ steam: 'ok', gog: 'signed-out', epic: 'syncing' });
  });
});
