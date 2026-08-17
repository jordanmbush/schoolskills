/**
 * What a block renderer is allowed to know about the page it is on.
 *
 * A block is handed this and its own data, and nothing else. It is deliberately
 * three facts rather than the whole `Sheet`: a renderer that could read the
 * header would start deciding things the family already decided, and the
 * declared-size bargain in `layout.ts` only holds while the view honours a
 * layout instead of discovering one.
 */
import type { Box } from "@/engine/sheets/layout";
import type { SheetFont } from "@/engine/sheets/types";

export type SheetMetrics = {
  /**
   * The printable box, in mil, measured from the paper's top-left corner —
   * `contentBox(sheet.paper)`. `x` is load-bearing as well as `width`: a
   * notebook rule's margin line is 1.25in from the edge of the *paper*, not
   * from the edge of the block, so a ruling has to know how far in it starts.
   */
  box: Box;
  /** The sheet's body size, in points. Sets the type inside an `<svg>`. */
  fontPt: number;
  /**
   * The face the sheet is set in — the id, never a font stack, which stays in
   * `sheet.css` where it belongs.
   *
   * A fourth fact rather than a third because a traced letterform is sized off
   * the face's own proportions and not off `fontPt`: a ⅝ rule holds a whole em
   * of Playwrite and only 0.79 of an em of Andika, so a renderer that couldn't
   * see the face would draw one of them through the top line (`faces.ts`).
   *
   * Absent is the print face, exactly as it is on the `Sheet` this came from —
   * carried through rather than resolved here, so there is one place that
   * decides what an unknown or missing face means (`faceOf`).
   */
  font?: SheetFont;
  /** Print the answers that were computed when the sheet was built. */
  answers: boolean;
};
