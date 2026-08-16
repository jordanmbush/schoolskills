import { points } from "@/engine/sheets/paper";

import { HAIRLINE, inch } from "../units";
import type { BlockProps } from "./block";

/** A row is two lines of type tall: room to draw between, and to write in. */
const ROW_TO_EM = 2.4;
/** Big enough for a five-year-old with a pencil to aim a line at. */
const DOT = points(1.6);
/** How far in from each edge the dots sit, as a share of the block width. */
const LEFT_DOT = 0.44;
const RIGHT_DOT = 0.56;

/**
 * Two columns to join with a pencil.
 *
 * The dots are what the child aims at, so they are drawn rather than typed —
 * a middle dot in a font sits at a height that depends on the face. On the key
 * the pairing is a stroke from dot to dot, which is what a marked matching
 * exercise looks like and what a parent checks against.
 */
export function Matching({ block, metrics }: BlockProps<"matching">) {
  const rows = Math.max(block.left.length, block.right.length);
  if (rows === 0) return null;

  const width = metrics.box.width;
  const size = points(metrics.fontPt);
  const row = Math.round(size * ROW_TO_EM);
  const height = rows * row;
  const leftX = Math.round(width * LEFT_DOT);
  const rightX = Math.round(width * RIGHT_DOT);
  const middle = (index: number) => Math.round((index + 0.5) * row);

  return (
    <svg
      className="sheet__ink"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Join each item on the left to its pair on the right"
    >
      {block.left.map((text, index) => (
        <g key={`l${index}-${text}`}>
          <text
            className="sheet__cell sheet__cell--start"
            x={0}
            y={middle(index)}
            fontSize={size}
            dominantBaseline="central"
          >
            {text}
          </text>
          <circle
            className="sheet__dot"
            cx={leftX}
            cy={middle(index)}
            r={DOT}
          />
        </g>
      ))}

      {block.right.map((text, index) => (
        <g key={`r${index}-${text}`}>
          <circle
            className="sheet__dot"
            cx={rightX}
            cy={middle(index)}
            r={DOT}
          />
          <text
            className="sheet__cell sheet__cell--end"
            x={width}
            y={middle(index)}
            fontSize={size}
            textAnchor="end"
            dominantBaseline="central"
          >
            {text}
          </text>
        </g>
      ))}

      {metrics.answers &&
        block.answer.map((right, left) => (
          <line
            key={`a${left}-${right}`}
            className="sheet__rule sheet__rule--joined"
            x1={leftX}
            y1={middle(left)}
            x2={rightX}
            y2={middle(right)}
            strokeWidth={HAIRLINE}
          />
        ))}
    </svg>
  );
}
