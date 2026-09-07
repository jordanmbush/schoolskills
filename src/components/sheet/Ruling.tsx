/**
 * A ruling, as strokes.
 *
 * Every ruled thing on a sheet goes through here: lined paper, the band a
 * tracing row sits on, the ground under a line of copywork. It returns a `<g>`
 * rather than an `<svg>` on purpose — a trace row draws its letterforms into
 * the same coordinate system as the rules they sit on, and two elements can't
 * share one.
 *
 * **Strokes, never a background** (§5). Browsers drop `background-image` when
 * printing unless the reader has ticked "Background graphics", so ruled paper
 * drawn with `repeating-linear-gradient` looks perfect on screen and comes out
 * of the printer blank. Strokes are foreground paint and always print.
 *
 * Coordinates are mil, matching the viewBox its caller sets up.
 */
import { ruledLines, type Box } from "@/engine/sheets/layout";
import { gridPitch, rulePitch, rulingOf } from "@/engine/sheets/paper";
import type { Mil, Rule } from "@/engine/sheets/types";

import { DASH_MIDLINE, HAIRLINE, RULE } from "./units";

/** How tall `sets` repeats of a ruling stand. Zero for blank paper. */
export function ruledHeight(rule: Rule, sets: number): Mil {
  return Math.max(0, sets) * rulePitch(rule);
}

type Props = {
  rule: Rule;
  /** Where the block sits on the paper. `x` places the margin line. */
  box: Box;
  /** How many repeats to draw. */
  sets: number;
  /**
   * Draw the notebook margin line, where the ruling has one. Only lined paper
   * asks for it: the same ruling under a line of copywork is ground for text
   * that starts at the left edge, and a margin line there runs through the
   * first word of every line.
   */
  marginLine?: boolean;
};

export function Ruling({ rule, box, sets, marginLine = false }: Props) {
  const ruling = rulingOf(rule);
  if (sets <= 0 || rulePitch(rule) <= 0) return null;
  return ruling.grid ? (
    <GridRuling rule={rule} box={box} sets={sets} />
  ) : (
    <LinedRuling rule={rule} box={box} sets={sets} marginLine={marginLine} />
  );
}

/**
 * Handwriting and notebook rules: horizontal strokes down the page.
 *
 * The y positions come from the engine rather than from a loop here, because
 * where the lines sit inside a repeat is geometry (`ruleLines`) and how many
 * repeats fit is arithmetic (`ruledLines`) — both of which a unit test can
 * check without a browser, and neither of which a renderer should be deciding.
 */
function LinedRuling({ rule, box, sets, marginLine }: Props) {
  const height = ruledHeight(rule, sets);
  const lines = ruledLines({ x: 0, y: 0, width: box.width, height }, rule);
  const ruling = rulingOf(rule);

  // 1.25in from the edge of the paper, so it lands in the same place as the
  // one on a notebook the child already owns. Black rather than the printed
  // red, because the default sheet is black on white and nobody should pay
  // for a colour cartridge to get lined paper.
  const margin =
    !marginLine || ruling.marginLine === undefined
      ? null
      : ruling.marginLine - box.x;
  const showMargin = margin !== null && margin > 0 && margin < box.width;

  return (
    <g className="sheet__ruling">
      {lines.map((line) => (
        <line
          key={`${line.y}-${line.role}`}
          className={`sheet__rule sheet__rule--${line.role}`}
          x1={0}
          x2={box.width}
          y1={line.y}
          y2={line.y}
          strokeWidth={RULE}
          strokeDasharray={line.dashed ? DASH_MIDLINE : undefined}
        />
      ))}
      {showMargin && (
        <line
          className="sheet__rule sheet__rule--margin"
          x1={margin}
          x2={margin}
          y1={0}
          y2={height}
          strokeWidth={RULE}
        />
      )}
    </g>
  );
}

/**
 * Graph, dot and isometric: a ruling that repeats across the page as well as
 * down it.
 *
 * The dot grid is drawn as dashed lines rather than as a few thousand
 * `<circle>` elements — a zero-length dash with a round cap *is* a dot, which
 * is the same trick CSS's `dotted` border plays. One `<line>` per row instead
 * of one element per intersection, and the two print identically.
 */
function GridRuling({ rule, box, sets }: Props) {
  const down = rulePitch(rule);
  const across = gridPitch(rule);
  const height = ruledHeight(rule, sets);
  if (across <= 0) return null;

  if (rule.style === "isometric") {
    return <Isometric width={box.width} rows={sets} row={down} side={across} />;
  }

  const rows = range(sets + 1, (row) => row * down);
  const columns = range(Math.floor(box.width / across) + 1, (i) => i * across);
  const dotted = rule.style === "dot";
  return (
    <g className="sheet__ruling sheet__ruling--grid">
      {rows.map((y) => (
        <line
          key={`r${y}`}
          className="sheet__rule sheet__rule--grid"
          x1={0}
          x2={box.width}
          y1={y}
          y2={y}
          strokeWidth={dotted ? HAIRLINE * 2 : HAIRLINE}
          strokeLinecap={dotted ? "round" : undefined}
          strokeDasharray={dotted ? `0 ${across}` : undefined}
        />
      ))}
      {!dotted &&
        columns.map((x) => (
          <line
            key={`c${x}`}
            className="sheet__rule sheet__rule--grid"
            x1={x}
            x2={x}
            y1={0}
            y2={height}
            strokeWidth={HAIRLINE}
          />
        ))}
    </g>
  );
}

/**
 * Equilateral triangles: three families of strokes at 0° and ±60°.
 *
 * The diagonals run off both sides of the box by half a side per row, which is
 * why they start left of zero — an `<svg>` clips to its own viewport, so the
 * overhang costs nothing and the grid reaches the edges instead of stopping
 * short of them.
 */
function Isometric({
  width,
  rows,
  row,
  side,
}: {
  width: Mil;
  /** Triangle rows. */
  rows: number;
  /** The height of one row — a triangle's altitude, already in `rulePitch`. */
  row: Mil;
  /** The triangle's side, which is the pitch across the page. */
  side: Mil;
}) {
  const height = rows * row;
  const run = Math.round((rows * side) / 2);
  const starts = range(Math.floor((width + 2 * run) / side) + 1, (i) =>
    Math.round(i * side - run),
  );

  return (
    <g className="sheet__ruling sheet__ruling--grid">
      {range(rows + 1, (index) => index * row).map((y) => (
        <line
          key={`h${y}`}
          className="sheet__rule sheet__rule--grid"
          x1={0}
          x2={width}
          y1={y}
          y2={y}
          strokeWidth={HAIRLINE}
        />
      ))}
      {starts.map((x) => (
        <g key={`d${x}`}>
          <line
            className="sheet__rule sheet__rule--grid"
            x1={x}
            x2={x + run}
            y1={0}
            y2={height}
            strokeWidth={HAIRLINE}
          />
          <line
            className="sheet__rule sheet__rule--grid"
            x1={x}
            x2={x - run}
            y1={0}
            y2={height}
            strokeWidth={HAIRLINE}
          />
        </g>
      ))}
    </g>
  );
}

/** `n` values from an index. */
function range<T>(n: number, at: (index: number) => T): T[] {
  return Array.from({ length: Math.max(0, n) }, (_, index) => at(index));
}
