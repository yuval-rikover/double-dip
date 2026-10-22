import { STEAM_REF_ATTR } from './badge';
import { STORE_NAMES, type Store } from './ownership';

/** Set on a Steam badge once its ownership has been checked. */
const CHECKED_ATTR = 'data-bsl-owned-checked';
const OWNED_ATTR = 'data-bsl-owned';

/** Stores owning the game with this Steam id; undefined while not answered yet. */
export type OwnershipLookup = (steamRef: string) => Store[] | undefined;

/** Steam ids of the badges not checked yet. */
export function uncheckedSteamRefs(doc: Document): string[] {
  const refs = [...doc.querySelectorAll(`[${STEAM_REF_ATTR}]:not([${CHECKED_ATTR}])`)].map(
    (badge) => badge.getAttribute(STEAM_REF_ATTR) ?? '',
  );
  return [...new Set(refs.filter(Boolean))];
}

/**
 * Adds an "Owned" marker beside every Steam badge whose game is in a library:
 * in the tile's other corner, or inline for inline badges. Works on badges
 * from any site, since it reads only the badge's own Steam id.
 * Returns how many markers were added.
 */
export function markOwnedBadges(doc: Document, lookup: OwnershipLookup): number {
  let added = 0;
  for (const badge of doc.querySelectorAll<HTMLElement>(`[${STEAM_REF_ATTR}]:not([${CHECKED_ATTR}])`)) {
    const stores = lookup(badge.getAttribute(STEAM_REF_ATTR) ?? '');
    if (!stores) continue;
    badge.setAttribute(CHECKED_ATTR, '');
    if (stores.length === 0) continue;
    const names = stores.map((store) => STORE_NAMES[store]);
    const marker = doc.createElement('span');
    marker.setAttribute(OWNED_ATTR, stores.join(' '));
    marker.className = badge.classList.contains('bsl-badge--inline') ? 'bsl-owned bsl-owned--inline' : 'bsl-owned';
    marker.textContent = `✓ Owned · ${names.join(', ')}`;
    marker.title = `In your ${names.join(' and ')} ${names.length > 1 ? 'libraries' : 'library'}`;
    badge.after(marker);
    added++;
  }
  return added;
}
