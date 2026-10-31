// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { BundleGame } from '../lib/fanatical';
import { annotateFanaticalCards, annotateFanaticalPackLists, clearFanaticalRibbons } from '../lib/fanatical-cards';
import type { SteamLookup } from '../lib/title-site';

const games: BundleGame[] = [
  { name: 'Haste', steam: { type: 'app', id: 1796470 } },
  { name: 'Critter Café', steam: null },
  { name: 'DOOM + DOOM II', steam: null, findOnSteam: true },
  { name: 'AMID EVIL & DUSK Double Pack', steam: null, includes: ['AMID EVIL', 'DUSK'] },
];
const packLookup: SteamLookup = (title) =>
  ({ 'AMID EVIL': { type: 'app', id: 673130 } as const, DUSK: null })[title];

function card(cls: string, heading: 'h2' | 'h3', name: string): string {
  return `<article class="${cls} faux-block-link"><div class="card-overlay"><${heading} class="card-product-name">${name}</${heading}></div></article>`;
}

const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

function onlyBadge(): HTMLAnchorElement {
  const all = badges();
  expect(all).toHaveLength(1);
  return all[0]!;
}

describe('annotateFanaticalCards', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('links a tiered-bundle card to its Steam app page', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Haste');
    expect(annotateFanaticalCards(document, games)).toBe(1);
    expect(onlyBadge().href).toBe('https://store.steampowered.com/app/1796470/');
    expect(onlyBadge().target).toBe('_blank');
  });

  it('links a build-your-own card the same way', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'Haste');
    annotateFanaticalCards(document, games);
    expect(badges()).toHaveLength(1);
  });

  it('falls back to a Steam search when there is no id', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Critter Café');
    annotateFanaticalCards(document, games);
    expect(onlyBadge().href).toBe('https://store.steampowered.com/search/?term=Critter%20Caf%C3%A9');
    expect(onlyBadge().classList).toContain('bsl-badge--search');
  });

  it('links a game without an id once its title is found on Steam', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'DOOM + DOOM II');
    expect(annotateFanaticalCards(document, games)).toBe(0);
    expect(annotateFanaticalCards(document, games, () => ({ type: 'app', id: 2280 }))).toBe(1);
    expect(onlyBadge().href).toBe('https://store.steampowered.com/app/2280/');
  });

  it('searches Steam for it when the title is not found', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'DOOM + DOOM II');
    annotateFanaticalCards(document, games, () => null);
    expect(onlyBadge().classList).toContain('bsl-badge--search');
  });

  it('leaves cards that are not in the bundle alone', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Some Other Game');
    expect(annotateFanaticalCards(document, games)).toBe(0);
  });

  it('adds one badge per card across repeated scans', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Haste');
    annotateFanaticalCards(document, games);
    expect(annotateFanaticalCards(document, games)).toBe(0);
    expect(badges()).toHaveLength(1);
  });

  it('keeps a badge click from reaching the card, in either phase', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Haste');
    let cardClicks = 0;
    const article = document.querySelector('article')!;
    article.addEventListener('click', () => cardClicks++);
    // Green Man Gaming listens in the capture phase.
    article.addEventListener('click', () => cardClicks++, true);
    document.addEventListener('click', () => cardClicks++, true);
    annotateFanaticalCards(document, games);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    onlyBadge().dispatchEvent(click);
    expect(cardClicks).toBe(0);
    // Only propagation stops: the link still opens Steam.
    expect(click.defaultPrevented).toBe(false);
  });

  it('still lets clicks elsewhere on the card through', () => {
    document.body.innerHTML = card('bundle-game-card', 'h3', 'Haste');
    let cardClicks = 0;
    document.querySelector('article')!.addEventListener('click', () => cardClicks++);
    annotateFanaticalCards(document, games);
    document.querySelector('.card-product-name')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cardClicks).toBe(1);
  });

  it('labels a pack once all its games are looked up, with a button for their links', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'AMID EVIL &amp; DUSK Double Pack');
    expect(annotateFanaticalCards(document, games, (title) => (title === 'DUSK' ? undefined : packLookup(title)))).toBe(0);
    expect(annotateFanaticalCards(document, games, packLookup)).toBe(1);
    const label = onlyBadge();
    expect(label.tagName).toBe('BUTTON');
    expect(label.textContent).toBe('2 games ▾');
    expect(label.getAttribute('data-bsl-tip')).toBe('Pack of 2\nAMID EVIL\nDUSK\nClick for their Steam pages');
    expect(JSON.parse(label.getAttribute('data-bsl-pack')!)).toEqual([
      ['AMID EVIL', 'app/673130'],
      ['DUSK', null],
    ]);
  });

  it("opens a menu of the pack's Steam links on click, without opening the card", () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'AMID EVIL &amp; DUSK Double Pack');
    let cardClicks = 0;
    document.querySelector('article')!.addEventListener('click', () => cardClicks++);
    annotateFanaticalCards(document, games, packLookup);
    const button = onlyBadge();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(cardClicks).toBe(0);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.bsl-menu a')];
    expect(links.map((link) => [link.textContent, link.href])).toEqual([
      ['AMID EVIL\u00a0↗', 'https://store.steampowered.com/app/673130/'],
      ['DUSK\u00a0↗ search', 'https://store.steampowered.com/search/?term=DUSK'],
    ]);

    // A second click closes it, and so does a click elsewhere.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    expect(document.querySelector('.bsl-menu')).toBeNull();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(document.querySelector('.bsl-menu')).toBeNull();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('closes the menu on Escape and puts focus back on the button', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'AMID EVIL &amp; DUSK Double Pack');
    annotateFanaticalCards(document, games, packLookup);
    const button = onlyBadge();
    // From the keyboard: focus moves into the menu.
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(document.activeElement?.textContent).toBe('AMID EVIL\u00a0↗');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.bsl-menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });
});

describe('annotateFanaticalPackLists', () => {
  const panel = (...items: string[]) =>
    `<div class="info-container"><h4>This bundle includes:</h4><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it("badges each game in a pack's details list", () => {
    document.body.innerHTML = panel('AMID EVIL', 'DUSK');
    expect(annotateFanaticalPackLists(document, games, packLookup)).toBe(2);
    const [hit, miss] = badges();
    expect(hit!.href).toBe('https://store.steampowered.com/app/673130/');
    expect(hit!.classList).toContain('bsl-badge--inline');
    expect(hit!.parentElement?.tagName).toBe('LI');
    expect(miss!.classList).toContain('bsl-badge--search');
  });

  it('skips games not looked up yet, other lists, and items already badged', () => {
    document.body.innerHTML = panel('AMID EVIL', 'Something Else') + '<ul><li>DUSK</li></ul>';
    expect(annotateFanaticalPackLists(document, games, (title) => (title === 'AMID EVIL' ? undefined : null))).toBe(0);
    expect(annotateFanaticalPackLists(document, games, packLookup)).toBe(1);
    expect(annotateFanaticalPackLists(document, games, packLookup)).toBe(0);
  });
});

describe('clearFanaticalRibbons', () => {
  /** A card with our badge at `badgeLeft`, and optionally a ribbon and an owned marker. */
  function ribbonCard(opts: { ribbonRight?: number; badgeLeft: number; marker?: boolean }): HTMLElement {
    const article = document.createElement('article');
    article.className = 'PickAndMixCard faux-block-link';
    const rect = (left: number, right: number) => () => ({ left, right, top: 0, bottom: 20 }) as DOMRect;
    if (opts.ribbonRight !== undefined) {
      const ribbon = document.createElement('div');
      ribbon.className = 'card-label';
      ribbon.getBoundingClientRect = rect(-5, opts.ribbonRight);
      article.append(ribbon);
    }
    const badge = document.createElement('a');
    badge.setAttribute('data-bsl-badge', '');
    badge.getBoundingClientRect = rect(opts.badgeLeft, 261);
    article.append(badge);
    if (opts.marker) {
      const marker = document.createElement('span');
      marker.className = 'bsl-owned';
      article.append(marker);
    }
    document.body.append(article);
    return article;
  }
  const moved = (card: HTMLElement) =>
    [...card.querySelectorAll('[data-bsl-badge], .bsl-owned')].map((e) => e.hasAttribute('data-bsl-below-ribbon'));

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('leaves the row in place when the ribbon ends before the badge', () => {
    const card = ribbonCard({ ribbonRight: 119, badgeLeft: 130 });
    clearFanaticalRibbons(document);
    expect(moved(card)).toEqual([false]);
  });

  it('moves the badge down when the ribbon reaches it', () => {
    const card = ribbonCard({ ribbonRight: 173, badgeLeft: 125 });
    clearFanaticalRibbons(document);
    expect(moved(card)).toEqual([true]);
  });

  it('moves the whole row down when there is an owned marker under the ribbon', () => {
    const card = ribbonCard({ ribbonRight: 119, badgeLeft: 186, marker: true });
    clearFanaticalRibbons(document);
    expect(moved(card)).toEqual([true, true]);
  });

  it('leaves cards without a ribbon alone', () => {
    const card = ribbonCard({ badgeLeft: 125, marker: true });
    clearFanaticalRibbons(document);
    expect(moved(card)).toEqual([false, false]);
  });

  it('moves the row back up once the ribbon is gone', () => {
    const card = ribbonCard({ ribbonRight: 119, badgeLeft: 186, marker: true });
    clearFanaticalRibbons(document);
    card.querySelector('.card-label')!.remove();
    clearFanaticalRibbons(document);
    expect(moved(card)).toEqual([false, false]);
  });
});
