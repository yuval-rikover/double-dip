// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { compactCount, ratingPercent, reviewsText } from '../lib/rating-label';

describe('compactCount', () => {
  it('keeps counts under a thousand exact, and shortens the rest to two digits', () => {
    expect(compactCount(1)).toBe('1');
    expect(compactCount(541)).toBe('541');
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1000)).toBe('1K');
    expect(compactCount(6681)).toBe('6.7K');
    expect(compactCount(12345)).toBe('12K');
    expect(compactCount(123456)).toBe('120K');
    expect(compactCount(1234567)).toBe('1.2M');
  });
});

describe('unscored games (under 10 reviews)', () => {
  const few = { percent: 100, score: 0, label: '8 user reviews', count: 8 };

  it('tints by percentage, since Steam gives no score', () => {
    expect(ratingPercent(document, few).className).toBe('bsl-rating bsl-rating--positive bsl-rating--few');
    expect(ratingPercent(document, { ...few, percent: 50 }).classList).toContain('bsl-rating--mixed');
    expect(ratingPercent(document, { ...few, percent: 20 }).classList).toContain('bsl-rating--negative');
  });

  it("leaves out Steam's \"8 user reviews\" label", () => {
    expect(reviewsText(few)).toBe('100% of 8 reviews, too few to go by');
    expect(reviewsText({ percent: 93, score: 8, label: 'Very Positive', count: 6681 })).toBe('Very Positive · 93% of 6,681 reviews');
  });
});
