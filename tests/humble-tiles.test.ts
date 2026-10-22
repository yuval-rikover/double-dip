// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { annotateHumble, collectHumbleTitles } from '../lib/humble-tiles';
import type { SteamLookup } from '../lib/title-site';

/** Markup shaped like a Humble bundle page: tier grid tiles plus the details carousel. */
const PAGE = `
  <div class="desktop-tier-collection-view">
    <div class="tier-item-view"><a class="js-item-details item-details" href="#"><div class="img-container"></div><span class="item-title">Kiln</span></a></div>
    <div class="tier-item-view"><a class="js-item-details item-details" href="#"><div class="img-container"></div><span class="item-title">Mystery Thing</span></a></div>
  </div>
  <div class="tier-item-details-view"><section class="header-area"><h2 class="heading-medium">Kiln</h2><s class="msrp">$19.99</s></section></div>
`;

const lookup: SteamLookup = (title) =>
  ({ Kiln: { type: 'app', id: 1165990 } as const, 'Mystery Thing': null })[title];

const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

describe('Humble tiles', () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
  });

  it('collects each title once from tiles and details headings', () => {
    expect(collectHumbleTitles(document)).toEqual(['Kiln', 'Mystery Thing']);
  });

  it('badges tiles in the corner and details headings inline', () => {
    expect(annotateHumble(document, lookup)).toBe(3);
    const [tile, unmatched, details] = badges();
    expect(tile!.href).toBe('https://store.steampowered.com/app/1165990/');
    expect(tile!.closest('.tier-item-view')).not.toBeNull();
    expect(unmatched!.classList).toContain('bsl-badge--search');
    expect(details!.classList).toContain('bsl-badge--inline');
    expect(details!.previousElementSibling?.tagName).toBe('H2');
  });

  it('waits for titles that are not resolved yet', () => {
    expect(annotateHumble(document, () => undefined)).toBe(0);
  });

  it('adds nothing twice', () => {
    annotateHumble(document, lookup);
    expect(annotateHumble(document, lookup)).toBe(0);
    expect(badges()).toHaveLength(3);
  });
});
