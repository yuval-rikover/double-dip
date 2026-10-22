import { BADGE_ATTR, createSteamBadge } from './badge';
import type { SteamRef } from './steam';

/** Game tiles in the bundle's tier grid. */
const TILE_TITLE_SELECTOR = '.tier-item-view .item-title';
/** The heading of each game's details panel (the carousel opened by a tile). */
const DETAILS_TITLE_SELECTOR = '.tier-item-details-view .header-area h2';

/**
 * Lookup result per title: a ref, null for "no Steam match", undefined for
 * "not resolved yet".
 */
export type SteamLookup = (title: string) => SteamRef | null | undefined;

export function collectHumbleTitles(doc: Document): string[] {
  const titles = [...doc.querySelectorAll(`${TILE_TITLE_SELECTOR}, ${DETAILS_TITLE_SELECTOR}`)].map(
    (el) => el.textContent?.trim() ?? '',
  );
  return [...new Set(titles.filter(Boolean))];
}

/**
 * Adds a Steam badge to each tile (in its corner) and each details heading
 * (inline after it) whose title has been resolved. Returns how many were added.
 */
export function annotateHumble(doc: Document, lookup: SteamLookup): number {
  let added = 0;
  for (const titleEl of doc.querySelectorAll(TILE_TITLE_SELECTOR)) {
    const tile = titleEl.closest('.tier-item-view');
    if (!tile || tile.querySelector(`[${BADGE_ATTR}]`)) continue;
    const badge = badgeFor(doc, titleEl, lookup, 'corner');
    if (!badge) continue;
    tile.append(badge);
    added++;
  }
  for (const heading of doc.querySelectorAll(DETAILS_TITLE_SELECTOR)) {
    if (heading.parentElement?.querySelector(`[${BADGE_ATTR}]`)) continue;
    const badge = badgeFor(doc, heading, lookup, 'inline');
    if (!badge) continue;
    heading.after(badge);
    added++;
  }
  return added;
}

function badgeFor(doc: Document, titleEl: Element, lookup: SteamLookup, placement: 'corner' | 'inline') {
  const name = titleEl.textContent?.trim() ?? '';
  const steam = name ? lookup(name) : undefined;
  return steam === undefined ? null : createSteamBadge(doc, { name, steam }, placement);
}
