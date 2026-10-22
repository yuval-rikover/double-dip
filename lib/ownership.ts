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
  status: Record<Store, LibraryStatus | 'syncing'>;
}

export interface OwnershipSources {
  steam: () => Promise<SteamLibrary>;
  gog: () => Promise<GogLibrary>;
  epic: () => Promise<EpicLibraryNow>;
  shopIds: (steamRefs: string[]) => Promise<Record<string, ShopIds>>;
}

/**
 * Answers, for each Steam id on a page, which libraries hold the game. GOG and
 * Epic are matched by id through ITAD, so a game ITAD can't map is checked on
 * Steam only.
 */
export async function getOwnership(steamRefs: string[], sources: OwnershipSources): Promise<OwnershipResult> {
  const [steam, gog, epic] = await Promise.all([sources.steam(), sources.gog(), sources.epic()]);
  const steamApps = new Set(steam.status === 'ok' ? steam.apps : []);
  const steamPackages = new Set(steam.status === 'ok' ? steam.packages : []);
  const gogOwned = new Set(gog.status === 'ok' ? gog.owned.map(String) : []);
  const epicOwned = new Set(epic.status === 'ok' ? epic.offers : []);
  // Mapping to GOG/Epic ids costs ITAD calls; skip it when neither library is there.
  const shopIds = gogOwned.size > 0 || epicOwned.size > 0 ? await sources.shopIds(steamRefs) : {};

  const owned: Record<string, Store[]> = {};
  for (const value of steamRefs) {
    const ref = parseSteamRef(value);
    if (!ref) continue;
    const stores: Store[] = [];
    if ((ref.type === 'app' ? steamApps : steamPackages).has(ref.id)) stores.push('steam');
    if (shopIds[value]?.gog.some((id) => gogOwned.has(id))) stores.push('gog');
    if (shopIds[value]?.epic.some((id) => epicOwned.has(id))) stores.push('epic');
    owned[value] = stores;
  }
  return { owned, status: { steam: steam.status, gog: gog.status, epic: epic.status } };
}
