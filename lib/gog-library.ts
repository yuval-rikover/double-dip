import { loadCachedLibrary, numbers, type LibraryResult, type LibraryStore } from './library-cache';

/** The signed-in user's owned and wishlisted GOG product ids. */
export interface OwnedGog {
  owned: number[];
  /** Missing from libraries cached before wishlists were read, or when GOG didn't answer. */
  wishlist?: number[];
  fetchedAt: number;
}

export type GogLibrary = LibraryResult<OwnedGog>;

export interface GogLibraryDeps {
  fetch: typeof fetch;
  store: LibraryStore<OwnedGog>;
  now?: () => number;
}

const GAMES_URL = 'https://embed.gog.com/user/data/games';
const WISHLIST_URL = 'https://embed.gog.com/user/wishlist.json';

/**
 * Reads the owned product ids from the user's GOG session. Signed out, GOG
 * doesn't answer with JSON but redirects to its login page. The wishlist is
 * a second request; if it fails, the library still loads, with the wishlist
 * from the last sync.
 */
export function getGogLibrary(deps: GogLibraryDeps, opts: { force?: boolean } = {}): Promise<GogLibrary> {
  const now = (deps.now ?? Date.now)();
  return loadCachedLibrary(
    deps.store,
    now,
    async (cached) => {
      const response = await deps.fetch(GAMES_URL, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`GOG games returned ${response.status}`);
      if (response.redirected || !response.headers.get('content-type')?.includes('json')) return 'signed-out';
      const owned = numbers(((await response.json()) as { owned?: unknown }).owned);
      if (!owned) throw new Error('GOG games has no owned list');
      const wishlist = (await fetchGogWishlist(deps.fetch).catch(() => undefined)) ?? cached?.wishlist;
      return { owned, ...(wishlist && { wishlist }), fetchedAt: now };
    },
    opts,
  );
}

/** `{"wishlist": {"1207658890": true, …}}`: the product ids marked true. */
async function fetchGogWishlist(fetchFn: typeof fetch): Promise<number[] | undefined> {
  const response = await fetchFn(WISHLIST_URL, { credentials: 'include', cache: 'no-store' });
  if (!response.ok || !response.headers.get('content-type')?.includes('json')) return undefined;
  const { wishlist } = (await response.json()) as { wishlist?: unknown };
  if (!wishlist || typeof wishlist !== 'object') return undefined;
  return Object.entries(wishlist)
    .filter(([id, on]) => on === true && /^\d+$/.test(id))
    .map(([id]) => Number(id));
}
