import { searchCell } from "@/engine/sheets/words/search";

import { HEAVY, inch } from "../units";
import type { BlockProps } from "./block";
import { Omitted } from "./Omitted";

const CELL_TO_EM = 0.62;

/**
 * A word search: a letter grid, the words to find, and — on the key — a stroke
 * through each one.
 *
 * The letters are `<text>` rather than a table so the solution can be drawn
 * over them in the same coordinate system. They are still selectable, readable
 * text; an `<svg>` is not an image unless it contains one.
 *
 * How big a cell is comes from the engine (`searchCell`) rather than from a
 * constant here, because the family reserved the page against exactly that
 * number before the grid existed. Two copies of it would be a grid an eighth of
 * an inch taller than the room made for it — which looks right on screen and
 * puts the word list on a second sheet of paper.
 */
export function WordSearch({ block, metrics }: BlockProps<"wordsearch">) {
  const rows = block.letters.length;
  const columns = block.letters.reduce(
    (most, row) => Math.max(most, row.length),
    0,
  );
  if (rows === 0 || columns === 0) return null;

  const cell = searchCell(metrics.box.width, columns);
  const width = columns * cell;
  const height = rows * cell;
  const centre = (index: number) => (index + 0.5) * cell;

  return (
    <div className="sheet__block">
      <svg
        className="sheet__ink"
        width={inch(width)}
        height={inch(height)}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Word search, ${columns} by ${rows}`}
      >
        {block.letters.flatMap((row, y) =>
          row.map((letter, x) => (
            <text
              key={`${x}-${y}`}
              className="sheet__cell"
              x={centre(x)}
              y={centre(y)}
              fontSize={Math.round(cell * CELL_TO_EM)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {letter}
            </text>
          )),
        )}

        {/* The key. A capsule around the word rather than a highlight, because
            a filled shape is a background and backgrounds don't print (§5). */}
        {metrics.answers &&
          block.solution?.map((found) => (
            <line
              key={found.word}
              className="sheet__found"
              x1={centre(found.column)}
              y1={centre(found.row)}
              x2={centre(found.column + found.dx * (found.word.length - 1))}
              y2={centre(found.row + found.dy * (found.word.length - 1))}
              strokeWidth={HEAVY}
              strokeLinecap="round"
            />
          ))}
      </svg>

      <ul className="sheet__words">
        {block.find.map((word) => (
          <li key={word}>{word}</li>
        ))}
      </ul>

      <Omitted words={block.omitted} more={block.omittedMore} />
    </div>
  );
}
