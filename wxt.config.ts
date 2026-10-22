import { defineConfig } from 'wxt';

export default defineConfig({
  // WXT defaults Firefox to MV2; build MV3 for both browsers.
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: 'Bundle Steam Links',
    description:
      'Adds Steam store links to games on Humble Bundle and Fanatical bundle pages.',
    permissions: ['storage'],
    // Called from the background script: Steam search and library, GOG
    // library, Epic order history, and ITAD id lookups.
    host_permissions: [
      'https://store.steampowered.com/*',
      'https://embed.gog.com/*',
      'https://accounts.epicgames.com/*',
      'https://api.isthereanydeal.com/*',
    ],
    ...(browser === 'firefox' && {
      browser_specific_settings: {
        gecko: {
          id: 'bundle-steam-links@extension',
          // Nothing leaves the browser except calls to the stores themselves.
          data_collection_permissions: { required: ['none'] },
        },
      },
    }),
  }),
});
