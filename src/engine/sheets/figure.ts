/**
 * Shapes, as points.
 *
 * A geometry sheet is the first family whose *question* is a drawing with
 * numbers on it, so the drawing is made where the numbers are — in the engine,
 * as data — and the renderer's whole job is to put ink on the points it is
 * handed. A shape a browser worked out is a shape no unit test can check, and a
 * row is reserved (§4) before anything is drawn.
 *
 * ── Proportion, not life size ──────────────────────────────────────────────
 * A ⅝ rule prints at ⅝ of an inch or it is wrong, and a clock dial prints at an
 * inch and a half. A rectangle eight metres by three does not print at eight
 * metres by three, so it is drawn **in proportion**: every figure is scaled to
 * fit one box, and the scale is applied to both directions at once so that eight
 * by three is drawn eight by three. The measurements are on the labels, and the
 * child reads them there.
 *
 * The one thing that *is* drawn true is an angle, because an angle has no size —
 * only a shape. A forty-degree angle is drawn at forty degrees, which is what
 * makes "is this acute or obtuse?" a question about the paper rather than about
 * the caption. Its arms are all one length for the same reason.
 */
import type { Figure, Mil, Point } from "./types";

import { inches, points } from "./paper";

/**
 * The square every figure is drawn to fit inside.
 *
 * One box for all of them, because the row height is one number for the whole
 * grid: a page whose figures were sized individually would be a page whose
 * tallest figure decides the reservation and whose shortest wastes it.
 */
const FIGURE: Mil = inches(1.1);

/**
 * Room round a figure for its labels, in ems of the sheet's own body size.
 *
 * A label sits half its own width past the edge it names, so the margin has to
 * grow with the type or `6 cm` loses its `m` off the side of the box. In ems
 * rather than inches for that reason and no other — the drawing does not scale
 * with the type, and this is not part of the drawing.
 */
const LABEL_PAD_EM = 2.2;

export const labelPad = (fontPt: number): Mil =>
  Math.round(points(fontPt) * LABEL_PAD_EM);

/* ── How much room it takes ────────────────────────────────────────────── */

export type Bounds = { minX: Mil; minY: Mil; maxX: Mil; maxY: Mil };

/** The corners of the square a circle is inscribed in. */
function circleCorners([centre, edge]: Point[]): Point[] {
  if (!centre) return [];
  const radius = radiusOf(centre, edge);
  return [
    { x: centre.x - radius, y: centre.y - radius },
    { x: centre.x + radius, y: centre.y + radius },
  ];
}

export const radiusOf = (centre: Point, edge?: Point): Mil =>
  edge ? Math.round(Math.hypot(edge.x - centre.x, edge.y - centre.y)) : 0;

/**
 * How far a figure actually reaches, which is not always where its points are:
 * a circle reaches a radius past its centre in every direction, so sizing one by
 * its two points alone clips the bottom half off.
 */
export function figureBounds(figure: Figure): Bounds {
  const corners =
    figure.shape === "circle" ? circleCorners(figure.points) : figure.points;
  if (corners.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

/** How much room the drawing takes on the page, labels and all. */
export function figureBox(
  figure: Figure,
  fontPt: number,
): { width: Mil; height: Mil } {
  const box = figureBounds(figure);
  const pad = labelPad(fontPt) * 2;
  return {
    width: box.maxX - box.minX + pad,
    height: box.maxY - box.minY + pad,
  };
}

/**
 * The tallest a figure from this module can stand, labels and all — what a
 * family reserves a row against.
 *
 * The box rather than the figure, because every constructor below fits inside
 * it and the reservation is one number for a grid of them.
 */
export const figureRow = (fontPt: number): Mil => FIGURE + labelPad(fontPt) * 2;

/* ── Drawing one ───────────────────────────────────────────────────────── */

/** `value` scaled so that `of` fills the box. */
const fit = (value: number, of: number): Mil =>
  of <= 0 ? 0 : Math.round((value * FIGURE) / of);

/**
 * A rectangle `across` by `down`, in proportion.
 *
 * The points run clockwise from the top-left corner, so the labels a caller
 * gives are the top edge and then the right one — the two a rectangle is
 * labelled on. The other two are the same lengths, and a sheet that printed all
 * four would be telling a child the answer to half the question.
 */
export function rectangleFigure(
  across: number,
  down: number,
  labels?: string[],
): Figure {
  const of = Math.max(across, down);
  const width = fit(across, of);
  const height = fit(down, of);
  return {
    shape: "rectangle",
    points: [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ],
    ...(labels ? { labels } : {}),
  };
}

/**
 * A right-angled triangle standing on its base, with the upright on the left.
 *
 * The right angle is where the base and the height meet, which is what makes
 * "half the base times the height" a thing a child can see rather than a formula
 * they recite. The points start at the bottom-left corner, so the labels are the
 * base, then the sloping side, then the height.
 */
export function rightTriangleFigure(
  base: number,
  height: number,
  labels?: string[],
): Figure {
  const of = Math.max(base, height);
  const across = fit(base, of);
  const down = fit(height, of);
  return {
    shape: "triangle",
    points: [
      { x: 0, y: down },
      { x: across, y: down },
      { x: 0, y: 0 },
    ],
    ...(labels ? { labels } : {}),
  };
}

const RADIANS = Math.PI / 180;

/** Where a point sits on the box's circle, measured clockwise from straight up. */
function around(degrees: number, radius: Mil): Point {
  const middle = Math.round(FIGURE / 2);
  return {
    x: middle + Math.round(radius * Math.sin(degrees * RADIANS)),
    y: middle - Math.round(radius * Math.cos(degrees * RADIANS)),
  };
}

/**
 * A regular polygon with `sides` sides, its corners on the box's circle.
 *
 * Turned by half a step when the count is even, which is the difference between
 * a square and a diamond: an even polygon started at the top has a corner at the
 * bottom, and a child asked to name a square standing on its point has been
 * asked a harder question than the sheet meant to ask.
 */
export function polygonFigure(sides: number): Figure {
  const count = Math.max(3, Math.round(sides));
  const step = 360 / count;
  const start = count % 2 === 0 ? step / 2 : 0;
  return {
    shape: count === 3 ? "triangle" : count === 4 ? "rectangle" : "polygon",
    points: Array.from({ length: count }, (_, index) =>
      around(start + index * step, Math.round(FIGURE / 2)),
    ),
  };
}

/**
 * A circle: where its centre is, and one point on it.
 *
 * Two points rather than a centre and a radius, because a radius stored beside
 * the points is a number that can disagree with them — and every other shape in
 * the union is already a list of points.
 */
export function circleFigure(labels?: string[]): Figure {
  const middle = Math.round(FIGURE / 2);
  return {
    shape: "circle",
    points: [
      { x: middle, y: middle },
      { x: FIGURE, y: middle },
    ],
    ...(labels ? { labels } : {}),
  };
}

/**
 * An angle of `degrees`, turned `from` degrees round.
 *
 * Three points — the end of one arm, the vertex, the end of the other — in the
 * order the angle is measured, which is what lets a renderer mark the arc
 * without a fourth number telling it which side to mark. Anticlockwise on paper,
 * because that is the direction degrees are counted in.
 *
 * `from` is what stops a page of angles all sitting on a horizontal arm. An
 * angle turned round is the same angle, and a child who can only recognise a
 * right angle in one orientation cannot recognise a right angle.
 */
export function angleFigure(degrees: number, from = 0): Figure {
  const arm = Math.round(FIGURE / 2);
  const middle = Math.round(FIGURE / 2);
  const end = (at: number): Point => ({
    x: middle + Math.round(arm * Math.cos(at * RADIANS)),
    y: middle - Math.round(arm * Math.sin(at * RADIANS)),
  });
  return {
    shape: "angle",
    points: [end(from), { x: middle, y: middle }, end(from + degrees)],
  };
}
