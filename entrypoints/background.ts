import type { KeyValueCache } from '../lib/cache';
import { createLimiter, shareInFlight } from '../lib/concurrency';
import { createEpicSource, type OwnedEpic } from '../lib/epic-library';
import { getGogLibrary, type OwnedGog } from '../lib/gog-library';
import type { LibraryStore } from '../lib/library-cache';
import { summarizeLibrary, type LibrarySummaries } from '../lib/library-summary';
import { isExtensionMessage, type ExtensionMessage } from '../lib/messages';
import { getOwnership } from '../lib/ownership';
import { steamRefsToShopIds, type CachedShopIds } from '../lib/shop-map';
import { getSteamLibrary, type OwnedSteam } from '../lib/steam-library';
import { getSteamRatings, type CachedRating } from '../lib/steam-ratings';
import { resolveSteamTitles, SEARCH_CONCURRENCY, type CachedRef } from '../lib/steam-resolve';

function keyValueCache<V>(): KeyValueCache<V> {
  return {
    get: (keys) => browser.storage.local.get(keys) as Promise<Record<string, V | undefined>>,
    set: (entries) => browser.storage.local.set(entries),
  };
}

function libraryStore<T>(key: string): LibraryStore<T> {
  return {
    get: async () => (await browser.storage.local.get(key))[key] as T | undefined,
    set: (library) => browser.storage.local.set({ [key]: library }),
    clear: () => browser.storage.local.remove(key),
  };
}

const fetchFn = (...args: Parameters<typeof fetch>) => fetch(...args);
const titleCache = keyValueCache<CachedRef>();
const shopIdCache = keyValueCache<CachedShopIds>();
const ratingCache = keyValueCache<CachedRating>();
const steamStore = libraryStore<OwnedSteam>('steam-library');
const gogStore = libraryStore<OwnedGog>('gog-library');

// Several pages (or a warm-up and the first ownership question) can ask at
// once; they share one load instead of each fetching the library.
const steamLibraryShared = shareInFlight(() => getSteamLibrary({ fetch: fetchFn, store: steamStore }));
const gogLibraryShared = shareInFlight(() => getGogLibrary({ fetch: fetchFn, store: gogStore }));
const steamLibrary = (force = false) =>
  force ? getSteamLibrary({ fetch: fetchFn, store: steamStore }, { force }) : steamLibraryShared();
const gogLibrary = (force = false) =>
  force ? getGogLibrary({ fetch: fetchFn, store: gogStore }, { force }) : gogLibraryShared();
// Epic's history takes many requests to read, so pages never wait for it.
const epic = createEpicSource({ fetch: fetchFn, store: libraryStore<OwnedEpic>('epic-library') });
// Shared by every title lookup: Humble pages send one request per title.
const steamSearchLimit = createLimiter(SEARCH_CONCURRENCY);

async function libraryStatus(refresh: boolean): Promise<LibrarySummaries> {
  const [steam, gog, epicLibrary] = await Promise.all([
    steamLibrary(refresh),
    gogLibrary(refresh),
    refresh ? epic.refresh(true) : epic.now(),
  ]);
  return {
    steam: summarizeLibrary(steam, (library) => library.apps.length),
    gog: summarizeLibrary(gog, (library) => library.owned.length),
    epic: summarizeLibrary(epicLibrary, (library) => library.offers.length),
  };
}

function handle(message: ExtensionMessage): Promise<unknown> {
  switch (message.type) {
    case 'resolveSteamTitles':
      return resolveSteamTitles(message.titles, { fetch: fetchFn, cache: titleCache, limit: steamSearchLimit });
    case 'getOwnership':
      return getOwnership(message.steamRefs, {
        steam: () => steamLibrary(),
        gog: () => gogLibrary(),
        epic: () => epic.now(),
        shopIds: (refs) => steamRefsToShopIds(refs, { fetch: fetchFn, cache: shopIdCache }),
      });
    case 'getSteamRatings':
      return getSteamRatings(message.steamRefs, { fetch: fetchFn, cache: ratingCache });
    case 'getLibraryStatus':
      return libraryStatus(message.refresh);
    case 'warmLibraries':
      return Promise.all([steamLibrary(), gogLibrary(), epic.now()]).then(() => undefined);
  }
}

export default defineBackground(() => {
  // Network calls run here, not in content scripts: the stores' APIs send no
  // CORS headers, and only the background has the host permissions (and the
  // user's store cookies) to call them.
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isExtensionMessage(message)) return;
    handle(message)
      .then(sendResponse)
      .catch((error) => {
        console.warn('[Double Dip]', error);
        sendResponse(undefined);
      });
    return true; // keeps sendResponse valid until the work finishes
  });
});
