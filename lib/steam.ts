/** A Steam store entry: an app (a single game) or a sub (a package of apps). */
export interface SteamRef {
  type: 'app' | 'sub';
  id: number;
}

/** "app/225260" ↔ { type: 'app', id: 225260 }: the form Steam URLs and ITAD use. */
export function formatSteamRef(ref: SteamRef): string {
  return `${ref.type}/${ref.id}`;
}

export function parseSteamRef(value: string): SteamRef | null {
  const match = value.match(/^(app|sub)\/(\d+)$/);
  return match ? { type: match[1] as SteamRef['type'], id: Number(match[2]) } : null;
}

export function steamStoreUrl(ref: SteamRef): string {
  return `https://store.steampowered.com/${ref.type}/${ref.id}/`;
}

export function steamSearchUrl(title: string): string {
  return `https://store.steampowered.com/search/?term=${encodeURIComponent(title)}`;
}
