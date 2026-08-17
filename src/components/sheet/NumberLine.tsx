/**
 * A number line, as strokes.
 *
 * Drawn under a problem so a child can count along it, which is how addition
 * starts before it is a fact: 6 + 3 is six hops and then three more. Strokes
 * rather than a background for the same reason every ruled thing on a sheet is
 * (§5) — browsers drop background paint when printing, and a counting aid that
 * comes out of the printer blank is worse than none.
 *
 * Where the ticks go is the engine's answer, not this component's. All that
 * happens here is the scaling from the numbers on the line to the mil the
 * viewBox counts in.
 */
import { NUMBER_LINE_HEIGHT, ticks } from "@/engine/sheets/numberline";
import type { NumberLine } from "@/engine/sheets/types";

import { RULE, inch } from "./units";

/**
 * Room at each end for the outermost label, which is centred on its tick and
 * would otherwise be cut in half by the edge of the drawing. Enough for three
 * digits at the size below.
 */
const INSET = 140;

/** The axis, and how far the ticks stand out either side of it. */
const AXIS = 120;
const TICK = 32;

/** The labels: their baseline, and the size they are set at (about 9pt). */
const LABEL = 290;
const LABEL_SIZE = 125;

export function NumberLineView({ line }: { line: NumberLine }) {
  const marks = ticks(line);
  const span = line.to - line.from;
  if (marks.length < 2 || span <= 0 || line.width <= 0) return null;

  const usable = Math.max(0, line.width - INSET * 2);
  const at = (value: number) =>
    Math.round(INSET + ((value - line.from) / span) * usable);

  return (
    <svg
      className="sheet__ink sheet__number-line"
      width={inch(line.width)}
      height={inch(NUMBER_LINE_HEIGHT)}
      viewBox={`0 0 ${line.width} ${NUMBER_LINE_HEIGHT}`}
    >
      {/* Named rather than `role="img"` + `aria-label`, the same call `Grid`
          makes: the numbers along it are readable content, and collapsing
          them into one sentence would throw them away. */}
      <title>{`Number line from ${line.from} to ${line.to}`}</title>

      <line
        className="sheet__rule sheet__rule--axis"
        x1={INSET}
        x2={line.width - INSET}
        y1={AXIS}
        y2={AXIS}
        strokeWidth={RULE}
      />
      {marks.map((value) => (
        <g key={value}>
          <line
            className="sheet__rule"
            x1={at(value)}
            x2={at(value)}
            y1={AXIS - TICK}
            y2={AXIS + TICK}
            strokeWidth={RULE}
          />
          <text
            className="sheet__tick"
            x={at(value)}
            y={LABEL}
            fontSize={LABEL_SIZE}
            textAnchor="middle"
          >
            {value}
          </text>
        </g>
      ))}
    </svg>
  );
}
