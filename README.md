# Double Dip

A Chrome and Firefox extension for game bundle pages. Next to each game it
shows:

- **A Steam link with the game's rating**: "Steam 93% ↗". The rating is left
  out where the page already shows it.
- **Where you already own it**: "✓ Steam GOG", from your Steam, GOG and Epic
  Games Store libraries.
- **For multi-game packs** (Fanatical): how many of the games you own ("2/3"),
  and a Steam link for each game in the pack's details.

Works on:

- Humble Bundle game and software bundles
- Humble Choice (the current month and past months)
- Fanatical bundles, including build-your-own bundles
- Green Man Gaming bundles

## How it works

- **No accounts or keys.** Ownership is read with the store sign-ins you
  already have in this browser. Signed out of a store? It's skipped. The
  toolbar popup shows each store's status and refreshes your libraries.
- **Finding the Steam game.** Fanatical and Humble Choice pages carry Steam
  IDs. Humble Bundle and Green Man Gaming list only titles, which are matched
  exactly on Steam's store search, with [IsThereAnyDeal](https://isthereanydeal.com/)
  as a fallback.
- **GOG and Epic** are matched by ID through IsThereAnyDeal, not by name.
- **Ratings** come from Steam's store API, up to 50 games per request.
- Lookups and libraries are cached in the browser, so repeat visits are
  instant.

Some of the store endpoints it uses (Steam's library and ratings, Epic's order
history) are undocumented, so a store change can break one feature until it's
updated.

## Privacy

Nothing is sent to the developer: no analytics, no ads, no tracking. Your
library stays in your browser. See [PRIVACY.md](PRIVACY.md).

## Develop

Built with [WXT](https://wxt.dev/) and TypeScript.

```sh
npm install
npm test               # unit tests (vitest)
npm run compile        # type check
npm run build          # Chrome  → .output/chrome-mv3
npm run build:firefox  # Firefox → .output/firefox-mv3
npm run zip            # store packages (zip:firefox also writes the sources zip)
```

Load the build unpacked:

- **Chrome**: `chrome://extensions` → Developer mode → *Load unpacked* →
  `.output/chrome-mv3`
- **Firefox**: `about:debugging#/runtime/this-firefox` → *Load Temporary
  Add-on* → `.output/firefox-mv3/manifest.json`

`npm run dev` and `npm run dev:firefox` open a browser that reloads the
extension on save. It uses a fresh profile, so you're not signed in to any
store there.

Per-site code lives in `entrypoints/*.content.ts` and `lib/`; network calls go
through the background script (`entrypoints/background.ts`).

Not affiliated with Valve, GOG, Epic Games, Humble Bundle, Fanatical, Green
Man Gaming or IsThereAnyDeal.
