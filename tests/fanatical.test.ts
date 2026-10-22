import { describe, expect, it } from 'vitest';
import { extractBundleGames, fanaticalApiPath, parseFanaticalPath } from '../lib/fanatical';
import mystery from './fixtures/fanatical-mystery.json';
import pickAndMix from './fixtures/fanatical-pick-and-mix.json';
import productsGroup from './fixtures/fanatical-products-group.json';

describe('parseFanaticalPath', () => {
  it('recognizes tiered and build-your-own bundles', () => {
    expect(parseFanaticalPath('/en/bundle/coppafeel-charity-bundle')).toEqual({
      kind: 'bundle',
      lang: 'en',
      slug: 'coppafeel-charity-bundle',
    });
    expect(parseFanaticalPath('/de/pick-and-mix/build-your-own-fall-bundle/')).toEqual({
      kind: 'pick-and-mix',
      lang: 'de',
      slug: 'build-your-own-fall-bundle',
    });
  });

  it('ignores section listings and other pages', () => {
    expect(parseFanaticalPath('/en/bundle/games')).toBeNull();
    expect(parseFanaticalPath('/en/bundle/mystery')).toBeNull();
    expect(parseFanaticalPath('/en/game/haste')).toBeNull();
    expect(parseFanaticalPath('/en/')).toBeNull();
  });
});

describe('fanaticalApiPath', () => {
  it('maps each page kind to the endpoint the page itself calls', () => {
    expect(fanaticalApiPath({ kind: 'bundle', lang: 'en', slug: 'x' })).toBe('/api/products-group/x/en');
    expect(fanaticalApiPath({ kind: 'pick-and-mix', lang: 'en', slug: 'y' })).toBe('/api/pick-and-mix/y/en');
  });
});

describe('extractBundleGames', () => {
  it('reads Steam app ids from a tiered bundle', () => {
    const games = extractBundleGames(productsGroup);
    expect(games).toHaveLength(10);
    expect(games).toContainEqual({ name: 'Haste', steam: { type: 'app', id: 1796470 } });
  });

  it('keeps a game without a Steam id, with steam null', () => {
    expect(extractBundleGames(productsGroup)).toContainEqual({ name: 'Critter Café', steam: null });
  });

  it('reads build-your-own products, including a sub-bundle with no id', () => {
    const games = extractBundleGames(pickAndMix);
    expect(games).toHaveLength(17);
    expect(games).toContainEqual({ name: 'Dreamscaper', steam: { type: 'app', id: 1040420 } });
    expect(games).toContainEqual({ name: 'Police Stories - Complete Edition', steam: null });
  });

  it('de-duplicates games repeated across tiers', () => {
    const { games } = productsGroup.bundles[0]!;
    const tiered = { bundles: [{ games }, { games }] };
    expect(extractBundleGames(tiered)).toHaveLength(10);
  });

  it('drops mystery placeholders', () => {
    expect(extractBundleGames(mystery)).toEqual([]);
  });

  it('maps package ids to Steam sub links', () => {
    expect(extractBundleGames({ products: [{ name: 'Pack', steam: { type: 'sub', id: 42 } }] })).toEqual([
      { name: 'Pack', steam: { type: 'sub', id: 42 } },
    ]);
  });
});
