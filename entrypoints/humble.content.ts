import '../lib/badge.css';
import { annotateHumble, collectHumbleTitles } from '../lib/humble-tiles';
import type { ResolveSteamTitlesMessage, ResolveSteamTitlesResponse } from '../lib/messages';
import { createOwnershipMarker } from '../lib/ownership-client';
import type { SteamRef } from '../lib/steam';

export default defineContentScript({
  matches: ['*://www.humblebundle.com/games/*', '*://www.humblebundle.com/software/*'],
  main(ctx) {
    // Humble tiles carry only a title, so each title is looked up on Steam
    // (through the background script) before its badge can be added.
    const resolved = new Map<string, SteamRef | null>();
    const requested = new Set<string>();
    const markOwned = createOwnershipMarker();
    const annotate = () => {
      annotateHumble(document, (title) => resolved.get(title));
      markOwned();
    };

    const scan = async () => {
      const titles = collectHumbleTitles(document).filter((title) => !requested.has(title));
      if (titles.length === 0) return;
      titles.forEach((title) => requested.add(title));
      const message: ResolveSteamTitlesMessage = { type: 'resolveSteamTitles', titles };
      const response = (await browser.runtime.sendMessage(message)) as ResolveSteamTitlesResponse | undefined;
      if (ctx.isInvalid) return;
      // A title the background couldn't answer for still gets a search link.
      for (const title of titles) resolved.set(title, response?.[title] ?? null);
      annotate();
    };

    const rescan = () => {
      annotate();
      scan().catch((error) => console.warn('[Double Dip]', error));
    };

    rescan();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        rescan();
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    ctx.onInvalidated(() => observer.disconnect());
  },
});
