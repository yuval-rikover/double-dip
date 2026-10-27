import { describe, expect, it } from 'vitest';
import { createEpicSource, fetchEpicOrders, getEpicLibrary, type EpicFailure, type OwnedEpic } from '../lib/epic-library';
import type { LibraryStore } from '../lib/library-cache';

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const order = (orderId: string, offerIds: string[], extra: Record<string, unknown> = {}) => ({
  orderId,
  marketplaceName: 'Epic Games Store',
  items: offerIds.map((offerId) => ({ offerId, giftRecipient: null })),
  ...extra,
});

/** Fake order history, newest first, `perPage` orders per page. */
function historyFetch(orders: unknown[], perPage = 2) {
  const calls: string[] = [];
  const fn = (async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const start = Number(new URL(url).searchParams.get('nextPageToken') ?? 0);
    const next = start + perPage < orders.length ? String(start + perPage) : null;
    return new Response(JSON.stringify({ orders: orders.slice(start, start + perPage), nextPageToken: next }), {
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }) as typeof fetch;
  return { fn, calls };
}

const signedOutFetch = (async () =>
  new Response('Found. Redirecting to /auth/login', { headers: { 'content-type': 'text/plain' } })) as typeof fetch;

function memoryStore<T = OwnedEpic>(initial?: NoInfer<T>): LibraryStore<T> & { value?: T } {
  const store: LibraryStore<T> & { value?: T } = {
    value: initial,
    get: async () => store.value,
    set: async (library) => void (store.value = library),
    clear: async () => void (store.value = undefined),
  };
  return store;
}

describe('fetchEpicOrders', () => {
  it('reads every page, keeping store purchases only', async () => {
    const { fn, calls } = historyFetch([
      order('o5', ['a']),
      order('o4', ['fab-asset'], { marketplaceName: 'Fab Marketplace' }),
      order('o3', ['b', 'c']),
      { orderId: 'o2', marketplaceName: 'Epic Games Store', items: [{ offerId: 'gift', giftRecipient: 'friend' }] },
      order('o1', ['d']),
    ]);
    expect(await fetchEpicOrders(fn)).toEqual({ offers: ['a', 'b', 'c', 'd'], newestOrderId: 'o5' });
    expect(calls).toHaveLength(3);
  });

  it('stops at an already-seen order', async () => {
    const { fn, calls } = historyFetch([order('o3', ['new']), order('o2', ['old']), order('o1', ['older'])], 1);
    expect(await fetchEpicOrders(fn, 'o2')).toEqual({ offers: ['new'], newestOrderId: 'o3' });
    expect(calls).toHaveLength(2);
  });

  it('reads the login redirect as signed out', async () => {
    expect(await fetchEpicOrders(signedOutFetch)).toBe('signed-out');
  });

  it('reads an unfollowed login redirect as signed out', async () => {
    const calls: RequestInit[] = [];
    const fetchFn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      calls.push(init!);
      // What fetch returns for a redirect with `redirect: 'manual'`.
      return Object.defineProperty(new Response(null), 'type', { value: 'opaqueredirect' });
    }) as typeof fetch;
    expect(await fetchEpicOrders(fetchFn)).toBe('signed-out');
    expect(calls[0]!.redirect).toBe('manual');
  });
});

describe('getEpicLibrary', () => {
  it('does a full sync the first time', async () => {
    const store = memoryStore();
    const { fn } = historyFetch([order('o2', ['a']), order('o1', ['b'])]);
    expect(await getEpicLibrary({ fetch: fn, store, now: () => NOW })).toEqual({
      status: 'ok',
      offers: ['a', 'b'],
      newestOrderId: 'o2',
      fullSyncAt: NOW,
      fetchedAt: NOW,
    });
  });

  it('adds only newer orders on a refresh', async () => {
    const store = memoryStore({ offers: ['a', 'b'], newestOrderId: 'o2', fullSyncAt: NOW - DAY, fetchedAt: NOW - 2 * HOUR });
    const { fn, calls } = historyFetch([order('o3', ['c']), order('o2', ['a']), order('o1', ['b'])]);
    expect(await getEpicLibrary({ fetch: fn, store, now: () => NOW })).toMatchObject({
      offers: ['a', 'b', 'c'],
      newestOrderId: 'o3',
      fullSyncAt: NOW - DAY,
    });
    expect(calls).toHaveLength(1);
  });

  it('keeps the library when signed out, and re-reads it all on signing back in', async () => {
    const store = memoryStore({ offers: ['a', 'b'], newestOrderId: 'o2', fullSyncAt: NOW - DAY, fetchedAt: NOW - 2 * HOUR });
    expect(await getEpicLibrary({ fetch: signedOutFetch, store, now: () => NOW })).toEqual({
      status: 'ok',
      offers: ['a', 'b'],
      newestOrderId: 'o2',
      fullSyncAt: NOW - DAY,
      fetchedAt: NOW - 2 * HOUR,
      signedOut: true,
    });
    expect(store.value?.signedOut).toBe(true);

    // Maybe another account: a full read replaces the old offers.
    const { fn } = historyFetch([order('o9', ['z'])]);
    const library = await getEpicLibrary({ fetch: fn, store, now: () => NOW });
    expect(library).toMatchObject({ status: 'ok', offers: ['z'], newestOrderId: 'o9', fullSyncAt: NOW });
    expect(library).not.toHaveProperty('signedOut');
  });

  it('re-reads everything once a week', async () => {
    const store = memoryStore({ offers: ['refunded'], newestOrderId: 'o1', fullSyncAt: NOW - 8 * DAY, fetchedAt: NOW - 2 * HOUR });
    const { fn } = historyFetch([order('o1', ['b'])]);
    expect(await getEpicLibrary({ fetch: fn, store, now: () => NOW })).toMatchObject({ offers: ['b'], fullSyncAt: NOW });
  });
});

describe('createEpicSource', () => {
  it('answers "syncing" on the first call and has the library once the sync lands', async () => {
    const store = memoryStore();
    const { fn } = historyFetch([order('o1', ['a'])]);
    const epic = createEpicSource({ fetch: fn, store, now: () => NOW });
    expect(await epic.now()).toEqual({ status: 'syncing' });
    await epic.refresh(); // joins the sync now() started
    expect(await epic.now()).toMatchObject({ status: 'ok', offers: ['a'] });
  });

  it('serves a stale library at once while it refreshes', async () => {
    const store = memoryStore({ offers: ['a'], newestOrderId: 'o1', fullSyncAt: NOW, fetchedAt: NOW - 2 * HOUR });
    const { fn, calls } = historyFetch([order('o2', ['b']), order('o1', ['a'])]);
    const epic = createEpicSource({ fetch: fn, store, now: () => NOW });
    expect(await epic.now()).toMatchObject({ status: 'ok', offers: ['a'] });
    await epic.refresh();
    expect(calls).toHaveLength(1); // the background refresh, shared
    expect(store.value?.offers).toEqual(['a', 'b']);
  });

  it('checks again on every call while signed out', async () => {
    const store = memoryStore({ offers: ['a'], newestOrderId: 'o1', fullSyncAt: NOW, fetchedAt: NOW, signedOut: true });
    const { fn, calls } = historyFetch([order('o1', ['a'])]);
    const epic = createEpicSource({ fetch: fn, store, now: () => NOW });
    expect(await epic.now()).toMatchObject({ status: 'ok', offers: ['a'], signedOut: true });
    await epic.refresh();
    expect(calls).toHaveLength(1);
    expect(store.value?.signedOut).toBeUndefined();
  });

  it('has the popup read a kept library as signed out while signed out, on every check', async () => {
    const store = memoryStore({ offers: ['a'], newestOrderId: 'o1', fullSyncAt: NOW, fetchedAt: NOW, signedOut: true });
    const epic = createEpicSource({ fetch: signedOutFetch, store, now: () => NOW });
    for (let i = 0; i < 3; i++) {
      expect(await epic.status()).toMatchObject({ status: 'ok', signedOut: true });
      await epic.refresh(); // the re-check status() started
    }
  });

  it('has the popup read "syncing" while a re-read runs after signing back in', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { fn: history } = historyFetch([order('o2', ['b'])]);
    const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      await gate;
      return history(input, init);
    }) as typeof fetch;
    const store = memoryStore({ offers: ['a'], newestOrderId: 'o1', fullSyncAt: NOW, fetchedAt: NOW, signedOut: true });
    const epic = createEpicSource({ fetch: fn, store, now: () => NOW });
    // The first check starts the re-read, so it can't know yet.
    expect(await epic.status()).toMatchObject({ status: 'ok', signedOut: true });
    expect(await epic.status()).toEqual({ status: 'syncing' });
    // Pages keep the kept library meanwhile.
    expect(await epic.now()).toMatchObject({ status: 'ok', offers: ['a'] });
    release();
    await epic.refresh();
    expect(await epic.status()).toMatchObject({ status: 'ok', offers: ['b'] });
  });

  it('answers "syncing" without a cache while a sync runs, not the old signed-out result', async () => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    let signedIn = false;
    const { fn: history } = historyFetch([order('o1', ['a'])]);
    const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      if (!signedIn) return signedOutFetch(input, init);
      await gate;
      return history(input, init);
    }) as typeof fetch;
    const epic = createEpicSource({ fetch: fn, store: memoryStore(), now: () => NOW });
    await epic.refresh();
    expect(await epic.now()).toEqual({ status: 'signed-out' });
    await epic.refresh(); // the re-check now() started

    signedIn = true;
    const syncing = epic.refresh(true);
    expect(await epic.now()).toEqual({ status: 'syncing' });
    release();
    await syncing;
    expect(await epic.now()).toMatchObject({ status: 'ok', offers: ['a'] });
  });

  it('reports signed out after a sync finds no session', async () => {
    const epic = createEpicSource({ fetch: signedOutFetch, store: memoryStore(), now: () => NOW });
    await epic.refresh();
    expect(await epic.now()).toEqual({ status: 'signed-out' });
  });

  it('still reports signed out after the background was suspended', async () => {
    const lastFailure = memoryStore<EpicFailure>();
    const before = createEpicSource({ fetch: signedOutFetch, store: memoryStore(), lastFailure, now: () => NOW });
    await before.refresh();
    // A new source, as when the background wakes up again: only the stores remain.
    const after = createEpicSource({ fetch: signedOutFetch, store: memoryStore(), lastFailure, now: () => NOW });
    expect(await after.status()).toEqual({ status: 'signed-out' });
  });

  it('forgets the kept failure once a sync succeeds', async () => {
    const lastFailure = memoryStore<EpicFailure>({ status: 'signed-out' });
    const { fn } = historyFetch([order('o1', ['a'])]);
    const epic = createEpicSource({ fetch: fn, store: memoryStore(), lastFailure, now: () => NOW });
    await epic.refresh();
    expect(lastFailure.value).toBeUndefined();
  });
});
