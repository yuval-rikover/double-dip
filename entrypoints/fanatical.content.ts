import '../lib/badge.css';
import { extractBundleGames, fanaticalApiPath, parseFanaticalPath, type BundleGame } from '../lib/fanatical';
import { annotateFanaticalCards } from '../lib/fanatical-cards';
import { createOwnershipMarker } from '../lib/ownership-client';

export default defineContentScript({
  matches: ['*://www.fanatical.com/*'],
  main(ctx) {
    const gamesByApiPath = new Map<string, Promise<BundleGame[]>>();
    const markOwned = createOwnershipMarker();
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

    // Fanatical is a single-page app: re-run on every in-app navigation, and
    // keep watching the DOM because cards render (and re-render) after load.
    const run = () => {
      const thisRun = ++runId;
      observer?.disconnect();
      observer = null;
      const page = parseFanaticalPath(location.pathname);
      if (!page) return;

      loadGames(fanaticalApiPath(page))
        .then((games) => {
          if (thisRun !== runId || ctx.isInvalid) return;
          const annotate = () => {
            annotateFanaticalCards(document, games);
            markOwned();
          };
          annotate();
          let scheduled = false;
          observer = new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            requestAnimationFrame(() => {
              scheduled = false;
              annotate();
            });
          });
          observer.observe(document.body, { childList: true, subtree: true });
        })
        .catch((error) => console.warn('[Bundle Steam Links]', error));
    };

    run();
    ctx.addEventListener(window, 'wxt:locationchange', run);
    ctx.onInvalidated(() => observer?.disconnect());
  },
});
