// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { annotateChoice, collectChoiceTitles } from '../lib/humble-choice';
import type { SteamLookup } from '../lib/title-site';

/** A tile shaped like a Choice month's grid (2026-11): a button around the card, right in the grid. */
function tile(title: string): string {
  return `<button type="button" aria-label="View details for ${title}">
    <div data-testid="product-card"><div><div data-testid="product-thumbnail"><img alt=""></div></div>
      <div data-testid="product-card-footer"><div><div><div>${title}</div></div></div><div><div>View Details</div></div></div>
    </div>
  </button>`;
}

/** The details dialog, open on one game, with its carousel of the month's games. */
const DIALOG = `
  <div role="dialog" aria-labelledby="radix-h1">
    <div><h2 id="radix-h1">Product Details</h2><div role="region" data-choice-count="3"></div></div>
    <div><h3>Psychonauts 2</h3><div><p>Retail $59.99</p></div></div>
  </div>`;

const lookup: SteamLookup = (title) =>
  ({ 'Psychonauts 2': { type: 'app', id: 607080 } as const, 'IGN Plus Subscription': null })[title];

const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

describe('Humble Choice tiles', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="grid">' + tile('Psychonauts 2') + tile('IGN Plus Subscription') + tile('Unknown Game') + '</div>' + DIALOG;
  });

  it('collects each tile title once', () => {
    document.body.insertAdjacentHTML('beforeend', tile('Psychonauts 2'));
    expect(collectChoiceTitles(document)).toEqual(['Psychonauts 2', 'IGN Plus Subscription', 'Unknown Game']);
  });

  it('badges matched tiles on their art, and the dialog heading inline', () => {
    expect(annotateChoice(document, lookup)).toBe(2);
    const [tileBadge, details] = badges();
    expect(tileBadge!.href).toBe('https://store.steampowered.com/app/607080/');
    expect(tileBadge!.parentElement?.dataset.testid).toBe('product-thumbnail');
    expect(details!.classList).toContain('bsl-badge--inline');
    expect(details!.parentElement?.previousElementSibling?.tagName).toBe('H3');
  });

  it('skips titles with no Steam match and waits on unresolved ones', () => {
    annotateChoice(document, lookup);
    expect(badges().some((badge) => badge.classList.contains('bsl-badge--search'))).toBe(false);
  });

  it('adds nothing twice', () => {
    annotateChoice(document, lookup);
    expect(annotateChoice(document, lookup)).toBe(0);
    expect(badges()).toHaveLength(2);
  });

  it('opens a badge in a tile from its own click, without opening the tile', () => {
    annotateChoice(document, lookup);
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    const tileClicked = vi.fn();
    document.querySelector('button')!.addEventListener('click', tileClicked);
    badges()[0]!.click();
    expect(open).toHaveBeenCalledWith('https://store.steampowered.com/app/607080/', '_blank', 'noopener');
    expect(tileClicked).not.toHaveBeenCalled();
    open.mockRestore();
  });

  it('replaces the dialog badge when the carousel switches games', () => {
    const ids: Record<string, number> = { 'Psychonauts 2': 607080, Kiln: 1165990 };
    const byId: SteamLookup = (title) => (ids[title] ? { type: 'app', id: ids[title]! } : undefined);
    annotateChoice(document, byId);
    const heading = document.querySelector('h3')!;
    heading.textContent = 'Kiln';
    expect(annotateChoice(document, byId)).toBe(1);
    const rows = document.querySelectorAll('[role=dialog] .bsl-row');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.querySelector('a')!.href).toBe('https://store.steampowered.com/app/1165990/');
    // A game not resolved yet: the old badge goes, none replaces it yet.
    heading.textContent = 'Unknown Game';
    expect(annotateChoice(document, byId)).toBe(0);
    expect(document.querySelectorAll('[role=dialog] .bsl-row')).toHaveLength(0);
  });
});
