import { loadCachedLibrary, type LibraryResult, type LibraryStore } from './library-cache';

/** Offer ids of the user's Epic Games Store purchases and free claims. */
export interface OwnedEpic {
  offers: string[];
  /** Newest order seen; an incremental sync stops when it reaches it. */
  newestOrderId: string | null;
  fullSyncAt: number;
  fetchedAt: number;
}

export type EpicLibrary = LibraryResult<OwnedEpic>;
/** What pages get: Epic is never waited on, so a first sync reads as "syncing". */
export type EpicLibraryNow = EpicLibrary | { status: 'syncing' };

export interface EpicLibraryDeps {
  fetch: typeof fetch;
  store: LibraryStore<OwnedEpic>;
  now?: () => number;
}

// accounts.epicgames.com, not www: www puts a bot challenge in front of it.
const ORDERS_URL = 'https://accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory?sortDir=DESC&sortBy=DATE&locale=en-US';
const STORE_MARKETPLACE = 'Epic Games Store';
const FULL_SYNC_EVERY = 7 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 500;

interface EpicOrder {
  orderId?: string;
  marketplaceName?: string;
  items?: { offerId?: string; giftRecipient?: unknown }[];
}

/**
 * Pages through the order history, newest first, collecting offer ids of
 * Epic Games Store orders. Unreal/Fab marketplace assets and gifts bought for
 * someone else are skipped. Stops early at `stopAtOrderId`. About 10 orders
 * per page, so a large history takes a while — callers shouldn't block on it.
 */
export async function fetchEpicOrders(
  fetchFn: typeof fetch,
  stopAtOrderId?: string | null,
): Promise<{ offers: string[]; newestOrderId: string | null } | 'signed-out'> {
  const offers: string[] = [];
  let newestOrderId: string | null = null;
  let token: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url: string = token ? `${ORDERS_URL}&nextPageToken=${encodeURIComponent(token)}` : ORDERS_URL;
    const response = await fetchFn(url, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) throw new Error(`Epic order history returned ${response.status}`);
    // Signed out, Epic redirects to its login page instead of answering.
    if (response.redirected || !response.headers.get('content-type')?.includes('json')) {
      if (page === 0) return 'signed-out';
      throw new Error('Epic order history stopped answering mid-sync');
    }
    const data = (await response.json()) as { orders?: EpicOrder[]; nextPageToken?: string | null };
    if (!Array.isArray(data.orders)) throw new Error('Epic order history has no orders list');
    for (const order of data.orders) {
      if (stopAtOrderId && order.orderId === stopAtOrderId) return { offers, newestOrderId };
      newestOrderId ??= order.orderId ?? null;
      if (order.marketplaceName !== STORE_MARKETPLACE) continue;
      for (const item of order.items ?? []) {
        if (item.offerId && !item.giftRecipient) offers.push(item.offerId);
      }
    }
    token = data.nextPageToken ?? null;
    if (!token) return { offers, newestOrderId };
  }
  throw new Error(`Epic order history ran past ${MAX_PAGES} pages`);
}

/**
 * Reads the Epic library from the user's Epic session, cached for an hour.
 * Refreshes fetch only orders newer than the cached ones; a full re-read runs
 * weekly so the cache can't drift for long.
 */
export function getEpicLibrary(deps: EpicLibraryDeps, opts: { force?: boolean } = {}): Promise<EpicLibrary> {
  const now = (deps.now ?? Date.now)();
  return loadCachedLibrary(
    deps.store,
    now,
    async (cached) => {
      const base = cached && now - cached.fullSyncAt < FULL_SYNC_EVERY ? cached : null;
      const fetched = await fetchEpicOrders(deps.fetch, base?.newestOrderId);
      if (fetched === 'signed-out') return 'signed-out';
      return {
        offers: [...new Set([...(base?.offers ?? []), ...fetched.offers])],
        newestOrderId: fetched.newestOrderId ?? base?.newestOrderId ?? null,
        fullSyncAt: base?.fullSyncAt ?? now,
        fetchedAt: now,
      };
    },
    opts,
  );
}

/**
 * Epic access for the background: `now()` answers at once from whatever is
 * cached and refreshes in the background when that's stale; `refresh()` waits
 * for a sync. Concurrent syncs share one run.
 */
export function createEpicSource(deps: EpicLibraryDeps) {
  const MAX_AGE = 60 * 60 * 1000;
  let running: Promise<EpicLibrary> | null = null;
  let last: EpicLibrary | null = null;

  const refresh = (force = false): Promise<EpicLibrary> => {
    running ??= getEpicLibrary(deps, { force })
      .then((library) => (last = library))
      .finally(() => (running = null));
    return running;
  };

  const now = async (): Promise<EpicLibraryNow> => {
    const cached = await deps.store.get();
    const age = cached ? (deps.now ?? Date.now)() - cached.fetchedAt : Infinity;
    if (age >= MAX_AGE) void refresh().catch(() => undefined);
    if (cached) return { status: 'ok', ...cached };
    // No cache: report the last sync's outcome (signed out, error) if there was one.
    return last && last.status !== 'ok' ? last : { status: 'syncing' };
  };

  return { now, refresh };
}
