import { PACK_ATTR, type PackEntry } from './pack-data';
import { packTip, togglePackMenu } from './pack-menu';
import { formatSteamRef, steamSearchUrl, steamStoreUrl, type SteamRef } from './steam';
import { setRichTip, setTip } from './tooltip';

/** Marks an element this extension added, so re-scans don't add it twice. */
export const BADGE_ATTR = 'data-bsl-badge';
/** On a Steam badge with a known id: the id, as "app/123" or "sub/456". */
export const STEAM_REF_ATTR = 'data-bsl-steam';

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
 * A "3 games ▾" button for a pack: it has no single Steam page, so a click
 * opens a menu with each game's Steam link. Its tooltip lists the games,
 * with their ratings and owned marks once known.
 */
export function createPackBadge(doc: Document, games: PackGame[]): HTMLElement {
  const button = doc.createElement('button');
  button.type = 'button';
  button.setAttribute(BADGE_ATTR, '');
  const entries: PackEntry[] = games.map((game) => [game.name, game.steam ? formatSteamRef(game.steam) : null]);
  button.setAttribute(PACK_ATTR, JSON.stringify(entries));
  button.setAttribute('aria-expanded', 'false');
  button.classList.add('bsl-badge', 'bsl-badge--pack');
  const arrow = doc.createElement('span');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = ' ▾';
  button.append(`${games.length} games`, arrow);
  setRichTip(
    button,
    [`Pack of ${games.length}`, ...games.map((game) => game.name), 'Click for their Steam pages'].join('\n'),
    () => packTip(doc, button),
  );
  guardBadgeClicks(doc);
  return button;
}

/** The line after a details heading that holds its badge and marker. */
const HEADING_ROW_CLASS = 'bsl-row';
/** On that line: the title it was made for. */
const ROW_TITLE_ATTR = 'data-bsl-for';

/**
 * Puts a badge on its own line after a details view's heading. A view that
 * moves on to another game may keep the heading and change only its text, so
 * a line made for another title is replaced. `makeBadge` returns null while
 * the title has no badge (yet). Returns whether a badge was added.
 */
export function badgeHeading(
  doc: Document,
  heading: Element,
  makeBadge: (name: string) => HTMLElement | null,
): boolean {
  const name = heading.textContent?.trim() ?? '';
  const next = heading.nextElementSibling;
  const row = next?.classList.contains(HEADING_ROW_CLASS) ? next : null;
  if (row?.getAttribute(ROW_TITLE_ATTR) === name) return false;
  row?.remove();
  const badge = name ? makeBadge(name) : null;
  if (!badge) return false;
  // Headings sit in columns, which would stretch the badge full width.
  const line = doc.createElement('div');
  line.classList.add(HEADING_ROW_CLASS);
  line.setAttribute(ROW_TITLE_ATTR, name);
  line.append(badge);
  heading.after(line);
  return true;
}

const guardedWindows = new WeakSet<Window>();

/**
 * Tiles open a details view on click, so a click on a badge must not reach
 * the site's handlers — only the Steam tab should open. Stopping it on the
 * badge isn't enough: some sites (Green Man Gaming) listen in the capture
 * phase, which runs before the badge sees the click. So stop it at the very
 * start, in a capture listener on the window. The link's default action —
 * opening Steam — still happens. A pack badge's menu opens from here too,
 * since its own listeners never see the click.
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
      const pack = element?.closest<HTMLElement>(`[${BADGE_ATTR}][${PACK_ATTR}]`);
      if (pack) {
        event.stopImmediatePropagation();
        event.preventDefault();
        // A click from the keyboard has no pointer, so detail is 0.
        togglePackMenu(pack, event.detail === 0);
      } else {
        const link = element?.closest<HTMLAnchorElement>(`a[${BADGE_ATTR}]`);
        if (!link) return;
        event.stopImmediatePropagation();
        // Inside a tile that is a button (Humble Choice), not every browser
        // follows the link: open it here instead.
        if (link.closest('button')) {
          event.preventDefault();
          win.open(link.href, '_blank', 'noopener');
        }
      }
    },
    true,
  );
}
