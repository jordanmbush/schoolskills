/**
 * A clock face, and the one place a time is written down.
 *
 * The dial is the first drawing in the shop a child reads an *answer* off rather
 * than an aid: a face with hands on it is the question, and a face without them
 * is where the answer goes. The size is here rather than in the renderer because
 * a family reserves the height of a row before anything is drawn (§4).
 *
 * **A time is one number here: minutes past twelve.** Hours and minutes are
 * derived when a face is made, never carried alongside, because two numbers that
 * mean one time are two numbers that can disagree — and elapsed time is a
 * subtraction that has to be exact. Twelve hours is 720 minutes, so every time
 * on a dial is a whole number below that, and nothing in this file divides.
 *
 * The size is in inches and does not scale with the body type: a dial is a
 * physical object a child draws hands on, and §17's larger type is about reading
 * the words rather than growing the pictures.
 */
import type { ClockFace, Mil } from "./types";

import { inches } from "./paper";

/**
 * The dial, across.
 *
 * An inch and a half is what a clock face is printed at on a worksheet: big
 * enough that a minute hand five minutes out is visibly five minutes out, small
 * enough that three fit across a page with their answers beside them.
 */
export const DIAL: Mil = inches(1.5);

export const HOURS = 12;
export const MINUTES_AN_HOUR = 60;
/** Once round the dial. */
export const MINUTES_A_TURN = HOURS * MINUTES_AN_HOUR;

/** The same time, brought onto the dial. Twelve hours on, or twelve back. */
const onTheDial = (minutes: number): number =>
  ((Math.round(minutes) % MINUTES_A_TURN) + MINUTES_A_TURN) % MINUTES_A_TURN;

/**
 * A face showing `minutes` past twelve.
 *
 * `hands` is the whole of the difference between the two halves of telling the
 * time: with them the dial is the question, without them it is the answer place
 * — and a key draws them either way, because a sheet asking a child to draw
 * twenty past three is answered by the face with the hands on it.
 */
export function clockFace(
  minutes: number,
  hands: boolean,
  label?: string,
): ClockFace {
  const at = onTheDial(minutes);
  const hour = Math.floor(at / MINUTES_AN_HOUR);
  return {
    // Twelve rather than nought: a dial has no nought on it.
    hour: hour === 0 ? HOURS : hour,
    minute: at % MINUTES_AN_HOUR,
    hands,
    ...(label === undefined ? {} : { label }),
  };
}

/**
 * The time as it is written: "3:20", and never "3:2".
 *
 * Here rather than in the family or in the renderer because both of them write
 * one — the family into the answer, the renderer into the label a screen reader
 * says — and two ways of writing the same time is one of them being wrong.
 */
export const faceText = (face: ClockFace): string =>
  `${face.hour}:${String(face.minute).padStart(2, "0")}`;

/** The same, from minutes past twelve. */
export const timeText = (minutes: number): string =>
  faceText(clockFace(minutes, false));
