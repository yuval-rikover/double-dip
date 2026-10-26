import { describe, expect, it } from 'vitest';
import type { LibraryStore } from '../lib/library-cache';
import { getSteamLibrary, type OwnedSteam } from '../lib/steam-library';

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;

function memoryStore(initial?: OwnedSteam): LibraryStore<OwnedSteam> & { value?: OwnedSteam } {
  const store: LibraryStore<OwnedSteam> & { value?: OwnedSteam } = {
    value: initial,
    get: async () => store.value,
    set: async (library) => void (store.value = library),
    clear: async () => void (store.value = undefined),
  };
  return store;
}

function fakeFetch(body: unknown, status = 200) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    if (body instanceof Error) throw body;
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
  return { fn, calls };
}

describe('getSteamLibrary', () => {
  it('reads owned apps and packages with the user session, and caches them', async () => {
    const store = memoryStore();
    const { fn, calls } = fakeFetch({ rgOwnedApps: [18500, 225260], rgOwnedPackages: [25920], rgWishlist: [1] });
    expect(await getSteamLibrary({ fetch: fn, store, now: () => NOW })).toEqual({
      status: 'ok',
      apps: [18500, 225260],
      packages: [25920],
      wishlist: [1],
      fetchedAt: NOW,
    });
    expect(calls[0]!.init?.credentials).toBe('include');
    expect(store.value).toEqual({ apps: [18500, 225260], packages: [25920], wishlist: [1], fetchedAt: NOW });
  });

  it('reports signed out on empty lists, and drops the cached library', async () => {
    const store = memoryStore({ apps: [1], packages: [], fetchedAt: NOW - 2 * HOUR });
    const { fn } = fakeFetch({ rgOwnedApps: [], rgOwnedPackages: [] });
    expect(await getSteamLibrary({ fetch: fn, store, now: () => NOW })).toEqual({ status: 'signed-out' });
    expect(store.value).toBeUndefined();
  });

  it('serves the cache for an hour without calling Steam', async () => {
    const store = memoryStore({ apps: [1], packages: [], fetchedAt: NOW - 59 * 60 * 1000 });
    const { fn, calls } = fakeFetch({});
    expect(await getSteamLibrary({ fetch: fn, store, now: () => NOW })).toMatchObject({ status: 'ok', apps: [1] });
    expect(calls).toHaveLength(0);
  });

  it('refreshes when forced or stale', async () => {
    const store = memoryStore({ apps: [1], packages: [], fetchedAt: NOW });
    const { fn, calls } = fakeFetch({ rgOwnedApps: [2], rgOwnedPackages: [] });
    expect(await getSteamLibrary({ fetch: fn, store, now: () => NOW }, { force: true })).toMatchObject({ apps: [2] });
    expect(calls).toHaveLength(1);
  });

  it('falls back to the stale cache when Steam fails', async () => {
    const store = memoryStore({ apps: [1], packages: [], fetchedAt: NOW - 5 * HOUR });
    const { fn } = fakeFetch({}, 502);
    expect(await getSteamLibrary({ fetch: fn, store, now: () => NOW })).toMatchObject({ status: 'ok', apps: [1] });
  });

  it('reports an error when Steam fails and nothing is cached', async () => {
    const { fn } = fakeFetch(new TypeError('Failed to fetch'));
    expect(await getSteamLibrary({ fetch: fn, store: memoryStore(), now: () => NOW })).toEqual({
      status: 'error',
      message: 'Failed to fetch',
    });
  });

  it('treats an unexpected response shape as an error', async () => {
    const { fn } = fakeFetch({ success: false });
    expect(await getSteamLibrary({ fetch: fn, store: memoryStore(), now: () => NOW })).toMatchObject({ status: 'error' });
  });
});
