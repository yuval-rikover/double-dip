# Privacy policy — Double Dip

_Last updated: 2026-11-12_

Double Dip is a browser extension that adds Steam store links to games on
Humble Bundle, Humble Choice, Fanatical and Green Man Gaming bundle pages, shows each game's
Steam rating, and marks the games you already own on Steam, GOG or the Epic Games Store. This policy explains what it reads, where
that goes, and what it keeps.

**In short:** nothing is sent to the developer. There are no analytics, no ads
and no tracking. What the extension learns about your libraries stays in your
browser.

## What it reads

- **Bundle and Humble Choice pages** (humblebundle.com, fanatical.com,
  greenmangamingbundles.com): the names of the games on the page, and for
  Fanatical, the Steam IDs the page itself provides.
- **Your store libraries**, using the sign-ins you already have in this browser:
  - **Steam**: the IDs of the apps and packages you own, and of the apps on
    your wishlist.
  - **GOG**: the IDs of the products you own and of those on your wishlist.
  - **Epic Games Store**: your order history, from which it keeps only the
    offer IDs of your Epic Games Store purchases and free claims. Prices, dates,
    payment details and Unreal/Fab marketplace items are discarded as soon as
    they're read.

The extension never sees or stores your passwords. If you're signed out of a
store in this browser, that store is skipped. Steam and Epic are the
exception: their sessions lapse on their own (Epic's when the browser closes,
Steam's until a Steam page is opened), so the last library read from them
stays in use while you're signed out, and the popup says so. Removing the
extension deletes it.

## Where data goes

The extension talks only to these services, and only to do its job:

| Sent to | What | Why |
|---|---|---|
| Steam (`store.steampowered.com`) | Game names from Humble Bundle, Humble Choice and Green Man Gaming pages | To find each game's Steam store page |
| Steam (`api.steampowered.com`) | Steam IDs of games on the page | To show each game's Steam rating, and to find the game in an edition Steam sells as a package |
| IsThereAnyDeal (`api.isthereanydeal.com`) | Game names Steam couldn't match, and Steam IDs of games on the page | To find the game's Steam, GOG and Epic IDs |
| Steam, GOG (`embed.gog.com`), Epic (`accounts.epicgames.com`) | Requests for your own library (and Steam and GOG wishlists), sent with your existing sign-in | To check which games you own or wishlisted |

Your library contents are never sent anywhere. Requests to Steam, GOG and Epic
are the same kind those sites make for you when you browse them while signed
in. The extension has no server of its own, and loads no code from the internet.

See the privacy policies of [Valve/Steam](https://store.steampowered.com/privacy_agreement/),
[GOG](https://support.gog.com/hc/en-us/articles/212632109-Privacy-Policy),
[Epic Games](https://legal.epicgames.com/epicgames/privacy-policy) and
[IsThereAnyDeal](https://isthereanydeal.com/legal/privacy/) for how they handle requests.

## What it keeps

In your browser's extension storage, on your device only:

- Your owned-game IDs per store, and Steam and GOG wishlist IDs, refreshed hourly (Epic: incrementally, fully
  once a week).
- Lookup results: game name → Steam ID, and
  Steam ID → GOG/Epic IDs, kept for up to 30 days so pages load quickly;
  Steam ratings, kept for a week.

Uninstalling the extension deletes all of it.

## Sharing and sale

The extension does not sell, share or transfer your data to anyone, and does not
use it for anything other than showing links, ratings and ownership markers on
bundle pages.

## Contact

Questions or concerns: open an issue at <https://github.com/yuval-rikover/double-dip/issues>.
