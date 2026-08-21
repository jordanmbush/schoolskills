/**
 * How wide a ruled table's columns are, and how tall its rows stand.
 *
 * Two families print tables — the forms (a reading log, a timeline) and the
 * week (a calendar, a planner, a chore chart) — and both have to answer the
 * same two questions before they know what fits on the page. Written once here
 * rather than twice in the families, because the failure is silent on screen
 * and is the last row of the table on a second sheet of paper.
 *
 * **The columns sum to the box exactly.** A table is drawn from a list of
 * widths, so widths that came to a few thousandths less than the page would
 * print a ragged right edge that no test would notice and every reader would.
 * Dividing by shares leaves a remainder, and it is spread a mil at a time over
 * the widest columns — see `tableColumns` for why it is not simply given away.
 */
import { answerLine, type Box } from "../layout";
import { inches, points } from "../paper";
import type { Mil, TableColumn } from "../types";

/** What a column is asked for: a heading, and how much of the width it wants. */
export type ColumnShare = { label: string; share: number };

/**
 * How tall the heading row stands, in ems of the body size.
 *
 * Taller than the type it holds, because it is the one row a child does not
 * write in: making it exactly as tall as a writing row leaves a reader hunting
 * for where the blanks start.
 */
export const HEAD_ROW_EMS = 1.9;

/** The smallest body row worth writing a word in, and the largest worth having. */
const MIN_ROW: Mil = inches(0.3);
const MAX_ROW: Mil = inches(1.6);

/**
 * The shortest a body row may be: a line a child writes on, and never less than
 * the type needs.
 *
 * Exported because a family with something *above* its table has to leave room
 * for one — a verse sized to the whole page would leave the week under it a row
 * shorter than the writing in it, which overflows downwards and off the paper.
 */
export const minRowHeight = (fontPt: number): Mil =>
  Math.max(answerLine(fontPt), MIN_ROW);

/**
 * The columns, at widths that sum to the box exactly.
 *
 * Shares rather than lengths, because what the families declare is proportions:
 * a reading log's "Minutes" column is three numerals wide and its "Book" column
 * is a title wide, and neither is a number of inches anybody should write down
 * twice, once for Letter and once for A4.
 */
export function tableColumns(shares: ColumnShare[], width: Mil): TableColumn[] {
  const total = shares.reduce(
    (sum, column) => sum + Math.max(0, column.share),
    0,
  );
  if (shares.length === 0 || total <= 0 || width <= 0) return [];

  const columns = shares.map((column) => ({
    label: column.label,
    width: Math.floor((width * Math.max(0, column.share)) / total),
  }));

  // The remainder, a thousandth of an inch at a time, to the widest columns
  // first. Flooring seven shares of a Letter page loses three thousandths, and a
  // table drawn from widths that do not add up is one whose right edge is not
  // the margin.
  //
  // Spread rather than handed to one column, because a calendar's seven columns
  // are supposed to be *equal*: three mil on one of them is a Sunday measurably
  // wider than a Monday, and one mil each on three of them is 25 microns, which
  // is finer than any home printer resolves.
  const order = columns
    .map((column, index) => ({ index, width: column.width }))
    .sort((a, b) => b.width - a.width || a.index - b.index);
  let short = width - columns.reduce((sum, column) => sum + column.width, 0);
  for (let at = 0; short > 0; at = (at + 1) % order.length, short--) {
    const { index } = order[at];
    columns[index] = { ...columns[index], width: columns[index].width + 1 };
  }
  return columns;
}

/** How tall a heading row stands at a given body size. */
export const headRowHeight = (fontPt: number): Mil =>
  points(fontPt * HEAD_ROW_EMS);

export type TableShape = { rows: number; row: Mil };

/**
 * How many body rows fit, and how tall each one stands.
 *
 * The count is a request and what fits is the answer (§4). Between the two
 * bounds the rows stretch to fill the page, which is what makes the same block
 * a *log* at eight rows and a *chart* at twenty.
 *
 * `least` is never less than a line a child writes on: a row shorter than the
 * type in it is a row the writing overflows, and the overflow is downward —
 * which is the bottom row of the table on a second sheet of paper.
 */
export function tableShape(
  box: Box,
  fontPt: number,
  want: number,
  head: boolean,
): TableShape {
  const body = Math.max(0, box.height - (head ? headRowHeight(fontPt) : 0));
  const least = minRowHeight(fontPt);
  const rows = Math.max(1, Math.min(want, Math.floor(body / least)));
  return {
    rows,
    row: Math.max(least, Math.min(MAX_ROW, Math.floor(body / rows))),
  };
}
