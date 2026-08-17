import { HAIRLINE, HEAVY, inch } from "../units";
import type { BlockProps } from "./block";

/** Numerals inside a square, at about half its height. */
const CELL_TO_EM = 0.5;

/**
 * A grid of squares: graph paper inside a box, a hundred chart, a coordinate
 * plane.
 *
 * Distinct from the `rules` block, which rules the *page*. This one has a
 * declared number of columns and rows and may have something printed in the
 * squares — a hundred chart is a grid with a hundred cells filled in and a
 * multiplication grid is the same shape with an axis.
 */
export function Grid({ block, metrics }: BlockProps<"grid">) {
  const { columns, rows, cells, answers, origin, kind } = block.grid;
  if (columns <= 0 || rows <= 0 || block.grid.cell <= 0) return null;

  // Clamped to what the content box actually holds. A grid wider than the box
  // is not cut off — `.sheet__ink { max-width: 100% }` rescales it — so a
  // declared quarter-inch square would print as something else, silently and
  // invisibly in the preview. Squares that measure what they say they measure
  // is the whole point of §4, so shrink the square rather than the drawing.
  const cell = Math.min(
    block.grid.cell,
    Math.floor(metrics.box.width / columns),
  );
  if (cell <= 0) return null;

  const width = columns * cell;
  const height = rows * cell;
  const size = Math.round(cell * CELL_TO_EM);

  return (
    <svg
      className="sheet__ink"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* A `<title>` rather than `role="img"` + `aria-label`: a hundred chart
          carries a hundred numbers in `<text>`, and `role="img"` would collapse
          all of them into this one sentence. The convention in this codebase is
          that `role="img"` is for a drawing whose label restates everything
          inside it (see `Ring` in ui/kit.tsx) — a numbered grid is the opposite
          case, so name it and leave its contents readable. */}
      <title>{`${columns} by ${rows} ${kind} grid`}</title>

      {count(columns + 1).map((column) => (
        <line
          key={`c${column}`}
          className="sheet__rule sheet__rule--grid"
          x1={column * cell}
          x2={column * cell}
          y1={0}
          y2={height}
          strokeWidth={HAIRLINE}
        />
      ))}
      {count(rows + 1).map((row) => (
        <line
          key={`r${row}`}
          className="sheet__rule sheet__rule--grid"
          x1={0}
          x2={width}
          y1={row * cell}
          y2={row * cell}
          strokeWidth={HAIRLINE}
        />
      ))}

      {/* Two heavier strokes through the ruling, where the grid says they
          cross — counted in squares, so they land on the ruling rather than
          near it. A coordinate plane's axes are the first use; a multiplication
          square's header rules are the second, and they are the same two lines
          drawn from the same number. Gated on the origin rather than on the
          kind, because a grid that named where they cross and then didn't get
          them would be a grid whose data said one thing and whose ink said
          another. */}
      {origin && (
        <g className="sheet__axes">
          <line
            x1={0}
            x2={width}
            y1={origin.row * cell}
            y2={origin.row * cell}
            className="sheet__rule sheet__rule--axis"
            strokeWidth={HEAVY}
          />
          <line
            x1={origin.column * cell}
            x2={origin.column * cell}
            y1={0}
            y2={height}
            className="sheet__rule sheet__rule--axis"
            strokeWidth={HEAVY}
          />
        </g>
      )}

      {/* Two lists over the same squares: what is printed whatever the sheet
          is, and what is printed only on a key. A multiplication square's
          headers are the first and its hundred and forty-four products are the
          second, so the blank grid and the wall chart are one build with
          `answers` flipped — the same mechanism as every ruled slot. */}
      {written(cells).map(([index, text]) => (
        <Cell key={`c${index}`} {...{ index, text, columns, cell, size }} />
      ))}
      {metrics.answers &&
        written(answers).map(([index, text]) => (
          <Cell
            key={`a${index}`}
            answered
            {...{ index, text, columns, cell, size }}
          />
        ))}
    </svg>
  );
}

/** The squares of a list that have something in them, with their positions. */
function written(cells: string[] | undefined): Array<[number, string]> {
  return (cells ?? []).flatMap((text, index) =>
    text === "" ? [] : [[index, text] as [number, string]],
  );
}

/** One numeral in the middle of its square. */
function Cell({
  index,
  text,
  columns,
  cell,
  size,
  answered = false,
}: {
  index: number;
  text: string;
  columns: number;
  cell: number;
  size: number;
  answered?: boolean;
}) {
  return (
    <text
      className={`sheet__cell${answered ? " sheet__cell--answered" : ""}`}
      x={((index % columns) + 0.5) * cell}
      y={(Math.floor(index / columns) + 0.5) * cell}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {text}
    </text>
  );
}

/** `0 … n − 1`. */
function count(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, index) => index);
}
