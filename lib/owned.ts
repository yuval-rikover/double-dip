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
    badge.after(createOwnedMarker(doc, stores, badge.classList.contains('bsl-badge--inline')));
    added++;
  }
  return added;
}

/** A green check followed by one chip per store, in that store's colors. */
function createOwnedMarker(doc: Document, stores: Store[], inline: boolean): HTMLElement {
  const names = stores.map((store) => STORE_NAMES[store]);
  const label = `Owned on ${names.join(' and ')}`;
  const marker = doc.createElement('span');
  marker.setAttribute(OWNED_ATTR, stores.join(' '));
  marker.className = inline ? 'bsl-owned bsl-owned--inline' : 'bsl-owned';
  marker.title = label;
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', label);
  const check = doc.createElement('span');
  check.className = 'bsl-owned__check';
  check.textContent = '✓';
  marker.append(check);
  for (const store of stores) {
    const chip = doc.createElement('span');
    chip.className = `bsl-chip bsl-chip--${store}`;
    chip.textContent = STORE_NAMES[store];
    marker.append(chip);
  }
  return marker;
}
