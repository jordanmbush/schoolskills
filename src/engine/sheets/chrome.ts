/**
 * What the header and footer take out of the page.
 *
 * Declared, not measured — the bargain `blockBox` is built on (§4) — and
 * rounded up, because the two errors are not symmetrical. Reserving a tenth of
 * an inch too much costs one rule line at the bottom of the page. Reserving too
 * little pushes that line onto a second sheet of paper, and print is the whole
 * of the output path here: there is no PDF to notice it in first.
 *
 * It lives on its own rather than inside a family because every family asks the
 * same question and the answer is delicate: the numbers below trail sheet.css,
 * which sets the header's rows in ems of the body size and its gaps in inches.
 * A second copy of them would be a second thing to keep in step with a
 * stylesheet, and the failure would be silent — a sheet that looks right on
 * screen and prints a blank second page.
 *
 * So: a title is 1.7em over a 1.05 line-height, a field line 0.82em over 1.35,
 * an instruction 0.9em, and the footer 0.62em above a rule with 0.18in of air
 * over it.
 */
import type { Mil, SheetOptions } from "./types";

import { blockBox, contentBox, type Box } from "./layout";
import { inches, points } from "./paper";

const HEAD_ROWS = { title: 1.9, fields: 1.2, instructions: 1.3 } as const;
const FOOT_ROW = 0.9;

/** The gap sheet.css puts between the header's rows. */
const HEAD_GAP = inches(0.09);
/** And under the header itself, whatever is in it. */
const HEAD_MARGIN = inches(0.16);
/** The footer's rule, its padding, and the air above it. */
const FOOT_MARGIN = inches(0.23);

/* The name line is not always one row. `.sheet__fields` is a wrapping flex
   row, so how many rows it takes is a question about the width of the page —
   three fields ("name", "date", "class" are all legal) measure more than a
   Letter content width and land on two. A row that was not reserved for is a
   rule line below the bottom margin, which is a second sheet of paper. */

/** One field: `.sheet__field-rule` at 2.1in, plus its label and their gap. */
const FIELD_WIDTH = inches(2.5);
/** The score box is the same row and a third of the width: 0.7in and "/ 20". */
const SCORE_WIDTH = inches(1.4);
/** `.sheet__fields` sets 0.06in between rows and 0.28in between fields. */
const FIELD_GAP = inches(0.28);
const FIELD_ROW_GAP = inches(0.06);

/** A height quoted in ems of the body size, in the unit the page is in. */
const em = (fontPt: number, rows: number): Mil => points(fontPt * rows);

/**
 * How many rows the name line wraps onto, packed the way a flex row packs.
 *
 * Greedy, item by item, because that is what `flex-wrap` does — and because
 * the items are not all the same width once a score box joins them. Counting
 * the score as another 2.5in field instead would push a name-date-score header
 * onto a second row it does not use, and on ⅝ paper a row is a line to write
 * on.
 */
function fieldRows(options: SheetOptions, score: boolean): number {
  const widths = [
    ...options.fields.map(() => FIELD_WIDTH),
    ...(score ? [SCORE_WIDTH] : []),
  ];
  if (widths.length === 0) return 0;

  const limit = contentBox(options.paper).width;
  let rows = 1;
  let used = 0;
  for (const width of widths) {
    const next = used === 0 ? width : used + FIELD_GAP + width;
    // A page too narrow for one whole field still prints one per row rather
    // than looping forever — `used > 0` is what makes the wrap terminate.
    if (next > limit && used > 0) {
      rows += 1;
      used = width;
    } else {
      used = next;
    }
  }
  return rows;
}

/**
 * How much of the page the header and footer will use.
 *
 * Counted from what the header actually holds rather than from a constant: a
 * sheet of lined paper with a name line and no title has an inch more writing
 * space than one with both, and on ⅝ paper an inch is two more lines to write
 * on. A family that reserved for the worst case would throw them away.
 */
export function chromeHeight(
  options: SheetOptions,
  /**
   * Whether the header carries a "___ / 20" box. The one part of the chrome a
   * family decides rather than a parent: a sheet is marked out of the number
   * of problems it ended up with, which is known after the build.
   */
  score = false,
): { header: Mil; footer: Mil } {
  const fields = fieldRows(options, score);
  const rows = [
    options.title ? HEAD_ROWS.title : 0,
    HEAD_ROWS.fields * fields,
    options.instructions ? HEAD_ROWS.instructions : 0,
  ].filter((row) => row > 0);

  return {
    // The margin is there even when the header is empty — SheetHead renders
    // the element either way, and an empty flex column still takes its gap.
    header:
      HEAD_MARGIN +
      rows.reduce((total, row) => total + em(options.fontPt, row), 0) +
      HEAD_GAP * Math.max(0, rows.length - 1) +
      FIELD_ROW_GAP * Math.max(0, fields - 1),
    footer: FOOT_MARGIN + em(options.fontPt, FOOT_ROW),
  };
}

/**
 * What is left for the blocks: the page, less its margins, less the chrome.
 *
 * Exported because it is the reservation itself, and the reservation is the
 * only thing a test can hold `chromeHeight` to. Checking a family's blocks
 * against the *content* box instead cannot fail — capacity is floored against
 * this box, which is the content box minus a non-negative number, so any
 * chrome at all satisfies it, including none.
 */
export function sheetBlockBox(options: SheetOptions, score = false): Box {
  return blockBox(options.paper, chromeHeight(options, score));
}
