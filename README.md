# Double Dip

Chrome and Firefox extension that adds a Steam store link to each game on
Fanatical, Humble Bundle and Green Man Gaming bundle pages and Humble Choice
months, and marks the games already in your Steam, GOG or Epic library.

## How it works

- **Fanatical**: the content script reads the same JSON the page renders from
  (`/api/products-group/<slug>/<lang>` for tiered bundles,
  `/api/pick-and-mix/<slug>/<lang>` for build-your-own bundles). Each game there
  carries its Steam app id. Cards are matched to games by normalized title
  (`lib/normalize.ts`). Games without an id get a "Search Steam" link instead;
  mystery-bundle placeholders get nothing.
- **Humble Bundle**: tiles carry only a title (the page's own JSON is removed
  once it loads), so the background script looks each title up
  (`lib/steam-resolve.ts`): Steam's store search, accepting only an exact
  match after normalizing, then IsThereAnyDeal's exact-title lookup
  (no API key needed) for the rest. Results are cached in `storage.local`,
  hits for 30 days and misses for 1 day. Unmatched titles get "Search Steam".

- **Green Man Gaming** (`greenmangamingbundles.com/bundles/*`): tiles list titles
  only, so they go through the same title lookup as Humble bundles
  (`lib/gmg-tiles.ts`, shared runner in `lib/title-site.ts`). GMG opens its
  product popup from a capture-phase click listener, so badge clicks are
  stopped at the window (`lib/badge.ts`).
- **Humble Choice** (`/membership/home` and month pages like
  `/membership/september-2026`): Humble removes its product JSON before the
  extension runs, so the month's public page is fetched once — without cookies,
  so it never carries the member's purchase keys — and its Steam ids are cached
  per month for 30 days (`lib/humble-choice.ts`). Non-Steam extras (e.g. "Get
  One Month of IGN Plus") get no badge. If that fetch fails, titles go through
  the Humble title lookup instead.
- **Owned on Steam**: the background script reads
  `store.steampowered.com/dynamicstore/userdata/` with your Steam store
  session (the call Steam's own store uses to mark owned games) and caches the
  owned app and package ids for an hour (`lib/steam-library.ts`).
- **Owned on GOG**: same idea with `embed.gog.com/user/data/games` and your
  GOG session (`lib/gog-library.ts`).
- **Owned on Epic**: offer ids from your Epic Games Store order history
  (`accounts.epicgames.com/account/v2/payment/ajaxGetOrderHistory`, your Epic
  session; Fab/Unreal assets and gifts skipped, `lib/epic-library.ts`). The
  history is ~10 orders per page, so the first sync takes a while (≈60 pages
  ≈ 20 s for 600 orders). It runs in the background — pages never wait for it —
  later refreshes read only orders newer than the cached ones, and a full
  re-read runs weekly. Undocumented endpoint: expect it to break someday.
- GOG and Epic are matched by id, not title: each badge's Steam id is mapped
  through ITAD (Steam id → ITAD id → GOG product ids / Epic offer ids, cached
  for 30 days, `lib/shop-map.ts`). Games with only a "Search Steam" badge
  aren't checked.
- Every Steam badge whose game is in a library gets a marker naming the
  stores, e.g. "✓ Owned · Steam, GOG" (`lib/ownership.ts`, `lib/owned.ts`).
  Signed out of a store in that browser → that store is skipped.
- **Popup** (toolbar icon): sign-in state, item count and age of each cached
  library, a *Refresh libraries* button (re-reads all three stores now, e.g. right
  after a purchase), and an *Allow access* prompt when site permissions are
  missing — Firefox can install MV3 extensions without them.

Steam ↔ title mapping via [IsThereAnyDeal](https://isthereanydeal.com/).
This extension is not affiliated with IsThereAnyDeal, Steam, Humble Bundle or
Fanatical.

## Develop

```sh
npm install
npm test             # unit tests (vitest)
npm run compile      # type check
npm run build        # Chrome  → .output/chrome-mv3
npm run build:firefox  # Firefox → .output/firefox-mv3
```

Load the build unpacked:

- **Chrome**: `chrome://extensions` → Developer mode → *Load unpacked* →
  `.output/chrome-mv3`
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary Add-on*
  → `.output/firefox-mv3/manifest.json`

`npm run dev` / `npm run dev:firefox` start a browser with the extension and
reload it on save; that browser uses a fresh profile, so you're not signed in
to any store there.
