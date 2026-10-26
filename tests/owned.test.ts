// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest';
import { createPackBadge, createSteamBadge, type PackGame } from '../lib/badge';
import { clearOwnedMarkers, markOwnedBadges, uncheckedSteamRefs, type OwnershipLookup } from '../lib/owned';
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
    const chips = (el: Element) => [...el.querySelectorAll('.bsl-chip')].map((chip) => [chip.className, chip.textContent]);
    expect(chips(one)).toEqual([['bsl-chip bsl-chip--steam', 'Steam']]);
    expect(chips(two)).toEqual([
      ['bsl-chip bsl-chip--steam', 'Steam'],
      ['bsl-chip bsl-chip--gog', 'GOG'],
    ]);
    const marker = two.querySelector<HTMLElement>('[data-bsl-owned]')!;
    expect(marker.querySelector('.bsl-owned__check')?.textContent).toBe('✓');
    expect(marker.getAttribute('data-bsl-tip')).toBe('Owned on Steam and GOG');
    expect(marker.getAttribute('aria-label')).toBe('Owned on Steam and GOG');
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

  it('starts over after clearing, with new answers', () => {
    tile({ name: 'Brutal Legend', steam: { type: 'app', id: 225260 } });
    tile({ name: 'Kiln', steam: { type: 'app', id: 1165990 } });
    markOwnedBadges(document, lookup);
    clearOwnedMarkers(document);
    expect(markers()).toHaveLength(0);
    expect(markOwnedBadges(document, (ref) => (ref === 'app/1165990' ? ['epic'] : []))).toBe(1);
    expect(markers().map((marker) => marker.getAttribute('data-bsl-owned'))).toEqual(['epic']);
  });

  it('lists each unchecked id once', () => {
    tile({ name: 'A', steam: { type: 'app', id: 1 } });
    tile({ name: 'A again', steam: { type: 'app', id: 1 } });
    expect(uncheckedSteamRefs(document)).toEqual(['app/1']);
  });
});

describe('markOwnedBadges on packs', () => {
  const pack = (games: PackGame[]) => {
    const el = document.createElement('div');
    el.append(createPackBadge(document, games));
    document.body.append(el);
    return el;
  };
  const trio: PackGame[] = [
    { name: 'Brutal Legend', steam: { type: 'app', id: 225260 } },
    { name: 'Psychonauts', steam: { type: 'app', id: 3830 } },
    { name: 'Kiln', steam: { type: 'app', id: 1165990 } },
  ];

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('asks about every game in the pack', () => {
    pack(trio);
    expect(uncheckedSteamRefs(document)).toEqual(['app/225260', 'app/3830', 'app/1165990']);
  });

  it('shows how many of the games are owned, and where', () => {
    const el = pack(trio);
    expect(markOwnedBadges(document, lookup)).toBe(1);
    const marker = el.querySelector<HTMLElement>('[data-bsl-owned]')!;
    expect(marker.classList).toContain('bsl-owned--partial');
    expect(marker.querySelector('.bsl-owned__check')?.textContent).toBe('2/3');
    expect([...marker.querySelectorAll('.bsl-chip')].map((chip) => chip.textContent)).toEqual(['Steam', 'GOG']);
    expect(marker.getAttribute('data-bsl-tip')).toBe('Own 2 of 3\nBrutal Legend (Steam)\nPsychonauts (Steam, GOG)');
    expect(marker.getAttribute('aria-label')).toBe('Own 2 of 3. Brutal Legend (Steam). Psychonauts (Steam, GOG)');
  });

  it('shows the plain check when every game is owned', () => {
    const el = pack(trio.slice(0, 2));
    markOwnedBadges(document, lookup);
    const marker = el.querySelector<HTMLElement>('[data-bsl-owned]')!;
    expect(marker.classList).not.toContain('bsl-owned--partial');
    expect(marker.querySelector('.bsl-owned__check')?.textContent).toBe('✓');
    expect(marker.getAttribute('data-bsl-tip')).toBe('Own all 2\nBrutal Legend (Steam)\nPsychonauts (Steam, GOG)');
  });

  it('counts a game not on Steam as not owned', () => {
    const el = pack([trio[0]!, { name: 'Critter Café', steam: null }]);
    markOwnedBadges(document, lookup);
    expect(el.querySelector('.bsl-owned__check')?.textContent).toBe('1/2');
  });

  it('waits until every game has an answer, and marks nothing when none are owned', () => {
    pack([trio[0]!, { name: 'Later', steam: { type: 'app', id: 42 } }]);
    expect(markOwnedBadges(document, lookup)).toBe(0);
    expect(uncheckedSteamRefs(document)).toEqual(['app/225260', 'app/42']);
    document.body.innerHTML = '';
    pack([trio[2]!]);
    expect(markOwnedBadges(document, lookup)).toBe(0);
    expect(uncheckedSteamRefs(document)).toEqual([]);
  });
});
