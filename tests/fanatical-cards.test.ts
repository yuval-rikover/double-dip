// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import type { BundleGame } from '../lib/fanatical';
import { annotateFanaticalCards } from '../lib/fanatical-cards';

const games: BundleGame[] = [
  { name: 'Haste', steam: { type: 'app', id: 1796470 } },
  { name: 'Critter Café', steam: null },
];

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
});
