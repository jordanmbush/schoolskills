import { faceOf, glyphAdvance, type Face } from "@/engine/sheets/faces";

import { HAIRLINE, HEAVY, inch } from "../units";
import type { BlockProps } from "./block";

/** Numerals inside a square, at about half its height. */
const CELL_TO_EM = 0.5;

/**
 * How much of a column a word at the head of one may take.
 *
 * Half a square is the right size for the numerals a grid was built for, and
 * far too big for a word: "Hundred thousands" set at half the height of its own
 * column runs four columns wide, and an `<svg>` clips to its viewBox, so what
 * prints is a place-value chart with most of its headings sliced off. So a cell
 * that cannot hold its text at the shared size is set at the size that fits —
 * measured the only way there is at build time, off the face's own declared
 * mean advance (`faces.ts`), which is the same bargain `chrome.ts` strikes for
 * every other run of text on a sheet. Through `glyphAdvance` rather than off
 * `advance` directly, because every word here starts with a capital and the
 * plain mean is taken over `a`–`z`: that is the distinction that put `Mm` a
 * tenth of an inch into the next cell on a handwriting row.
 *
 * It never fires on the grids that were here first: three characters is the
 * widest thing a hundred chart or a multiplication square puts in a square, and
 * three of them fit at the shared size on every face in the shop.
 */
const CELL_FILL = 0.86;

/** How far from its dot a point's letter is set, in squares. */
const MARK_TO_EM = 0.42;

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
  const { columns, rows, cells, answers, marks, origin, axis, kind } =
    block.grid;
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

  // How tall a row is, which is the square unless the grid says otherwise —
  // and only one grid in the shop does. See `GridSpec.row`: everything a child
  // measures against leaves it unsaid and gets squares by construction.
  const rowHeight = Math.max(1, block.grid.row ?? cell);

  const width = columns * cell;
  const height = rows * rowHeight;
  // One size for every square, and it is the smallest any of them needs. Per
  // cell would be arithmetically tidier and would print a header row with a
  // different type size in each column, which reads as a mistake whether or not
  // it is one.
  const size = fits(
    [...(cells ?? []), ...(answers ?? [])],
    cell,
    Math.round(Math.min(cell, rowHeight) * CELL_TO_EM),
    faceOf(metrics.font),
  );

  // How far off the edge of the drawing a numeral and a point's letter have to
  // stay. An `<svg>` clips to its viewBox and the outermost gridline of a plane
  // *is* the edge of it, so anything centred there loses half of itself — and a
  // letter drawn a square further out loses all of it, leaving the sheet asking
  // "E = ___" with no E anywhere on the paper.
  const half = Math.max(1, Math.round(size * 0.5));
  const away = Math.max(1, Math.round(cell * MARK_TO_EM));

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
      {count(rows + 1).map((line) => (
        <line
          key={`r${line}`}
          className="sheet__rule sheet__rule--grid"
          x1={0}
          x2={width}
          y1={line * rowHeight}
          y2={line * rowHeight}
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
            y1={origin.row * rowHeight}
            y2={origin.row * rowHeight}
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

      {/* What the axes count in, printed in the squares beside them rather than
          outside the drawing: the grid is exactly as wide as its squares say it
          is (§4), so a numeral past the edge is a numeral that gets clipped or a
          drawing that gets rescaled. Nought is left off — where the two heavy
          rules cross is not something a child needs telling — and so is any
          gridline the plane does not reach, which is how a first-quadrant sheet
          numbers its margin square nothing rather than −1. */}
      {kind === "coordinate" && origin && (
        <g className="sheet__axis-marks">
          {origin.row < rows &&
            count(columns + 1).map((column) => (
              <Numbered
                key={`x${column}`}
                x={within(column * cell, half, width - half)}
                y={(origin.row + 0.5) * rowHeight}
                value={column - origin.column}
                axis={axis}
                size={size}
              />
            ))}
          {origin.column > 0 &&
            count(rows + 1).map((line) => (
              <Numbered
                key={`y${line}`}
                x={(origin.column - 0.5) * cell}
                y={within(line * rowHeight, half, height - half)}
                value={origin.row - line}
                axis={axis}
                size={size}
              />
            ))}
        </g>
      )}

      {/* The points a coordinate sheet asks about: a dot where the ruling
          crosses, not a numeral in a square. They are the question rather than
          the answer, so they print on the blank sheet too — the coordinates are
          what the child writes. */}
      {(marks ?? []).map((mark, index) => (
        <g key={`m${index}-${mark.label}`}>
          <circle
            className="sheet__dot"
            cx={mark.column * cell}
            cy={mark.row * rowHeight}
            r={Math.max(1, Math.round(cell * 0.11))}
          />
          {/* Up and to the right of its dot, and turned inward where that would
              be off the paper: the plane puts points on its outermost gridlines,
              and a letter set outside the viewBox is clipped away entirely —
              which leaves "E = ___" printed under a plane with no E on it. */}
          <text
            className="sheet__cell"
            x={within(mark.column * cell + away, away, width - away)}
            y={within(mark.row * rowHeight - away, away, height - away)}
            fontSize={Math.round(cell * 0.62)}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {mark.label}
          </text>
        </g>
      ))}

      {/* Two lists over the same squares: what is printed whatever the sheet
          is, and what is printed only on a key. A multiplication square's
          headers are the first and its hundred and forty-four products are the
          second, so the blank grid and the wall chart are one build with
          `answers` flipped — the same mechanism as every ruled slot. */}
      {written(cells).map(([index, text]) => (
        <Cell
          key={`c${index}`}
          {...{ index, text, columns, cell, rowHeight, size }}
        />
      ))}
      {metrics.answers &&
        written(answers).map(([index, text]) => (
          <Cell
            key={`a${index}`}
            answered
            {...{ index, text, columns, cell, rowHeight, size }}
          />
        ))}
    </svg>
  );
}

/**
 * The size the squares' text is set at: the shared one, or what the widest of
 * them will fit at.
 *
 * Declared rather than measured, the same way every other run of text on a
 * sheet is (§4) — there is no DOM at build time to ask instead, and a size a
 * browser worked out is a size no test can check. The mean advance is the
 * face's own, so a heading that fits in the print face is not clipped in the
 * dyslexic one.
 */
function fits(texts: string[], cell: number, size: number, face: Face): number {
  return texts.reduce((smallest, text) => {
    const advance = glyphAdvance(text, face);
    if (text.length === 0 || advance <= 0) return smallest;
    return Math.min(
      smallest,
      Math.floor((cell * CELL_FILL) / (text.length * advance)),
    );
  }, size);
}

/** The squares of a list that have something in them, with their positions. */
function written(cells: string[] | undefined): Array<[number, string]> {
  return (cells ?? []).flatMap((text, index) =>
    text === "" ? [] : [[index, text] as [number, string]],
  );
}

/** One numeral — or one heading — in the middle of its square. */
function Cell({
  index,
  text,
  columns,
  cell,
  rowHeight,
  size,
  answered = false,
}: {
  index: number;
  text: string;
  columns: number;
  cell: number;
  rowHeight: number;
  size: number;
  answered?: boolean;
}) {
  return (
    <text
      className={`sheet__cell${answered ? " sheet__cell--answered" : ""}`}
      x={((index % columns) + 0.5) * cell}
      y={(Math.floor(index / columns) + 0.5) * rowHeight}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {text}
    </text>
  );
}

/**
 * One number beside an axis, in the square next to the rule it counts.
 *
 * Nought is never drawn: the two heavy rules cross there, and a nought printed
 * on top of them is a nought a child has to read through. Nor is a number the
 * plane does not run to — a gridline outside `axis` is the margin the numerals
 * themselves sit in, not the first square of a quadrant the sheet does not have.
 */
function Numbered({
  x,
  y,
  value,
  axis,
  size,
}: {
  x: number;
  y: number;
  value: number;
  axis?: { min: number; max: number };
  size: number;
}) {
  if (value === 0) return null;
  if (axis && (value < axis.min || value > axis.max)) return null;
  return (
    <text
      className="sheet__cell"
      x={x}
      y={y}
      fontSize={Math.round(size * 0.8)}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {value}
    </text>
  );
}

/** `0 … n − 1`. */
function count(n: number): number[] {
  return Array.from({ length: Math.max(0, n) }, (_, index) => index);
}

/** `value`, moved the shortest distance that puts it between the two bounds. */
function within(value: number, low: number, high: number): number {
  return Math.max(low, Math.min(high, value));
}
