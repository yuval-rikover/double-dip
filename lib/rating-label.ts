import type { SteamRating } from './steam-ratings';

/** Below this many reviews Steam won't call a game "Very Positive": too few to go by. */
const FEW_REVIEWS = 50;

/** "93%", tinted by Steam's score and dimmed when there are few reviews. */
export function ratingPercent(doc: Document, rating: SteamRating): HTMLElement {
  const percent = doc.createElement('span');
  const few = rating.count < FEW_REVIEWS ? ' bsl-rating--few' : '';
  percent.className = `bsl-rating bsl-rating--${tone(rating.score)}${few}`;
  percent.textContent = `${rating.percent}%`;
  return percent;
}

/** "Very Positive · 93% of 1,234 reviews", flagged when there are too few. */
export function reviewsText(rating: SteamRating): string {
  const count = `${rating.count.toLocaleString('en-US')} ${rating.count === 1 ? 'review' : 'reviews'}`;
  const text = `${rating.label} · ${rating.percent}% of ${count}`;
  return rating.count < FEW_REVIEWS ? `${text}, too few to go by` : text;
}

/** Steam's own grouping: 6–9 positive, 5 mixed, 1–4 negative. */
function tone(score: number): 'positive' | 'mixed' | 'negative' {
  if (score >= 6) return 'positive';
  return score === 5 ? 'mixed' : 'negative';
}
