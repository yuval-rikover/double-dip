import '../lib/badge.css';
import { annotateHumble, collectHumbleTitles } from '../lib/humble-tiles';
import type { ResolveSteamTitlesMessage, ResolveSteamTitlesResponse } from '../lib/messages';
import { createOwnershipMarker, warmLibraries } from '../lib/ownership-client';
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

    // One request per title, so each badge appears as soon as its own lookup
    // finishes instead of when the slowest one does. The background caps how
    // many Steam searches run at once.
    const resolveTitle = async (title: string) => {
      const message: ResolveSteamTitlesMessage = { type: 'resolveSteamTitles', titles: [title] };
      const response = (await browser.runtime.sendMessage(message)) as ResolveSteamTitlesResponse | undefined;
      if (ctx.isInvalid) return;
      // A title the background couldn't answer for still gets a search link.
      resolved.set(title, response?.[title] ?? null);
      annotate();
    };

    const rescan = () => {
      annotate();
      for (const title of collectHumbleTitles(document)) {
        if (requested.has(title)) continue;
        requested.add(title);
        resolveTitle(title).catch((error) => console.warn('[Double Dip]', error));
      }
    };

    warmLibraries();
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
