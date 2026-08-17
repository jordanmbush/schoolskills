/**
 * A shape, as strokes.
 *
 * Every figure is drawn in its own coordinate space — the engine gives points in
 * mil within the figure's own box — so a row of shapes is a row of small `<svg>`
 * elements rather than one large one with the arithmetic to place them. That is
 * also what lets a figure keep its shape when the row wraps.
 *
 * Nothing here decides how big anything is. The points come from `figure.ts`,
 * which is the same module the family reserved the row height with, and this
 * file only puts ink on them: a closed outline, a circle, or the two open arms
 * of an angle. A renderer that scaled a shape to fit would be a renderer that
 * can disagree with the labels on it, and a rectangle drawn 8 by 4 and labelled
 * 8 by 3 teaches a child not to trust the picture.
 */
import { figureBounds, labelPad, radiusOf } from "@/engine/sheets/figure";
import { points } from "@/engine/sheets/paper";
import type { Figure, Mil, Point } from "@/engine/sheets/types";

import { HAIRLINE, RULE, inch } from "./units";

/** How far the arc that marks an angle sits from the vertex. */
const ARC = 0.3;

export function FigureView({
  figure,
  fontPt,
}: {
  figure: Figure;
  /** The body size, which is what the room for the labels is measured in. */
  fontPt: number;
}) {
  const corners = figure.points;
  if (corners.length === 0) return null;

  // The box is measured from the drawing rather than from the points: a circle
  // reaches a radius past its centre in every direction, so sizing it by its
  // two points alone clips the bottom half off.
  const box = figureBounds(figure);
  const pad = labelPad(fontPt);
  const size = points(fontPt);
  const width = box.maxX - box.minX + pad * 2;
  const height = box.maxY - box.minY + pad * 2;
  const shift = (point: Point): Point => ({
    x: point.x - box.minX + pad,
    y: point.y - box.minY + pad,
  });

  return (
    <svg
      className="sheet__ink sheet__figure"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* A `<title>` rather than `role="img"`: the side labels below are the
          measurements the question is about, and `role="img"` would hide
          "8 cm" behind "a rectangle". */}
      <title>{named(figure)}</title>

      {figure.shape === "circle" ? (
        <Circle points={corners.map(shift)} radius={hasLabel(figure, 0)} />
      ) : figure.shape === "angle" ? (
        <Angle points={corners.map(shift)} />
      ) : (
        <polygon
          className="sheet__shape"
          strokeWidth={RULE}
          points={corners
            .map(shift)
            .map((point) => `${point.x},${point.y}`)
            .join(" ")}
        />
      )}

      {/* A side label sits just outside the midpoint of the edge that starts
          at the point of the same index — which is why `labels` is documented
          as being in the order the points are given. Outside, because a `6 cm`
          printed on top of the line it measures is a line a child then has to
          read through. An empty label is an edge with nothing to say. */}
      {figure.labels?.map((text, edge) => {
        const from = corners[edge];
        const to = corners[(edge + 1) % corners.length];
        if (!from || !to || text === "") return null;
        const middle = shift(
          away(
            {
              x: Math.round((from.x + to.x) / 2),
              y: Math.round((from.y + to.y) / 2),
            },
            centreOf(corners),
            Math.round(size * 0.75),
          ),
        );
        return (
          <text
            key={`${edge}-${text}`}
            className="sheet__cell"
            x={middle.x}
            y={middle.y}
            fontSize={size}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {text}
          </text>
        );
      })}
    </svg>
  );
}

/** What the drawing is, for a reader who cannot see it. */
function named(figure: Figure): string {
  return `${/^[aeiou]/.test(figure.shape) ? "An" : "A"} ${figure.shape}`;
}

const hasLabel = (figure: Figure, edge: number): boolean =>
  (figure.labels?.[edge] ?? "") !== "";

/** The average of a figure's corners — near enough its middle to push away from. */
function centreOf(corners: Point[]): Point {
  const total = corners.reduce(
    (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
    { x: 0, y: 0 },
  );
  return {
    x: Math.round(total.x / corners.length),
    y: Math.round(total.y / corners.length),
  };
}

/** `point`, moved `by` further from `centre`. */
function away(point: Point, centre: Point, by: Mil): Point {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  const span = Math.hypot(dx, dy);
  if (span === 0) return point;
  return {
    x: Math.round(point.x + (dx / span) * by),
    y: Math.round(point.y + (dy / span) * by),
  };
}

/**
 * A circle is two points: where its centre is, and one point on it.
 *
 * The radius is drawn only when it is being labelled. An unlabelled circle is
 * just a circle, and a line across the middle of it is a line a child has to
 * decide to ignore.
 */
function Circle({
  points: [centre, edge],
  radius,
}: {
  points: Point[];
  radius: boolean;
}) {
  if (!centre) return null;
  return (
    <>
      <circle
        className="sheet__shape"
        cx={centre.x}
        cy={centre.y}
        r={radiusOf(centre, edge)}
        strokeWidth={RULE}
      />
      {edge && radius && (
        <line
          className="sheet__rule"
          x1={centre.x}
          y1={centre.y}
          x2={edge.x}
          y2={edge.y}
          strokeWidth={HAIRLINE}
        />
      )}
    </>
  );
}

/**
 * An angle: two arms from a vertex, and an arc across the corner between them.
 *
 * The arms are open rather than closed, because an angle is not a shape — a
 * triangle drawn where an angle was meant is a different question. The arc is
 * what says *which* of the two angles the arms make is being asked about, and it
 * always takes the smaller one: see the note in `geometry.ts` on why a reflex
 * angle is not on these sheets.
 */
function Angle({ points: [first, vertex, second] }: { points: Point[] }) {
  if (!first || !vertex || !second) return null;
  const at = Math.round(
    Math.min(radiusOf(vertex, first), radiusOf(vertex, second)) * ARC,
  );
  const from = along(vertex, first, at);
  const to = along(vertex, second, at);
  // Which way round the arc is swept, from the sign of the cross product of the
  // two arms. Without it the arc takes the long way round on half of the
  // angles, and marks the one the sheet did not ask about.
  const cross =
    (first.x - vertex.x) * (second.y - vertex.y) -
    (first.y - vertex.y) * (second.x - vertex.x);

  return (
    <>
      <polyline
        className="sheet__shape"
        strokeWidth={RULE}
        points={[first, vertex, second]
          .map((point) => `${point.x},${point.y}`)
          .join(" ")}
      />
      <path
        className="sheet__rule"
        strokeWidth={HAIRLINE}
        fill="none"
        d={`M ${from.x} ${from.y} A ${at} ${at} 0 0 ${cross > 0 ? 1 : 0} ${to.x} ${to.y}`}
      />
    </>
  );
}

/** The point `by` along the way from `centre` towards `edge`. */
function along(centre: Point, edge: Point, by: Mil): Point {
  const span = Math.hypot(edge.x - centre.x, edge.y - centre.y);
  if (span === 0) return centre;
  return {
    x: Math.round(centre.x + ((edge.x - centre.x) / span) * by),
    y: Math.round(centre.y + ((edge.y - centre.y) / span) * by),
  };
}
