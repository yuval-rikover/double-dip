import { PACK_ATTR, STEAM_REF_ATTR } from './badge';
import { STORE_NAMES, type Store } from './ownership';
import { setTip } from './tooltip';

const STORES = Object.keys(STORE_NAMES) as Store[];

/** Set on a Steam badge once its ownership has been checked. */
const CHECKED_ATTR = 'data-bsl-owned-checked';
const OWNED_ATTR = 'data-bsl-owned';

/** Stores owning the game with this Steam id; undefined while not answered yet. */
export type OwnershipLookup = (steamRef: string) => Store[] | undefined;

/** Steam ids of the badges not checked yet, including every game in an unchecked pack. */
export function uncheckedSteamRefs(doc: Document): string[] {
  const refs = [...doc.querySelectorAll(`[${STEAM_REF_ATTR}]:not([${CHECKED_ATTR}])`)].map(
    (badge) => badge.getAttribute(STEAM_REF_ATTR) ?? '',
  );
  for (const pack of doc.querySelectorAll(`[${PACK_ATTR}]:not([${CHECKED_ATTR}])`)) {
    refs.push(...packGames(pack).flatMap(([, ref]) => (ref ? [ref] : [])));
  }
  return [...new Set(refs.filter(Boolean))];
}

type PackEntry = [title: string, steamRef: string | null];

interface OwnedGame {
  title: string;
  stores: Store[];
}

function packGames(pack: Element): PackEntry[] {
  try {
    return JSON.parse(pack.getAttribute(PACK_ATTR) ?? '[]') as PackEntry[];
  } catch {
    return [];
  }
}

/** Removes every owned marker, so the next `markOwnedBadges` starts over. */
export function clearOwnedMarkers(doc: Document): void {
  for (const marker of doc.querySelectorAll(`[${OWNED_ATTR}]`)) marker.remove();
  for (const badge of doc.querySelectorAll(`[${CHECKED_ATTR}]`)) badge.removeAttribute(CHECKED_ATTR);
}

/**
 * Adds an "Owned" marker beside every Steam badge whose game is in a library:
 * in the tile's other corner, or inline for inline badges. Works on badges
 * from any site, since it reads only the badge's own Steam id. A pack badge
 * is marked once every game in it has an answer.
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
  for (const pack of doc.querySelectorAll<HTMLElement>(`[${PACK_ATTR}]:not([${CHECKED_ATTR}])`)) {
    const entries = packGames(pack);
    const games: OwnedGame[] = [];
    for (const [title, ref] of entries) {
      // A game not found on Steam can't be checked: it counts as not owned.
      const stores = ref ? lookup(ref) : [];
      if (!stores) break;
      games.push({ title, stores });
    }
    if (games.length < entries.length) continue;
    pack.setAttribute(CHECKED_ATTR, '');
    const owned = games.filter((game) => game.stores.length > 0);
    if (owned.length === 0) continue;
    pack.after(createPackOwnedMarker(doc, owned, games.length));
    added++;
  }
  return added;
}

/**
 * For a pack: the green check when every game in it is owned, else "2/3" in
 * amber. Chips name every store holding any of them; the tooltip says which
 * game is where, one per line.
 */
function createPackOwnedMarker(doc: Document, owned: OwnedGame[], total: number): HTMLElement {
  const stores = STORES.filter((store) => owned.some((game) => game.stores.includes(store)));
  const where = owned.map((game) => `${game.title} (${game.stores.map((store) => STORE_NAMES[store]).join(', ')})`);
  const all = owned.length === total;
  const label = [all ? `Own all ${total}` : `Own ${owned.length} of ${total}`, ...where].join('\n');
  const marker = createOwnedMarker(doc, stores, false, label);
  if (!all) {
    marker.classList.add('bsl-owned--partial');
    marker.querySelector('.bsl-owned__check')!.textContent = `${owned.length}/${total}`;
  }
  return marker;
}

/** A green check followed by one chip per store, in that store's colors. */
function createOwnedMarker(
  doc: Document,
  stores: Store[],
  inline: boolean,
  label = `Owned on ${stores.map((store) => STORE_NAMES[store]).join(' and ')}`,
): HTMLElement {
  const marker = doc.createElement('span');
  marker.setAttribute(OWNED_ATTR, stores.join(' '));
  marker.className = inline ? 'bsl-owned bsl-owned--inline' : 'bsl-owned';
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', label.split('\n').join('. '));
  setTip(marker, label);
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
