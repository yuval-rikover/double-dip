/**
 * IsThereAnyDeal id lookups. These endpoints need no API key; each takes a
 * batch, so a whole bundle page costs one or two calls.
 */
const ITAD = 'https://api.isthereanydeal.com';

export const ITAD_SHOP = { steam: 61, gog: 35, epic: 16 } as const;

/** Game titles (exact match) → ITAD game ids. */
export function itadIdsByTitle(fetchFn: typeof fetch, titles: string[]) {
  return postJson<Record<string, string | null>>(fetchFn, `${ITAD}/lookup/id/title/v1`, titles);
}

/** A shop's game ids (Steam: "app/225260") → ITAD game ids. */
export function itadIdsByShopId(fetchFn: typeof fetch, shop: number, shopIds: string[]) {
  return postJson<Record<string, string | null>>(fetchFn, `${ITAD}/lookup/id/shop/${shop}/v1`, shopIds);
}

/** ITAD game ids → every id the game has in a shop. */
export function shopIdsByItadId(fetchFn: typeof fetch, shop: number, itadIds: string[]) {
  return postJson<Record<string, string[] | null>>(fetchFn, `${ITAD}/lookup/shop/${shop}/id/v1`, itadIds);
}

async function postJson<T>(fetchFn: typeof fetch, url: string, body: unknown): Promise<T> {
  const response = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}
