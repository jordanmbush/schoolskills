/**
 * Counters, drawn where the engine put them.
 *
 * The picture a division lesson starts from (§23): dots already dealt into
 * rings, ringed along a row, or set out in rows. Every dot, ring and count is
 * placed by `counters.ts`, and this component draws the list it is handed and
 * decides nothing — which is what lets a test count the picture without a
 * browser and hold it to the sentence printed beside it.
 *
 * The dots are an SVG `fill` and the rings are strokes, so both survive a
 * printer with background graphics off (§5). The caption is HTML text under
 * the drawing rather than text inside it, for the reason a problem is (§2):
 * "3 rings · 4 in each" is something a reader reads.
 */
import {
  DOT,
  LABEL_SIZE,
  countersGeometry,
  grouped,
} from "@/engine/sheets/counters";
import type { Counters } from "@/engine/sheets/types";

import { RULE, inch } from "./units";

export function CountersView({ counters }: { counters: Counters }) {
  const { dots, rings, labels } = countersGeometry(counters);
  if (dots.length === 0 || counters.width <= 0 || counters.height <= 0)
    return null;
  const { groups, left } = grouped(counters);

  return (
    <span className="sheet__counters">
      <svg
        className="sheet__ink sheet__dots"
        width={inch(counters.width)}
        height={inch(counters.height)}
        viewBox={`0 0 ${counters.width} ${counters.height}`}
        role="img"
        // The picture is the question, so saying what is in it gives nothing
        // away — a child who cannot see it is told what a child who can is
        // looking at. What the groups add up to is never said.
        aria-label={describe(counters, groups, left)}
      >
        {rings.map((ring, index) => (
          <rect
            className="sheet__shape"
            key={index}
            x={ring.x}
            y={ring.y}
            width={ring.width}
            height={ring.height}
            rx={Math.round(Math.min(ring.width, ring.height) / 2)}
            strokeWidth={RULE}
          />
        ))}
        {dots.map((dot, index) => (
          <circle
            className="sheet__dot"
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={DOT / 2}
          />
        ))}
        {labels.map((label) => (
          <text
            className="sheet__tick"
            key={`${label.x}:${label.y}`}
            x={label.x}
            y={label.y}
            fontSize={LABEL_SIZE}
            textAnchor="middle"
          >
            {label.text}
          </text>
        ))}
      </svg>
      {counters.caption && (
        <span className="sheet__caption">{counters.caption}</span>
      )}
    </span>
  );
}

function describe(counters: Counters, groups: number, left: number): string {
  const dots = `${counters.total} counters`;
  const over = left > 0 ? `, ${left} left over` : "";
  switch (counters.layout) {
    case "array":
      return `${dots} in rows of ${counters.per}`;
    case "share":
      return counters.rings
        ? `${dots} in ${groups} rings${over}`
        : `${dots} in ${groups} piles${over}`;
    case "group":
      return counters.rings
        ? `${dots} in a row, ringed ${counters.per} at a time${over}`
        : `${dots} in a row`;
  }
}
