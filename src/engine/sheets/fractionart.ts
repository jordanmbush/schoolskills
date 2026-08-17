/**
 * A whole, cut into equal parts.
 *
 * The bar and the circle a fraction is taught from before it is a pair of
 * numbers. Like a number line, it is a drawing attached to a problem rather
 * than a block of its own — the problem grid is the shared primitive every
 * maths family prints through, and a picture the question is *about* belongs
 * inside the question.
 *
 * How big it is drawn lives here rather than in the renderer, for the same
 * reason `NUMBER_LINE_HEIGHT` does: the family reserves the height of a row
 * before anything is drawn (§4), and a diagram that came out taller than the
 * reservation is the bottom row of the page on a second sheet of paper. So
 * there is one set of dimensions and both halves read it.
 *
 * The sizes are inches and do not scale with the body type. A diagram is a
 * physical object a child colours in — a quarter is a quarter of the same bar
 * whether the sheet is set at 12pt or at 18pt for a five-year-old — and §17's
 * larger type is about reading the words, not about growing the pictures.
 */
import type { FractionArt, Mil } from "./types";

import { inches } from "./paper";

/** The bar: wide enough to cut into twelfths and still see the twelfths. */
export const BAR = { width: inches(1.3), height: inches(0.36) };

/** The circle, across. Smaller than the bar is wide, so a row of them reads. */
export const CIRCLE: Mil = inches(0.9);

export function fractionArt(
  shape: FractionArt["shape"],
  parts: number,
  shaded: number,
): FractionArt {
  const cuts = Math.max(1, Math.round(parts));
  return {
    shape,
    parts: cuts,
    // Clamped rather than trusted: `shaded` past `parts` is a picture with more
    // shading in it than there is whole, which is not a fraction of anything.
    shaded: Math.min(cuts, Math.max(0, Math.round(shaded))),
  };
}

/** How wide the drawing is. */
export const artWidth = (art: FractionArt): Mil =>
  art.shape === "circle" ? CIRCLE : BAR.width;

/** And how tall — a circle is as tall as it is wide, a bar is a band. */
export const artHeight = (art: FractionArt): Mil =>
  art.shape === "circle" ? CIRCLE : BAR.height;
