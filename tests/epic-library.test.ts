import { describe, expect, it } from 'vitest';
import { createEpicSource, fetchEpicOrders, getEpicLibrary, type OwnedEpic } from '../lib/epic-library';
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

function memoryStore(initial?: OwnedEpic): LibraryStore<OwnedEpic> & { value?: OwnedEpic } {
  const store: LibraryStore<OwnedEpic> & { value?: OwnedEpic } = {
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

  it('reports signed out after a sync finds no session', async () => {
    const epic = createEpicSource({ fetch: signedOutFetch, store: memoryStore(), now: () => NOW });
    await epic.refresh();
    expect(await epic.now()).toEqual({ status: 'signed-out' });
  });
});
