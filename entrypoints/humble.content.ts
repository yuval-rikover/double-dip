import '../lib/badge.css';
import '../lib/humble.css';
import { annotateChoice, collectChoiceTitles } from '../lib/humble-choice';
import { annotateHumble, collectHumbleTitles } from '../lib/humble-tiles';
import { runTitleSite } from '../lib/title-site';

const isBundle = () => /^\/(games|software)\/[^/]+/.test(location.pathname);
const isChoice = () => location.pathname.startsWith('/membership/');

export default defineContentScript({
  // Site-wide: Humble is a single-page app, so moving from a bundle to Choice
  // (or from Humble's home page to either) loads no new page, and a script
  // matched to one of them would never start on the other. It acts only on
  // the page shown now.
  matches: ['*://www.humblebundle.com/*'],
  main(ctx) {
    // Humble tiles carry only a title, on bundles and Choice alike.
    runTitleSite(ctx, {
      isActive: () => isBundle() || isChoice(),
      collectTitles: (doc) => (isBundle() ? collectHumbleTitles(doc) : collectChoiceTitles(doc)),
      annotate: (doc, lookup) => (isBundle() ? annotateHumble(doc, lookup) : annotateChoice(doc, lookup)),
    });
  },
});
