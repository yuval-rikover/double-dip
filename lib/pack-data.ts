import type { GameStores } from './owned';
import type { SteamRating } from './steam-ratings';

/** On a pack badge: the games inside, as JSON `PackEntry[]`. */
export const PACK_ATTR = 'data-bsl-pack';
/** On a pack badge once its games' ownership is known: JSON `GameStores[]`, in the order of `PACK_ATTR`. */
export const PACK_STORES_ATTR = 'data-bsl-pack-stores';
/** On a pack badge once its games' ratings are known: JSON `(SteamRating | null)[]`, in the order of `PACK_ATTR`. */
export const PACK_RATINGS_ATTR = 'data-bsl-pack-ratings';

/** A game in a pack: the title and "app/123", or null when not on Steam. */
export type PackEntry = [title: string, steamRef: string | null];

function readJson<T>(el: Element, attr: string): T | undefined {
  try {
    return JSON.parse(el.getAttribute(attr) ?? 'null') ?? undefined;
  } catch {
    return undefined;
  }
}

export const packEntries = (pack: Element): PackEntry[] => readJson<PackEntry[]>(pack, PACK_ATTR) ?? [];
export const packStores = (pack: Element) => readJson<GameStores[]>(pack, PACK_STORES_ATTR);
export const packRatings = (pack: Element) => readJson<(SteamRating | null)[]>(pack, PACK_RATINGS_ATTR);
