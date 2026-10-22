import { browser } from 'wxt/browser';
import type { GetOwnershipMessage, GetOwnershipResponse, WarmLibrariesMessage } from './messages';
import { markOwnedBadges, uncheckedSteamRefs } from './owned';
import type { Store } from './ownership';

/** Badges arriving within this window go to the background as one question. */
const BATCH_WINDOW_MS = 60;

/** Asks the background to start loading the libraries while the page renders. */
export function warmLibraries(): void {
  const message: WarmLibrariesMessage = { type: 'warmLibraries' };
  browser.runtime.sendMessage(message).catch(() => undefined);
}

/**
 * Returns a function for content scripts to call after each round of badges:
 * it asks the background which libraries hold the newly badged games and adds
 * "Owned" markers as the answers arrive. Each Steam id is asked about once,
 * and ids badged in quick succession are batched into one question (each
 * question costs the background a few ITAD calls).
 */
export function createOwnershipMarker(): () => void {
  const answers = new Map<string, Store[]>();
  const requested = new Set<string>();
  let batch: string[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const mark = () => markOwnedBadges(document, (ref) => answers.get(ref));

  const flush = () => {
    const refs = batch;
    batch = [];
    timer = undefined;
    const message: GetOwnershipMessage = { type: 'getOwnership', steamRefs: refs };
    (browser.runtime.sendMessage(message) as Promise<GetOwnershipResponse | undefined>)
      .then((response) => {
        // Unanswered ids (background failure) count as not owned.
        for (const ref of refs) answers.set(ref, response?.owned[ref] ?? []);
        mark();
      })
      .catch((error) => console.warn('[Double Dip]', error));
  };

  return function markOwned() {
    mark();
    const refs = uncheckedSteamRefs(document).filter((ref) => !requested.has(ref));
    if (refs.length === 0) return;
    refs.forEach((ref) => requested.add(ref));
    batch.push(...refs);
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  };
}
