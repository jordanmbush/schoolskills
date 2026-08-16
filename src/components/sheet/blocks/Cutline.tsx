import { inches } from "@/engine/sheets/paper";

import { DASH_CUT, HAIRLINE, inch } from "../units";
import type { BlockProps } from "./block";

/** Enough room either side that the line reads as an instruction, not a rule. */
const HEIGHT = inches(0.24);

/**
 * Where to cut, for cards and bookmarks.
 *
 * A dashed stroke rather than a dashed CSS border for the same reason the
 * rulings are strokes: this one has to survive the print pipeline, and a child
 * with scissors is following it exactly.
 */
export function Cutline({ metrics }: BlockProps<"cutline">) {
  const width = metrics.box.width;
  return (
    <svg
      className="sheet__ink sheet__cut"
      width={inch(width)}
      height={inch(HEIGHT)}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      role="img"
      aria-label="Cut along this line"
    >
      <line
        className="sheet__rule sheet__rule--cut"
        x1={0}
        x2={width}
        y1={HEIGHT / 2}
        y2={HEIGHT / 2}
        strokeWidth={HAIRLINE}
        strokeDasharray={DASH_CUT}
      />
    </svg>
  );
}
