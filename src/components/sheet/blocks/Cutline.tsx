import { inches } from "@/engine/sheets/paper";

import { DASH_CUT, HEAVY, inch } from "../units";
import type { BlockProps } from "./block";

/** Enough room either side that the line reads as an instruction, not a rule. */
const HEIGHT = inches(0.24);

/**
 * Where to cut, for cards and bookmarks.
 *
 * A dashed stroke rather than a dashed CSS border for the same reason the
 * rulings are strokes: this one has to survive the print pipeline, and a child
 * with scissors is following it exactly.
 *
 * `HEAVY` for the same reason — a cut line is read before it is used, and it
 * has to be the one line on the page nobody mistakes for a rule to write on.
 * That is the weight `units.ts` names cut lines under.
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
        strokeWidth={HEAVY}
        strokeDasharray={DASH_CUT}
      />
    </svg>
  );
}
