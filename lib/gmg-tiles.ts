import { BADGE_ATTR, createSteamBadge } from './badge';
import type { SteamLookup } from './title-site';

/**
 * Game tiles on a Green Man Gaming bundle page. The bonus coupon is also a
 * `.bundle-item`, but a div without a `.game-title`, so it's never matched.
 */
export const GMG_TILE_SELECTOR = 'figure.bundle-item';
const TILE_TITLE_SELECTOR = '.game-title';
const TILE_IMAGE_SELECTOR = '.image';

export function collectGmgTitles(doc: Document): string[] {
  const titles = [...doc.querySelectorAll(`${GMG_TILE_SELECTOR} ${TILE_TITLE_SELECTOR}`)].map(
    (el) => el.textContent?.trim() ?? '',
  );
  return [...new Set(titles.filter(Boolean))];
}

/** Adds a Steam badge to the image of each tile whose title is resolved. Returns how many were added. */
export function annotateGmg(doc: Document, lookup: SteamLookup): number {
  let added = 0;
  for (const tile of doc.querySelectorAll(GMG_TILE_SELECTOR)) {
    const name = tile.querySelector(TILE_TITLE_SELECTOR)?.textContent?.trim();
    if (!name || tile.querySelector(`[${BADGE_ATTR}]`)) continue;
    const steam = lookup(name);
    if (steam === undefined) continue;
    const holder = tile.querySelector<HTMLElement>(TILE_IMAGE_SELECTOR) ?? (tile as HTMLElement);
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    holder.append(createSteamBadge(doc, { name, steam }));
    added++;
  }
  return added;
}
