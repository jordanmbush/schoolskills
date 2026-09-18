import { StrokedRow } from "../Stroked";
import type { BlockProps } from "./block";

/**
 * Stroke rows: a pattern across one ruled repeat, in the cells the family
 * chose — the row a penmanship sheet opens with, and the one row on any sheet
 * that is drawn rather than written (§24).
 */
export function Strokes({ block, metrics }: BlockProps<"strokes">) {
  return (
    <div className="sheet__block">
      {block.rows.map((row, index) => (
        <div className="sheet__row" key={`${index}-${row.pattern}`}>
          <StrokedRow
            rule={block.rule}
            metrics={metrics}
            pattern={row.pattern}
            cells={row.cells}
          />
        </div>
      ))}
    </div>
  );
}
