import { NumberLineView } from "../NumberLine";
import type { BlockProps } from "./block";

/**
 * A number line on its own, rather than under a sum.
 *
 * The whole of this block is the same drawing a problem carries, which is the
 * point of it: the strip a child cuts out and sticks on a desk and the line
 * drawn under `6 + 3 =` are one renderer, so the ticks land in the same places
 * on both and there is one piece of arithmetic deciding where that is.
 *
 * What it is *not* is a `problems` block with one blank item in it. That block
 * numbers what it holds, and a "1." printed against a wall chart is a question
 * nobody asked.
 */
export function Line({ block }: BlockProps<"numberline">) {
  return <NumberLineView line={block.line} />;
}
