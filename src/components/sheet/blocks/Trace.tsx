import { TracedRow } from "../Traced";
import type { BlockProps } from "./block";

/**
 * Tracing rows: the same word several times across one ruled repeat, each in
 * its own style.
 *
 * `["solid", "dotted", "dotted", "none"]` is trace → copy → write on one line,
 * which is the progression a handwriting sheet exists to walk a child through.
 * The row decides its own styles; this only draws them.
 */
export function Trace({ block, metrics }: BlockProps<"trace">) {
  return (
    <div className="sheet__block">
      {block.rows.map((row, index) => (
        <div className="sheet__row" key={`${index}-${row.text}`}>
          <TracedRow
            rule={block.rule}
            metrics={metrics}
            cells={row.repeats.map((style) => ({ text: row.text, style }))}
          />
        </div>
      ))}
    </div>
  );
}
