/**
 * Reduces a game title to a comparison key, so the same game listed slightly
 * differently (case, accents, ™/®, punctuation, "&" vs "and") gets one key.
 * Edition suffixes are kept: "Deluxe Edition" can be a different Steam app.
 */
export function normalizeTitle(title: string): string {
  return title
    // Before NFKD, which would expand ™ into the letters "TM".
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
