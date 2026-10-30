import type { OwnedEpic } from './epic-library';
import type { OwnedGog } from './gog-library';
import { LIBRARY_KEYS, type LibraryResult } from './library-cache';
import type { Store } from './ownership';
import type { OwnedSteam } from './steam-library';

/** A library as the popup shows it: a count instead of the id lists. */
export type LibrarySummary =
  | { status: 'ok'; count: number; fetchedAt: number; signedOut?: boolean }
  | { status: 'signed-out' }
  | { status: 'syncing' }
  | { status: 'error'; message: string }
  /** Nothing saved yet; the background is still asking the store. */
  | { status: 'checking' };

export type LibrarySummaries = Record<Store, LibrarySummary>;

/** How many items each store's library holds. */
export const LIBRARY_COUNTS = {
  steam: (library: OwnedSteam) => library.apps.length,
  gog: (library: OwnedGog) => library.owned.length,
  epic: (library: OwnedEpic) => library.offers.length,
};

export function summarizeLibrary<T extends { fetchedAt: number; signedOut?: boolean }>(
  library: LibraryResult<T> | { status: 'syncing' },
  count: (library: T) => number,
): LibrarySummary {
  if (library.status !== 'ok') return library;
  const summary: LibrarySummary = { status: 'ok', count: count(library), fetchedAt: library.fetchedAt };
  return library.signedOut ? { ...summary, signedOut: true } : summary;
}

/**
 * The popup's first look, from `storage.local`, while the background checks
 * the stores: each library as last saved, or "checking" where none is.
 */
export function savedSummaries(saved: Record<string, unknown>): LibrarySummaries {
  const summary = <T extends { fetchedAt: number }>(key: string, count: (library: T) => number): LibrarySummary => {
    const library = saved[key] as T | undefined;
    return library ? summarizeLibrary({ status: 'ok', ...library }, count) : { status: 'checking' };
  };
  return {
    steam: summary(LIBRARY_KEYS.steam, LIBRARY_COUNTS.steam),
    gog: summary(LIBRARY_KEYS.gog, LIBRARY_COUNTS.gog),
    epic: summary(LIBRARY_KEYS.epic, LIBRARY_COUNTS.epic),
  };
}

/**
 * Whether the popup should check this library again while open: a first sync
 * still running, or a store the user may be signing in to right now.
 */
export function awaitsChange(summary: LibrarySummary): boolean {
  return summary.status === 'syncing' || summary.status === 'signed-out' || (summary.status === 'ok' && !!summary.signedOut);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAge(fetchedAt: number, now: number): string {
  const minutes = Math.floor((now - fetchedAt) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** The popup's one-line description of a library. */
export function describeLibrary(summary: LibrarySummary, now: number): string {
  switch (summary.status) {
    case 'ok':
      // Only Epic keeps a library on sign-out: its session expires on its own.
      if (summary.signedOut) {
        return `Session expired · showing ${summary.count.toLocaleString('en-US')} items from ${formatAge(summary.fetchedAt, now)}`;
      }
      return `${summary.count.toLocaleString('en-US')} items · updated ${formatAge(summary.fetchedAt, now)}`;
    case 'signed-out':
      return 'Signed out in this browser';
    case 'syncing':
      return 'Reading purchase history… (takes up to ~30 s)';
    case 'error':
      return `Couldn't load: ${summary.message}`;
    case 'checking':
      return 'Checking…';
  }
}
