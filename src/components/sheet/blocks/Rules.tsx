import { Ruling, ruledHeight } from "../Ruling";
import { inch } from "../units";
import type { BlockProps } from "./block";

/**
 * Ruled paper: `lines` repeats of a ruling and nothing written on them.
 *
 * The whole of "printable wide ruled paper" (§18), and the block every other
 * ruled thing on a sheet is built out of.
 */
export function Rules({ block, metrics }: BlockProps<"rules">) {
  const width = metrics.box.width;
  const height = ruledHeight(block.rule, block.lines);
  // Blank paper is a ruling with no pitch. It draws nothing, which is correct
  // and is not the same thing as drawing a zero-height box.
  if (height <= 0) return null;

  return (
    <svg
      className="sheet__ink"
      width={inch(width)}
      height={inch(height)}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
    >
      <Ruling rule={block.rule} box={metrics.box} sets={block.lines} />
    </svg>
  );
}
