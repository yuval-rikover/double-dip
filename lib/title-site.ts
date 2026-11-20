import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import type { ResolveSteamTitlesMessage, ResolveSteamTitlesResponse } from './messages';
import { stackCrowdedMarkers } from './owned';
import { createOwnershipMarker, createRatingMarker, warmLibraries } from './ownership-client';
import type { SteamRef } from './steam';

/** Lookup result per title: a ref, null for "no Steam match", undefined for "not resolved yet". */
export type SteamLookup = (title: string) => SteamRef | null | undefined;

export interface TitleSite {
  /** Titles of the game tiles currently on the page. */
  collectTitles(doc: Document): string[];
  /** Adds badges for the titles `lookup` can answer; must skip tiles already badged. */
  annotate(doc: Document, lookup: SteamLookup): void;
  /**
   * Whether the page shown now has tiles to annotate. A single-page site
   * (Humble) changes pages without a reload, so it's asked on every change.
   */
  isActive?(): boolean;
}

/**
 * Runs a content script for a site whose tiles carry only a game title
 * (Humble bundles, Green Man Gaming bundles): each title is looked up on
 * Steam through the background — one request per title, so each badge
 * appears as soon as its own lookup finishes — and owned markers and Steam
 * ratings follow.
 * Keeps watching the page for tiles that render later.
 */
export function runTitleSite(ctx: ContentScriptContext, site: TitleSite): void {
  const resolved = new Map<string, SteamRef | null>();
  const requested = new Set<string>();
  const markOwned = createOwnershipMarker();
  const markRatings = createRatingMarker();
  const annotate = () => {
    site.annotate(document, (title) => resolved.get(title));
    markOwned();
    markRatings();
    stackCrowdedMarkers(document);
  };

  const resolveTitle = async (title: string) => {
    const message: ResolveSteamTitlesMessage = { type: 'resolveSteamTitles', titles: [title] };
    const response = (await browser.runtime.sendMessage(message)) as ResolveSteamTitlesResponse | undefined;
    if (ctx.isInvalid) return;
    // A title the background couldn't answer for still gets a search link.
    resolved.set(title, response?.[title] ?? null);
    annotate();
  };

  let warmed = false;
  const rescan = () => {
    if (site.isActive && !site.isActive()) return;
    // Libraries load only once a page with tiles is open.
    if (!warmed) {
      warmed = true;
      warmLibraries();
    }
    annotate();
    for (const title of site.collectTitles(document)) {
      if (requested.has(title)) continue;
      requested.add(title);
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
  // Narrower tiles can crowd a marker into its badge.
  ctx.addEventListener(window, 'resize', () => requestAnimationFrame(() => stackCrowdedMarkers(document)));
  ctx.onInvalidated(() => observer.disconnect());
}
