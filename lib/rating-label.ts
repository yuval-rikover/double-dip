import type { SteamRating } from './steam-ratings';

/** Below this many reviews Steam won't call a game "Very Positive": too few to go by. */
const FEW_REVIEWS = 50;

/** "93%", tinted by Steam's score and dimmed when there are few reviews. */
export function ratingPercent(doc: Document, rating: SteamRating): HTMLElement {
  const percent = doc.createElement('span');
  const few = rating.count < FEW_REVIEWS ? ' bsl-rating--few' : '';
  percent.className = `bsl-rating bsl-rating--${tone(rating)}${few}`;
  percent.textContent = `${rating.percent}%`;
  return percent;
}

/** How many reviews, short: "541", "6.7K", "12K", "1.2M". */
export function compactCount(count: number): string {
  if (count < 1000) return String(count);
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumSignificantDigits: 2 }).format(count);
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** A person's silhouette, in the text color: says the number counts people. */
function personIcon(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'bsl-rating-count__icon');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('aria-hidden', 'true');
  const head = doc.createElementNS(SVG_NS, 'circle');
  head.setAttribute('cx', '8');
  head.setAttribute('cy', '4.5');
  head.setAttribute('r', '3.5');
  const body = doc.createElementNS(SVG_NS, 'path');
  body.setAttribute('d', 'M1 16c0-3.9 3.1-7 7-7s7 3.1 7 7z');
  svg.append(head, body);
  return svg;
}

/** "👤 6.7K" in muted text, for beside the percentage. */
export function reviewCount(doc: Document, rating: SteamRating): HTMLElement {
  const count = doc.createElement('span');
  count.className = 'bsl-rating-count';
  count.append(personIcon(doc), compactCount(rating.count));
  return count;
}

/** "Very Positive · 93% of 1,234 reviews", flagged when there are too few. */
export function reviewsText(rating: SteamRating): string {
  const count = `${rating.count.toLocaleString('en-US')} ${rating.count === 1 ? 'review' : 'reviews'}`;
  const percent = `${rating.percent}% of ${count}`;
  // Under 10 reviews Steam has no score, only "8 user reviews" for a label.
  const text = scored(rating) ? `${rating.label} · ${percent}` : percent;
  return rating.count < FEW_REVIEWS ? `${text}, too few to go by` : text;
}

/** Whether Steam gave the game a score (1–9): it doesn't under 10 reviews. */
const scored = (rating: SteamRating) => rating.score >= 1 && rating.score <= 9;

/**
 * Steam's own grouping: 6–9 positive, 5 mixed, 1–4 negative. Unscored
 * games get the group their percentage would put them in (70% and up
 * positive, under 40% negative).
 */
function tone(rating: SteamRating): 'positive' | 'mixed' | 'negative' {
  if (!scored(rating)) return rating.percent >= 70 ? 'positive' : rating.percent >= 40 ? 'mixed' : 'negative';
  if (rating.score >= 6) return 'positive';
  return rating.score === 5 ? 'mixed' : 'negative';
}
