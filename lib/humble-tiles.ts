import { BADGE_ATTR, badgeHeading, createSteamBadge } from './badge';
import type { SteamLookup } from './title-site';

/** A game tile in the bundle's grid. Its classes are Tailwind's, so only test ids are stable. */
const CARD_SELECTOR = '[data-testid="bundle-item-card"]';
/**
 * The tile's art, whose alt text is the game's title. Its test id was
 * bundle-item-native-image until 2026-11-20; both are read.
 */
const CARD_IMAGE_SELECTOR =
  ':is([data-testid="product-thumbnail"], [data-testid="bundle-item-native-image"]) img[alt]';
/** On a tile's badge: the tile shows Humble's own Steam rating (see humble.css). */
const SITE_RATING_ATTR = 'data-bsl-site-rating';
/** Humble's rating on a tile's art ("👍 93%"): a percentage on its own. */
const SITE_RATING_TEXT = /^\d{1,3}%$/;
/** A game's details, opened by a tile: a dialog titled by its heading. */
const DIALOG_SELECTOR = '[role="dialog"][aria-labelledby]';

export function collectHumbleTitles(doc: Document): string[] {
  const titles = [...doc.querySelectorAll(CARD_SELECTOR)].map(cardTitle);
  return [...new Set(titles.filter(Boolean))];
}

/**
 * Adds a Steam badge to each tile (in its corner) and each details heading
 * (on a line after it) whose title has been resolved. Returns how many were added.
 */
export function annotateHumble(doc: Document, lookup: SteamLookup): number {
  let added = 0;
  for (const card of doc.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    // The tile is a button: the badge goes beside it, in its list item, so a
    // link isn't nested in a button.
    const holder = card.closest('li') ?? card;
    let badge = holder.querySelector(`[${BADGE_ATTR}]`);
    if (!badge) {
      badge = badgeFor(doc, cardTitle(card), lookup, 'corner');
      if (!badge) continue;
      if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
      holder.append(badge);
      added++;
    }
    // Humble's rating renders after the tile, so it's checked on every pass.
    badge.toggleAttribute(SITE_RATING_ATTR, hasSiteRating(card));
  }
  for (const dialog of doc.querySelectorAll(DIALOG_SELECTOR)) {
    const heading = doc.getElementById(dialog.getAttribute('aria-labelledby') ?? '');
    // Only titles from tiles are looked up, so other dialogs (the cart) get none.
    if (heading && badgeHeading(doc, heading, (name) => badgeFor(doc, name, lookup, 'inline'))) added++;
  }
  return added;
}

function hasSiteRating(card: Element): boolean {
  return [...card.querySelectorAll('span')].some((span) => SITE_RATING_TEXT.test(span.textContent?.trim() ?? ''));
}

function cardTitle(card: Element): string {
  return card.querySelector(CARD_IMAGE_SELECTOR)?.getAttribute('alt')?.trim() ?? '';
}

function badgeFor(doc: Document, name: string, lookup: SteamLookup, placement: 'corner' | 'inline') {
  const steam = name ? lookup(name) : undefined;
  return steam === undefined ? null : createSteamBadge(doc, { name, steam }, placement);
}
