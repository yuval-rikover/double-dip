import { browser } from 'wxt/browser';
import type {
  GetOwnershipMessage,
  GetOwnershipResponse,
  GetSteamRatingsMessage,
  GetSteamRatingsResponse,
  WarmLibrariesMessage,
} from './messages';
import { LIBRARY_KEYS, ownedIdsChanged } from './library-cache';
import { clearOwnedMarkers, markOwnedBadges, uncheckedSteamRefs, type GameStores } from './owned';
import { markRatedBadges, unratedSteamRefs } from './ratings';
import type { SteamRating } from './steam-ratings';

/** Badges arriving within this window go to the background as one question. */
const BATCH_WINDOW_MS = 60;

/** Asks the background to start loading the libraries while the page renders. */
export function warmLibraries(): void {
  const message: WarmLibrariesMessage = { type: 'warmLibraries' };
  try {
    browser.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // Throws synchronously once the extension was reloaded under this page.
  }
}

/**
 * Returns a function for content scripts to call after each round of badges:
 * it asks the background which libraries hold the newly badged games and adds
 * "Owned" (or wishlisted) markers as the answers arrive. When a library or
 * wishlist changes (a purchase, signing in or out of a store), the markers
 * are redone without a reload.
 */
export function createOwnershipMarker(): () => void {
  const decorator = createBadgeDecorator<GameStores>({
    mark: (lookup) => markOwnedBadges(document, lookup),
    clear: () => clearOwnedMarkers(document),
    unchecked: () => uncheckedSteamRefs(document),
    ask: async (steamRefs) => {
      const message: GetOwnershipMessage = { type: 'getOwnership', steamRefs };
      const response = (await browser.runtime.sendMessage(message)) as GetOwnershipResponse | undefined;
      if (!response) return undefined;
      return Object.fromEntries(
        Object.entries(response.owned).map(([ref, owned]) => [ref, { owned, wishlisted: response.wishlisted?.[ref] }]),
      );
    },
    // Unanswered ids (background failure) count as not owned.
    fallback: { owned: [] },
  });
  const libraryKeys = new Set<string>(Object.values(LIBRARY_KEYS));
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const changed = Object.entries(changes).some(
        ([key, change]) => libraryKeys.has(key) && ownedIdsChanged(change.oldValue, change.newValue),
      );
      if (changed) decorator.reask();
    });
  } catch {
    // Left behind by an extension reload: the extension can't be reached.
  }
  return decorator.decorate;
}

/**
 * Like `createOwnershipMarker`, for Steam ratings in the badges. `tileSelector`
 * matches the site's game tiles, to spot tiles that already show the rating.
 */
export function createRatingMarker(tileSelector: string): () => void {
  return createBadgeDecorator<SteamRating | null>({
    mark: (lookup) => markRatedBadges(document, lookup, tileSelector),
    unchecked: () => unratedSteamRefs(document),
    ask: async (steamRefs) => {
      const message: GetSteamRatingsMessage = { type: 'getSteamRatings', steamRefs };
      return (await browser.runtime.sendMessage(message)) as GetSteamRatingsResponse | undefined;
    },
    fallback: null,
  }).decorate;
}

interface BadgeDecorator<T> {
  /** Decorates the badges `lookup` can answer for. */
  mark(lookup: (steamRef: string) => T | undefined): void;
  /** Removes the decorations, for `reask`. */
  clear?(): void;
  /** Steam ids of the badges not decorated yet. */
  unchecked(): string[];
  ask(steamRefs: string[]): Promise<Record<string, T> | undefined>;
  /** The answer for ids the background didn't answer. */
  fallback: T;
}

/**
 * Each Steam id is asked about once, and ids badged in quick succession are
 * batched into one question (each costs the background a network call or a
 * few). `reask` asks again about every id so far and redoes the decorations
 * once the answers are in, so they don't flicker off while waiting.
 */
function createBadgeDecorator<T>(decorator: BadgeDecorator<T>): { decorate: () => void; reask: () => void } {
  const answers = new Map<string, T>();
  const requested = new Set<string>();
  let batch: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mark = () => decorator.mark((ref) => answers.get(ref));

  const flush = () => {
    const refs = batch;
    batch = [];
    timer = undefined;
    decorator
      .ask(refs)
      .then((response) => {
        for (const ref of refs) answers.set(ref, response?.[ref] ?? decorator.fallback);
        mark();
      })
      .catch((error) => console.warn('[Double Dip]', error));
  };

  const decorate = () => {
    mark();
    const refs = decorator.unchecked().filter((ref) => !requested.has(ref));
    if (refs.length === 0) return;
    refs.forEach((ref) => requested.add(ref));
    batch.push(...refs);
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  };

  let reasking = 0;
  const reask = () => {
    const refs = [...answers.keys()];
    if (refs.length === 0) return;
    // A later change wins over an earlier one still waiting for answers.
    const thisRound = ++reasking;
    decorator
      .ask(refs)
      .then((response) => {
        if (thisRound !== reasking) return;
        for (const ref of refs) answers.set(ref, response?.[ref] ?? decorator.fallback);
        decorator.clear?.();
        mark();
      })
      .catch((error) => console.warn('[Double Dip]', error));
  };

  return { decorate, reask };
}
