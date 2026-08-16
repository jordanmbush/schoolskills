import { inches } from "@/engine/sheets/paper";
import type { ClockFace, Mil } from "@/engine/sheets/types";

import { HAIRLINE, HEAVY, RULE, inch } from "../units";
import type { BlockProps } from "./block";

/* The dial, in mil. One and a half inches is the size a clock face is printed
   at on a worksheet: big enough for a child to draw a minute hand accurately,
   small enough that six of them fit across a page. */
const FACE = inches(1.5);
const CENTRE = FACE / 2;
const DIAL = Math.round(FACE * 0.46);
const TICK = Math.round(DIAL * 0.88);
const NUMERAL = Math.round(DIAL * 0.74);
const HOUR_HAND = Math.round(DIAL * 0.52);
const MINUTE_HAND = Math.round(DIAL * 0.8);

/** Where a point sits on the dial, measured clockwise from twelve. */
function at(degrees: number, radius: Mil): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Math.round(CENTRE + radius * Math.sin(radians)),
    y: Math.round(CENTRE - radius * Math.cos(radians)),
  };
}

/**
 * Analog dials.
 *
 * One block covers both halves of telling the time: `hands: true` is a face to
 * read, `hands: false` is a face to draw. On the key the hands appear either
 * way — a sheet asking a child to draw twenty past three is answered by the
 * face with the hands on it.
 */
export function Clock({ block, metrics }: BlockProps<"clock">) {
  return (
    <div className="sheet__faces">
      {block.faces.map((face, index) => (
        <figure className="sheet__face" key={`${index}-${face.label ?? ""}`}>
          <Dial face={face} hands={face.hands || metrics.answers} />
          {face.label && (
            <figcaption className="sheet__caption">{face.label}</figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

function Dial({ face, hands }: { face: ClockFace; hands: boolean }) {
  const minute = face.minute * 6;
  const hour = ((face.hour % 12) + face.minute / 60) * 30;
  const time = `${face.hour}:${String(face.minute).padStart(2, "0")}`;

  return (
    <svg
      className="sheet__ink"
      width={inch(FACE)}
      height={inch(FACE)}
      viewBox={`0 0 ${FACE} ${FACE}`}
      role="img"
      aria-label={hands ? `A clock showing ${time}` : "A clock with no hands"}
    >
      <circle
        className="sheet__dial"
        cx={CENTRE}
        cy={CENTRE}
        r={DIAL}
        strokeWidth={RULE}
      />
      {Array.from({ length: 12 }, (_, index) => {
        const outer = at(index * 30, DIAL);
        const inner = at(index * 30, TICK);
        const numeral = at(index * 30, NUMERAL);
        return (
          <g key={index}>
            <line
              className="sheet__rule"
              x1={inner.x}
              y1={inner.y}
              x2={outer.x}
              y2={outer.y}
              strokeWidth={HAIRLINE}
            />
            <text
              className="sheet__cell"
              x={numeral.x}
              y={numeral.y}
              fontSize={Math.round(DIAL * 0.3)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {index === 0 ? 12 : index}
            </text>
          </g>
        );
      })}
      {hands && (
        <g className="sheet__hands">
          <line
            className="sheet__rule"
            x1={CENTRE}
            y1={CENTRE}
            x2={at(hour, HOUR_HAND).x}
            y2={at(hour, HOUR_HAND).y}
            strokeWidth={HEAVY}
            strokeLinecap="round"
          />
          <line
            className="sheet__rule"
            x1={CENTRE}
            y1={CENTRE}
            x2={at(minute, MINUTE_HAND).x}
            y2={at(minute, MINUTE_HAND).y}
            strokeWidth={RULE}
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
