/**
 * How big a run of text may be set to stay inside the box drawn for it.
 *
 * Declared rather than measured, the same bargain `layout.ts` strikes over a
 * problem cell (§4): there is no DOM at build time to ask instead, and a size a
 * browser worked out is a size no test can check. The mean advance is the
 * face's own (`faces.ts`), so a heading that fits in the print face is not
 * clipped in the dyslexic one — which is half a line wider per character.
 *
 * It lives on its own because three blocks now ask it. `Grid.tsx` was first —
 * a place-value chart's "Hundred thousands" set at half the height of its own
 * column runs four columns wide, and an `<svg>` clips to its viewBox, so what
 * printed was a chart with most of its headings sliced off. A table's headings
 * and a card's big line have exactly the same problem, and three copies of the
 * arithmetic would be three chances to write the division the other way up.
 */
import { glyphAdvance, type Face } from "@/engine/sheets/faces";
import type { Mil } from "@/engine/sheets/types";

/**
 * The largest of `size` and what the widest of `texts` will fit at.
 *
 * One size for every item rather than one each, and it is the smallest any of
 * them needs. Per item would be arithmetically tidier and would print a heading
 * row with a different type size in every column, which reads as a mistake
 * whether or not it is one.
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
