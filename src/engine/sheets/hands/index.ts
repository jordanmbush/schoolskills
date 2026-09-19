/**
 * The front door for hands (§25): which hand, if any, a face is written in.
 *
 * Resolved through `faceOf` rather than off the font id, because a sheet
 * saved with no `font`, or with one this build no longer has, is the print
 * face everywhere else it is read — and a row that traced in the print face
 * but was written in no hand would be the one place that disagreed.
 */
import { faceOf } from "../faces";
import type { SheetFont } from "../types";

import type { Hand } from "./hand";
import { PRINT } from "./print";

const HANDS: Partial<Record<SheetFont, Hand>> = { print: PRINT };

/** The hand a face is written in, or nothing: a face without one keeps the outline row. */
export function handOf(font: SheetFont | undefined): Hand | undefined {
  return HANDS[faceOf(font).id];
}
