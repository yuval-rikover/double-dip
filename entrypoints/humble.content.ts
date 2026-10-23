import '../lib/badge.css';
import { annotateHumble, collectHumbleTitles, HUMBLE_TILE_SELECTOR } from '../lib/humble-tiles';
import { runTitleSite } from '../lib/title-site';

export default defineContentScript({
  matches: ['*://www.humblebundle.com/games/*', '*://www.humblebundle.com/software/*'],
  main(ctx) {
    // Humble tiles carry only a title (the page's JSON is gone by now).
    runTitleSite(ctx, { collectTitles: collectHumbleTitles, annotate: annotateHumble, tileSelector: HUMBLE_TILE_SELECTOR });
  },
});
