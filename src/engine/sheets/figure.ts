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
import type { Figure, Mil, Point, SheetFont } from "./types";

import { faceOf } from "./faces";
import { inches, points } from "./paper";

/**
 * The square every figure is drawn to fit inside.
 *
 * One box for all of them, because the row height is one number for the whole
 * grid: a page whose figures were sized individually would be a page whose
 * tallest figure decides the reservation and whose shortest wastes it.
 */
const FIGURE: Mil = inches(1.1);

/* ── Room for the labels ───────────────────────────────────────────────────
   All three in ems of the body size, because the drawing does not scale with
   the type and the words on it do.                                          */

/** The air between an edge and the nearest end of the label naming it. */
const GAP_EM = 0.4;
/** Half a line of type, ink and all — how far a label reaches from its middle. */
const LINE_EM = 0.5;
/** Enough that the outline's own stroke is inside the box rather than on it. */
const EDGE_EM = 0.1;

/**
 * The tallest a label can make a figure: the gap, then the line it stands in.
 *
 * Height only. How much room a label needs *beside* a shape is its own width,
 * which is a different number for every one of them and is worked out per
 * figure in `figureInk` — a single pad for both directions is what printed
 * `12 m` through the side of the rectangle it measured, because there was room
 * for the words and it was above the shape.
 */
const edgePad = (fontPt: number): Mil =>
  Math.round(points(fontPt) * (GAP_EM + LINE_EM * 2 + EDGE_EM));

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
  font?: SheetFont,
): { width: Mil; height: Mil } {
  const { width, height } = figureInk(figure, fontPt, font);
  return { width, height };
}

/**
 * The tallest a figure from this module can stand, labels and all — what a
 * family reserves a row against.
 *
 * The box rather than the figure, because every constructor below fits inside
 * it and the reservation is one number for a grid of them. Height only, and it
 * is the same number whatever a figure is labelled with — a label above a shape
 * takes a line whether it reads `4 m` or `120 cm`, and a label beside one takes
 * no height at all.
 */
export const figureRow = (fontPt: number): Mil => FIGURE + edgePad(fontPt) * 2;

/* ── Where the labels go ───────────────────────────────────────────────────
   In the engine with the shape rather than in the renderer, for the reason at
   the head of this file: a placement a browser worked out is a placement no
   unit test can check.                                                       */

/**
 * How wide a measurement will be set — declared, not measured, the same bargain
 * every other length on a sheet is struck on (§4). There is no DOM at build
 * time to ask how wide `12 cm` came out.
 *
 * Exported because it is the only thing standing between a label and the edge
 * of its own box: the box is sized from this, so a test that wants to know a
 * label was not cut in half has to ask the same question the sizing did.
 */
export const labelWidth = (
  text: string,
  fontPt: number,
  font?: SheetFont,
): Mil => Math.round(text.length * points(fontPt) * faceOf(font).advance);

/** One measurement, ready to set: where it goes and which end of it that is. */
export type LabelInk = {
  text: string;
  x: Mil;
  y: Mil;
  /** Which end of the words sits on `x`, so the gap stays a gap. */
  anchor: "start" | "middle" | "end";
};

/** A figure and its labels, in a box that holds both. */
export type FigureInk = {
  width: Mil;
  height: Mil;
  /** How far the figure's own points move to sit inside that box. */
  offset: Point;
  labels: LabelInk[];
};

/**
 * A figure's drawing and its labels, placed.
 *
 * Each label goes outside the edge it names — a `6 cm` printed on the line it
 * measures is a line a child then has to read through — and **which way out is
 * decided by the edge, not by the corner it sits nearest**. A tall thin
 * triangle's upright is closer to the top of the figure than to the side of it,
 * so pushing a label away from the middle of the shape put `9 m` back across
 * the very line it was measuring. An edge that runs down the page is labelled
 * beside it; one that runs across is labelled above or below.
 *
 * The box is then whatever holds the drawing and the words together, which is
 * why it is worked out here rather than reserved as a constant: `4 m` beside a
 * rectangle needs half the room `120 cm` does, and a figure padded for the
 * longest label anybody might ask for is a figure too wide to sit beside its
 * own question number.
 */
export function figureInk(
  figure: Figure,
  fontPt: number,
  font?: SheetFont,
): FigureInk {
  const size = points(fontPt);
  const gap = Math.round(size * GAP_EM);
  const line = Math.round(size * LINE_EM);
  const edge = Math.round(size * EDGE_EM);

  const bounds = figureBounds(figure);
  const corners = figure.points;
  const middle = centreOf(corners);
  const labels: LabelInk[] = [];
  const reach = { ...bounds };
  const hold = (minX: Mil, minY: Mil, maxX: Mil, maxY: Mil) => {
    reach.minX = Math.min(reach.minX, minX);
    reach.minY = Math.min(reach.minY, minY);
    reach.maxX = Math.max(reach.maxX, maxX);
    reach.maxY = Math.max(reach.maxY, maxY);
  };

  figure.labels?.forEach((text, index) => {
    const from = corners[index];
    const to = corners[(index + 1) % corners.length];
    if (!from || !to || text === "") return;
    const at = {
      x: Math.round((from.x + to.x) / 2),
      y: Math.round((from.y + to.y) / 2),
    };
    const width = labelWidth(text, fontPt, font);

    if (Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)) {
      const under = at.y >= middle.y;
      const y = at.y + (under ? gap + line : -(gap + line));
      labels.push({ text, x: at.x, y, anchor: "middle" });
      hold(at.x - width / 2, y - line, at.x + width / 2, y + line);
      return;
    }
    const right = at.x >= middle.x;
    const x = at.x + (right ? gap : -gap);
    labels.push({ text, x, y: at.y, anchor: right ? "start" : "end" });
    hold(
      right ? x : x - width,
      at.y - line,
      right ? x + width : x,
      at.y + line,
    );
  });

  const offset = { x: edge - reach.minX, y: edge - reach.minY };
  return {
    width: reach.maxX - reach.minX + edge * 2,
    height: reach.maxY - reach.minY + edge * 2,
    offset,
    labels: labels.map((label) => ({
      ...label,
      x: label.x + offset.x,
      y: label.y + offset.y,
    })),
  };
}

/** The average of a figure's corners — near enough its middle to push away from. */
function centreOf(corners: Point[]): Point {
  if (corners.length === 0) return { x: 0, y: 0 };
  const total = corners.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: Math.round(total.x / corners.length),
    y: Math.round(total.y / corners.length),
  };
}

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
