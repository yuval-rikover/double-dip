import type { SteamRef } from './steam';

/** A Fanatical page whose games this extension annotates. */
export interface FanaticalPage {
  kind: 'bundle' | 'pick-and-mix';
  lang: string;
  slug: string;
}

export interface BundleGame {
  name: string;
  /** null when Fanatical has no Steam id for the item (mystery slots, sub-bundles). */
  steam: SteamRef | null;
  /** For a pack ("Double Pack", "Triple Pack"): the titles of the games in it. */
  includes?: string[];
}

/** Fanatical's own section pages, which list bundles rather than being one. */
const SECTION_SLUGS = new Set([
  'games',
  'books',
  'software',
  'elearning',
  'comics',
  'audio',
  'mystery',
  'other',
]);

export function parseFanaticalPath(pathname: string): FanaticalPage | null {
  const match = pathname.match(/^\/([a-z]{2}(?:-[a-z]+)?)\/(bundle|pick-and-mix)\/([a-z0-9-]+)\/?$/);
  if (!match) return null;
  const [, lang, kind, slug] = match as unknown as [string, string, string, string];
  if (kind === 'bundle' && SECTION_SLUGS.has(slug)) return null;
  return { kind: kind as FanaticalPage['kind'], lang, slug };
}

/** The JSON endpoint the Fanatical page itself calls to render the bundle. */
export function fanaticalApiPath(page: FanaticalPage): string {
  const group = page.kind === 'bundle' ? 'products-group' : 'pick-and-mix';
  return `/api/${group}/${page.slug}/${page.lang}`;
}

interface ApiProduct {
  name?: string;
  /** Set on mystery-bundle placeholders ("Haunted Mystery Game"). */
  mystery?: boolean | null;
  steam?: { type?: string | null; id?: number | null } | null;
  /** Set on packs: the games inside, by title only — no Steam ids. */
  gameNames?: string[] | null;
}

interface ApiResponse {
  bundles?: { games?: ApiProduct[] }[];
  products?: ApiProduct[];
}

/**
 * Lists the bundle's games, de-duplicated by name. A tiered bundle repeats
 * lower-tier games in every higher tier. Mystery placeholders are dropped:
 * there is no real game behind them to link to. A pack has no Steam id of
 * its own; it keeps the titles of the games inside instead.
 */
export function extractBundleGames(data: ApiResponse): BundleGame[] {
  const products = [...(data.bundles ?? []).flatMap((tier) => tier.games ?? []), ...(data.products ?? [])];
  const byName = new Map<string, BundleGame>();
  for (const product of products) {
    if (!product.name || product.mystery || byName.has(product.name)) continue;
    const game: BundleGame = { name: product.name, steam: toSteamRef(product.steam) };
    if (!game.steam && product.gameNames?.length) game.includes = product.gameNames;
    byName.set(product.name, game);
  }
  return [...byName.values()];
}

function toSteamRef(steam: ApiProduct['steam']): SteamRef | null {
  if (!steam?.id) return null;
  if (steam.type === 'app') return { type: 'app', id: steam.id };
  if (steam.type === 'sub' || steam.type === 'package') return { type: 'sub', id: steam.id };
  return null;
}
