/**
 * The coordinate plane, and where a point sits on it.
 *
 * Here rather than inside the family that first drew one: a plane is the
 * question on two different sheets — reading coordinates, and reading a slope
 * off a graph — and a second copy of "how many squares wide is it, and where do
 * the axes cross" would be a second answer to the question the layout arithmetic
 * already asked. The height a family reserves and the drawing the renderer makes
 * come from one place, which is the whole of the bargain in §4.
 *
 * Nothing here knows what a problem is. It is squares, an origin, and the
 * arithmetic that turns a pair of coordinates into a position on the ruling.
 */
import type { Box } from "./layout";
import { inches } from "./paper";
import type { GridMark, GridSpec, Mil } from "./types";

/** The biggest a square is drawn, and how much of the page a plane may take. */
const GRID_CELL = inches(0.4);
const GRID_SHARE = 0.55;

/**
 * How far the axes run from the origin, in each of the two shapes.
 *
 * A four-quadrant plane runs less far each way for the same paper, because it
 * has twice as much of everything to draw.
 */
const QUADRANT_SPAN = 10;
const FOUR_QUADRANT_SPAN = 8;

/**
 * How far a caller may move that, either way.
 *
 * Four because a plane that runs to three is four squares of paper and a
 * drawing nobody would print; twenty because past it the squares are finer than
 * a child can write a coordinate into, whatever the paper. Both are here rather
 * than in the family that asks, because the plane is what has the opinion.
 */
const MIN_SPAN = 4;
const MAX_SPAN = 20;

export type Plane = {
  /** How far the axes run from nought. */
  span: number;
  /** Whether the plane has negative coordinates on it. */
  negative: boolean;
  grid: GridSpec;
};

/**
 * How a plane may be asked for differently from the one under a question.
 *
 * Both defaults are what a *problem* sheet needs, because that is what asked
 * first: a plane no bigger than 0.4in to the square, taking a little over half
 * the page, with the questions about it underneath. A blank coordinate grid is
 * the same drawing with neither of those true — it is the whole sheet, and it
 * is as large as the paper allows — and a second copy of "where do the axes
 * cross, and how far out do the numerals sit" is the thing worth not having.
 */
export type PlaneOptions = {
  /** How far the axes run from nought, where the caller has an opinion. */
  span?: number;
  /** The largest a square may be drawn. */
  cell?: Mil;
  /** How much of the block box the plane may take, down the page. */
  share?: number;
};

/**
 * The grid a coordinate sheet is drawn on.
 *
 * A first-quadrant plane keeps one square of margin below and to the left of the
 * axes, which is where the numbers along them go: the drawing is exactly as wide
 * as its squares say it is (§4), so a numeral outside the grid is a numeral off
 * the edge of the drawing.
 *
 * `quadrants` is a number rather than a union because it arrives from outside
 * this build — a bookmarked URL, a sheet saved in March — and anything that is
 * not four has to resolve to a plane rather than throw. `span` is guarded the
 * same way and for the same reason.
 */
export function planeOf(
  quadrants: number,
  box: Box,
  options: PlaneOptions = {},
): Plane {
  const negative = Math.floor(quadrants) === 4;
  const fallback = negative ? FOUR_QUADRANT_SPAN : QUADRANT_SPAN;
  const asked = Math.floor(options.span ?? fallback);
  const span = Number.isFinite(asked)
    ? Math.max(MIN_SPAN, Math.min(MAX_SPAN, asked))
    : fallback;
  const pad = negative ? span : 1;
  const columns = span + pad;
  const rows = span + pad;
  const cell = Math.max(
    1,
    Math.min(
      options.cell ?? GRID_CELL,
      Math.floor(box.width / columns),
      Math.floor((box.height * (options.share ?? GRID_SHARE)) / rows),
    ),
  );
  return {
    span,
    negative,
    grid: {
      kind: "coordinate",
      columns,
      rows,
      cell,
      origin: { column: pad, row: span },
      // What is on the plane, as against what the ruling runs to. On a
      // first-quadrant plane the padding square outside the axes is where the
      // numerals go, not a column of −1: this is what stops one being printed
      // there, on the sheet that promised no negative numbers at all.
      axis: { min: negative ? -span : 0, max: span },
    },
  };
}

/** How much page a plane takes, which is what the problems under it do not get. */
export const planeHeight = (plane: Plane): Mil =>
  plane.grid.rows * plane.grid.cell;

/** The smallest coordinate a point may have: −span, or one on a quarter plane. */
export const planeFloor = (plane: Plane): number =>
  plane.negative ? -plane.span : 1;

/** Where a point sits on the plane, in squares from the top-left of the grid. */
export const markAt = (
  plane: Plane,
  x: number,
  y: number,
  label: string,
): GridMark => ({
  column: (plane.grid.origin?.column ?? 0) + x,
  row: (plane.grid.origin?.row ?? 0) - y,
  label,
});

/** A, B, C … the letters a point is called by. */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * The letter the nth point on a plane is called by, starting round again at A.
 *
 * Here rather than in either family, now that two of them name points: reading
 * coordinates and reading a slope off a graph both letter their dots, and the
 * wrap is the part worth writing once — a plane with twenty-seven points on it
 * is not a sheet anybody would print, and a blank label is not a question.
 */
export const letterAt = (index: number): string =>
  LETTERS[index % LETTERS.length];
