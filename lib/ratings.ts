import { STEAM_REF_ATTR } from './badge';
import { PACK_ATTR, PACK_RATINGS_ATTR, packEntries } from './pack-data';
import { ratingPercent, reviewCount, reviewsText } from './rating-label';
import type { SteamRating } from './steam-ratings';
import { setTip, TIP_ATTR } from './tooltip';

/** Set on a Steam or pack badge once its rating has been added or ruled out. */
const RATED_ATTR = 'data-bsl-rated';

/** Rating for a Steam id: null for none, undefined while not answered yet. */
export type RatingLookup = (steamRef: string) => SteamRating | null | undefined;

/** Steam link badges not rated, or ruled out, yet. */
function unratedBadges(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(`a[${STEAM_REF_ATTR}]:not([${RATED_ATTR}])`)];
}

function unratedPacks(doc: Document): HTMLElement[] {
  return [...doc.querySelectorAll<HTMLElement>(`[${PACK_ATTR}]:not([${RATED_ATTR}])`)];
}

/** Steam ids of the badges still waiting for a rating, including every game in an unrated pack. */
export function unratedSteamRefs(doc: Document): string[] {
  const refs = unratedBadges(doc).map((badge) => badge.getAttribute(STEAM_REF_ATTR) ?? '');
  for (const pack of unratedPacks(doc)) refs.push(...packEntries(pack).map(([, ref]) => ref ?? ''));
  return [...new Set(refs)].filter(Boolean);
}

/**
 * Adds the Steam rating to each Steam badge: "Steam 93% 👤6.7K ↗", the
 * percentage tinted by Steam's score and dimmed when there are few reviews, with the label and
 * review count in the tooltip. Pack badges keep their games' ratings for
 * their tooltip and menu. Returns how many Steam badges got a rating.
 */
export function markRatedBadges(doc: Document, lookup: RatingLookup): number {
  let added = 0;
  for (const badge of unratedBadges(doc)) {
    const rating = lookup(badge.getAttribute(STEAM_REF_ATTR) ?? '');
    if (rating === undefined) continue;
    badge.setAttribute(RATED_ATTR, '');
    if (!rating) continue;
    addRating(doc, badge, rating);
    added++;
  }
  // A pack's games get theirs in its tooltip and menu, once all are answered.
  for (const pack of unratedPacks(doc)) {
    const ratings = packEntries(pack).map(([, ref]) => (ref ? lookup(ref) : null));
    if (ratings.includes(undefined)) continue;
    pack.setAttribute(RATED_ATTR, '');
    pack.setAttribute(PACK_RATINGS_ATTR, JSON.stringify(ratings));
  }
  return added;
}

function addRating(doc: Document, badge: HTMLElement, rating: SteamRating): void {
  badge.textContent = 'Steam ';
  badge.append(ratingPercent(doc, rating), ' ', reviewCount(doc, rating), ' ↗');
  // Under the game's name, the first line.
  const [name = '', ...rest] = (badge.getAttribute(TIP_ATTR) ?? '').split('\n');
  setTip(badge, [name, reviewsText(rating), ...rest].join('\n'));
}
