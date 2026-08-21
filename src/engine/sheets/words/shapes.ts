/**
 * A word as the outline its letters make: three bands, a box per letter.
 *
 * Which band a letter is in is deliberately *not* read out of a face's own
 * metrics (`faces.ts`). It is the printed convention — `f` is drawn with a
 * descender in some hands and none in others, and a box that changed height
 * when a parent switched to the cursive face would make the same word two
 * different puzzles. The face only decides how the letter inside is drawn.
 *
 * The geometry is here too, in shares of one row, because both halves have to
 * agree: the family reserves the row (§4) and `WordShapes.tsx` draws the boxes
 * inside it, and a second copy of these numbers would be a row of boxes that
 * overhangs the one beneath it.
 */
import type { LetterShape, WordShape } from "../types";

/**
 * The letters that reach the top line.
 *
 * `t` is in it, though it is drawn shorter than a `b` in most hands: the
 * question a word shape asks is "is this letter taller than an `o`", and a `t`
 * plainly is.
 */
const TALL = new Set([..."bdfhklt"]);

/** And the five that hang below it. `f` does not, by the convention above. */
const TAIL = new Set([..."gjpqy"]);

/** Which band one character is drawn in. */
export function letterShape(letter: string): LetterShape {
  if (TAIL.has(letter)) return "tail";
  if (TALL.has(letter)) return "tall";
  // A space is the absence of a band: a two-word entry like "1 Samuel" would
  // otherwise print a box nothing can go in. The slot is still counted so the
  // boxes either side keep their positions — see `LetterShape`.
  if (/\s/.test(letter)) return "gap";
  // A capital or a numeral gets the tall box. `toLowerCase() !== letter` rather
  // than a range, so an accented capital is not read as a small letter.
  if (/[0-9]/.test(letter) || letter.toLowerCase() !== letter) return "tall";
  return "small";
}

/** One word, box by box. Punctuation counts as small, a space as a gap. */
export const wordShape = (word: string): WordShape => ({
  word,
  letters: [...word].map(letterShape),
});

/* ── How tall a row of boxes is ────────────────────────────────────────────
   The proportions a primary ruling uses: rather more than a third above the
   midline, rather more than a third between midline and baseline, and the rest
   for a tail — which is what makes a `tall` box visibly twice a `small` one at
   a glance across a page.                                                    */

/**
 * How tall one row of boxes stands, in ems of the body size.
 *
 * Rather taller than a line of type, because what goes in a box is a letter
 * written by hand and a child of five writes larger than the sheet is set in.
 * At the 12pt default this is a shade over four tenths of an inch to the row —
 * the size a reading scheme prints them.
 */
export const SHAPE_ROW_EMS = 2.6;

/** Where each band starts and stops, as a share of the row, top down. */
export const BANDS = {
  ascender: { top: 0, bottom: 0.38 },
  body: { top: 0.38, bottom: 0.74 },
  descender: { top: 0.74, bottom: 1 },
} as const;

/**
 * How wide one box is, in ems — wider than the letter it holds, for the reason
 * the row is taller. A box measured to the face's own mean advance would be a
 * box a child cannot write a `w` in.
 */
export const SHAPE_BOX_EMS = 1.3;

export const SHAPE_BOX_GAP_EMS = 0.1;

/**
 * The top and the bottom of one letter's box, as shares of the row.
 *
 * `gap` has no box, and answers with the body band anyway rather than throwing
 * or widening the return type: the caller that meets a gap skips drawing before
 * it ever asks, and a total function keeps that the renderer's one decision.
 */
export function shapeBand(shape: LetterShape): { top: number; bottom: number } {
  if (shape === "tall")
    return { top: BANDS.ascender.top, bottom: BANDS.body.bottom };
  if (shape === "tail")
    return { top: BANDS.body.top, bottom: BANDS.descender.bottom };
  return { top: BANDS.body.top, bottom: BANDS.body.bottom };
}
