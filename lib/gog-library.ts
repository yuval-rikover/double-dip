import { loadCachedLibrary, numbers, type LibraryResult, type LibraryStore } from './library-cache';

/** The signed-in user's owned GOG product ids. */
export interface OwnedGog {
  owned: number[];
  fetchedAt: number;
}

export type GogLibrary = LibraryResult<OwnedGog>;

export interface GogLibraryDeps {
  fetch: typeof fetch;
  store: LibraryStore<OwnedGog>;
  now?: () => number;
}

const GAMES_URL = 'https://embed.gog.com/user/data/games';

/**
 * Reads the owned product ids from the user's GOG session. Signed out, GOG
 * doesn't answer with JSON but redirects to its login page.
 */
export function getGogLibrary(deps: GogLibraryDeps, opts: { force?: boolean } = {}): Promise<GogLibrary> {
  const now = (deps.now ?? Date.now)();
  return loadCachedLibrary(
    deps.store,
    now,
    async () => {
      const response = await deps.fetch(GAMES_URL, { credentials: 'include', cache: 'no-store' });
      if (!response.ok) throw new Error(`GOG games returned ${response.status}`);
      if (response.redirected || !response.headers.get('content-type')?.includes('json')) return 'signed-out';
      const owned = numbers(((await response.json()) as { owned?: unknown }).owned);
      if (!owned) throw new Error('GOG games has no owned list');
      return { owned, fetchedAt: now };
    },
    opts,
  );
}
