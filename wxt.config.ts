import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/auto-icons'],
  // Generates the 16–128 px icons from one SVG at build time.
  autoIcons: { baseIconPath: 'assets/icon.svg' },
  // WXT defaults Firefox to MV2; build MV3 for both browsers.
  manifestVersion: 3,
  // The sources zip goes to Firefox reviewers: code only, not the local store
  // screenshots (third-party game art, git-ignored).
  zip: { excludeSources: ['store-assets/**'] },
  manifest: ({ browser }) => ({
    name: 'Double Dip',
    description:
      'Steam links and "already owned" markers (Steam, GOG, Epic) on Humble Bundle, Humble Choice, Fanatical and Green Man Gaming bundles.',
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
          id: 'double-dip@yuval-rikover',
          // Firefox's built-in data-consent prompt needs 140+.
          strict_min_version: '140.0',
          // Game titles and Steam ids from bundle pages go to Steam search and
          // IsThereAnyDeal to identify the games: page content sent off-device.
          // Nothing is sent to the developer.
          data_collection_permissions: { required: ['websiteContent'] },
        },
      },
    }),
  }),
});
