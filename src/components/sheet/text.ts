/**
 * How big a run of text may be set to stay inside the box drawn for it.
 *
 * Declared rather than measured, the same bargain `layout.ts` strikes over a
 * problem cell (§4): there is no DOM at build time to ask instead, and a size a
 * browser worked out is a size no test can check. The mean advance is the
 * face's own (`faces.ts`), so a heading that fits in the print face is not
 * clipped in the dyslexic one — which is half a line wider per character.
 *
 * What it guards on a drawn block is an overflow nothing tidies up afterwards:
 * a heading set in an `<svg>` is cut off at the edge of the drawing, and
 * overlaps the column beside it before that.
 */
import { glyphAdvance, type Face } from "@/engine/sheets/faces";
import type { Mil } from "@/engine/sheets/types";

/**
 * `size`, or the largest every one of `texts` fits `width` at — whichever is
 * smaller.
 *
 * One size for every item rather than one each, and it is the smallest any of
 * them needs: the widest text is the one that decides, and `size` is a ceiling
 * rather than a floor, so a run of short words is set at the size asked for and
 * never larger. Per item would be arithmetically tidier and would print a
 * heading row with a different type size in every column, which reads as a
 * mistake whether or not it is one.
 *
 * `texts` is therefore a set of things sharing **one** width. A caller whose
 * boxes are different widths — a table's columns, a form's fields — asks once
 * per box and takes the minimum itself, because one width for all of them
 * measures the longest text against the narrowest box.
 *
 * `fill` is how much of the box the text may take, which is never all of it:
 * something has to hold the letters off the rule beside them.
 */
export function fitText(
  texts: string[],
  width: Mil,
  size: number,
  face: Face,
  fill: number,
): number {
  return texts.reduce((smallest, text) => {
    const advance = glyphAdvance(text, face);
    if (text.length === 0 || advance <= 0) return smallest;
    return Math.min(
      smallest,
      Math.floor((width * fill) / (text.length * advance)),
    );
  }, size);
}
