# Store listing — Chrome Web Store & Firefox Add-ons

Drafts to paste into the developer dashboards.

## Name

Double Dip

Optional longer store title (Chrome allows 75 characters), which helps search:
"Double Dip – already-owned check for game bundles"

## Short description (≤ 132 characters; also the manifest `description`)

Steam links and "already owned" markers (Steam, GOG, Epic) for games on Humble Bundle and Fanatical bundle pages.

## Detailed description

Thinking about a Humble Bundle, a Humble Choice month or a Fanatical bundle? See
at a glance which games you already own, and jump to any game's Steam page.

On every bundle page, each game gets:
• A "Steam ↗" link to its Steam store page — reviews, trailers, system requirements.
• A "✓ Owned" marker if it's already in your library, naming where: Steam, GOG
  and/or Epic Games Store.

How it works:
• Uses the sign-ins you already have in this browser — no extra accounts, no
  passwords, no API keys.
• Games are matched by store ID wherever possible (via IsThereAnyDeal), so
  different editions and spellings don't trip it up.
• Signed out of a store? It's simply skipped. The toolbar popup shows each
  store's status and refreshes your libraries after a purchase.

Privacy: nothing is sent to the developer — no analytics, no ads, no tracking.
Your library stays in your browser. Full policy: https://github.com/yuval-rikover/double-dip/blob/main/PRIVACY.md

Not affiliated with Valve, Steam, GOG, Epic Games, Humble Bundle, Fanatical or
IsThereAnyDeal.

## Category

- Chrome Web Store: Shopping
- Firefox Add-ons: Shopping (secondary: Games & Entertainment, if offered)

## Chrome: single purpose

Shows Steam links and "already owned" markers for the games on Humble Bundle and
Fanatical bundle pages.

## Chrome: permission justifications

| Permission | Justification |
|---|---|
| `storage` | Caches the user's owned-game IDs and game-ID lookups locally, so bundle pages show markers instantly and the stores aren't asked on every page load. |
| Content scripts on `www.humblebundle.com/games/*`, `/software/*`, `/membership/*` and `www.fanatical.com/*` | Reads the games listed on bundle and Humble Choice pages and adds the Steam links and owned markers to them. |
| `https://store.steampowered.com/*` | Looks up a game's Steam page from its name (Humble pages don't list Steam IDs), and reads the user's owned Steam games with their existing Steam sign-in. |
| `https://embed.gog.com/*` | Reads the user's owned GOG products with their existing GOG sign-in. |
| `https://accounts.epicgames.com/*` | Reads the user's Epic Games Store order history with their existing Epic sign-in, to know which Epic games they own. |
| `https://api.isthereanydeal.com/*` | Maps games between stores (Steam ID ↔ GOG/Epic IDs) so ownership is matched by ID, not by name. |

Remote code: **No.** All code ships in the package.

## Chrome: data usage disclosures

My reading of the form — check the current wording when you fill it in.

| Data type | Answer | Why |
|---|---|---|
| Website content | **Yes** | Game names from bundle pages are sent to Steam search and IsThereAnyDeal. |
| Financial and payment information | **Yes** (conservative) | Epic order history is read to find purchases; only offer IDs are kept, locally. |
| Personally identifiable info, health, authentication info, personal communications, location, web history, user activity | No | Not read or not transmitted. Sign-in cookies are used by the browser for the stores' own requests; the extension never reads them. |

Certify all three: not sold to third parties; not used or transferred for
purposes unrelated to the single purpose; not used for creditworthiness or
lending.

## Firefox: data collection

Declared in the manifest as `data_collection_permissions.required: ["websiteContent"]`
(game names sent to Steam search and IsThereAnyDeal). Requires Firefox 140+.

## Firefox: source code for review

The package is built (bundled/minified), so AMO needs the source:
`npm run zip:firefox` creates both the extension zip and a sources zip.
Build steps for reviewers: see README → Develop (`npm ci && npm run build:firefox`).

## Screenshots

Generated locally into `store-assets/` (git-ignored: the bundle shots show
third-party game art). All are 24-bit PNG, no alpha.

| File | Size | Caption |
|---|---|---|
| `1-humble-steam-gog.png` | 1280×800 | Every game gets a Steam link, and games you already own are marked with the stores you own them on. |
| `2-fanatical-epic-search.png` | 1280×800 | Works on Fanatical too. No Steam ID listed? You get a Steam search link instead. |
| `3-humble-steam-epic.png` | 1280×800 | Steam, GOG and Epic Games Store libraries, matched by store ID. |
| `4-popup.png` | 1280×800 | The popup shows each library's status and refreshes after a purchase. |
| `promo-tile-440x280.png` | 440×280 | Chrome small promo tile. |

Firefox Add-ons accepts the same 1280×800 shots.
