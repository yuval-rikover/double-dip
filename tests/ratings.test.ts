// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createSteamBadge } from '../lib/badge';
import { markRatedBadges, tileShowsSteamRating, unratedSteamRefs, type RatingLookup } from '../lib/ratings';
import type { SteamRating } from '../lib/steam-ratings';

const ratings: Record<string, SteamRating | null> = {
  'app/673130': { percent: 93, score: 8, label: 'Very Positive', count: 6681 },
  'app/1': { percent: 55, score: 5, label: 'Mixed', count: 120 },
  'app/2': { percent: 20, score: 3, label: 'Negative', count: 40 },
  'app/3284450': null,
};
const lookup: RatingLookup = (ref) => ratings[ref];

function tile(id: number, extra = '') {
  const el = document.createElement('div');
  el.className = 'tile';
  el.innerHTML = extra;
  el.append(createSteamBadge(document, { name: `Game ${id}`, steam: { type: 'app', id } }));
  document.body.append(el);
  return el.querySelector<HTMLAnchorElement>('[data-bsl-badge]')!;
}

describe('markRatedBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('adds the percentage to the badge, tinted by score, with details in the tooltip', () => {
    const badge = tile(673130);
    expect(markRatedBadges(document, lookup, '.tile')).toBe(1);
    expect(badge.textContent).toBe('Steam 93% ↗');
    expect(badge.querySelector('.bsl-rating')?.className).toBe('bsl-rating bsl-rating--positive');
    expect(badge.title).toBe('Open Game 673130 on Steam · Very Positive: 93% of 6,681 reviews');
    expect(badge.href).toBe('https://store.steampowered.com/app/673130/');
  });

  it("uses Steam's mixed and negative colors", () => {
    const mixed = tile(1);
    const negative = tile(2);
    markRatedBadges(document, lookup, '.tile');
    expect(mixed.querySelector('.bsl-rating')?.classList).toContain('bsl-rating--mixed');
    expect(negative.querySelector('.bsl-rating')?.classList).toContain('bsl-rating--negative');
  });

  it('leaves games without reviews as plain "Steam ↗"', () => {
    const badge = tile(3284450);
    expect(markRatedBadges(document, lookup, '.tile')).toBe(0);
    expect(badge.textContent).toBe('Steam ↗');
    expect(unratedSteamRefs(document)).toEqual([]);
  });

  it('waits for an answer, then rates the badge once', () => {
    tile(42);
    expect(markRatedBadges(document, lookup, '.tile')).toBe(0);
    expect(unratedSteamRefs(document)).toEqual(['app/42']);
    const later: RatingLookup = (ref) => (ref === 'app/42' ? ratings['app/673130'] : undefined);
    expect(markRatedBadges(document, later, '.tile')).toBe(1);
    expect(markRatedBadges(document, later, '.tile')).toBe(0);
  });

  it('skips tiles that already show the rating, without asking for it', () => {
    const humble = tile(673130, '<span class="item-flavor-text"><p>83% Positive on Steam</p><p>Never Been Bundled!</p></span>');
    const gmg = tile(1, '<span class="badge"><span>Very Positive</span></span>');
    expect(markRatedBadges(document, () => undefined, '.tile')).toBe(0);
    expect(unratedSteamRefs(document)).toEqual([]);
    expect(humble.textContent).toBe('Steam ↗');
    expect(gmg.textContent).toBe('Steam ↗');
  });

  it('does not rate search links', () => {
    const el = document.createElement('div');
    el.append(createSteamBadge(document, { name: 'Unknown', steam: null }));
    document.body.append(el);
    expect(unratedSteamRefs(document)).toEqual([]);
  });
});

describe('tileShowsSteamRating', () => {
  it('ignores words inside longer text, and the badge itself', () => {
    const el = document.createElement('div');
    el.innerHTML = '<p>A positive, mixed-genre adventure</p>';
    expect(tileShowsSteamRating(el)).toBe(false);
    el.innerHTML = '<a data-bsl-badge>Steam <span>93%</span> ↗</a>';
    expect(tileShowsSteamRating(el)).toBe(false);
    expect(tileShowsSteamRating(null)).toBe(false);
  });
});
