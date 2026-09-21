/**
 * How much fits on a page — from geometry alone, and never from measurement
 * (§4).
 *
 * Everything is in `Mil`, thousandths of an inch. Positions are computed from a
 * repeat index rather than accumulated, so the last rule on a page is exactly as
 * far from the first as the arithmetic says.
 *
 * The gaps and row heights below trail what the view actually draws — usually a
 * `gap` in `sheet.css` — and they live here rather than in the family that first
 * needed each, because more than one family now divides a page by them. A second
 * copy would be a second thing to keep in step with the view, and the failure is
 * silent: a sheet that looks right on screen and prints its bottom row on a
 * second sheet of paper.
 */
import type { Block, Mil, Paper, Problem, Rule } from "./types";

import {
  inches,
  marginOf,
  pageSize,
  points,
  ruleLines,
  rulePitch,
  type RuleRole,
} from "./paper";

export type Box = { x: Mil; y: Mil; width: Mil; height: Mil };

/**
 * How tall one ruled line for a hand-written answer is.
 *
 * A quarter of an inch is what a child writes on, and never less than the body
 * type needs: at 18pt the type is a quarter inch on its own, and a key printed
 * onto lines shorter than its own letters is a row taller than was reserved for.
 *
 * More than one thing a child writes on is this tall — a fact family's four
 * number sentences and the partial products of a long multiplication among
 * them.
 */
export const answerLine = (fontPt: number): Mil =>
  Math.max(inches(0.25), points(fontPt * 1.35));

/**
 * How wide a figure is, in ems of the body type. A tabular figure in the face
 * a sheet prints in is about six tenths of an em, and a comma and a space are
 * narrower, so a line reserved by this is wider than the line it holds.
 */
export const DIGIT_EM = 0.6;

/**
 * The room a problem's number takes in front of it: two digits and a full
 * stop at the body size, `.sheet__number`'s margin, and the gap
 * `.sheet__problem` puts after it. What a family adds to a drawing's own width
 * before asking how many columns of it fit — a bracket exactly as wide as its
 * column would print its number on the line above.
 */
export const numberRoom = (fontPt: number): Mil =>
  points(fontPt * DIGIT_EM * 3) + inches(0.12);

/**
 * The air between one problem and the next, down and across.
 *
 * `.sheet__problems` in sheet.css is the grid every math family prints
 * through, and this is its `gap` written in the unit the capacity arithmetic
 * works in.
 */
export const PROBLEM_GAP = { x: inches(0.3), y: inches(0.2) };

/**
 * The air *inside* a problem, between two lines of one that wrapped.
 *
 * `.sheet__problem` is a wrapping flex row, and it has to be: a number line and
 * a workspace take a line of their own under the sum, and so does the ruled
 * blank beside a fraction diagram. So a problem is sometimes two lines tall, and
 * a family that reserves for the second one has to know what the browser will
 * put between them.
 */
export const WRAP_GAP: Mil = inches(0.06);

/**
 * The air between one item of a list and the next.
 *
 * `.sheet__blanks` and `.sheet__questions` are both flex columns with this as
 * their `gap`, which is why it is one constant: a sentence with a gap in it and
 * a multiple-choice question are the same shape of thing down the page.
 */
export const LIST_GAP: Mil = inches(0.16);

/**
 * How tall one row of a matching block stands, in ems of the body size.
 *
 * `Matching.tsx` draws the block from this and a family reserves the page for
 * it, so a family that guessed a different number would print a column of pairs
 * off the bottom of the page. Two lines of type — room to draw a line between
 * two dots, and room to read the words either side of it.
 */
export const MATCH_ROW_EMS = 2.4;

/**
 * How tall one line of a note stands, in ems of its type — the sheet's own
 * `line-height`, which `.sheet__panel` inherits rather than restates.
 */
export const NOTE_LINE_EMS = 1.35;

/**
 * The share of the body size an aside is set at — the sentence for the
 * grown-up at the foot of a lesson, `.sheet__panel--aside` in sheet.css.
 */
export const ASIDE_EM = 0.85;

/** The air inside a note's border, each side — `.sheet__panel`'s padding. */
export const NOTE_PAD: Mil = inches(0.08);

/** The border itself, top and bottom. */
export const NOTE_RULE: Mil = points(0.75);

/**
 * How tall a note of `lines` lines stands, border and all, at the size its
 * type is set — the body size, or `ASIDE_EM` of it.
 *
 * `Note.tsx` draws the box exactly this tall and a lesson reserves exactly
 * this. A short estimate shows as text over the border; a box that grew would
 * push the last block onto page two (§23).
 */
export const noteHeight = (lines: number, pt: number): Mil =>
  Math.round(Math.max(1, lines) * points(pt * NOTE_LINE_EMS)) +
  2 * (NOTE_PAD + NOTE_RULE);

/**
 * The air between one block and the next.
 *
 * `.sheet__blocks` is a flex column and this is its `gap` — the one of these a
 * family with more than one block has to pay for. A coordinate sheet is a plane
 * and then the questions about it, and a gap the layout did not know about is
 * the last row of questions below the bottom margin.
 */
export const BLOCK_GAP: Mil = inches(0.14);

/** The paper minus its margins: everything a sheet is allowed to print in. */
export function contentBox(paper: Paper): Box {
  const { width, height } = pageSize(paper);
  const margin = marginOf(paper);
  return {
    x: margin,
    y: margin,
    width: Math.max(0, width - margin * 2),
    height: Math.max(0, height - margin * 2),
  };
}

/**
 * What's left for blocks once the header and footer have taken their share.
 *
 * Both heights are declared by the family rather than measured, the same
 * bargain as a problem cell: state what you will use, and the arithmetic stays
 * honest.
 */
export function blockBox(
  paper: Paper,
  chrome: { header?: Mil; footer?: Mil } = {},
): Box {
  const box = contentBox(paper);
  const header = Math.max(0, chrome.header ?? 0);
  const footer = Math.max(0, chrome.footer ?? 0);
  return {
    x: box.x,
    y: box.y + header,
    width: box.width,
    height: Math.max(0, box.height - header - footer),
  };
}

/**
 * How many cells of a declared size fit along a span: `n` cells and `n − 1`
 * gaps, which is why the gap is added to the span before dividing.
 */
export function fitAcross(span: Mil, cell: Mil, gap: Mil = 0): number {
  if (cell <= 0 || span <= 0) return 0;
  return Math.max(0, Math.floor((span + gap) / (cell + gap)));
}

export type Cell = { width: Mil; height: Mil };
export type Gap = { x?: Mil; y?: Mil };
export type Capacity = { columns: number; rows: number; perPage: number };

/** Rows, columns and the product — how many problems go on one page. */
export function capacity(box: Box, cell: Cell, gap: Gap = {}): Capacity {
  const columns = fitAcross(box.width, cell.width, gap.x ?? 0);
  const rows = fitAcross(box.height, cell.height, gap.y ?? 0);
  return { columns, rows, perPage: columns * rows };
}

/** The width of one column when the family has fixed the column count. */
export function columnWidth(box: Box, columns: number, gap: Mil = 0): Mil {
  if (columns <= 0) return 0;
  return Math.max(0, Math.floor((box.width - gap * (columns - 1)) / columns));
}

/**
 * The most problems a sheet is asked for: the top of the builder's stepper,
 * and the ceiling on a count from outside this build. A config in a
 * bookmarked URL may ask for a million, and a family that drew them would
 * hang the page before it printed one.
 */
export const MAX_COUNT = 200;

/** How many were asked for: whole, never negative, never past `MAX_COUNT`. */
export function countOf(count: number): number {
  return Math.max(0, Math.min(MAX_COUNT, Math.floor(count) || 0));
}

/**
 * How many problems a family draws for the count it was given. The count is
 * not cut to the page — what does not fit runs on (§4) — with one exception:
 * when not even one row fits at this type size, nothing is drawn at all,
 * because no number of pages would mend a row taller than the paper.
 */
export function wantedOf(count: number, perPage: number): number {
  return perPage <= 0 ? 0 : countOf(count);
}

/**
 * A list cut into pages: one block a page and a `break` between, never fewer
 * than one block, so a sheet with nothing on it still has a block to be
 * empty in. `perPage` is the family's own arithmetic, never a measurement,
 * and a page holds at least one item however small the number handed in — a
 * family with nothing that fits draws nothing rather than handing a list
 * here (§4).
 */
export function paged<T>(
  items: T[],
  perPage: number,
  block: (page: T[], from: number) => Block,
): Block[] {
  const take = Math.max(1, Math.floor(perPage) || 1);
  const blocks: Block[] = [];
  for (let from = 0; from < items.length; from += take) {
    if (from > 0) blocks.push({ kind: "break" });
    blocks.push(block(items.slice(from, from + take), from));
  }
  return blocks.length > 0 ? blocks : [block([], 0)];
}

/**
 * Problems a page at a time, numbered on from where the page before left
 * off, so a child told to do 14 to 20 finds them on page two.
 */
export function problemPages(
  items: Problem[],
  columns: number,
  perPage: number,
): Block[] {
  return paged(items, perPage, (page, from) => ({
    kind: "problems",
    columns,
    items: page,
    ...(from > 0 ? { start: from + 1 } : {}),
  }));
}

/** How many whole repeats of a ruling fit in a height. Never more than fit. */
export function ruleCapacity(height: Mil, rule: Rule): number {
  const pitch = rulePitch(rule);
  if (pitch <= 0 || height <= 0) return 0;
  return Math.floor(height / pitch);
}

export type RuledLine = { y: Mil; role: RuleRole; dashed: boolean };

/**
 * Where every rule line lands inside a box, top down.
 *
 * With no descender space a set's baseline is the next set's top line, so the
 * coincident pair is emitted once — two strokes at the same y print as one
 * heavy line, which is exactly the sort of thing that looks fine on screen and
 * wrong on paper.
 */
export function ruledLines(box: Box, rule: Rule): RuledLine[] {
  const pitch = rulePitch(rule);
  const lines = ruleLines(rule);
  if (lines.length === 0) return [];

  const sets = ruleCapacity(box.height, rule);
  const out: RuledLine[] = [];
  const seen = new Set<Mil>();
  for (let set = 0; set < sets; set++) {
    for (const line of lines) {
      const y = box.y + set * pitch + line.at;
      if (seen.has(y)) continue;
      seen.add(y);
      out.push({ y, role: line.role, dashed: line.dashed });
    }
  }
  return out;
}
