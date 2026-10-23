import '../lib/badge.css';
import { annotateGmg, collectGmgTitles, GMG_TILE_SELECTOR } from '../lib/gmg-tiles';
import { runTitleSite } from '../lib/title-site';

export default defineContentScript({
  matches: ['*://www.greenmangamingbundles.com/bundles/*'],
  main(ctx) {
    // GMG pages list titles only; switching tiers swaps the tiles in place,
    // which the runner's DOM watcher picks up.
    runTitleSite(ctx, { collectTitles: collectGmgTitles, annotate: annotateGmg, tileSelector: GMG_TILE_SELECTOR });
  },
});
