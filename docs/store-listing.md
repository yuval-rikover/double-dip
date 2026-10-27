# Store listing — Chrome Web Store & Firefox Add-ons

Drafts to paste into the developer dashboards.

## Name

- Chrome: Double Dip: Already-Owned Check for Game Bundles (48 characters; Chrome allows 75)
- Firefox: Double Dip: Already-Owned Games in Bundles (42 characters; AMO allows 45)

This is the manifest `name`, so it is the store title and is searchable. The
manifest `short_name` is "Double Dip", used where space is tight.

## Short description (≤ 132 characters; also the manifest `description`)

Steam links, ratings and "owned" markers (Steam, GOG, Epic) on Humble Bundle, Humble Choice, Fanatical and Green Man Gaming bundles.

## Detailed description

Thinking about a Humble Bundle, a Humble Choice month, a Fanatical or a Green Man
Gaming bundle? See at a glance which games you already own, and jump to any
game's Steam page.

On every bundle page, each game gets:
• A "Steam ↗" link to its Steam store page, with the game's Steam rating
  ("Steam 93% ↗") when the bundle page doesn't already show it.
• A "✓ Owned" marker if it's already in your library, naming where: Steam, GOG
  and/or Epic Games Store.
• A "♥ Wishlisted" marker if you don't own it but it's on your Steam or GOG
  wishlist.
• For multi-game packs on Fanatical: how many of the games you own ("2/3"), and
  each game's Steam rating and Steam link from the pack's "3 games ▾" label.

How it works:
• Owned markers need you to be signed in to each store in this browser. It uses
  the sign-ins you already have — no extra accounts, no passwords, no API keys.
• Games are matched by store ID wherever possible (via IsThereAnyDeal), so
  different editions and spellings don't trip it up.
• Signed out of a store? It's simply skipped. The toolbar popup shows each
  store's status and refreshes your libraries after a purchase.

Privacy: nothing is sent to the developer — no analytics, no ads, no tracking.
Your library stays in your browser. Full policy: https://github.com/yuval-rikover/double-dip/blob/main/PRIVACY.md

An independent project, not affiliated with or endorsed by any of the stores or
bundle sites mentioned above.

## Category

- Chrome Web Store: Shopping
- Firefox Add-ons: Shopping (secondary: Games & Entertainment, if offered)

## Chrome: single purpose

Shows Steam links, Steam ratings and "already owned" markers for the games on
game bundle pages (Humble Bundle, Humble Choice, Fanatical, Green Man Gaming).

## Chrome: permission justifications

| Permission | Justification |
|---|---|
| `storage` | Caches the user's owned-game IDs and game-ID lookups locally, so bundle pages show markers instantly and the stores aren't asked on every page load. |
| Content scripts on `www.humblebundle.com/games/*`, `/software/*`, `/membership/*`, `www.fanatical.com/*` and `www.greenmangamingbundles.com/bundles/*` | Reads the games listed on bundle and Humble Choice pages and adds the Steam links and owned markers to them. |
| `https://store.steampowered.com/*` | Looks up a game's Steam page from its name (Humble pages don't list Steam IDs), and reads the user's owned Steam games with their existing Steam sign-in. |
| `https://api.steampowered.com/*` | Reads the Steam review summary (percent positive) for the games on the page, to show it in each game's Steam link. No sign-in is used. |
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
| Personally identifiable info, health, authentication info, personal communications, location, web history, user activity | No | Not read or not transmitted. (Steam and GOG wishlists are read, like libraries, and kept only on the device.) Sign-in cookies are used by the browser for the stores' own requests; the extension never reads them. |

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
third-party game art). All are 24-bit PNG, no alpha. The stores show them at
about half size, so each one is a few real tiles, zoomed in, under a headline.

| File | Size | Caption |
|---|---|---|
| `1-owned.png` | 1280×800 | See which games you already own, on Steam, GOG or Epic. |
| `2-ratings.png` | 1280×800 | The Steam rating of every game; hover for the review count. |
| `3-packs.png` | 1280×800 | Fanatical packs show how many of the games you own. |
| `4-wishlist.png` | 1280×800 | Games on your Steam or GOG wishlist get a heart. |
| `5-popup.png` | 1280×800 | Uses the sign-ins you already have; the popup shows each library. |
| `promo-tile-440x280.png` | 440×280 | Chrome small promo tile. |

Firefox Add-ons accepts the same 1280×800 shots.
