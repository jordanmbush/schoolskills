/**
 * The number-sense sheets: five decimal questions with no sum in them, each
 * aimed at one wrong idea a child holds about decimals (§22).
 *
 * - `compare` and `order` are for "longer is bigger" and its opposite — 0.45
 *   read as more than 0.5 because 45 is more than 5, and 0.5 read as more than
 *   0.55 because tenths are bigger than hundredths. So the pairs and the sets
 *   are built to differ in their place counts, not only in their digits.
 * - `round` is for "add one to the last digit": a share of the values round up
 *   through a 9, where that rule gives 2.10 for 2.97.
 * - `place` is for reading a digit's worth off its column rather than off the
 *   digit: the 5 in 3.75 is 0.05.
 * - `powers` is for "move the point": the digits move, and the point stays.
 *
 * Every answer is exact, as it is everywhere in the family: a comparison is
 * two whole numbers compared, a rounding is a whole number of the next place
 * cut off, and a shift is `shifted` in `exact.ts`.
 */
import { between } from "@/engine/random";

import type { DecimalConfig, RoundTo } from "../types";

import {
  MAX_PLACES,
  bounds,
  drawValue,
  placesOf,
  type Drawn,
} from "./decimal-draw";
import {
  compareFixed,
  fixed,
  fixedText,
  scale,
  shifted,
  type Fixed,
} from "./exact";

/* ── Multiplying and dividing by 10, 100 and 1000 ───────────────────────── */

/**
 * How much of the page is whole numbers: `48 ÷ 1000` is the question a child
 * who has only ever shifted a decimal cannot do, and the one that shows the
 * point was never what moved.
 */
const WHOLE_SHARE = 1 / 3;

export function drawPowers(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const value =
    rand() < WHOLE_SHARE ? drawWhole(config, rand) : drawValue(config, rand);
  if (value === null) return null;
  // A value ending in a zero moves into `37.0` or `0.20`: right, and a fair
  // thing to mark a child's `37` against, but not a fair thing to print as
  // the key.
  if (value.units % 10 === 0) return null;
  const power = between(1, 3, rand);
  const multiply = rand() < 0.5;
  const answer = shifted(value, multiply ? power : -power);
  if (answer.places > MAX_PLACES) return null;
  const text = fixedText(value);
  const by = scale(power);
  const sign = multiply ? "×" : "÷";
  return {
    key: `powers:${text}:${sign}:${by}`,
    prompt: `${text} ${sign} ${by} =`,
    answer: fixedText(answer),
  };
}

/** A whole number from the range, and never nothing. */
function drawWhole(config: DecimalConfig, rand: () => number): Fixed | null {
  const { min, max } = bounds(config.range);
  if (max < 1) return null;
  return fixed(between(Math.max(1, min), max, rand), 0);
}

/* ── Comparing ─────────────────────────────────────────────────────────── */

/**
 * Two decimals with `<`, `>` or `=` to write between them.
 *
 * Three kinds of pair, and two of them are the misconception: half the page
 * is two numbers with one whole part and different place counts (0.5 and
 * 0.45), where the longer one is bigger only half the time; a quarter is the
 * same number written to two place counts (3.4 and 3.40); and a quarter is
 * two numbers at the sheet's places, which is the comparison everyone can do.
 * A tenths sheet has one place count, so it is all of the last kind.
 */
export function drawCompare(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const kind = places > 1 ? between(0, 3, rand) : 3;
  const pair = kind === 0 ? sameValue : kind === 3 ? freePair : sameWhole;
  const drawn = pair(config, places, rand);
  if (drawn === null) return null;
  // Either way round, so the longer number is not always on one side.
  const [left, right] = rand() < 0.5 ? drawn : [drawn[1], drawn[0]];
  const order = compareFixed(left, right);
  const sign = order < 0 ? "<" : order > 0 ? ">" : "=";
  const texts = [fixedText(left), fixedText(right)];
  return {
    key: `compare:${[...texts].sort().join(":")}`,
    prompt: `${texts[0]} _ ${texts[1]}`,
    answer: sign,
  };
}

type Pair = (
  config: DecimalConfig,
  places: number,
  rand: () => number,
) => [Fixed, Fixed] | null;

/**
 * The same number twice, written to different places: 3.4 and 3.40, never
 * 16.0 and 16.00, which is a whole number wearing two costumes.
 */
const sameValue: Pair = (config, places, rand) => {
  const fewer = between(1, places - 1, rand);
  const more = between(fewer + 1, places, rand);
  const value = drawValue(config, rand, fewer);
  if (value === null || value.units % 10 === 0) return null;
  return [value, fixed(value.units * scale(more - fewer), more)];
};

/**
 * Two numbers with one whole part and different place counts, so the
 * comparison is decided after the point, where the misconception lives.
 */
const sameWhole: Pair = (config, places, rand) => {
  const first = between(1, places, rand);
  const other = between(1, places - 1, rand);
  const second = other >= first ? other + 1 : other;
  const value = drawValue(config, rand, first);
  // Neither ends in a zero, so the longer number is longer in its digits.
  if (value === null || value.units % 10 === 0) return null;
  const whole = Math.floor(value.units / scale(first));
  // The pair shares a whole part, so the second is out of range only when the
  // first sits exactly on the top of it.
  if (whole >= bounds(config.range).max) return null;
  const partner = fixed(
    whole * scale(second) + between(1, scale(second) - 1, rand),
    second,
  );
  if (partner.units % 10 === 0 || compareFixed(value, partner) === 0)
    return null;
  return [value, partner];
};

/** Two numbers at the sheet's places, and never the same one twice. */
const freePair: Pair = (config, _places, rand) => {
  const left = drawValue(config, rand);
  const right = drawValue(config, rand);
  if (left === null || right === null) return null;
  if (compareFixed(left, right) === 0) return null;
  return [left, right];
};

/* ── Ordering ──────────────────────────────────────────────────────────── */

/** How many decimals a set has: enough to sort, few enough for one line. */
export const ORDER_SET = { min: 4, max: 5 };

/**
 * Four or five decimals to write smallest first on the line underneath.
 *
 * One whole part for the set and a place count drawn for each value, so the
 * sorting happens after the point — 3.4, 3.04, 3.45, 3.5 — and a set that
 * already reads in order is thrown away, because it answers itself. The
 * answer travels as a ruled line (`answers`) and as the same text joined, so
 * the two cannot disagree.
 */
export function drawOrder(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const { min, max } = bounds(config.range);
  if (max <= min) return null;
  const whole = between(min, max - 1, rand);
  const size = between(ORDER_SET.min, ORDER_SET.max, rand);
  const values: Fixed[] = [];
  while (values.length < size) {
    const at = between(1, places, rand);
    const value = fixed(
      whole * scale(at) + between(1, scale(at) - 1, rand),
      at,
    );
    if (values.some((seen) => compareFixed(seen, value) === 0)) return null;
    values.push(value);
  }
  const sorted = [...values].sort(compareFixed);
  if (sorted.every((value, index) => value === values[index])) return null;
  const answer = sorted.map(fixedText).join(", ");
  return {
    key: `order:${sorted.map(fixedText).join(":")}`,
    prompt: values.map(fixedText).join(", "),
    answer,
    answers: [answer],
  };
}

/* ── Rounding ──────────────────────────────────────────────────────────── */

/** The places a rounding sheet rounds to. */
const TARGET_PLACES: Record<RoundTo, number> = {
  whole: 0,
  tenth: 1,
  hundredth: 2,
};

/** What a rounding sheet rounds to, made safe to read from a saved config. */
export function roundTo(config: DecimalConfig): RoundTo {
  const asked = config.to;
  return asked !== undefined && asked in TARGET_PLACES ? asked : "whole";
}

/** The places the values on a rounding sheet carry: one past the target. */
export const roundingPlaces = (config: DecimalConfig): number =>
  TARGET_PLACES[roundTo(config)] + 1;

/**
 * How much of the page rounds up through a 9 — 2.97 to 3.0 — which is the
 * case "add one to the last digit" gets wrong, and the one a free draw would
 * print once a page or not at all.
 */
const CARRY_SHARE = 1 / 4;

/**
 * A decimal with one place more than the target, and the value it rounds to.
 *
 * The deciding digit is the last one, so rounding is that digit cut off and
 * the rest carried up when it was five or more — whole numbers throughout. A
 * value whose last digit is a zero has nothing to round and is left out.
 */
export function drawRound(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const target = TARGET_PLACES[roundTo(config)];
  const value =
    rand() < CARRY_SHARE
      ? drawCarry(config, target, rand)
      : drawValue(config, rand, target + 1);
  if (value === null) return null;
  const last = value.units % 10;
  if (last === 0) return null;
  const rounded = fixed(
    (value.units - last + (last >= 5 ? 10 : 0)) / 10,
    target,
  );
  const text = fixedText(value);
  return {
    key: `round:${text}`,
    prompt: `${text} ≈`,
    answer: fixedText(rounded),
  };
}

/**
 * A value that rounds up through a 9: the digit at the target place is a 9
 * and the one after it is five or more, inside the range.
 */
function drawCarry(
  config: DecimalConfig,
  target: number,
  rand: () => number,
): Fixed | null {
  const { min, max } = bounds(config.range);
  const by = scale(target);
  const first = Math.max(0, Math.ceil((min * by - 9) / 10));
  const last = Math.floor((max * by - 9) / 10);
  if (first > last) return null;
  const nines = 10 * between(first, last, rand) + 9;
  return fixed(nines * 10 + between(5, 9, rand), target + 1);
}

/* ── Place value ───────────────────────────────────────────────────────── */

/**
 * "What is the 5 in 3.75 worth?" — answered as the number, 0.05.
 *
 * The digit is one that appears once in the number, so the question names one
 * column, and never a zero, whose worth is nothing to write. Two times in
 * three it is a digit after the point, because those are what the sheet is
 * about — but the whole-part digits stay in, since a child who assumes the
 * answer is always small has not read the column.
 */
const AFTER_SHARE = 2 / 3;

export function drawPlace(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const value = drawValue(config, rand);
  if (value === null) return null;
  const text = fixedText(value);
  const point = text.indexOf(".");
  const usable = [...text]
    .map((ch, at) => ({ ch, at }))
    .filter(
      ({ ch }) =>
        ch >= "1" && ch <= "9" && text.indexOf(ch) === text.lastIndexOf(ch),
    );
  if (usable.length === 0) return null;
  const after = usable.filter((digit) => digit.at > point);
  const pool = after.length > 0 && rand() < AFTER_SHARE ? after : usable;
  const { ch, at } = pool[Math.floor(rand() * pool.length)];
  const digit = Number(ch);
  // Places to the right of the units column; a tens digit is one to the left.
  const place = at < point ? at - point + 1 : at - point;
  const worth =
    place >= 0 ? fixed(digit, place) : fixed(digit * scale(-place), 0);
  return {
    key: `place:${text}:${digit}`,
    prompt: `What is the ${digit} in ${text} worth?`,
    answer: fixedText(worth),
  };
}
