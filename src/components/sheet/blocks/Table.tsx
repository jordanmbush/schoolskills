import { faceOf } from "@/engine/sheets/faces";
import { points } from "@/engine/sheets/paper";
import type { Mil, TableCell, TableColumn } from "@/engine/sheets/types";

import { fitText } from "../text";
import { HAIRLINE, HEAVY, RULE, inch, inside } from "../units";
import type { BlockProps } from "./block";

/** The share of the body size a heading and a corner numeral are set at. */
const HEAD_EM = 0.82;
const CORNER_EM = 0.8;

/** How much of its column a heading or a cell's text may take. */
const FILL = 0.9;

/** How far text is held off the rule to its left, as a share of the row. */
const PAD = 0.14;

/** How far a timeline's tick reaches into a row from its spine. */
const TICK = 0.16;

/**
 * A ruled table: headings across the top, and rows to fill in under them.
 *
 * One `<svg>` rather than a grid of boxed `<div>`s, and the reason is the
 * shared edge: two adjacent cells with a border each print a rule twice as
 * heavy as the outside of the table, and the pair do not always land on the same
 * device pixel. A stroke drawn once between two columns is drawn once.
 *
 * The text inside is `<text>`, which is still real text — selectable, indexable
 * and announced — so a calendar's dates and a chore chart's jobs are content
 * rather than a picture of content (§2).
 *
 * **Nothing here decides a width.** `templates/table.ts` fitted the columns to
 * the page and the family fitted the rows, so what is left to this file is
 * where the strokes go and how small a heading has to be set to stay in its own
 * column.
 */
export function Table({ block, metrics }: BlockProps<"table">) {
  const { columns, rows, cells, head, row, headRow, spine } = block;
  if (columns.length === 0 || rows <= 0 || row <= 0) return null;

  const width = columns.reduce((total, column) => total + column.width, 0);
  const top = head ? headRow : 0;
  const height = top + rows * row;
  if (width <= 0 || height <= 0) return null;

  const face = faceOf(metrics.font);

  // One size for every heading and it is the smallest any of them needs — but
  // measured **column by column**, the way `Form.tsx` measures a field. A
  // table's columns are deliberately unequal; that is what `TableColumn.width`
  // is for. Handing `fitText` one width for every label measures the longest
  // heading against the narrowest column and shrinks the whole row to a size no
  // column actually needs — which set a behaviour chart's headings at under
  // four points beside a twelve-point body.
  const headSize = columns.reduce(
    (smallest, column) =>
      Math.min(
        smallest,
        fitText(
          [column.label],
          column.width,
          points(metrics.fontPt * HEAD_EM),
          face,
          FILL,
        ),
      ),
    points(metrics.fontPt * HEAD_EM),
  );
  const cellSize = points(metrics.fontPt);
  const pad = Math.round(row * PAD);

  // Where each column starts, accumulated once. The last entry is the right
  // edge of the table, which is what the vertical rules are drawn from — so
  // there are `columns.length + 1` of them and the outer two are the sides.
  const edges: Mil[] = columns.reduce<Mil[]>(
    (at, column) => [...at, at[at.length - 1] + column.width],
    [0],
  );

  // Every horizontal boundary, top edge included. `top` is where the *body*
  // starts, which on a table with a heading is the bottom of the heading row
  // and not the top of the table — so the first rule is `0` rather than `top`,
  // and the rest hang off `top` one row at a time. Counting from `top` alone
  // drew a table with a left, a right and a bottom and no top: the heading row
  // printed open at the very edge of the paper, which reads as a page that has
  // been cropped. With no heading `top` is zero and this is the same list.
  //
  // The boundary at `top` itself is deliberately absent: the heavier `--axis`
  // rule below is already there, and a hairline under it prints as one thicker
  // line whose weight nothing chose.
  const rules: Mil[] = [
    0,
    ...Array.from({ length: rows }, (_, index) => top + (index + 1) * row),
  ];

  return (
    <svg
      className="sheet__ink sheet__table"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
    >
      {/* Named rather than `role="img"`: the cells carry real text, and
          `role="img"` would collapse every one of them into this sentence. The
          same convention `Grid.tsx` follows and for the same reason. */}
      <title>{`${columns.length} by ${rows} table`}</title>

      {edges.map((x, index) => (
        <line
          className="sheet__rule sheet__rule--grid"
          key={`v${index}`}
          x1={inside(x, width, HAIRLINE)}
          x2={inside(x, width, HAIRLINE)}
          y1={0}
          y2={height}
          strokeWidth={HAIRLINE}
        />
      ))}
      {rules.map((y, index) => (
        <line
          className="sheet__rule sheet__rule--grid"
          key={`h${index}`}
          x1={0}
          x2={width}
          y1={inside(y, height, HAIRLINE)}
          y2={inside(y, height, HAIRLINE)}
          strokeWidth={HAIRLINE}
        />
      ))}

      {/* The rule under the headings, heavier than the ruling it crosses: it is
          the line between what is printed and what is written, and a reader
          finds the first blank row by it. */}
      {head && (
        <line
          className="sheet__rule sheet__rule--axis"
          x1={0}
          x2={width}
          y1={headRow}
          y2={headRow}
          strokeWidth={RULE}
        />
      )}

      {head &&
        columns.map((column, index) => (
          <Head
            key={`t${index}`}
            column={column}
            x={edges[index]}
            headRow={headRow}
            size={headSize}
          />
        ))}

      {/* The spine, and the ticks along it. The one thing that turns a
          two-column table into a timeline: a heavy upright with a mark into
          every row, so an event is written *against* a point on a line rather
          than in a box beside one. */}
      {spine !== undefined && edges[spine] !== undefined && (
        <g className="sheet__spine">
          <line
            className="sheet__rule sheet__rule--axis"
            x1={inside(edges[spine], width, HEAVY)}
            x2={inside(edges[spine], width, HEAVY)}
            y1={top}
            y2={height}
            strokeWidth={HEAVY}
          />
          {Array.from({ length: rows }, (_, index) => {
            const y = top + (index + 0.5) * row;
            const reach = Math.round(row * TICK);
            return (
              <line
                className="sheet__rule"
                key={`k${index}`}
                x1={edges[spine] - reach}
                x2={edges[spine] + reach}
                y1={y}
                y2={y}
                strokeWidth={RULE}
              />
            );
          })}
        </g>
      )}

      {cells.map((cell, index) => (
        <Cell
          key={`c${index}`}
          cell={cell}
          x={edges[index % columns.length] ?? 0}
          y={top + Math.floor(index / columns.length) * row}
          row={row}
          pad={pad}
          size={cellSize}
          corner={Math.round(cellSize * CORNER_EM)}
        />
      ))}
    </svg>
  );
}

/** One heading, centred over the column it names. */
function Head({
  column,
  x,
  headRow,
  size,
}: {
  column: TableColumn;
  x: Mil;
  headRow: Mil;
  size: number;
}) {
  if (column.label === "") return null;
  return (
    <text
      className="sheet__cell"
      x={x + column.width / 2}
      y={headRow / 2}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {column.label}
    </text>
  );
}

/**
 * What is in one cell: a word on its own baseline, a numeral in the corner, or
 * — on most of these sheets — nothing at all.
 *
 * The corner is where a calendar's date goes, and it is a corner rather than a
 * centre for a reason a reader would notice immediately if it were not: the
 * rest of the square has to stay empty, because the square is what somebody
 * writes the day's lesson in.
 */
function Cell({
  cell,
  x,
  y,
  row,
  pad,
  size,
  corner,
}: {
  cell: TableCell;
  x: Mil;
  y: Mil;
  row: Mil;
  pad: Mil;
  size: number;
  corner: number;
}) {
  return (
    <>
      {cell.corner && (
        <text
          className="sheet__cell sheet__cell--start"
          x={x + pad}
          y={y + pad + corner / 2}
          fontSize={corner}
          dominantBaseline="central"
        >
          {cell.corner}
        </text>
      )}
      {cell.text && (
        <text
          className="sheet__cell sheet__cell--start"
          x={x + pad}
          y={y + row / 2}
          fontSize={size}
          dominantBaseline="central"
        >
          {cell.text}
        </text>
      )}
    </>
  );
}
