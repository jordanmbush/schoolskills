/**
 * What each step of the rail says about the sheet while it is closed (§14).
 *
 * A step that showed only its name would have to be opened to be checked, so
 * each carries the choices made in it as one short line. The paper's, the
 * lettering's and the heading's are written here; the family's is the family's
 * own `describe(config)`, and the sheet type's is its label.
 */
import type {
  MarginSize,
  PaperSize,
  SheetConfig,
  SheetFont,
} from "@/engine/sheets/types";

import { opt } from "./options/parts";

/**
 * The faces, named by shape and never by a teaching model, because the models
 * with names are trademarks with per-seat fonts behind them (§6).
 *
 * Five is the last count `Choice` still draws as a row of pills — the threshold
 * is *past* five, not at it (`options/parts.tsx`) — so all five faces stay on
 * screen at once with their hints, which is what a list where two entries differ
 * by a detail worth reading needs. A sixth face would take the row to a dropdown
 * and the hints with it.
 *
 * Here rather than beside the control that offers them, because the lettering
 * line below is written from the same five names.
 */
export const FONTS = [
  opt<SheetFont>("print", "Print", "single-storey a and g"),
  opt<SheetFont>("cursive", "Cursive, looped", "the traditional joined hand"),
  opt<SheetFont>(
    "cursive-modern",
    "Cursive, unlooped",
    "simpler shapes; the pencil lifts after b, f, g, j, p, q, s and y",
  ),
  opt<SheetFont>(
    "cursive-uk",
    "Cursive, fully joined",
    "lead-in strokes, and a join out of every letter",
  ),
  opt<SheetFont>("dyslexic", "Dyslexia", "weighted letters that can't mirror"),
];

const SIZES: Record<PaperSize, string> = {
  letter: "Letter",
  a4: "A4",
  legal: "Legal",
};

/** Normal margins go unsaid; the line is for what was changed. */
const MARGINS: Record<MarginSize, string | null> = {
  none: "no margins",
  narrow: "narrow margins",
  normal: null,
  wide: "wide margins",
};

export function paperLine({ paper, cutLines }: SheetConfig): string {
  const parts = [SIZES[paper.size], paper.orientation];
  const margins = MARGINS[paper.margin];
  if (margins) parts.push(margins);
  if (cutLines) parts.push("cut lines");
  return parts.join(", ");
}

export function letteringLine({ fontPt, font, forms }: SheetConfig): string {
  const face =
    FONTS.find((one) => one.value === (font ?? "print"))?.label ?? "Print";
  const shapes =
    forms && Object.keys(forms).length > 0 ? ", letter shapes chosen" : "";
  return `${fontPt} pt, ${face}${shapes}`;
}

/**
 * The lines to fill in, and the title where a parent wrote one. The fields are
 * sentence-cased as a list — "Name, date, class" — so the line reads as words
 * rather than as the config's own keys.
 */
export function headingLine({ title, fields }: SheetConfig): string {
  const lines =
    fields.length > 0
      ? fields
          .map((field, index) =>
            index === 0 ? field[0].toUpperCase() + field.slice(1) : field,
          )
          .join(", ")
      : "No lines to fill in";
  return title ? `“${title}”, ${lines.toLowerCase()}` : lines;
}
