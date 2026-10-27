import { STEAM_REF_ATTR } from './badge';
import { PACK_ATTR, PACK_STORES_ATTR, packEntries } from './pack-data';
import { ownedLabel, STORE_NAMES, storeNames as names, wishLabel, type Store } from './ownership';
import { setTip } from './tooltip';

const STORES = Object.keys(STORE_NAMES) as Store[];

/** Set on a Steam badge once its ownership has been checked. */
const CHECKED_ATTR = 'data-bsl-owned-checked';
const OWNED_ATTR = 'data-bsl-owned';
const WISH_ATTR = 'data-bsl-wish';

/** Where the user has a game: stores owning it, and for a game owned nowhere, wishlists holding it. */
export interface GameStores {
  owned: Store[];
  wishlisted?: Store[];
}

/** Undefined while not answered yet. */
export type OwnershipLookup = (steamRef: string) => GameStores | undefined;

/** Steam ids of the badges not checked yet, including every game in an unchecked pack. */
export function uncheckedSteamRefs(doc: Document): string[] {
  const refs = [...doc.querySelectorAll(`[${STEAM_REF_ATTR}]:not([${CHECKED_ATTR}])`)].map(
    (badge) => badge.getAttribute(STEAM_REF_ATTR) ?? '',
  );
  for (const pack of doc.querySelectorAll(`[${PACK_ATTR}]:not([${CHECKED_ATTR}])`)) {
    refs.push(...packEntries(pack).flatMap(([, ref]) => (ref ? [ref] : [])));
  }
  return [...new Set(refs.filter(Boolean))];
}

interface PackGame {
  title: string;
  stores: Store[];
}

/** Removes every owned and wishlist marker, so the next `markOwnedBadges` starts over. */
export function clearOwnedMarkers(doc: Document): void {
  for (const marker of doc.querySelectorAll(`[${OWNED_ATTR}], [${WISH_ATTR}]`)) marker.remove();
  for (const badge of doc.querySelectorAll(`[${CHECKED_ATTR}]`)) badge.removeAttribute(CHECKED_ATTR);
  for (const pack of doc.querySelectorAll(`[${PACK_STORES_ATTR}]`)) pack.removeAttribute(PACK_STORES_ATTR);
}

/**
 * Adds an "Owned" marker beside every Steam badge whose game is in a library,
 * or a wishlist marker when it's owned nowhere but wishlisted: in the tile's
 * other corner, or inline for inline badges. Works on badges from any site,
 * since it reads only the badge's own Steam id. A pack badge is marked once
 * every game in it has an answer.
 * Returns how many markers were added.
 */
export function markOwnedBadges(doc: Document, lookup: OwnershipLookup): number {
  let added = 0;
  for (const badge of doc.querySelectorAll<HTMLElement>(`[${STEAM_REF_ATTR}]:not([${CHECKED_ATTR}])`)) {
    const answer = lookup(badge.getAttribute(STEAM_REF_ATTR) ?? '');
    if (!answer) continue;
    badge.setAttribute(CHECKED_ATTR, '');
    const inline = badge.classList.contains('bsl-badge--inline');
    if (answer.owned.length > 0) badge.after(createMarker(doc, 'owned', answer.owned, inline, ownedLabel(answer.owned)));
    else if (answer.wishlisted?.length) badge.after(createMarker(doc, 'wish', answer.wishlisted, inline, wishLabel(answer.wishlisted)));
    else continue;
    added++;
  }
  for (const pack of doc.querySelectorAll<HTMLElement>(`[${PACK_ATTR}]:not([${CHECKED_ATTR}])`)) {
    const entries = packEntries(pack);
    const owned: PackGame[] = [];
    const wished: PackGame[] = [];
    const answers: GameStores[] = [];
    for (const [title, ref] of entries) {
      // A game not found on Steam can't be checked: it counts as not owned.
      const answer = ref ? lookup(ref) : { owned: [] };
      if (!answer) break;
      answers.push(answer);
      if (answer.owned.length > 0) owned.push({ title, stores: answer.owned });
      else if (answer.wishlisted?.length) wished.push({ title, stores: answer.wishlisted });
    }
    if (answers.length < entries.length) continue;
    pack.setAttribute(CHECKED_ATTR, '');
    // For the pack's menu of Steam links.
    pack.setAttribute(PACK_STORES_ATTR, JSON.stringify(answers));
    if (owned.length > 0) pack.after(createPackOwnedMarker(doc, owned, wished, entries.length));
    else if (wished.length > 0) pack.after(createPackWishMarker(doc, wished, entries.length));
    else continue;
    added++;
  }
  return added;
}

const where = (games: PackGame[]) => games.map((game) => `${game.title} (${names(game.stores, ', ')})`);
const storesOf = (games: PackGame[]) => STORES.filter((store) => games.some((game) => game.stores.includes(store)));

/**
 * For a pack: the green check when every game in it is owned, else "2/3" in
 * amber. Chips name every store holding any of them; the tooltip says which
 * game is where, one per line, then any wishlisted ones.
 */
function createPackOwnedMarker(doc: Document, owned: PackGame[], wished: PackGame[], total: number): HTMLElement {
  const all = owned.length === total;
  const label = [
    all ? `Own all ${total}` : `Own ${owned.length} of ${total}`,
    ...where(owned),
    ...(wished.length > 0 ? ['Wishlisted:', ...where(wished)] : []),
  ].join('\n');
  const marker = createMarker(doc, 'owned', storesOf(owned), false, label);
  if (!all) {
    marker.classList.add('bsl-owned--partial');
    marker.querySelector('.bsl-owned__check')!.textContent = `${owned.length}/${total}`;
  }
  return marker;
}

/** For a pack with nothing owned but some games wishlisted: the heart, and which ones. */
function createPackWishMarker(doc: Document, wished: PackGame[], total: number): HTMLElement {
  const label = [`${wished.length} of ${total} on your wishlists`, ...where(wished)].join('\n');
  return createMarker(doc, 'wish', storesOf(wished), false, label);
}

/**
 * Owned: a green check followed by one chip per store, in that store's colors.
 * Wishlisted: a single pink "♥ Wishlisted" pill, with the stores in the
 * tooltip; store chips there would make it read like the owned marker.
 */
function createMarker(doc: Document, kind: 'owned' | 'wish', stores: Store[], inline: boolean, label: string): HTMLElement {
  const marker = doc.createElement('span');
  marker.setAttribute(kind === 'owned' ? OWNED_ATTR : WISH_ATTR, stores.join(' '));
  marker.className = inline ? 'bsl-owned bsl-owned--inline' : 'bsl-owned';
  if (kind === 'wish') marker.classList.add('bsl-owned--wish');
  marker.setAttribute('role', 'img');
  marker.setAttribute('aria-label', label.split('\n').join('. '));
  setTip(marker, label);
  const check = doc.createElement('span');
  check.className = 'bsl-owned__check';
  check.textContent = kind === 'owned' ? '✓' : '♥ Wishlisted';
  marker.append(check);
  if (kind === 'wish') return marker;
  for (const store of stores) {
    const chip = doc.createElement('span');
    chip.className = `bsl-chip bsl-chip--${store}`;
    chip.textContent = STORE_NAMES[store];
    marker.append(chip);
  }
  return marker;
}
