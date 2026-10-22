import type { LibrarySummaries } from './library-summary';
import type { OwnershipResult } from './ownership';
import type { SteamRef } from './steam';

/** Content script → background: find Steam entries for game titles. */
export interface ResolveSteamTitlesMessage {
  type: 'resolveSteamTitles';
  titles: string[];
}

export type ResolveSteamTitlesResponse = Record<string, SteamRef | null>;

/** Content script → background: which libraries hold the games with these Steam ids. */
export interface GetOwnershipMessage {
  type: 'getOwnership';
  steamRefs: string[];
}

export type GetOwnershipResponse = OwnershipResult;

/** Popup → background: library status per store; `refresh` re-reads them from the stores. */
export interface GetLibraryStatusMessage {
  type: 'getLibraryStatus';
  refresh: boolean;
}

export type GetLibraryStatusResponse = LibrarySummaries;

/**
 * Content script → background, as a bundle page opens: start loading the
 * libraries now, so they're ready by the time the first ownership question
 * arrives. Fire and forget.
 */
export interface WarmLibrariesMessage {
  type: 'warmLibraries';
}

export type ExtensionMessage =
  | ResolveSteamTitlesMessage
  | GetOwnershipMessage
  | GetLibraryStatusMessage
  | WarmLibrariesMessage;

export function isExtensionMessage(message: unknown): message is ExtensionMessage {
  if (typeof message !== 'object' || message === null) return false;
  const { type, titles, steamRefs } = message as { type?: unknown; titles?: unknown; steamRefs?: unknown };
  return (
    (type === 'resolveSteamTitles' && Array.isArray(titles)) ||
    (type === 'getOwnership' && Array.isArray(steamRefs)) ||
    type === 'getLibraryStatus' ||
    type === 'warmLibraries'
  );
}
