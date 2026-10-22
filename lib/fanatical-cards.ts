import { BADGE_ATTR, createSteamBadge } from './badge';
import type { BundleGame } from './fanatical';
import { normalizeTitle } from './normalize';

/**
 * Game cards on both page kinds: `article.bundle-game-card` (h3) on tiered
 * bundles, `article.PickAndMixCard` (h2) on build-your-own bundles.
 */
const CARD_NAME_SELECTOR = 'article.faux-block-link .card-product-name';

/**
 * Adds a Steam badge to every game card that doesn't have one yet. Cards whose
 * name isn't in the bundle data (other sections of the page) are left alone.
 * Returns how many badges were added.
 */
export function annotateFanaticalCards(doc: Document, games: BundleGame[]): number {
  const byKey = new Map(games.map((game) => [normalizeTitle(game.name), game]));
  let added = 0;
  for (const nameEl of doc.querySelectorAll(CARD_NAME_SELECTOR)) {
    const card = nameEl.closest('article');
    if (!card || card.querySelector(`[${BADGE_ATTR}]`)) continue;
    const game = byKey.get(normalizeTitle(nameEl.textContent ?? ''));
    if (!game) continue;
    if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
    card.append(createSteamBadge(doc, game));
    added++;
  }
  return added;
}
