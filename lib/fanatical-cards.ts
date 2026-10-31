import { BADGE_ATTR, createPackBadge, createSteamBadge } from './badge';
import type { BundleGame } from './fanatical';
import { normalizeTitle } from './normalize';
import type { SteamLookup } from './title-site';

/**
 * Game cards on both page kinds: `article.bundle-game-card` (h3) on tiered
 * bundles, `article.PickAndMixCard` (h2) on build-your-own bundles.
 */
const CARD_NAME_SELECTOR = 'article.faux-block-link .card-product-name';
/** The game list in a pack's details view ("This bundle includes:"). */
const PACK_LIST_ITEM_SELECTOR = '.info-container li';
/** Fanatical's own ribbon on a card's top-left corner ("New To Bundle"). */
const RIBBON_SELECTOR = ':scope > .card-label';
/** On our badge and marker: drop below the ribbon (see badge.css). */
const BELOW_RIBBON_ATTR = 'data-bsl-below-ribbon';
/** Space kept between the ribbon's end and the Steam badge. */
const RIBBON_GAP = 4;

/**
 * Adds a badge to every game card that doesn't have one yet: a Steam link,
 * or for a pack a "3 games" label once `lookup` has answered for every game
 * in it. A game to find on Steam waits for `lookup` to answer for its title. Cards whose name isn't in the bundle data (other sections of the
 * page) are left alone. Returns how many badges were added.
 */
export function annotateFanaticalCards(doc: Document, games: BundleGame[], lookup: SteamLookup = () => undefined): number {
  const byKey = new Map(games.map((game) => [normalizeTitle(game.name), game]));
  let added = 0;
  for (const nameEl of doc.querySelectorAll(CARD_NAME_SELECTOR)) {
    const card = nameEl.closest('article');
    if (!card || card.querySelector(`[${BADGE_ATTR}]`)) continue;
    const game = byKey.get(normalizeTitle(nameEl.textContent ?? ''));
    if (!game) continue;
    let badge: HTMLElement;
    if (game.includes) {
      const refs = game.includes.map(lookup);
      if (refs.some((ref) => ref === undefined)) continue;
      badge = createPackBadge(
        doc,
        game.includes.map((name, i) => ({ name, steam: refs[i] ?? null })),
      );
    } else if (game.findOnSteam) {
      const steam = lookup(game.name);
      if (steam === undefined) continue;
      badge = createSteamBadge(doc, { name: game.name, steam });
    } else {
      badge = createSteamBadge(doc, game);
    }
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.append(badge);
    added++;
  }
  return added;
}

/**
 * Adds an inline Steam badge after each game in an open pack's details list.
 * Matches list items against the packs' game titles, so other lists on the
 * page are left alone. Returns how many badges were added.
 */
export function annotateFanaticalPackLists(doc: Document, games: BundleGame[], lookup: SteamLookup): number {
  const included = new Map(games.flatMap((game) => game.includes ?? []).map((title) => [normalizeTitle(title), title]));
  if (included.size === 0) return 0;
  let added = 0;
  for (const item of doc.querySelectorAll(PACK_LIST_ITEM_SELECTOR)) {
    if (item.querySelector(`[${BADGE_ATTR}]`)) continue;
    const title = included.get(normalizeTitle(item.textContent ?? ''));
    if (!title) continue;
    const steam = lookup(title);
    if (steam === undefined) continue;
    item.append(createSteamBadge(doc, { name: title, steam }, 'inline'));
    added++;
  }
  return added;
}

/**
 * Drops a card's row of badges below Fanatical's ribbon where the ribbon would
 * cover it: always when there's an owned marker, which sits in the ribbon's
 * corner, and otherwise only when the ribbon reaches the Steam badge. The
 * whole row moves together, so it stays on one line. Run after the markers
 * are added: a marker or a longer badge can change the answer.
 */
export function clearFanaticalRibbons(doc: Document): void {
  for (const card of doc.querySelectorAll<HTMLElement>('article.faux-block-link')) {
    const badge = card.querySelector<HTMLElement>(`:scope > [${BADGE_ATTR}]`);
    if (!badge) continue;
    const marker = card.querySelector<HTMLElement>(':scope > .bsl-owned');
    const ribbon = card.querySelector(RIBBON_SELECTOR);
    // Left edges only: moving the row down doesn't change them.
    const below =
      !!ribbon &&
      (!!marker || badge.getBoundingClientRect().left < ribbon.getBoundingClientRect().right + RIBBON_GAP);
    for (const element of [badge, marker]) element?.toggleAttribute(BELOW_RIBBON_ATTR, below);
  }
}
