// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPackBadge, createSteamBadge } from '../lib/badge';
import { markRatedBadges, unratedSteamRefs, type RatingLookup } from '../lib/ratings';
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

  it('adds the percentage and review count to the badge, tinted by score, with details in the tooltip', () => {
    const badge = tile(673130);
    expect(markRatedBadges(document, lookup)).toBe(1);
    expect(badge.textContent).toBe('Steam 93% 6.7K ↗');
    expect(badge.querySelector('.bsl-rating-count')?.textContent).toBe('6.7K');
    expect(badge.querySelector('.bsl-rating-count svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(badge.querySelector('.bsl-rating')?.className).toBe('bsl-rating bsl-rating--positive');
    expect(badge.getAttribute('data-bsl-tip')).toBe('Game 673130\nVery Positive · 93% of 6,681 reviews\nOpen on Steam');
    expect(badge.title).toBe('');
    expect(badge.href).toBe('https://store.steampowered.com/app/673130/');
  });

  it("uses Steam's mixed and negative colors", () => {
    const mixed = tile(1);
    const negative = tile(2);
    markRatedBadges(document, lookup);
    expect(mixed.querySelector('.bsl-rating')?.classList).toContain('bsl-rating--mixed');
    expect(negative.querySelector('.bsl-rating')?.classList).toContain('bsl-rating--negative');
  });

  it('fades the percentage when there are under 50 reviews, and says why', () => {
    const few = tile(2);
    const many = tile(1);
    markRatedBadges(document, lookup);
    expect(few.querySelector('.bsl-rating')?.classList).toContain('bsl-rating--few');
    expect(few.getAttribute('data-bsl-tip')).toBe('Game 2\nNegative · 20% of 40 reviews, too few to go by\nOpen on Steam');
    expect(many.querySelector('.bsl-rating')?.classList).not.toContain('bsl-rating--few');
  });

  it('leaves games without reviews as plain "Steam ↗"', () => {
    const badge = tile(3284450);
    expect(markRatedBadges(document, lookup)).toBe(0);
    expect(badge.textContent).toBe('Steam ↗');
    expect(unratedSteamRefs(document)).toEqual([]);
  });

  it('waits for an answer, then rates the badge once', () => {
    tile(42);
    expect(markRatedBadges(document, lookup)).toBe(0);
    expect(unratedSteamRefs(document)).toEqual(['app/42']);
    const later: RatingLookup = (ref) => (ref === 'app/42' ? ratings['app/673130'] : undefined);
    expect(markRatedBadges(document, later)).toBe(1);
    expect(markRatedBadges(document, later)).toBe(0);
  });

  it("rates tiles that show Steam's label or percentage too", () => {
    const humble = tile(673130, '<span class="item-flavor-text"><p>83% Positive on Steam</p></span>');
    const gmg = tile(1, '<span class="badge"><span>Very Positive</span></span>');
    expect(markRatedBadges(document, lookup)).toBe(2);
    expect(humble.textContent).toBe('Steam 93% 6.7K ↗');
    expect(gmg.textContent).toBe('Steam 55% 120 ↗');
  });

  it('does not rate search links', () => {
    const el = document.createElement('div');
    el.append(createSteamBadge(document, { name: 'Unknown', steam: null }));
    document.body.append(el);
    expect(unratedSteamRefs(document)).toEqual([]);
  });
});

describe('ratings for packs', () => {
  const packBadge = () => {
    const el = document.createElement('div');
    el.className = 'tile';
    const badge = createPackBadge(document, [
      { name: 'AMID EVIL', steam: { type: 'app', id: 673130 } },
      { name: 'Unreviewed', steam: { type: 'app', id: 3284450 } },
      { name: 'Not on Steam', steam: null },
    ]);
    el.append(badge);
    document.body.append(el);
    return badge;
  };

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it("asks about the pack's games, and keeps their ratings once all are answered", () => {
    const badge = packBadge();
    expect(unratedSteamRefs(document)).toEqual(['app/673130', 'app/3284450']);
    markRatedBadges(document, (ref) => (ref === 'app/3284450' ? undefined : lookup(ref)));
    expect(badge.hasAttribute('data-bsl-pack-ratings')).toBe(false);
    markRatedBadges(document, lookup);
    expect(JSON.parse(badge.getAttribute('data-bsl-pack-ratings')!)).toEqual([ratings['app/673130'], null, null]);
    expect(unratedSteamRefs(document)).toEqual([]);
  });

  it('shows each rating in the tooltip on hover', () => {
    vi.useFakeTimers();
    try {
      const badge = packBadge();
      markRatedBadges(document, lookup);
      badge.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      vi.runAllTimers();
      const rows = [...document.querySelectorAll('.bsl-tip .bsl-pack-row')].map((row) => row.textContent);
      expect(rows).toEqual(['AMID EVIL93%6.7K', 'Unreviewed', 'Not on Steam']);
      expect(document.querySelector('.bsl-tip strong')?.textContent).toBe('Pack of 3');
    } finally {
      vi.useRealTimers();
    }
  });
});
