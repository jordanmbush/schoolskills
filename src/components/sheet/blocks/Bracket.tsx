import { Fragment, type CSSProperties } from "react";

import type { TableauRow } from "@/engine/sheets/maths/tableau";
import type { Problem } from "@/engine/sheets/types";

import { inch } from "../units";

/**
 * Long division, in the one shape it has ever been written in: the divisor
 * outside the bracket, the dividend under the bar, the quotient along the top
 * and the working underneath (§21).
 *
 * The house is a column of rows, and every row is the same gutter followed by
 * one square per digit of the dividend, at widths the engine declared. That is
 * what puts a quotient digit directly over the dividend digit it belongs to,
 * whether or not a square is drawn round either: nothing here is aligned by
 * text, only by columns. The rows are the height the family reserved, so the
 * house is exactly as tall as the layout arithmetic said. A decimal point is
 * not a column: it is drawn on the boundary between two squares, and the
 * quotient's point goes on the same boundary (§22).
 *
 * The bar and the upright are borders rather than a drawing, for the reason
 * everything else on a sheet is (§5) — they are foreground paint and always
 * print — and so are the hairlines round the squares and the heavier rule
 * under a take-away row. The one fill, the shading of the squares a guided
 * division writes in, is an SVG behind the squares for the same reason.
 */
export function Bracket({
  problem,
  answers,
}: {
  problem: Problem;
  answers: boolean;
}) {
  const bracket = problem.bracket;
  if (!bracket) return null;

  const { cell, help, tableau } = bracket;
  const digits = bracket.dividend.replace(".", "");
  const point = bracket.dividend.indexOf(".");
  const columns = Array.from({ length: digits.length }, (_, column) => column);
  const rows = Array.from(
    { length: Math.max(0, Math.floor(bracket.rows)) },
    (_, row) => tableau?.rows[row],
  );
  const gutter = Math.max(1, bracket.divisor.length) * cell;
  const ruled = help !== "none";
  const stepped = help === "steps" || help === "guided";
  const quotient = quotientOf(problem, digits.length);
  const last = (tableau?.rows.length ?? 0) - 1;

  return (
    <span
      className={`sheet__bracket${ruled ? " sheet__bracket--ruled" : ""}`}
      style={
        {
          "--sheet-cell": inch(cell),
          "--sheet-gutter": inch(gutter),
        } as CSSProperties
      }
    >
      {help === "guided" && (
        <Shading
          cells={written(quotient, tableau?.rows ?? [])}
          cell={cell}
          gutter={gutter}
          columns={digits.length}
          rows={2 + rows.length}
        />
      )}
      <span className="sheet__bracket-row">
        <span className="sheet__gutter" />
        <span
          className={`sheet__quotient${answers ? " sheet__quotient--answered" : ""}`}
        >
          {columns.map((column) => {
            const digit = digitAt(quotient, column);
            return (
              <Fragment key={column}>
                <Square
                  text={answers ? digit : undefined}
                  answered={answers && digit !== undefined}
                />
                {/* On the sheet, the point above the bar is part of the
                    scaffold the squares draw; a bare bracket leaves placing
                    it to the child. The key always writes it. */}
                {column + 1 === point && (answers || ruled) && <Point />}
              </Fragment>
            );
          })}
          {answers && quotient.remainder !== "" && (
            <span className="sheet__remainder">r {quotient.remainder}</span>
          )}
        </span>
      </span>
      <span className="sheet__bracket-row">
        <span className="sheet__gutter sheet__divisor">{bracket.divisor}</span>
        <span className="sheet__dividend">
          {columns.map((column) => (
            <Fragment key={column}>
              <Square text={digits[column]} dividend />
              {column + 1 === point && <Point />}
            </Fragment>
          ))}
        </span>
      </span>
      {rows.map((row, index) => (
        // The rows are the reservation, not the tableau: a division that
        // needs fewer leaves blank squares under it, and the last tableau row
        // is the remainder wherever the reservation ends.
        <span className="sheet__bracket-row" key={index}>
          <span className="sheet__gutter">
            {stepped && row?.role === "take"
              ? "−"
              : help === "guided" && index === last
                ? "R"
                : ""}
          </span>
          {columns.map((column) => {
            const digit = row && digitAt(spanOf(row), column);
            // The squares are there at every level and only the borders
            // differ, so the key writes the working into them whether or not
            // the sheet drew them: a parent marking from the key wants it.
            const written = answers && digit !== undefined;
            return (
              <Square
                key={column}
                text={written ? digit : undefined}
                answered={written}
                take={stepped && row?.role === "take" && digit !== undefined}
              />
            );
          })}
        </span>
      ))}
    </span>
  );
}

/** Digits written along a row, and the column the first of them is in. */
type Span = { text: string; start: number };

const digitAt = ({ text, start }: Span, column: number): string | undefined =>
  column >= start && column < start + text.length
    ? text[column - start]
    : undefined;

const spanOf = (row: TableauRow): Span => ({
  text: row.text,
  start: row.end - row.text.length + 1,
});

/**
 * Where the quotient's digits go and what follows them: out of the tableau
 * when the division was built with one, else right-aligned out of the answer,
 * which is where a fact sheet's single digit belongs.
 */
function quotientOf(
  problem: Problem,
  digits: number,
): Span & { remainder: string } {
  const tableau = problem.bracket?.tableau;
  if (tableau) {
    return {
      ...tableau.quotient,
      remainder: tableau.remainder > 0 ? String(tableau.remainder) : "",
    };
  }
  const [written, remainder = ""] = problem.answer.split(" r ");
  const text = written.replace(".", "");
  return { text, start: Math.max(0, digits - text.length), remainder };
}

/** The decimal point, on the boundary between two squares (§22). */
const Point = () => <span className="sheet__point">.</span>;

function Square({
  text = "",
  dividend = false,
  answered = false,
  take = false,
}: {
  text?: string;
  /** A digit of the question, printed on the sheet as well as on the key. */
  dividend?: boolean;
  /** Written by the key rather than printed as part of the question. */
  answered?: boolean;
  /** Part of a take-away row: the heavier rule goes under it. */
  take?: boolean;
}) {
  const className = [
    "sheet__square",
    dividend ? "sheet__square--dividend" : "",
    answered ? "sheet__square--answered" : "",
    take ? "sheet__square--take" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={className}>{text}</span>;
}

type Cell = { row: number; column: number };

/** Every square a division writes in: the quotient's, then each row's. */
function written(quotient: Span, rows: TableauRow[]): Cell[] {
  const cells: Cell[] = [];
  for (let at = 0; at < quotient.text.length; at += 1) {
    cells.push({ row: 0, column: quotient.start + at });
  }
  rows.forEach((row, index) => {
    const { start } = spanOf(row);
    for (let at = 0; at < row.text.length; at += 1) {
      cells.push({ row: 2 + index, column: start + at });
    }
  });
  return cells;
}

/** A twelfth of the ink: a digit written over it is still black on near-white. */
const SHADE = 0.12;

/**
 * The shaded squares of a guided division, placed from the same cell and
 * gutter widths the squares are laid out with, so the two cannot come apart.
 */
function Shading({
  cells,
  cell,
  gutter,
  columns,
  rows,
}: {
  cells: Cell[];
  cell: number;
  gutter: number;
  columns: number;
  rows: number;
}) {
  const width = gutter + columns * cell;
  const height = rows * cell;
  return (
    <svg
      className="sheet__shading"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <g fill="currentColor" fillOpacity={SHADE}>
        {cells.map(({ row, column }) => (
          <rect
            key={`${row}:${column}`}
            x={gutter + column * cell}
            y={row * cell}
            width={cell}
            height={cell}
          />
        ))}
      </g>
    </svg>
  );
}
