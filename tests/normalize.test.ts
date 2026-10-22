import { describe, expect, it } from 'vitest';
import { normalizeTitle } from '../lib/normalize';

describe('normalizeTitle', () => {
  it.each([
    ['Brütal Legend', 'brutal legend'],
    ['Critter Café', 'critter cafe'],
    ['PlateUp!', 'plateup'],
    ["Hack 'n' Slash", 'hack n slash'],
    ['DOOM™ Eternal®', 'doom eternal'],
    ['Oddsparks: An Automation Adventure', 'oddsparks an automation adventure'],
    ['Ratchet & Clank', 'ratchet and clank'],
    ['  Spacebase   DF-9 ', 'spacebase df 9'],
  ])('%s → %s', (title, expected) => {
    expect(normalizeTitle(title)).toBe(expected);
  });

  it('keeps edition suffixes, which can be different Steam apps', () => {
    expect(normalizeTitle('Steelrising - Bastille Edition')).not.toBe(normalizeTitle('Steelrising'));
  });
});
