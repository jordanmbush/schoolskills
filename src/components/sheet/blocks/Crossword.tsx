/**
 * A crossword: the squares, the numbers in their corners, and the two clue
 * lists under them.
 *
 * An `<svg>` rather than a table for the reason the word search is one — the
 * letters of the key have to land in the same coordinate system as the boxes
 * they belong in — and squares drawn as strokes rather than as filled cells
 * because background paint is what a browser drops when printing (§5).
 *
 * The clues are real HTML under it, so they are selectable, they wrap, and a
 * crawler reads them as the text they are.
 */
import { searchCell } from "@/engine/sheets/words/metrics";
import type { CrosswordEntry } from "@/engine/sheets/types";

import { HAIRLINE, inch } from "../units";
import type { BlockProps } from "./block";
import { Omitted } from "./Omitted";

/** A letter that fills its square without touching the sides of it. */
const LETTER_TO_EM = 0.58;
/** The number in the corner: small enough to leave the square writable. */
const NUMBER_TO_EM = 0.3;
/** How far the number sits in from the corner, as a share of the square. */
const NUMBER_INSET = 0.1;

export function Crossword({ block, metrics }: BlockProps<"crossword">) {
  const rows = block.cells.length;
  const columns = block.cells.reduce(
    (most, row) => Math.max(most, row.length),
    0,
  );
  // A grid with nothing in it is still a block: the line under it is the whole
  // of the sheet's content, and it gets the same air around it as a puzzle
  // would have had.
  if (rows === 0 || columns === 0)
    return (
      <div className="sheet__block">
        <Omitted words={block.omitted} more={block.omittedMore} />
      </div>
    );

  // The same cell size the family reserved the page against — see the note in
  // `WordSearch` for why this is asked of the engine rather than declared here.
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
        aria-label={`Crossword, ${columns} by ${rows}`}
      >
        {block.cells.flatMap((row, y) =>
          row.map((square, x) =>
            square === null ? null : (
              <g key={`${x}-${y}`}>
                <rect
                  className="sheet__box"
                  x={x * cell}
                  y={y * cell}
                  width={cell}
                  height={cell}
                  strokeWidth={HAIRLINE}
                />
                {square.number !== undefined && (
                  <text
                    className="sheet__cell sheet__cell--start"
                    x={x * cell + cell * NUMBER_INSET}
                    y={y * cell + cell * NUMBER_INSET}
                    fontSize={Math.round(cell * NUMBER_TO_EM)}
                    dominantBaseline="hanging"
                  >
                    {square.number}
                  </text>
                )}
                {/* The letter is on the square whether or not this is a key;
                    `answers` decides whether it is printed. Same bargain as a
                    ruled slot, so a key cannot disagree with its sheet. */}
                {metrics.answers && (
                  <text
                    className="sheet__cell sheet__cell--answered"
                    x={centre(x)}
                    y={centre(y)}
                    fontSize={Math.round(cell * LETTER_TO_EM)}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {square.letter}
                  </text>
                )}
              </g>
            ),
          ),
        )}
      </svg>

      <div className="sheet__clues">
        <Clues heading="Across" entries={block.across} />
        <Clues heading="Down" entries={block.down} />
      </div>

      <Omitted words={block.omitted} more={block.omittedMore} />
    </div>
  );
}

/**
 * One direction's clues, numbered as the grid numbered them.
 *
 * The number is a `<span>` rather than a list marker for the reason every
 * numbered list on a sheet is: markers are stripped site-wide, a marker sits
 * outside the box and therefore outside the margin, and a child told to "do 4,
 * 7 and 12" needs the numbers to be on the paper.
 */
function Clues({
  heading,
  entries,
}: {
  heading: string;
  entries: CrosswordEntry[];
}) {
  if (entries.length === 0) return null;
  return (
    <div>
      <p className="sheet__clue-head">{heading}</p>
      <ul className="sheet__clue-list">
        {entries.map((entry) => (
          <li key={`${heading}-${entry.number}`}>
            <span className="sheet__number">{entry.number}.</span>
            {entry.clue}
          </li>
        ))}
      </ul>
    </div>
  );
}
