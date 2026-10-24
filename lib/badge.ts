import { formatSteamRef, steamSearchUrl, steamStoreUrl, type SteamRef } from './steam';
import { setTip } from './tooltip';

/** Marks an element this extension added, so re-scans don't add it twice. */
export const BADGE_ATTR = 'data-bsl-badge';
/** On a Steam badge with a known id: the id, as "app/123" or "sub/456". */
export const STEAM_REF_ATTR = 'data-bsl-steam';
/** On a pack badge: the games inside, as JSON `[title, "app/123" | null][]`. */
export const PACK_ATTR = 'data-bsl-pack';

/** A game in a pack, with its Steam id once looked up (null: not on Steam). */
export interface PackGame {
  name: string;
  steam: SteamRef | null;
}

/**
 * A small "Steam" link for a game tile. Without a known Steam id it links to a
 * Steam search for the title instead, styled differently so it reads as a guess.
 * `corner` pins it to the tile's top-right; `inline` flows it after a heading.
 */
export function createSteamBadge(
  doc: Document,
  game: { name: string; steam: SteamRef | null },
  placement: 'corner' | 'inline' = 'corner',
): HTMLAnchorElement {
  const link = doc.createElement('a');
  link.setAttribute(BADGE_ATTR, '');
  link.classList.add('bsl-badge');
  if (!game.steam) link.classList.add('bsl-badge--search');
  if (placement === 'inline') link.classList.add('bsl-badge--inline');
  if (game.steam) link.setAttribute(STEAM_REF_ATTR, formatSteamRef(game.steam));
  link.href = game.steam ? steamStoreUrl(game.steam) : steamSearchUrl(game.name);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = game.steam ? 'Steam ↗' : 'Search Steam ↗';
  setTip(link, `${game.name}\n${game.steam ? 'Open on Steam' : 'No Steam ID listed: searches Steam for the title'}`);
  guardBadgeClicks(doc);
  return link;
}

/**
 * A "3 games" label for a pack: it has no single Steam page, so this is not a
 * link. Its tooltip lists the games; the site's own details view lists them too,
 * where each gets its own Steam badge.
 */
export function createPackBadge(doc: Document, games: PackGame[]): HTMLElement {
  const label = doc.createElement('span');
  label.setAttribute(BADGE_ATTR, '');
  label.setAttribute(
    PACK_ATTR,
    JSON.stringify(games.map((game) => [game.name, game.steam ? formatSteamRef(game.steam) : null])),
  );
  label.classList.add('bsl-badge', 'bsl-badge--pack');
  label.textContent = `${games.length} games`;
  setTip(label, [`Pack of ${games.length}`, ...games.map((game) => game.name)].join('\n'));
  return label;
}

const guardedWindows = new WeakSet<Window>();

/**
 * Tiles open a details view on click, so a click on a badge must not reach
 * the site's handlers — only the Steam tab should open. Stopping it on the
 * badge isn't enough: some sites (Green Man Gaming) listen in the capture
 * phase, which runs before the badge sees the click. So stop it at the very
 * start, in a capture listener on the window. The link's default action —
 * opening Steam — still happens. Labels that aren't links let clicks through.
 */
function guardBadgeClicks(doc: Document): void {
  const win = doc.defaultView;
  if (!win || guardedWindows.has(win)) return;
  guardedWindows.add(win);
  win.addEventListener(
    'click',
    (event) => {
      const target = event.target as Node | null;
      const element = target && target.nodeType === 1 ? (target as Element) : target?.parentElement;
      if (element?.closest(`a[${BADGE_ATTR}]`)) event.stopImmediatePropagation();
    },
    true,
  );
}
