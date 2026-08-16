import { points } from "@/engine/sheets/paper";
import type { Figure, Mil } from "@/engine/sheets/types";

import { HAIRLINE, RULE, inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Room around a figure for its labels, in ems of the sheet's own body size —
 * a label sits half its own width past the edge it names, so the margin has to
 * grow with the type or `6 cm` loses its `m` off the side of the box.
 */
const PAD_TO_EM = 2.2;

/**
 * Figures to measure, name or shade.
 *
 * Each one is drawn in its own coordinate space — the engine gives points in
 * mil within the figure's own box — so a row of shapes is a row of small
 * `<svg>` elements rather than one large one with the arithmetic to place them.
 * That is also what lets a figure keep its shape when the row wraps.
 */
export function Shapes({ block, metrics }: BlockProps<"shapes">) {
  return (
    <div className="sheet__figures">
      {block.figures.map((figure, index) => (
        <Drawn
          key={index}
          figure={figure}
          size={points(metrics.fontPt)}
          index={index}
        />
      ))}
    </div>
  );
}

function Drawn({
  figure,
  size,
  index,
}: {
  figure: Figure;
  size: Mil;
  index: number;
}) {
  const corners = figure.points;
  if (corners.length === 0) return null;

  // The box is measured from the drawing rather than from the points: a circle
  // reaches a radius past its centre in every direction, so sizing it by its
  // two points alone clips the bottom half off.
  const box = boundsOf(figure);
  const pad = Math.round(size * PAD_TO_EM);
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
      <title>{`Figure ${index + 1}: a ${figure.shape}`}</title>

      {figure.shape === "circle" ? (
        <Circle points={corners.map(shift)} />
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
          read through. */}
      {figure.labels?.map((text, edge) => {
        const from = corners[edge];
        const to = corners[(edge + 1) % corners.length];
        if (!from || !to) return null;
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

type Point = { x: Mil; y: Mil };

/** How far a figure actually reaches, which is not always where its points are. */
function boundsOf(figure: Figure): {
  minX: Mil;
  minY: Mil;
  maxX: Mil;
  maxY: Mil;
} {
  const corners =
    figure.shape === "circle" ? circleCorners(figure.points) : figure.points;
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

/** The corners of the square a circle is inscribed in. */
function circleCorners([centre, edge]: Point[]): Point[] {
  if (!centre) return [];
  const radius = radiusOf(centre, edge);
  return [
    { x: centre.x - radius, y: centre.y - radius },
    { x: centre.x + radius, y: centre.y + radius },
  ];
}

const radiusOf = (centre: Point, edge?: Point): Mil =>
  edge ? Math.round(Math.hypot(edge.x - centre.x, edge.y - centre.y)) : 0;

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
 * A circle is two points: where its centre is, and one point on it. Storing a
 * radius separately would let a figure disagree with itself, and every other
 * shape in the union is already a list of points.
 */
function Circle({ points: [centre, edge] }: { points: Point[] }) {
  if (!centre) return null;
  const radius = radiusOf(centre, edge);
  return (
    <>
      <circle
        className="sheet__shape"
        cx={centre.x}
        cy={centre.y}
        r={radius}
        strokeWidth={RULE}
      />
      {edge && (
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
