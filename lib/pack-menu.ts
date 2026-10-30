import type { GameStores } from './owned';
import { ownedLabel, STORE_NAMES, wishLabel } from './ownership';
import { packEntries, packRatings, packStores } from './pack-data';
import { ratingPercent, reviewCount, reviewsText } from './rating-label';
import { parseSteamRef, steamSearchUrl, steamStoreUrl } from './steam';
import { hideTip, place } from './tooltip';

/** "✓ GOG Epic" in the owned marker's colors, or "♥" for a wishlisted game; null for neither. */
function storesMark(doc: Document, { owned, wishlisted }: GameStores): HTMLElement | null {
  if (owned.length === 0 && !wishlisted?.length) return null;
  const mark = doc.createElement('span');
  mark.className = 'bsl-pack-row__stores';
  const check = doc.createElement('span');
  check.className = 'bsl-owned__check';
  if (owned.length > 0) {
    check.textContent = '✓';
    mark.append(check);
    for (const store of owned) {
      const chip = doc.createElement('span');
      chip.className = `bsl-chip bsl-chip--${store}`;
      chip.textContent = STORE_NAMES[store];
      mark.append(chip);
    }
    mark.setAttribute('aria-label', ownedLabel(owned));
  } else {
    mark.classList.add('bsl-pack-row__stores--wish');
    check.textContent = '♥';
    mark.append(check);
    mark.setAttribute('aria-label', wishLabel(wishlisted!));
  }
  return mark;
}

/**
 * One row per game in a pack: its title, then where it's owned or
 * wishlisted and its Steam rating and review count, once those are known. As links to Steam for the
 * menu (a Steam search for games without a Steam id), plain for the tooltip.
 */
function packRows(doc: Document, pack: Element, links: boolean): HTMLElement[] {
  const stores = packStores(pack);
  const ratings = packRatings(pack);
  return packEntries(pack).map(([title, ref], i) => {
    const steam = ref ? parseSteamRef(ref) : null;
    const row = doc.createElement(links ? 'a' : 'div');
    row.className = 'bsl-pack-row';
    const name = doc.createElement('span');
    // A no-break space keeps the arrow on the title's last line.
    name.textContent = links ? `${title}\u00a0↗` : title;
    row.append(name);
    if (links && !steam) {
      const note = doc.createElement('span');
      note.className = 'bsl-pack-row__note';
      note.textContent = 'search';
      name.append(' ', note);
    }
    const end = doc.createElement('span');
    end.className = 'bsl-pack-row__end';
    // The rating and review count last, in columns of their own, so they line up.
    const mark = stores?.[i] && storesMark(doc, stores[i]);
    if (mark) end.append(mark);
    const rating = ratings?.[i];
    const percent = doc.createElement('span');
    percent.className = 'bsl-pack-row__rating';
    const count = doc.createElement('span');
    count.className = 'bsl-pack-row__count';
    if (rating) {
      percent.append(ratingPercent(doc, rating));
      count.append(reviewCount(doc, rating));
    }
    if (ratings?.some(Boolean)) end.append(percent, count);
    if (end.childElementCount > 0) row.append(end);
    if (links) {
      const link = row as HTMLAnchorElement;
      link.href = steam ? steamStoreUrl(steam) : steamSearchUrl(title);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const said = [title, rating && `Steam ${reviewsText(rating)}`, mark?.getAttribute('aria-label')];
      link.setAttribute('aria-label', said.filter(Boolean).join('. '));
    }
    return row;
  });
}

/** A pack badge's tooltip: its games, with what's known about each, and the hint to click. */
export function packTip(doc: Document, pack: Element): Node[] {
  const heading = doc.createElement('strong');
  heading.textContent = `Pack of ${packEntries(pack).length}`;
  const hint = doc.createElement('div');
  hint.className = 'bsl-pack-row__note';
  hint.textContent = 'Click for their Steam pages';
  return [heading, ...packRows(doc, pack, false), hint];
}

let open: { badge: HTMLElement; close: () => void } | null = null;

/**
 * Opens the menu under a pack badge, or closes it if it's open: the
 * tooltip's rows, as Steam links. It stays open while links are opened, and
 * closes on a click elsewhere, Escape, or scrolling, since it's fixed in
 * place. `focusFirst` is for keyboard users.
 */
export function togglePackMenu(badge: HTMLElement, focusFirst: boolean): void {
  const wasOpen = open?.badge === badge;
  open?.close();
  if (wasOpen) return;
  const doc = badge.ownerDocument;
  if (!doc.body) return;

  const menu = doc.createElement('div');
  menu.className = 'bsl-menu';
  const heading = doc.createElement('strong');
  heading.textContent = 'On Steam';
  menu.append(heading, ...packRows(doc, badge, true));
  hideTip(doc);
  doc.body.append(menu);
  place(menu, badge.getBoundingClientRect(), doc.documentElement);
  badge.setAttribute('aria-expanded', 'true');

  const outside = (event: Event) => {
    const target = event.target as Node | null;
    if (!menu.contains(target) && !badge.contains(target)) close();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    close();
    badge.focus();
  };
  const close = () => {
    menu.remove();
    badge.setAttribute('aria-expanded', 'false');
    doc.removeEventListener('pointerdown', outside, true);
    doc.removeEventListener('scroll', outside, true);
    doc.removeEventListener('keydown', onKey, true);
    if (open?.badge === badge) open = null;
  };
  doc.addEventListener('pointerdown', outside, true);
  doc.addEventListener('scroll', outside, true);
  doc.addEventListener('keydown', onKey, true);
  open = { badge, close };
  if (focusFirst) menu.querySelector('a')?.focus();
}
