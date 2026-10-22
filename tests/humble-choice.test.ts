// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { annotateChoice, choiceMonthSlug, collectChoiceTitles, parseChoiceMonth } from '../lib/humble-choice';
import { normalizeTitle } from '../lib/normalize';

// By path: happy-dom replaces import.meta.url with a page URL.
const octoberHtml = readFileSync('tests/fixtures/humble-choice-october-2026.html', 'utf8');

/** Tiles shaped like the member hub's grid. */
function tile(title: string | null): string {
  return `<div class="content-choice"><div class="choice-image-container"><img class="choice-image"></div>${
    title === null ? '' : `<div class="content-choice-title">${title}</div>`
  }</div>`;
}

const badges = () => [...document.querySelectorAll<HTMLAnchorElement>('[data-bsl-badge]')];

describe('parseChoiceMonth', () => {
  const month = parseChoiceMonth(octoberHtml)!;

  it('reads every Steam game with its app id', () => {
    expect(month[normalizeTitle('Psychonauts 2')]).toEqual({ type: 'app', id: 607080 });
    expect(month[normalizeTitle("Asgard's Fall — Viking Survivors")]).toEqual({ type: 'app', id: 2780710 });
    expect(Object.values(month).filter((v) => v !== 'not-steam')).toHaveLength(9);
  });

  it('marks extras without a Steam id as not-steam', () => {
    expect(month[normalizeTitle('Get One Month of IGN Plus')]).toBe('not-steam');
  });

  it('returns null without the data block', () => {
    expect(parseChoiceMonth('<html><body>no data</body></html>')).toBeNull();
  });
});

describe('choiceMonthSlug', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('reads a month page from its URL', () => {
    expect(choiceMonthSlug('/membership/september-2026', document)).toBe('september-2026');
  });

  it('reads the member hub from its month heading, once rendered', () => {
    expect(choiceMonthSlug('/membership/home', document)).toBeNull();
    document.body.innerHTML = '<h3 class="content-choices-title">Your games</h3><h3 class="content-choices-title">October 2026 games</h3>';
    expect(choiceMonthSlug('/membership/home', document)).toBe('october-2026');
  });

  it('ignores other membership pages', () => {
    expect(choiceMonthSlug('/membership/checkout', document)).toBeNull();
  });
});

describe('annotateChoice', () => {
  beforeEach(() => {
    document.body.innerHTML = tile('Psychonauts 2') + tile('Get One Month of IGN Plus') + tile('Unknown Game') + tile(null);
  });

  it('collects titled tiles only', () => {
    expect(collectChoiceTitles(document)).toEqual(['Psychonauts 2', 'Get One Month of IGN Plus', 'Unknown Game']);
  });

  it('badges Steam games inside the image, skips extras, waits on unknowns', () => {
    const month = parseChoiceMonth(octoberHtml)!;
    expect(annotateChoice(document, (title) => month[normalizeTitle(title)])).toBe(1);
    const [badge] = badges();
    expect(badge!.href).toBe('https://store.steampowered.com/app/607080/');
    expect(badge!.parentElement?.classList).toContain('choice-image-container');
  });

  it('offers a search for a title with no match, and adds nothing twice', () => {
    expect(annotateChoice(document, (title) => (title === 'Unknown Game' ? null : undefined))).toBe(1);
    expect(badges()[0]!.classList).toContain('bsl-badge--search');
    expect(annotateChoice(document, (title) => (title === 'Unknown Game' ? null : undefined))).toBe(0);
  });
});
