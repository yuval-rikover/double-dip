import { formatSteamRef, steamSearchUrl, steamStoreUrl, type SteamRef } from './steam';

/** Marks an element this extension added, so re-scans don't add it twice. */
export const BADGE_ATTR = 'data-bsl-badge';
/** On a Steam badge with a known id: the id, as "app/123" or "sub/456". */
export const STEAM_REF_ATTR = 'data-bsl-steam';

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
  link.title = game.steam ? `Open ${game.name} on Steam` : `No Steam ID listed — search Steam for ${game.name}`;
  // Tiles open a details view on click; keep our click from reaching the
  // site's handlers so only the Steam tab opens.
  link.addEventListener('click', (event) => event.stopPropagation());
  return link;
}
