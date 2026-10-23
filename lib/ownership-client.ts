import { browser } from 'wxt/browser';
import type {
  GetOwnershipMessage,
  GetOwnershipResponse,
  GetSteamRatingsMessage,
  GetSteamRatingsResponse,
  WarmLibrariesMessage,
} from './messages';
import { markOwnedBadges, uncheckedSteamRefs } from './owned';
import type { Store } from './ownership';
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
 * "Owned" markers as the answers arrive.
 */
export function createOwnershipMarker(): () => void {
  return createBadgeDecorator<Store[]>({
    mark: (lookup) => markOwnedBadges(document, lookup),
    unchecked: () => uncheckedSteamRefs(document),
    ask: async (steamRefs) => {
      const message: GetOwnershipMessage = { type: 'getOwnership', steamRefs };
      return ((await browser.runtime.sendMessage(message)) as GetOwnershipResponse | undefined)?.owned;
    },
    // Unanswered ids (background failure) count as not owned.
    fallback: [],
  });
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
  });
}

interface BadgeDecorator<T> {
  /** Decorates the badges `lookup` can answer for. */
  mark(lookup: (steamRef: string) => T | undefined): void;
  /** Steam ids of the badges not decorated yet. */
  unchecked(): string[];
  ask(steamRefs: string[]): Promise<Record<string, T> | undefined>;
  /** The answer for ids the background didn't answer. */
  fallback: T;
}

/**
 * Each Steam id is asked about once, and ids badged in quick succession are
 * batched into one question (each costs the background a network call or a
 * few).
 */
function createBadgeDecorator<T>(decorator: BadgeDecorator<T>): () => void {
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

  return function decorate() {
    mark();
    const refs = decorator.unchecked().filter((ref) => !requested.has(ref));
    if (refs.length === 0) return;
    refs.forEach((ref) => requested.add(ref));
    batch.push(...refs);
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  };
}
