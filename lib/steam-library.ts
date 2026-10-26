import { loadCachedLibrary, numbers, type LibraryResult, type LibraryStore } from './library-cache';

/** The signed-in user's owned Steam apps and packages, and wishlisted apps. */
export interface OwnedSteam {
  apps: number[];
  packages: number[];
  /** Missing from libraries cached before wishlists were read. */
  wishlist?: number[];
  fetchedAt: number;
}

export type SteamLibrary = LibraryResult<OwnedSteam>;

export interface LibraryDeps {
  fetch: typeof fetch;
  store: LibraryStore<OwnedSteam>;
  now?: () => number;
}

const USERDATA_URL = 'https://store.steampowered.com/dynamicstore/userdata/';

/**
 * Reads the library from the user's Steam store session (the same call the
 * Steam store makes to mark owned games). A signed-out session answers with
 * empty lists, so "owns nothing" reads as signed out. The same answer has the
 * wishlist.
 */
export function getSteamLibrary(deps: LibraryDeps, opts: { force?: boolean } = {}): Promise<SteamLibrary> {
  const now = (deps.now ?? Date.now)();
  return loadCachedLibrary(
    deps.store,
    now,
    async () => {
      // Cache-busting query: Steam serves this with long-lived caching headers.
      const response = await deps.fetch(`${USERDATA_URL}?t=${now}`, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`Steam userdata returned ${response.status}`);
      const data = (await response.json()) as { rgOwnedApps?: unknown; rgOwnedPackages?: unknown; rgWishlist?: unknown };
      const apps = numbers(data.rgOwnedApps);
      const packages = numbers(data.rgOwnedPackages);
      if (!apps || !packages) throw new Error('Steam userdata has no owned lists');
      if (apps.length === 0 && packages.length === 0) return 'signed-out';
      return { apps, packages, wishlist: numbers(data.rgWishlist) ?? [], fetchedAt: now };
    },
    opts,
  );
}
