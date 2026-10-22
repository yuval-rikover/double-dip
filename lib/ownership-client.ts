import { browser } from 'wxt/browser';
import type { GetOwnershipMessage, GetOwnershipResponse } from './messages';
import { markOwnedBadges, uncheckedSteamRefs } from './owned';
import type { Store } from './ownership';

/**
 * Returns a function for content scripts to call after each round of badges:
 * it asks the background which libraries hold the newly badged games and adds
 * "Owned" markers as the answers arrive. Each Steam id is asked about once.
 */
export function createOwnershipMarker(): () => void {
  const answers = new Map<string, Store[]>();
  const requested = new Set<string>();
  const mark = () => markOwnedBadges(document, (ref) => answers.get(ref));

  return function markOwned() {
    mark();
    const refs = uncheckedSteamRefs(document).filter((ref) => !requested.has(ref));
    if (refs.length === 0) return;
    refs.forEach((ref) => requested.add(ref));
    const message: GetOwnershipMessage = { type: 'getOwnership', steamRefs: refs };
    (browser.runtime.sendMessage(message) as Promise<GetOwnershipResponse | undefined>)
      .then((response) => {
        // Unanswered ids (background failure) count as not owned.
        for (const ref of refs) answers.set(ref, response?.owned[ref] ?? []);
        mark();
      })
      .catch((error) => console.warn('[Double Dip]', error));
  };
}
