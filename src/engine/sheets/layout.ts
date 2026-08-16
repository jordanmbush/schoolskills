/**
 * How much fits on a page — from geometry alone.
 *
 * There is no DOM here and no measurement, because there can't be: the catalog
 * pages are built at build time and the engine is unit-tested in plain Node
 * (§4). So a cell has a *declared* size rather than a measured one, capacity is
 * usable height ÷ row height, and the renderer honours the layout instead of
 * discovering it. That is a real constraint on the design of every sheet
 * family, and the right one — it is also what makes "did it fit?" a question a
 * test can answer without a browser.
 *
 * Everything is in `Mil`, thousandths of an inch. Positions are computed from a
 * repeat index rather than accumulated, so the last rule on a page is exactly
 * as far from the first as the arithmetic says.
 */
import type { Mil, Paper, Rule } from "./types";

import {
  marginOf,
  pageSize,
  ruleLines,
  rulePitch,
  type RuleRole,
} from "./paper";

export type Box = { x: Mil; y: Mil; width: Mil; height: Mil };

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
 * Both heights are declared by the family rather than measured, which is the
 * same bargain as a problem cell: state what you will use, and the arithmetic
 * stays honest.
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

/** Pages needed for a run of items, at a given capacity. Never divides by zero. */
export function pageCount(items: number, perPage: number): number {
  if (items <= 0) return 0;
  if (perPage <= 0) return 1;
  return Math.ceil(items / perPage);
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
