import { BADGE_ATTR, createSteamBadge } from './badge';
import { normalizeTitle } from './normalize';
import type { SteamRef } from './steam';

/**
 * A Humble Choice month's items: per normalized title, its Steam entry, or
 * 'not-steam' for extras that aren't Steam games (e.g. "Get One Month of IGN
 * Plus", delivered as another kind of key).
 */
export type ChoiceMonth = Record<string, SteamRef | 'not-steam'>;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];
const MONTH_SLUG = new RegExp(`^(${MONTHS.join('|')})-(\\d{4})$`);
const MONTH_HEADING = new RegExp(`^(${MONTHS.join('|')}) (\\d{4}) games$`, 'i');

/** Game tiles in a Choice month's grid, and the element that holds each tile's image. */
const CHOICE_TILE_SELECTOR = '.content-choice';
const TILE_TITLE_SELECTOR = '.content-choice-title';
const TILE_IMAGE_SELECTOR = '.choice-image-container';

/**
 * Which month a Choice page shows, as Humble's URL slug ("october-2026"). A
 * month page has it in its URL; the member hub (/membership/home) only in its
 * "October 2026 games" heading, which renders after load — so this can return
 * null early and the slug later.
 */
export function choiceMonthSlug(pathname: string, doc: Document): string | null {
  const fromPath = pathname.match(/^\/membership\/([a-z]+-\d{4})\/?$/)?.[1];
  if (fromPath && MONTH_SLUG.test(fromPath)) return fromPath;
  for (const heading of doc.querySelectorAll('.content-choices-title')) {
    const match = heading.textContent?.trim().match(MONTH_HEADING);
    if (match) return `${match[1]!.toLowerCase()}-${match[2]}`;
  }
  return null;
}

/** The public month page; fetched without cookies, so it never holds account data. */
export function choiceMonthUrl(slug: string): string {
  return `https://www.humblebundle.com/membership/${slug}`;
}

interface ChoiceGameData {
  title?: string;
  tpkds?: { steam_app_id?: number | null }[] | null;
}

/** Reads the month's items from the page's embedded product JSON. */
export function parseChoiceMonth(html: string): ChoiceMonth | null {
  const json = html.match(/<script id="webpack-monthly-product-data" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  if (!json) return null;
  const data = JSON.parse(json) as {
    contentChoiceOptions?: { contentChoiceData?: { game_data?: Record<string, ChoiceGameData> } };
  };
  const games = data.contentChoiceOptions?.contentChoiceData?.game_data;
  if (!games) return null;
  const month: ChoiceMonth = {};
  for (const game of Object.values(games)) {
    if (!game.title) continue;
    const appId = (game.tpkds ?? []).find((key) => key.steam_app_id)?.steam_app_id;
    month[normalizeTitle(game.title)] = appId ? { type: 'app', id: appId } : 'not-steam';
  }
  return month;
}

/**
 * Lookup result per tile title: a Steam entry, null for "no match, offer a
 * search", 'not-steam' for "no badge at all", undefined for "not known yet".
 */
export type ChoiceLookup = (title: string) => SteamRef | null | 'not-steam' | undefined;

export function collectChoiceTitles(doc: Document): string[] {
  const titles = [...doc.querySelectorAll(`${CHOICE_TILE_SELECTOR} ${TILE_TITLE_SELECTOR}`)].map(
    (el) => el.textContent?.trim() ?? '',
  );
  return [...new Set(titles.filter(Boolean))];
}

/** Adds a Steam badge to each Choice tile whose title is resolved. Returns how many were added. */
export function annotateChoice(doc: Document, lookup: ChoiceLookup): number {
  let added = 0;
  for (const tile of doc.querySelectorAll(CHOICE_TILE_SELECTOR)) {
    const name = tile.querySelector(TILE_TITLE_SELECTOR)?.textContent?.trim();
    if (!name || tile.querySelector(`[${BADGE_ATTR}]`)) continue;
    const steam = lookup(name);
    if (steam === undefined || steam === 'not-steam') continue;
    const holder = tile.querySelector<HTMLElement>(TILE_IMAGE_SELECTOR) ?? (tile as HTMLElement);
    if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
    holder.append(createSteamBadge(doc, { name, steam }));
    added++;
  }
  return added;
}
