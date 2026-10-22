// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createSteamBadge } from '../lib/badge';
import { markOwnedBadges, uncheckedSteamRefs, type OwnershipLookup } from '../lib/owned';
import type { Store } from '../lib/ownership';

const answers: Record<string, Store[]> = {
  'app/225260': ['steam'],
  'app/3830': ['steam', 'gog'],
  'app/1165990': [],
};
const lookup: OwnershipLookup = (ref) => answers[ref];
const markers = () => [...document.querySelectorAll('[data-bsl-owned]')];

function tile(game: Parameters<typeof createSteamBadge>[1], placement?: 'corner' | 'inline') {
  const el = document.createElement('div');
  el.append(createSteamBadge(document, game, placement));
  document.body.append(el);
  return el;
}

describe('markOwnedBadges', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('names the stores that own the game', () => {
    const one = tile({ name: 'Brutal Legend', steam: { type: 'app', id: 225260 } });
    const two = tile({ name: 'Psychonauts', steam: { type: 'app', id: 3830 } });
    expect(markOwnedBadges(document, lookup)).toBe(2);
    expect(one.querySelector('[data-bsl-owned]')?.textContent).toBe('✓ Owned · Steam');
    expect(two.querySelector('[data-bsl-owned]')?.textContent).toBe('✓ Owned · Steam, GOG');
    expect(two.querySelector<HTMLElement>('[data-bsl-owned]')?.title).toBe('In your Steam and GOG libraries');
  });

  it('marks nothing for games owned nowhere, or search-only badges', () => {
    tile({ name: 'Kiln', steam: { type: 'app', id: 1165990 } });
    tile({ name: 'Critter Café', steam: null });
    expect(markOwnedBadges(document, lookup)).toBe(0);
  });

  it('waits for unanswered ids, then marks them on a later pass', () => {
    tile({ name: 'Later', steam: { type: 'app', id: 42 } });
    expect(markOwnedBadges(document, lookup)).toBe(0);
    expect(uncheckedSteamRefs(document)).toEqual(['app/42']);
    expect(markOwnedBadges(document, (ref) => (ref === 'app/42' ? ['gog'] : undefined))).toBe(1);
    expect(uncheckedSteamRefs(document)).toEqual([]);
  });

  it('uses the inline style next to inline badges', () => {
    tile({ name: 'Brutal Legend', steam: { type: 'app', id: 225260 } }, 'inline');
    markOwnedBadges(document, lookup);
    expect(markers()[0]!.classList).toContain('bsl-owned--inline');
  });

  it('checks each badge once', () => {
    tile({ name: 'Brutal Legend', steam: { type: 'app', id: 225260 } });
    markOwnedBadges(document, lookup);
    expect(markOwnedBadges(document, lookup)).toBe(0);
    expect(markers()).toHaveLength(1);
  });

  it('lists each unchecked id once', () => {
    tile({ name: 'A', steam: { type: 'app', id: 1 } });
    tile({ name: 'A again', steam: { type: 'app', id: 1 } });
    expect(uncheckedSteamRefs(document)).toEqual(['app/1']);
  });
});
