import { BADGE_ATTR, STEAM_REF_ATTR } from './badge';
import type { SteamRating } from './steam-ratings';

/** Set on a Steam badge once its rating has been added or ruled out. */
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

/** Steam ids of the badges still waiting for a rating. */
export function unratedSteamRefs(doc: Document): string[] {
  return [...new Set(unratedBadges(doc).map((badge) => badge.getAttribute(STEAM_REF_ATTR) ?? ''))].filter(Boolean);
}

/**
 * Adds the Steam rating to each Steam badge: "Steam 93% ↗", tinted by
 * Steam's score, with the label and review count in the tooltip. Badges on
 * tiles matching `tileSelector` that already show the rating are skipped,
 * without asking Steam. Returns how many badges got a rating.
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
  return added;
}

function addRating(doc: Document, badge: HTMLElement, rating: SteamRating): void {
  const percent = doc.createElement('span');
  percent.className = `bsl-rating bsl-rating--${tone(rating.score)}`;
  percent.textContent = `${rating.percent}%`;
  badge.textContent = 'Steam ';
  badge.append(percent, ' ↗');
  badge.title += ` · ${rating.label}: ${rating.percent}% of ${rating.count.toLocaleString('en-US')} reviews`;
}

/** Steam's own grouping: 6–9 positive, 5 mixed, 1–4 negative. */
function tone(score: number): 'positive' | 'mixed' | 'negative' {
  if (score >= 6) return 'positive';
  return score === 5 ? 'mixed' : 'negative';
}
