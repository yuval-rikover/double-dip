import { describeLibrary, type LibrarySummaries, type LibrarySummary } from '../../lib/library-summary';
import type { GetLibraryStatusMessage, GetLibraryStatusResponse } from '../../lib/messages';
import { STORE_NAMES, type Store } from '../../lib/ownership';

const SIGN_IN_URLS: Record<Store, string> = {
  steam: 'https://store.steampowered.com/login/',
  gog: 'https://www.gog.com/',
  epic: 'https://www.epicgames.com/id/login',
};

const storesList = document.querySelector<HTMLUListElement>('#stores')!;
const refreshButton = document.querySelector<HTMLButtonElement>('#refresh')!;
const hint = document.querySelector<HTMLParagraphElement>('#hint')!;
const access = document.querySelector<HTMLElement>('#access')!;
const grantButton = document.querySelector<HTMLButtonElement>('#grant')!;

/** Every origin the extension works on: content-script sites plus the APIs. */
function requiredOrigins(): string[] {
  const manifest = browser.runtime.getManifest();
  const contentOrigins = (manifest.content_scripts ?? []).flatMap((script) => script.matches ?? []);
  return [...new Set([...(manifest.host_permissions ?? []), ...contentOrigins])];
}

let pollTimer: ReturnType<typeof setTimeout> | undefined;

async function loadStatus(refresh: boolean): Promise<void> {
  const message: GetLibraryStatusMessage = { type: 'getLibraryStatus', refresh };
  const summaries = (await browser.runtime.sendMessage(message)) as GetLibraryStatusResponse | undefined;
  render(summaries);
  // A first Epic sync runs in the background; check back until it lands.
  clearTimeout(pollTimer);
  if (summaries && Object.values(summaries).some((summary) => summary.status === 'syncing')) {
    pollTimer = setTimeout(() => void loadStatus(false), 3000);
  }
}

function render(summaries: LibrarySummaries | undefined): void {
  storesList.replaceChildren(
    ...(Object.keys(STORE_NAMES) as Store[]).map((store) =>
      storeRow(store, summaries?.[store] ?? { status: 'error', message: 'no answer from the extension' }),
    ),
  );
}

function storeRow(store: Store, summary: LibrarySummary): HTMLLIElement {
  const row = document.createElement('li');
  const signedOut = summary.status === 'signed-out' || (summary.status === 'ok' && summary.signedOut);
  row.className = `store store--${signedOut ? 'signed-out' : summary.status}`;
  const name = document.createElement('span');
  name.className = 'store__name';
  name.textContent = STORE_NAMES[store];
  const detail = document.createElement('span');
  detail.className = 'store__detail';
  detail.textContent = describeLibrary(summary, Date.now());
  row.append(name, detail);
  if (signedOut) {
    const link = document.createElement('a');
    link.href = SIGN_IN_URLS[store];
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = `Sign in to ${STORE_NAMES[store]} ↗`;
    row.append(link);
  }
  return row;
}

refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  refreshButton.textContent = 'Refreshing…';
  try {
    await loadStatus(true);
    hint.hidden = false;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = 'Refresh libraries';
  }
});

// Firefox treats MV3 host permissions as optional, so they may be missing.
// The request must be the first thing the click does: browsers only allow it
// directly from a user action.
const origins = requiredOrigins();
grantButton.addEventListener('click', () => {
  browser.permissions.request({ origins }).then((granted) => {
    if (!granted) return;
    access.hidden = true;
    void loadStatus(false);
  });
});

browser.permissions.contains({ origins }).then((granted) => {
  access.hidden = granted;
});
void loadStatus(false);
