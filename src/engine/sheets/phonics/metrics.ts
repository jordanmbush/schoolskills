/**
 * How big a card is, and nothing else — which is the whole point of the module.
 *
 * Declared, not measured (§4), and in ems of the body size, so a parent who
 * wants cards twice the size raises the type size and the whole card grows with
 * it. It is also how one block prints both a flash card an inch high and a
 * sentence strip a child reads across a room.
 *
 * **These numbers sit apart from `cards.ts` because two very different callers
 * read them:** the family, which reserves the page against them, and
 * `blocks/Cards.tsx`, which draws the box. A renderer reaching them through
 * `cards.ts` would drag `bank.ts` — 27 KB of word corpus — into the Print
 * Shop's first download for four numbers, and the phonics family's
 * `() => import(...)` in `families.ts` would then be fetching a module the
 * browser already had (§3). So this file imports nothing at all, and the rule
 * that keeps it that way is `blocks/index.test.ts`.
 */

/** The spelling on a sound card, and on the wall chart. */
export const CARD_BIG_EMS = 3.2;

/** A sentence strip: a whole sentence, so a great deal smaller than a card. */
export const STRIP_BIG_EMS = 1.6;

/** The example word under the spelling. */
export const CARD_SMALL_EMS = 0.95;

/** The leading each of the two lines is set on. */
export const CARD_BIG_LEADING = 1.1;
export const CARD_SMALL_LEADING = 1.35;

/** The air inside a card's box, top and bottom each. */
export const CARD_PAD_EMS = 0.42;

/**
 * How tall one card stands, in ems of the body size.
 *
 * Read by both the family that reserves the page and the renderer that draws
 * the box, for the reason `answerLine` gives: the failure is silent on screen
 * and is the last row of cards on a second sheet of paper.
 *
 * `rows` is how many lines the big line wraps onto — one for a spelling, and
 * however many the longest sentence needs for a strip.
 */
export function cardRowEms(big: number, rows: number, small: boolean): number {
  return (
    rows * big * CARD_BIG_LEADING +
    (small ? CARD_SMALL_EMS * CARD_SMALL_LEADING : 0) +
    CARD_PAD_EMS * 2
  );
}
