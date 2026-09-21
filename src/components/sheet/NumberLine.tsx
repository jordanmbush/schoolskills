/**
 * A number line, as strokes.
 *
 * Drawn under a problem so a child can count along it, which is how addition
 * starts before it is a fact: 6 + 3 is six hops and then three more. Strokes
 * rather than a background, because background paint is what a browser drops
 * when printing (§5).
 *
 * Where the ticks go is the engine's answer, not this component's, and so are
 * the inset at each end and the size of a label — two of the three numbers it
 * chose the tick spacing with. A second copy of either would be a line whose
 * labels overlap on paper while the engine's own test says they cannot. All
 * that happens here is the scaling from the numbers on the line to the mil the
 * viewBox counts in.
 */
import {
  LABEL_SIZE,
  LINE_INSET,
  NUMBER_LINE_HEIGHT,
  jumps,
  lineHeight,
  ticks,
} from "@/engine/sheets/numberline";
import type { NumberLine } from "@/engine/sheets/types";

import { RULE, inch } from "./units";

/**
 * The axis, and how far the ticks stand out either side of it. Measured from
 * the top of a plain line; a line with hops on it stands `JUMP_ROOM` taller
 * and everything below moves down by the difference, so the hops have the
 * room above the axis and the ticks keep exactly the drawing they had.
 */
const AXIS = 120;
const TICK = 32;

/**
 * How high a hop's arc rises over the axis, and how far its label's baseline
 * sits over that. The label's top then lands inside `JUMP_ROOM`, which is
 * what the engine reserved.
 */
const RISE = 150;
const LABEL_LIFT = 25;
/** The arrowhead where a hop lands: this tall, and this wide at the base. */
const HEAD = { tall: 55, wide: 30 };

/**
 * How far a tick with no number under it stands out, as a share of one that
 * has.
 *
 * A line marked every 1 from 0 to 100 cannot carry a hundred and one numerals,
 * so the engine thins them out (`labelEvery`) — and a tick with nothing under
 * it has to read as a tick rather than as a shorter version of the same thing.
 * Two thirds is the ratio a ruler uses, and it is what makes counting between
 * two labelled ticks possible at all.
 *
 * On a line under a sum this never applies: `label` is absent there, every tick
 * keeps its number, and every tick is full length.
 */
const MINOR = 2 / 3;

/** The labels' baseline. */
const LABEL = 290;

export function NumberLineView({ line }: { line: NumberLine }) {
  const marks = ticks(line);
  const span = line.to - line.from;
  if (marks.length < 2 || span <= 0 || line.width <= 0) return null;

  const usable = Math.max(0, line.width - LINE_INSET * 2);
  const at = (value: number) =>
    Math.round(LINE_INSET + ((value - line.from) / span) * usable);

  // Which ticks keep their number is the engine's answer as well: every one of
  // them under a sum, and as many as fit on a reference line.
  const every = Math.max(1, line.label ?? 1);
  const minor = Math.round(TICK * MINOR);
  const height = lineHeight(line);
  const down = height - NUMBER_LINE_HEIGHT;
  const axis = AXIS + down;
  const hops = jumps(line);

  return (
    <svg
      className="sheet__ink sheet__number-line"
      width={inch(line.width)}
      height={inch(height)}
      viewBox={`0 0 ${line.width} ${height}`}
    >
      {/* Named rather than `role="img"` + `aria-label`, the same call `Grid`
          makes: the numbers along it are readable content, and collapsing
          them into one sentence would throw them away. */}
      <title>{`Number line from ${line.from} to ${line.to}`}</title>

      <line
        className="sheet__rule sheet__rule--axis"
        x1={LINE_INSET}
        x2={line.width - LINE_INSET}
        y1={axis}
        y2={axis}
        strokeWidth={RULE}
      />
      {marks.map((value, index) => {
        const numbered = index % every === 0;
        const out = numbered ? TICK : minor;
        return (
          <g key={value}>
            <line
              className="sheet__rule"
              x1={at(value)}
              x2={at(value)}
              y1={axis - out}
              y2={axis + out}
              strokeWidth={RULE}
            />
            {numbered && (
              <text
                className="sheet__tick"
                x={at(value)}
                y={LABEL + down}
                fontSize={LABEL_SIZE}
                textAnchor="middle"
              >
                {value}
              </text>
            )}
          </g>
        );
      })}
      {hops.map((hop) => {
        const from = at(hop.from);
        const to = at(hop.to);
        const middle = Math.round((from + to) / 2);
        return (
          <g className="sheet__jump" key={hop.from}>
            {/* A quadratic curve's apex is half the control point's height, so
                the control sits twice `RISE` up to put the top of the arc
                where the label expects it. */}
            <path
              className="sheet__rule"
              d={`M ${from} ${axis} Q ${middle} ${axis - 2 * RISE} ${to} ${axis}`}
              strokeWidth={RULE}
            />
            <path
              className="sheet__dot"
              d={`M ${to} ${axis} l ${-HEAD.wide} ${-HEAD.tall} l ${2 * HEAD.wide} 0 z`}
            />
            <text
              className="sheet__tick"
              x={middle}
              y={axis - RISE - LABEL_LIFT}
              fontSize={LABEL_SIZE}
              textAnchor="middle"
            >
              {`−${hop.from - hop.to}`}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
