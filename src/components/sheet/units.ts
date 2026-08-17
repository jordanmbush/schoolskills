/**
 * Mil on the sheet, CSS on the page.
 *
 * The engine hands every length over as `Mil` — a whole thousandth of an inch
 * (see `src/engine/sheets/types.ts`). Two things then need it in a form a
 * browser understands, and they want different forms:
 *
 * **The box model wants inches.** `0.625in` is what a ⅝ rule is, and inches
 * survive the print pipeline unchanged where `rem` would not.
 *
 * **Every `<svg>` on a sheet is a mil viewBox**, so inside one, user units
 * *are* mil and no conversion happens at all. That is why the ink weights
 * below are `Mil` and are set as attributes rather than in CSS: a
 * `stroke-width: 0.75pt` declaration inside a viewBox scaled from mil to
 * inches is resolved in CSS pixels and then multiplied by the viewBox
 * transform, which turns three quarters of a point into about a thousandth of
 * one — a line that vanishes on paper while looking fine on screen. Colour and
 * font family don't scale, so those stay in the stylesheet where they belong.
 */
import { inches, points, toInches } from "@/engine/sheets/paper";
import type { Mil } from "@/engine/sheets/types";

/** A length for CSS. Inches, because that is what paper is measured in. */
export const inch = (mil: Mil): string => `${toInches(mil)}in`;

/** A type size for CSS. Points, because that is what a type size is. */
export const pt = (size: number): string => `${size}pt`;

/* ── Ink ───────────────────────────────────────────────────────────────────
   Three weights and nothing else. A worksheet printed thirty pages a week is
   paid for in toner (§5), so the default sheet is black on white with no fills
   and the only thing that varies is how heavy a line is.                    */

/** Boxes, gaps, the faint half of a grid. */
export const HAIRLINE: Mil = points(0.5);
/** Rule lines, glyph outlines, everything a child writes on. */
export const RULE: Mil = points(0.75);
/** Axes, cut lines, the outside of a box — anything read before it's used. */
export const HEAVY: Mil = points(1.25);

/* ── Dashes ────────────────────────────────────────────────────────────────
   `stroke-dasharray` in mil, for the same reason the weights are. Each pair is
   ink-then-gap, and each is tuned to what it marks rather than shared: a
   handwriting midline is a broken line a child ignores and a cut line is an
   instruction.

   The dotted and dashed *letterforms* used to live here too and no longer do:
   theirs is the one pattern that can't be absolute, because it has to keep its
   dot-to-gap ratio across a face whose em changes with the ruling. They are
   shares of the outline weight now, in `src/engine/sheets/faces.ts`.        */

/** The dashed midline of a handwriting rule — the usual (§5). */
export const DASH_MIDLINE = `${inches(0.09)} ${inches(0.07)}`;
/** Cut here. Long enough to read as scissors rather than as a faint rule. */
export const DASH_CUT = `${inches(0.12)} ${inches(0.08)}`;
