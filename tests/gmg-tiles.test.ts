// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { annotateGmg, collectGmgTitles } from '../lib/gmg-tiles';
import type { SteamLookup } from '../lib/title-site';

/** Markup shaped like a Green Man Gaming bundle page: game figures plus the bonus coupon. */
function figure(title: string): string {
  return `<figure class="col-6 bundle-item"><div class="figure-item-wrapper"><div class="image"><img alt="${title}"></div><figcaption><div class="item-box"><strong class="game-title">${title}</strong></div></figcaption></div></figure>`;
}
const COUPON = '<div class="col-12 bundle-item coupon"><div class="description-part"><h3>Extra 3% Off Your Next PC Game</h3></div></div>';

const lookup: SteamLookup = (title) =>
  ({ Hatred: { type: 'app', id: 341940 } as const, 'IS Defense': null })[title];
const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

describe('GMG tiles', () => {
  beforeEach(() => {
    document.body.innerHTML = figure('Hatred') + figure('IS Defense') + figure('Not Resolved Yet') + COUPON;
  });

  it('collects game titles, not the coupon', () => {
    expect(collectGmgTitles(document)).toEqual(['Hatred', 'IS Defense', 'Not Resolved Yet']);
  });

  it('badges resolved tiles inside the image, with a search link for misses', () => {
    expect(annotateGmg(document, lookup)).toBe(2);
    const [hit, miss] = badges();
    expect(hit!.href).toBe('https://store.steampowered.com/app/341940/');
    expect(hit!.parentElement?.classList).toContain('image');
    expect(miss!.classList).toContain('bsl-badge--search');
  });

  it('adds nothing twice', () => {
    annotateGmg(document, lookup);
    expect(annotateGmg(document, lookup)).toBe(0);
    expect(badges()).toHaveLength(2);
  });
});
