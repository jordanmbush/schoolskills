import { TracedRow } from "../Traced";
import type { BlockProps } from "./block";

/**
 * Tracing rows: several cells across one ruled repeat, each with something
 * written in it and a style to write it in.
 *
 * A word in `["solid", "dotted", "dotted", "none"]` is trace → copy → write on
 * one line, which is the progression a handwriting sheet exists to walk a child
 * through; a row of three letters in that same sequence is the shape that fits
 * an alphabet on one page. The family decides both; this only draws them.
 */
export function Trace({ block, metrics }: BlockProps<"trace">) {
  return (
    <div className="sheet__block">
      {block.rows.map((row, index) => (
        <div
          className="sheet__row"
          key={`${index}-${row.cells[0]?.text ?? ""}`}
        >
          <TracedRow rule={block.rule} metrics={metrics} cells={row.cells} />
        </div>
      ))}
    </div>
  );
}
