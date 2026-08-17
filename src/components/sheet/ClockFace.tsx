/**
 * An analog dial, as strokes.
 *
 * The one drawing in the shop that is the question on one sheet and the answer
 * place on the next: a face with hands on it is read, a face without them is
 * drawn on, and a key draws them either way. So `hands` is not a property of the
 * drawing — it is the answer to "has this been answered yet", and it comes from
 * the face and the sheet together.
 *
 * The dial is an inch and a half across on paper and stays that size whatever
 * the body type is set at (§17), because it is a physical object a child puts a
 * pencil on. The size comes from `clockface.ts`, which is the same module the
 * family reserved the row height with, so the drawing cannot come out taller
 * than the space that was kept for it.
 */
import {
  DIAL,
  HOURS,
  MINUTES_AN_HOUR,
  faceText,
} from "@/engine/sheets/clockface";
import type { ClockFace, Mil } from "@/engine/sheets/types";

import { HAIRLINE, HEAVY, RULE, inch } from "./units";

const CENTRE = Math.round(DIAL / 2);
/** The rim, and where the marks inside it fall. */
const RIM = Math.round(DIAL * 0.46);
const TICK = Math.round(RIM * 0.88);
const NUMERAL = Math.round(RIM * 0.74);
const HOUR_HAND = Math.round(RIM * 0.52);
const MINUTE_HAND = Math.round(RIM * 0.8);

/** A twelfth of a turn, and a sixtieth of one. */
const PER_HOUR = 360 / HOURS;
const PER_MINUTE = 360 / MINUTES_AN_HOUR;

/** Where a point sits on the dial, measured clockwise from twelve. */
function at(degrees: number, radius: Mil): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: Math.round(CENTRE + radius * Math.sin(radians)),
    y: Math.round(CENTRE - radius * Math.cos(radians)),
  };
}

export function ClockFaceView({
  face,
  answers,
}: {
  face: ClockFace;
  /** Whether the sheet is a key, which is what puts hands on an empty dial. */
  answers: boolean;
}) {
  const hands = face.hands || answers;
  const minute = face.minute * PER_MINUTE;
  // The hour hand has moved on by the part of the hour that has gone: at twenty
  // past three it is a third of the way to four, and a dial that drew it pointing
  // at the 3 would be a dial no clock has ever had.
  const hour = ((face.hour % HOURS) + face.minute / MINUTES_AN_HOUR) * PER_HOUR;

  return (
    <svg
      className="sheet__ink"
      width={inch(DIAL)}
      height={inch(DIAL)}
      viewBox={`0 0 ${DIAL} ${DIAL}`}
      role="img"
      // The dial is the question when it has hands on it, so saying the time is
      // handing a child who cannot see it what a child who can is looking at.
      // An empty dial says nothing, because there is nothing on it yet.
      aria-label={
        hands ? `A clock showing ${faceText(face)}` : "A clock with no hands"
      }
    >
      <circle
        className="sheet__dial"
        cx={CENTRE}
        cy={CENTRE}
        r={RIM}
        strokeWidth={RULE}
      />
      {Array.from({ length: HOURS }, (_, index) => {
        const outer = at(index * PER_HOUR, RIM);
        const inner = at(index * PER_HOUR, TICK);
        const numeral = at(index * PER_HOUR, NUMERAL);
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
              fontSize={Math.round(RIM * 0.3)}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {index === 0 ? HOURS : index}
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
