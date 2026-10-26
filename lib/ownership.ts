import type { EpicLibraryNow } from './epic-library';
import type { GogLibrary } from './gog-library';
import type { LibraryStatus } from './library-cache';
import type { ShopIds } from './shop-map';
import { parseSteamRef } from './steam';
import type { SteamLibrary } from './steam-library';

export type Store = 'steam' | 'gog' | 'epic';

export const STORE_NAMES: Record<Store, string> = { steam: 'Steam', gog: 'GOG', epic: 'Epic' };

export interface OwnershipResult {
  /** Per Steam id ("app/225260"): the stores the user owns the game on. */
  owned: Record<string, Store[]>;
  /** Per Steam id of a game owned nowhere: the stores where it's on the user's wishlist. */
  wishlisted: Record<string, Store[]>;
  status: Record<Store, LibraryStatus | 'syncing'>;
}

export interface OwnershipSources {
  steam: () => Promise<SteamLibrary>;
  gog: () => Promise<GogLibrary>;
  epic: () => Promise<EpicLibraryNow>;
  shopIds: (steamRefs: string[]) => Promise<Record<string, ShopIds>>;
}

/**
 * Answers, for each Steam id on a page, which libraries hold the game, and for
 * games owned nowhere, which wishlists (Steam, GOG) have it. GOG and Epic are
 * matched by id through ITAD, so a game ITAD can't map is checked on Steam
 * only.
 */
export async function getOwnership(steamRefs: string[], sources: OwnershipSources): Promise<OwnershipResult> {
  const [steam, gog, epic] = await Promise.all([sources.steam(), sources.gog(), sources.epic()]);
  const steamApps = new Set(steam.status === 'ok' ? steam.apps : []);
  const steamPackages = new Set(steam.status === 'ok' ? steam.packages : []);
  const gogOwned = new Set(gog.status === 'ok' ? gog.owned.map(String) : []);
  const epicOwned = new Set(epic.status === 'ok' ? epic.offers : []);
  const steamWished = new Set(steam.status === 'ok' ? (steam.wishlist ?? []) : []);
  const gogWished = new Set(gog.status === 'ok' ? (gog.wishlist ?? []).map(String) : []);
  // Mapping to GOG/Epic ids costs ITAD calls; skip it when there's nothing to match there.
  const needShopIds = gogOwned.size > 0 || epicOwned.size > 0 || gogWished.size > 0;
  const shopIds = needShopIds ? await sources.shopIds(steamRefs) : {};

  const owned: Record<string, Store[]> = {};
  const wishlisted: Record<string, Store[]> = {};
  for (const value of steamRefs) {
    const ref = parseSteamRef(value);
    if (!ref) continue;
    const stores: Store[] = [];
    if ((ref.type === 'app' ? steamApps : steamPackages).has(ref.id)) stores.push('steam');
    if (shopIds[value]?.gog.some((id) => gogOwned.has(id))) stores.push('gog');
    if (shopIds[value]?.epic.some((id) => epicOwned.has(id))) stores.push('epic');
    owned[value] = stores;
    if (stores.length > 0) continue;
    const wished: Store[] = [];
    // Steam wishlists hold apps only.
    if (ref.type === 'app' && steamWished.has(ref.id)) wished.push('steam');
    if (shopIds[value]?.gog.some((id) => gogWished.has(id))) wished.push('gog');
    if (wished.length > 0) wishlisted[value] = wished;
  }
  return { owned, wishlisted, status: { steam: steam.status, gog: gog.status, epic: epic.status } };
}
