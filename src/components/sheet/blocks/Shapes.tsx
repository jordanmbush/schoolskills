import { FigureView } from "../Figure";
import type { BlockProps } from "./block";

/**
 * A row of figures to measure, name or classify.
 *
 * The drawing itself is `Figure.tsx`, because a shape is also drawn beside a
 * problem in the problem grid — a geometry sheet asks about its figures one at a
 * time, with a blank beside each, and this block is the row of them with no
 * question attached.
 */
export function Shapes({ block, metrics }: BlockProps<"shapes">) {
  return (
    <div className="sheet__figures">
      {block.figures.map((figure, index) => (
        <FigureView key={index} figure={figure} fontPt={metrics.fontPt} />
      ))}
    </div>
  );
}
