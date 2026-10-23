import '../lib/badge.css';
import '../lib/humble-choice.css';
import {
  annotateChoice,
  CHOICE_TILE_SELECTOR,
  choiceMonthSlug,
  choiceMonthUrl,
  collectChoiceTitles,
  parseChoiceMonth,
  type ChoiceMonth,
} from '../lib/humble-choice';
import type { ResolveSteamTitlesMessage, ResolveSteamTitlesResponse } from '../lib/messages';
import { normalizeTitle } from '../lib/normalize';
import { createOwnershipMarker, createRatingMarker, warmLibraries } from '../lib/ownership-client';
import type { SteamRef } from '../lib/steam';

const MONTH_TTL = 30 * 24 * 60 * 60 * 1000;

interface CachedMonth {
  month: ChoiceMonth;
  at: number;
}

/**
 * A Choice month's Steam ids, from the month's public page. That page takes
 * about a second to serve, so the parsed list is kept in storage: the fetch
 * happens once per month.
 */
async function loadMonth(slug: string): Promise<ChoiceMonth | null> {
  const key = `choice-month:${slug}`;
  const cached = (await browser.storage.local.get(key))[key] as CachedMonth | undefined;
  if (cached && Date.now() - cached.at < MONTH_TTL) return cached.month;
  // credentials: 'omit' — the public view is enough, and it carries none of
  // the signed-in member's purchase keys.
  const response = await fetch(choiceMonthUrl(slug), { credentials: 'omit' });
  if (!response.ok) throw new Error(`Choice month ${slug} returned ${response.status}`);
  const month = parseChoiceMonth(await response.text());
  if (month) await browser.storage.local.set({ [key]: { month, at: Date.now() } satisfies CachedMonth });
  return month;
}

export default defineContentScript({
  matches: ['*://www.humblebundle.com/membership/*'],
  main(ctx) {
    warmLibraries();
    const markOwned = createOwnershipMarker();
    const markRatings = createRatingMarker(CHOICE_TILE_SELECTOR);
    let month: ChoiceMonth | null = null;
    let slugRequested: string | null = null;
    // Used only if the month's data can't be loaded: look titles up on Steam.
    let fallback = false;
    const byTitle = new Map<string, SteamRef | null>();
    const titlesRequested = new Set<string>();

    const annotate = () => {
      annotateChoice(document, (title) =>
        month ? (month[normalizeTitle(title)] ?? byTitle.get(title)) : fallback ? byTitle.get(title) : undefined,
      );
      markOwned();
      markRatings();
    };

    const resolveTitle = async (title: string) => {
      const message: ResolveSteamTitlesMessage = { type: 'resolveSteamTitles', titles: [title] };
      const response = (await browser.runtime.sendMessage(message)) as ResolveSteamTitlesResponse | undefined;
      if (ctx.isInvalid) return;
      byTitle.set(title, response?.[title] ?? null);
      annotate();
    };

    const rescan = () => {
      const slug = choiceMonthSlug(location.pathname, document);
      if (slug && slug !== slugRequested) {
        slugRequested = slug;
        loadMonth(slug)
          .then((loaded) => {
            if (ctx.isInvalid) return;
            month = loaded;
            fallback = !loaded;
            rescan();
          })
          .catch((error) => {
            console.warn('[Double Dip]', error);
            fallback = true;
            rescan();
          });
      }
      annotate();
      // Titles to look up on Steam: all of them in fallback mode, otherwise
      // only tiles missing from the month's data.
      if (!month && !fallback) return;
      for (const title of collectChoiceTitles(document)) {
        if (titlesRequested.has(title) || (month && normalizeTitle(title) in month)) continue;
        titlesRequested.add(title);
        resolveTitle(title).catch((error) => console.warn('[Double Dip]', error));
      }
    };

    rescan();
    let scheduled = false;
    const observer = new MutationObserver(() => {
      if (scheduled || ctx.isInvalid) return;
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
