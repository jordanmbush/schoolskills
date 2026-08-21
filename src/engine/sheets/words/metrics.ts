/**
 * What a word puzzle reserves the page against, and what the renderer draws
 * against — the handful of things both halves have to agree on exactly.
 *
 * A grid a hair wider than the space kept for it, or a "not in the grid" line
 * measured at one length and printed at another, looks right on screen and
 * comes out on a second sheet of paper. So there is one copy of each, here.
 *
 * **Here rather than in `search.ts` or `puzzles.ts` for the reason
 * `phonics/metrics.ts` gives:** three block renderers need these, and reaching
 * them through a family module would put the puzzle generators in the Print
 * Shop's first download — leaving the `puzzle` and `words` entries in
 * `families.ts` fetching modules the browser already had (§3). Nothing here
 * generates anything: two numbers and a list of tokens, over `paper.ts`, which
 * every sheet already needs.
 */
import type { Mil } from "../types";

import { inches } from "../paper";

/**
 * A letter big enough for a five-year-old to find, and small enough that a
 * ten-by-ten puzzle doesn't take the whole page.
 */
export const SEARCH_CELL: Mil = inches(0.34);

/** How wide one cell comes out at, given the room and the number of them. */
export const searchCell = (width: Mil, size: number): Mil =>
  size <= 0 ? 0 : Math.min(SEARCH_CELL, Math.floor(width / size));

/** What `<Omitted>` puts in front of the list. */
const MISSING_HEAD = "Not in the grid:";

/**
 * The missing line, as the words it is set from.
 *
 * Tokens rather than a sentence because both halves need it in this shape: the
 * renderer joins them with a space, and the reservation packs them by whole
 * words, greedily, exactly as `packRows` does for the wrapping rows in the
 * chrome. A copy of the sentence in `Omitted.tsx` would be a paragraph measured
 * at one length and printed at another.
 */
export function missingTokens(words: string[], more: number): string[] {
  return [
    MISSING_HEAD,
    // The last word takes no comma, the tail included: "CAT, DOG … and 3 more"
    // is a list that ran out, and "DOG, … and 3 more" is a typo.
    ...words.map((word, at) => (at === words.length - 1 ? word : `${word},`)),
    ...(more > 0 ? [`… and ${more} more`] : []),
  ];
}
