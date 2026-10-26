import { describe, expect, it } from 'vitest';
import { awaitsChange, describeLibrary, formatAge, markersChanged, summarizeLibrary, type LibrarySummaries } from '../lib/library-summary';

const NOW = 1_800_000_000_000;
const MIN = 60_000;

describe('summarizeLibrary', () => {
  it('replaces the id lists with a count', () => {
    const library = { status: 'ok' as const, apps: [1, 2, 3], packages: [9], fetchedAt: NOW };
    expect(summarizeLibrary(library, (l) => l.apps.length)).toEqual({ status: 'ok', count: 3, fetchedAt: NOW });
  });

  it('keeps the signed-out mark of a kept library', () => {
    const library = { status: 'ok' as const, offers: ['a'], fetchedAt: NOW, signedOut: true };
    expect(summarizeLibrary(library, (l) => l.offers.length)).toEqual({ status: 'ok', count: 1, fetchedAt: NOW, signedOut: true });
  });

  it('passes signed-out and error through', () => {
    expect(summarizeLibrary({ status: 'signed-out' }, () => 0)).toEqual({ status: 'signed-out' });
    expect(summarizeLibrary({ status: 'error', message: 'x' }, () => 0)).toEqual({ status: 'error', message: 'x' });
  });
});

describe('formatAge', () => {
  it.each([
    [0, 'just now'],
    [5 * MIN, '5 min ago'],
    [59 * MIN, '59 min ago'],
    [3 * 60 * MIN, '3 h ago'],
    [24 * 60 * MIN, '1 day ago'],
    [50 * 60 * MIN, '2 days ago'],
  ])('%i ms → %s', (age, expected) => {
    expect(formatAge(NOW - age, NOW)).toBe(expected);
  });
});

describe('describeLibrary', () => {
  it('describes each status', () => {
    expect(describeLibrary({ status: 'ok', count: 2887, fetchedAt: NOW - 5 * MIN }, NOW)).toBe('2,887 items · updated 5 min ago');
    expect(describeLibrary({ status: 'signed-out' }, NOW)).toBe('Signed out in this browser');
    expect(describeLibrary({ status: 'ok', count: 1234, fetchedAt: NOW - 180 * MIN, signedOut: true }, NOW)).toBe(
      'Signed out · showing 1,234 items from 3 h ago',
    );
    expect(describeLibrary({ status: 'error', message: 'GOG games returned 503' }, NOW)).toBe(
      "Couldn't load: GOG games returned 503",
    );
  });
});

describe('awaitsChange', () => {
  it('re-checks syncing and signed-out stores, not loaded or failed ones', () => {
    expect(awaitsChange({ status: 'syncing' })).toBe(true);
    expect(awaitsChange({ status: 'signed-out' })).toBe(true);
    expect(awaitsChange({ status: 'ok', count: 1, fetchedAt: NOW, signedOut: true })).toBe(true);
    expect(awaitsChange({ status: 'ok', count: 1, fetchedAt: NOW })).toBe(false);
    expect(awaitsChange({ status: 'error', message: 'x' })).toBe(false);
  });
});

describe('markersChanged', () => {
  const base: LibrarySummaries = {
    steam: { status: 'ok', count: 2887, fetchedAt: NOW - 5 * MIN },
    gog: { status: 'signed-out' },
    epic: { status: 'ok', count: 664, fetchedAt: NOW - 5 * MIN },
  };

  it('ignores a refresh that only updated the time', () => {
    expect(markersChanged(base, { ...base, steam: { status: 'ok', count: 2887, fetchedAt: NOW } })).toBe(false);
  });

  it('ignores Epic going signed out while its library is kept', () => {
    expect(markersChanged(base, { ...base, epic: { status: 'ok', count: 664, fetchedAt: NOW, signedOut: true } })).toBe(false);
  });

  it('notices a new purchase, a sign-in and a library going away', () => {
    expect(markersChanged(base, { ...base, steam: { status: 'ok', count: 2888, fetchedAt: NOW } })).toBe(true);
    expect(markersChanged(base, { ...base, gog: { status: 'ok', count: 610, fetchedAt: NOW } })).toBe(true);
    expect(markersChanged(base, { ...base, epic: { status: 'syncing' } })).toBe(true);
  });
});
