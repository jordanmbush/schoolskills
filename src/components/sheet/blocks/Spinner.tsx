import { points } from "@/engine/sheets/paper";
import type { Net as NetSpec } from "@/engine/sheets/types";

import { DASH_CUT, HAIRLINE, HEAVY, RULE, inch, inside } from "../units";

/** How far out from the middle a sector's label sits, as a share of the radius. */
const LABEL_AT = 0.62;

/**
 * A dial cut into equal sectors, and the pointer that turns on it.
 *
 * The sectors are a whole turn divided by how many there are, computed here and
 * nowhere else, which is what makes "is this fair?" answerable: there is no
 * per-sector angle on the block for a longer label to have talked its way into.
 *
 * Twelve o'clock is where the first sector starts, because that is where a
 * child reads a dial from, and the pointer is drawn below the dial to be cut
 * out and pinned through the middle of it.
 *
 * Both cut lines are held off the edge of the box they are drawn in — the dial
 * by taking half a stroke off its radius, the pointer through `inside`, whose
 * bottom vertex sits exactly on the bottom of the drawing. An `<svg>` clips to
 * its box, and half a cut line is one somebody follows with scissors anyway and
 * wonders why it is fainter than the circle above it.
 */
export function Spinner({
  net,
  fontPt,
}: {
  net: Extract<NetSpec, { shape: "spinner" }>;
  fontPt: number;
}) {
  const { radius, sectors, pointer } = net;
  if (radius <= 0 || sectors.length === 0) return null;

  const width = Math.max(2 * radius, pointer.length);
  const gap = Math.round(radius * 0.2);
  const height = 2 * radius + gap + pointer.width * 2;
  const middle = { x: width / 2, y: radius };
  const turn = (2 * Math.PI) / sectors.length;
  const on = (angle: number, at: number) => ({
    // Measured from twelve o'clock, clockwise, which is how a dial is read.
    x: middle.x + at * Math.sin(angle),
    y: middle.y - at * Math.cos(angle),
  });

  return (
    <svg
      className="sheet__ink sheet__net"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`A spinner cut into ${sectors.length} equal sectors, with a pointer to cut out`}
    >
      <circle
        className="sheet__rule sheet__rule--cut"
        cx={middle.x}
        cy={middle.y}
        r={radius - HEAVY / 2}
        strokeWidth={HEAVY}
        strokeDasharray={DASH_CUT}
      />
      {sectors.map((label, index) => {
        const spoke = on(index * turn, radius);
        const text = on((index + 0.5) * turn, radius * LABEL_AT);
        return (
          <g key={index}>
            <line
              className="sheet__rule"
              x1={middle.x}
              x2={spoke.x}
              y1={middle.y}
              y2={spoke.y}
              strokeWidth={RULE}
            />
            <text
              className="sheet__cell"
              x={text.x}
              y={text.y}
              fontSize={points(fontPt)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {label}
            </text>
          </g>
        );
      })}
      {/* Where the pin goes. A hairline circle rather than a filled dot, so it
          is a target to push through rather than a spot of ink to aim near. */}
      <circle
        className="sheet__rule"
        cx={middle.x}
        cy={middle.y}
        r={Math.max(1, Math.round(radius * 0.03))}
        strokeWidth={HAIRLINE}
      />
      <polygon
        className="sheet__rule sheet__rule--cut"
        points={[
          [middle.x - pointer.length / 2, 2 * radius + gap + pointer.width],
          [middle.x + pointer.length / 2 - pointer.width, 2 * radius + gap],
          [middle.x + pointer.length / 2, 2 * radius + gap + pointer.width],
          [
            middle.x + pointer.length / 2 - pointer.width,
            2 * radius + gap + pointer.width * 2,
          ],
        ]
          .map(
            ([x, y]) =>
              `${inside(x, width, HEAVY)},${inside(y, height, HEAVY)}`,
          )
          .join(" ")}
        strokeWidth={HEAVY}
        strokeDasharray={DASH_CUT}
      />
    </svg>
  );
}
