import { BADGE_ATTR, STEAM_REF_ATTR } from './badge';
import { PACK_ATTR, PACK_RATINGS_ATTR, packEntries } from './pack-data';
import { ratingPercent, reviewsText } from './rating-label';
import type { SteamRating } from './steam-ratings';
import { setTip, TIP_ATTR } from './tooltip';

/** Set on a Steam or pack badge once its rating has been added or ruled out. */
const RATED_ATTR = 'data-bsl-rated';

/** Rating for a Steam id: null for none, undefined while not answered yet. */
export type RatingLookup = (steamRef: string) => SteamRating | null | undefined;

/** Steam's review labels, as sites copy them onto tiles (Green Man Gaming). */
const STEAM_LABELS = new Set([
  'overwhelmingly positive',
  'very positive',
  'positive',
  'mostly positive',
  'mixed',
  'mostly negative',
  'negative',
  'very negative',
  'overwhelmingly negative',
]);
/** Humble's flavor line: "83% Positive on Steam". */
const PERCENT_TEXT = /\b\d{1,3}% (positive|negative|mixed)\b/i;

/**
 * Whether the site already shows the game's Steam rating on this tile: then
 * the badge doesn't repeat it.
 */
export function tileShowsSteamRating(tile: Element | null): boolean {
  if (!tile) return false;
  for (const el of [tile, ...tile.querySelectorAll('*')]) {
    if (el.closest(`[${BADGE_ATTR}], .bsl-owned`)) continue;
    const own = [...el.childNodes]
      .filter((node) => node.nodeType === 3)
      .map((node) => node.textContent)
      .join('')
      .trim();
    if (PERCENT_TEXT.test(own) || STEAM_LABELS.has(own.toLowerCase())) return true;
  }
  return false;
}

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
 * Adds the Steam rating to each Steam badge: "Steam 93% ↗", tinted by
 * Steam's score and dimmed when there are few reviews, with the label and
 * review count in the tooltip. Badges on
 * tiles matching `tileSelector` that already show the rating are skipped,
 * without asking Steam. Pack badges keep their games' ratings for their
 * tooltip and menu. Returns how many Steam badges got a rating.
 */
export function markRatedBadges(doc: Document, lookup: RatingLookup, tileSelector: string): number {
  let added = 0;
  for (const badge of unratedBadges(doc)) {
    if (tileShowsSteamRating(badge.closest(tileSelector))) {
      badge.setAttribute(RATED_ATTR, '');
      continue;
    }
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
  badge.append(ratingPercent(doc, rating), ' ↗');
  // Under the game's name, the first line.
  const [name = '', ...rest] = (badge.getAttribute(TIP_ATTR) ?? '').split('\n');
  setTip(badge, [name, reviewsText(rating), ...rest].join('\n'));
}
