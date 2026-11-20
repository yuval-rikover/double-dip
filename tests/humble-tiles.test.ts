// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { annotateHumble, collectHumbleTitles } from '../lib/humble-tiles';
import type { SteamLookup } from '../lib/title-site';

/** Markup shaped like a Humble bundle page (2026-11-20): grid tiles plus an open details dialog. */
const card = (title: string, artId = 'product-thumbnail') => `
  <li class="min-w-0"><button type="button" aria-haspopup="dialog" class="relative flex w-full">
    <div class="w-full rounded-lg" data-testid="bundle-item-card" data-bundle-type="games">
      <div class="relative"><div class="relative w-full" data-testid="${artId}"><img alt="${title}" src="x.jpg"></div></div>
      <div class="flex flex-col"><div class="p-3"><div class="line-clamp-2" data-state="closed">${title}</div></div></div>
    </div>
  </button></li>`;
const PAGE = `
  <section data-testid="bundle-item-section-games"><ul class="grid">${card('Kiln')}${card('Mystery Thing')}</ul></section>
  <div role="dialog" aria-labelledby="radix-h1" data-state="open">
    <div class="flex flex-col gap-1"><h2 id="radix-h1">Kiln</h2><p>Retail $19.99</p></div>
  </div>
  <div role="dialog" aria-labelledby="cart-title"><h2 id="cart-title">Your Cart</h2></div>
`;

const lookup: SteamLookup = (title) =>
  ({ Kiln: { type: 'app', id: 1165990 } as const, 'Mystery Thing': null })[title];

const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

describe('Humble tiles', () => {
  beforeEach(() => {
    document.body.innerHTML = PAGE;
  });

  it('collects each tile title once', () => {
    document.querySelector('ul')!.insertAdjacentHTML('beforeend', card('Kiln'));
    expect(collectHumbleTitles(document)).toEqual(['Kiln', 'Mystery Thing']);
  });

  it('badges tiles in the corner and details headings inline', () => {
    expect(annotateHumble(document, lookup)).toBe(3);
    const [tile, unmatched, details] = badges();
    expect(tile!.href).toBe('https://store.steampowered.com/app/1165990/');
    // Beside the tile's button, not inside it.
    expect(tile!.parentElement?.tagName).toBe('LI');
    expect(tile!.closest('button')).toBeNull();
    expect(unmatched!.classList).toContain('bsl-badge--search');
    expect(details!.classList).toContain('bsl-badge--inline');
    expect(details!.parentElement?.classList).toContain('bsl-row');
    expect(details!.parentElement?.previousElementSibling?.tagName).toBe('H2');
  });

  it('waits for titles that are not resolved yet', () => {
    expect(annotateHumble(document, () => undefined)).toBe(0);
  });

  it('adds nothing twice', () => {
    annotateHumble(document, lookup);
    expect(annotateHumble(document, lookup)).toBe(0);
    expect(badges()).toHaveLength(3);
  });

  it("marks badges on tiles that show Humble's own rating, once it renders", () => {
    annotateHumble(document, lookup);
    const [kiln, mystery] = badges();
    expect(kiln!.hasAttribute('data-bsl-site-rating')).toBe(false);
    const art = document.querySelector('[data-testid="product-thumbnail"]')!;
    art.insertAdjacentHTML('afterend', '<div class="absolute"><div><div class="rounded-full"><svg></svg><span>93%</span></div></div></div>');
    annotateHumble(document, lookup);
    expect(kiln!.hasAttribute('data-bsl-site-rating')).toBe(true);
    expect(mystery!.hasAttribute('data-bsl-site-rating')).toBe(false);
  });

  it('reads titles from tiles with the art test id Humble used before 2026-11-20', () => {
    document.body.innerHTML = `<ul>${card('Kiln', 'bundle-item-native-image')}</ul>`;
    expect(collectHumbleTitles(document)).toEqual(['Kiln']);
  });
});
