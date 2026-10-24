// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { BundleGame } from '../lib/fanatical';
import { annotateFanaticalCards, annotateFanaticalPackLists } from '../lib/fanatical-cards';
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

  it('labels a pack once all its games are looked up, without a link', () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'AMID EVIL &amp; DUSK Double Pack');
    expect(annotateFanaticalCards(document, games, (title) => (title === 'DUSK' ? undefined : packLookup(title)))).toBe(0);
    expect(annotateFanaticalCards(document, games, packLookup)).toBe(1);
    const label = onlyBadge();
    expect(label.tagName).toBe('SPAN');
    expect(label.textContent).toBe('2 games');
    expect(label.getAttribute('data-bsl-tip')).toBe('Pack of 2\nAMID EVIL\nDUSK');
    expect(JSON.parse(label.getAttribute('data-bsl-pack')!)).toEqual([
      ['AMID EVIL', 'app/673130'],
      ['DUSK', null],
    ]);
  });

  it("lets a click on a pack's label reach the card", () => {
    document.body.innerHTML = card('PickAndMixCard', 'h2', 'AMID EVIL &amp; DUSK Double Pack');
    let cardClicks = 0;
    document.querySelector('article')!.addEventListener('click', () => cardClicks++);
    annotateFanaticalCards(document, games, packLookup);
    onlyBadge().dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cardClicks).toBe(1);
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
