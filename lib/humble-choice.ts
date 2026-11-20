import { BADGE_ATTR, badgeHeading, createSteamBadge } from './badge';
import type { SteamLookup } from './title-site';

/** A game tile in a Choice month's grid. Its classes are Tailwind's, so only test ids are stable. */
const CARD_SELECTOR = '[data-testid="product-card"]';
/** The tile's art, which holds the badge. */
const CARD_IMAGE_SELECTOR = '[data-testid="product-thumbnail"]';
/** The tile's caption; its first part is the title, then "View Details". */
const CARD_FOOTER_SELECTOR = '[data-testid="product-card-footer"]';
/** The month's details dialog: its carousel of the month's games. */
const DIALOG_SELECTOR = '[role="dialog"]:has([data-choice-count])';

export function collectChoiceTitles(doc: Document): string[] {
  const titles = [...doc.querySelectorAll(CARD_SELECTOR)].map(cardTitle);
  return [...new Set(titles.filter(Boolean))];
}

/**
 * Adds a Steam badge to each tile (in its corner) and to the details dialog's
 * heading. Humble lists no Steam ids any more, so titles are matched on Steam;
 * one without a match (an extra like "IGN Plus Subscription") gets no badge.
 * Returns how many were added.
 */
export function annotateChoice(doc: Document, lookup: SteamLookup): number {
  let added = 0;
  for (const card of doc.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
    // The tiles are buttons right in the grid, so anything beside one would
    // take a grid cell: the badge goes on the tile's art instead.
    const holder = card.querySelector<HTMLElement>(CARD_IMAGE_SELECTOR) ?? card;
    if (holder.querySelector(`[${BADGE_ATTR}]`)) continue;
    const badge = badgeFor(doc, cardTitle(card), lookup, 'corner');
    if (!badge) continue;
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    holder.append(badge);
    added++;
  }
  for (const dialog of doc.querySelectorAll(DIALOG_SELECTOR)) {
    // The dialog's carousel switches games by changing the heading's text.
    const heading = dialog.querySelector('h3');
    if (heading && badgeHeading(doc, heading, (name) => badgeFor(doc, name, lookup, 'inline'))) added++;
  }
  return added;
}

function cardTitle(card: Element): string {
  return card.querySelector(CARD_FOOTER_SELECTOR)?.firstElementChild?.textContent?.trim() ?? '';
}

function badgeFor(doc: Document, name: string, lookup: SteamLookup, placement: 'corner' | 'inline') {
  const steam = name ? lookup(name) : undefined;
  return steam ? createSteamBadge(doc, { name, steam }, placement) : null;
}
