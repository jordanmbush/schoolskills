import { handOf } from "@/engine/sheets/hands";
import { drawable } from "@/engine/sheets/hands/hand";
import type { ModelGuides, TraceCell } from "@/engine/sheets/types";

import { TracedRow } from "../Traced";
import { WrittenRow, type WrittenCell } from "../Written";
import type { BlockProps } from "./block";

/**
 * Tracing rows: several cells across one ruled repeat, each with something
 * written in it and a style to write it in.
 *
 * A word in `["solid", "dotted", "dotted", "none"]` is trace → copy → write on
 * one line, which is the progression a handwriting sheet exists to walk a child
 * through; a row of three letters in that same sequence is the shape that fits
 * an alphabet on one page. The family decides both; this only draws them.
 *
 * Where the face has a hand, a row is written in it as the strokes of its
 * letters, and set in the outline face where it is not (§25). The choice is
 * made row by row rather than cell by cell: the hand has the characters
 * somebody has drawn, and a row it could only half write would put half a
 * word in one shape and the rest in another on the same line — a worse model
 * than the outline face whole.
 */
export function Trace({ block, metrics }: BlockProps<"trace">) {
  const hand = handOf(metrics.font);
  const guides = block.guides ?? "letters";
  return (
    <div className="sheet__block">
      {block.rows.map((row, index) => (
        <div
          className="sheet__row"
          key={`${index}-${row.cells[0]?.text ?? ""}`}
        >
          {hand && row.cells.every((cell) => drawable(hand, cell.text)) ? (
            <WrittenRow
              rule={block.rule}
              metrics={metrics}
              hand={hand}
              cells={row.cells.map((cell) => written(cell, guides))}
              forms={metrics.forms}
              guided={guides === "all"}
            />
          ) : (
            <TracedRow rule={block.rule} metrics={metrics} cells={row.cells} />
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Which models carry their guides (§25). The usual is a letter, a numeral or
 * an `Aa` pair and not a word: the marks between a word's letters crowd the
 * row, and the row never shrinks a word to make room for them. A block set
 * to `all` guides every model, and every cell in it is then set with a
 * guided cell's room, drawn or not, so a sentence and the rows traced under
 * it line up. A value this build has never heard of is read as the usual.
 */
const written = (cell: TraceCell, guides: ModelGuides): WrittenCell => ({
  ...cell,
  guides:
    cell.style === "solid" &&
    (guides === "all" || (guides !== "none" && cell.text.length <= 2)),
});
