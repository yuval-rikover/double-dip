import '../lib/badge.css';
import { extractBundleGames, fanaticalApiPath, parseFanaticalPath, type BundleGame } from '../lib/fanatical';
import { annotateFanaticalCards, annotateFanaticalPackLists } from '../lib/fanatical-cards';
import type { ResolveSteamTitlesMessage, ResolveSteamTitlesResponse } from '../lib/messages';
import { createOwnershipMarker, createRatingMarker, warmLibraries } from '../lib/ownership-client';
import type { SteamRef } from '../lib/steam';

export default defineContentScript({
  matches: ['*://www.fanatical.com/*'],
  main(ctx) {
    const gamesByApiPath = new Map<string, Promise<BundleGame[]>>();
    const markOwned = createOwnershipMarker();
    const markRatings = createRatingMarker();
    // Packs carry only their games' titles, and some games no Steam id: those
    // titles are looked up on Steam.
    const resolved = new Map<string, SteamRef | null>();
    const requested = new Set<string>();
    const lookup = (title: string) => resolved.get(title);
    let annotate = () => {};
    let observer: MutationObserver | null = null;
    let runId = 0;

    const loadGames = (apiPath: string): Promise<BundleGame[]> => {
      let games = gamesByApiPath.get(apiPath);
      if (!games) {
        games = fetch(new URL(apiPath, location.origin), { headers: { Accept: 'application/json' } })
          .then((response) => {
            if (!response.ok) throw new Error(`${apiPath} returned ${response.status}`);
            return response.json();
          })
          .then(extractBundleGames);
        // Don't cache a failure; the next visit retries.
        games.catch(() => gamesByApiPath.delete(apiPath));
        gamesByApiPath.set(apiPath, games);
      }
      return games;
    };

    /** Looks up titles in a single request: a pack's badge waits for all its games. */
    const resolveTitles = async (titles: string[]) => {
      const message: ResolveSteamTitlesMessage = { type: 'resolveSteamTitles', titles };
      const response = (await browser.runtime
        .sendMessage(message)
        .catch((error) => console.warn('[Double Dip]', error))) as ResolveSteamTitlesResponse | undefined;
      if (ctx.isInvalid) return;
      // Titles the background couldn't answer for still get a search link.
      for (const title of titles) resolved.set(title, response?.[title] ?? null);
      annotate();
    };

    // Fanatical is a single-page app: re-run on every in-app navigation, and
    // keep watching the DOM because cards render (and re-render) after load.
    const run = (pathname: string) => {
      // Left behind by an extension reload: the extension can't be reached.
      if (ctx.isInvalid) return;
      const thisRun = ++runId;
      observer?.disconnect();
      observer = null;
      const page = parseFanaticalPath(pathname);
      if (!page) return;
      warmLibraries();

      loadGames(fanaticalApiPath(page))
        .then((games) => {
          if (thisRun !== runId || ctx.isInvalid) return;
          annotate = () => {
            annotateFanaticalCards(document, games, lookup);
            annotateFanaticalPackLists(document, games, lookup);
            markOwned();
            markRatings();
          };
          annotate();
          const request = (titles: string[]) => {
            const fresh = titles.filter((title) => !requested.has(title));
            if (!fresh.length) return;
            fresh.forEach((title) => requested.add(title));
            void resolveTitles(fresh);
          };
          for (const { includes } of games) if (includes) request(includes);
          request(games.filter((game) => game.findOnSteam).map((game) => game.name));
          let scheduled = false;
          observer = new MutationObserver(() => {
            if (scheduled || ctx.isInvalid) return;
            scheduled = true;
            requestAnimationFrame(() => {
              scheduled = false;
              annotate();
            });
          });
          observer.observe(document.body, { childList: true, subtree: true });
        })
        .catch((error) => console.warn('[Double Dip]', error));
    };

    run(location.pathname);
    // Use the event's URL, not `location`: with the Navigation API, WXT fires
    // this before the new URL commits, so `location` still shows the old page.
    ctx.addEventListener(window, 'wxt:locationchange', (event) => run(event.newUrl.pathname));
    ctx.onInvalidated(() => observer?.disconnect());
  },
});
