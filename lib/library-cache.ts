/** A store library as the background reports it. */
export type LibraryResult<T> =
  | ({ status: 'ok' } & T)
  | { status: 'signed-out' }
  | { status: 'error'; message: string };

export type LibraryStatus = LibraryResult<unknown>['status'];

export interface LibraryStore<T> {
  get(): Promise<T | undefined>;
  set(library: T): Promise<void>;
  clear(): Promise<void>;
}

const MAX_AGE = 60 * 60 * 1000;

/**
 * Serves a store library from cache for an hour, otherwise fetches it fresh.
 * Signing out clears the cache, unless `keepWhenSignedOut`: then the cached
 * library is kept, marked `signedOut`, until a sync succeeds again. On a
 * failed refresh the last cached library is returned, however old, so a store
 * outage doesn't hide every marker.
 */
export async function loadCachedLibrary<T extends { fetchedAt: number; signedOut?: boolean }>(
  store: LibraryStore<T>,
  now: number,
  /** Gets the cached library, if any, to refresh incrementally from. */
  fetchFresh: (cached: T | undefined) => Promise<T | 'signed-out'>,
  opts: { force?: boolean; keepWhenSignedOut?: boolean } = {},
): Promise<LibraryResult<T>> {
  const cached = await store.get();
  if (!opts.force && cached && !cached.signedOut && now - cached.fetchedAt < MAX_AGE) return { status: 'ok', ...cached };
  try {
    const fresh = await fetchFresh(cached);
    if (fresh === 'signed-out') {
      if (opts.keepWhenSignedOut && cached) {
        const kept: T = { ...cached, signedOut: true };
        await store.set(kept);
        return { status: 'ok', ...kept };
      }
      await store.clear();
      return { status: 'signed-out' };
    }
    await store.set(fresh);
    return { status: 'ok', ...fresh };
  } catch (error) {
    if (cached) return { status: 'ok', ...cached };
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

export function numbers(value: unknown): number[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'number') ? value : null;
}
