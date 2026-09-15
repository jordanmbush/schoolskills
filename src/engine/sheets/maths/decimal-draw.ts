/**
 * What one draw of the decimals family returns, the numbers every draw takes
 * its values from, and the draws the family began with: sums, percents and
 * conversions. Division's are in `decimal-division.ts` and the number-sense
 * ones in `decimal-sense.ts`; `decimals.ts` is the spec that lays them out.
 *
 * **A draw never reads `form`.** It returns the problem in every shape it can
 * take — the sentence, and the stack or the bracket beside it — and the spec
 * picks one from the layout it has already reserved for. That is what keeps
 * the draw and the row height from disagreeing, and what lets a draw live in a
 * module that knows nothing about the page.
 *
 * **Nothing here is ever a float.** `maths/exact.ts` holds the shape and the
 * reasons (§11).
 */
import { between } from "@/engine/random";

import type { DecimalConfig, DecimalOperation } from "../types";

import {
  fixed,
  fixedText,
  gcd,
  minusFixed,
  plusFixed,
  scale,
  timesFixed,
  timesWhole,
  type Fixed,
} from "./exact";

export type Drawn = {
  /** What makes two draws the same problem, so a page never asks one twice. */
  key: string;
  /** Along a line: "13.47 + 8.06 =", or a sentence with `_` for the gap. */
  prompt: string;
  answer: string;
  /** The same sum stacked, where the sheet stacks. */
  operands?: string[];
  operator?: string;
  /** The same division in the bracket, as far as the draw decides it. */
  bracket?: { divisor: string; dividend: string };
  /** The answer as a ruled line under the prompt, when it is a list. */
  answers?: string[];
};

export type Draw = (config: DecimalConfig, rand: () => number) => Drawn | null;

/** Tenths, hundredths, thousandths. Past that it is a physics sheet. */
export const MAX_PLACES = 3;

/** What a decimal is multiplied by: three lots of 1.25, never seventy of it. */
const MULTIPLIER = { min: 2, max: 9 };

/**
 * The percentages a sheet asks for.
 *
 * The ones a child is taught to recognise rather than every whole number
 * between 1 and 100: "37% of 200" is a calculator question, and "25% of 80" is
 * a quarter of eighty, which is the whole point of the lesson.
 */
const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

/**
 * The percentages a sheet takes *of an amount*, which is the list above without
 * the identity on it.
 *
 * "100% of 63" is 63, and a child who has read the question has already written
 * the answer. It stays in `PERCENTS` because `100% = 1.00` is a fair conversion
 * to ask for — a whole is a hundred per cent is the thing being converted — and
 * it comes out here because it is not a calculation to do.
 */
const AMOUNT_PERCENTS = PERCENTS.filter((percent) => percent !== 100);

/**
 * The denominators a conversion sheet uses.
 *
 * Only fractions that *stop* — a third is 0.333… and there is no number of
 * places at which it is exactly right. Which of these survive is decided by the
 * places the sheet is set at: eighths are exact in thousandths and not in
 * hundredths, so `scale % d` does the filtering rather than a second list.
 */
const FRIENDLY = [2, 4, 5, 8, 10, 20, 25, 50, 100];

/**
 * How far apart two percents are that a sheet at this scale can write down.
 *
 * Every percent is exact in hundredths and finer, and only the tens are exact
 * in tenths: 45% is 0.45, which a sheet set at one place cannot print. So the
 * step is one at two places and ten at one, and the draw walks in steps rather
 * than drawing and rejecting.
 */
const percentStep = (by: number): number => 100 / gcd(100, by);

const SIGN = { add: "+", subtract: "−", multiply: "×", divide: "÷" } as const;

/* ── The numbers on the page ───────────────────────────────────────────────
   Every bound is sanitised once, because they arrive from outside this build:
   a config in a bookmarked URL may ask for nine places, or for a range that
   runs backwards.                                                            */

export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

export const placesOf = (config: DecimalConfig): number =>
  clamp(config.places ?? 2, 1, MAX_PLACES);

export function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range?.min ?? 0));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 0)) };
}

/**
 * One value from the range, in the smallest unit the sheet counts in — or at
 * the places a draw names, where a sheet mixes them.
 *
 * Drawn as a whole number of hundredths rather than as a decimal rounded
 * afterwards: rounding is where a place count stops being a promise. A value of
 * nothing is rejected — `0.00 + 3.45` is not a question about decimals.
 */
export function drawValue(
  config: DecimalConfig,
  rand: () => number,
  places = placesOf(config),
): Fixed | null {
  const by = scale(places);
  const { min, max } = bounds(config.range);
  const units = between(min * by, max * by, rand);
  return units > 0 ? fixed(units, places) : null;
}

/* ── Sums ──────────────────────────────────────────────────────────────── */

/** Which way round an `either` sheet's problem reads. */
function operationOf(
  operation: DecimalOperation,
  rand: () => number,
): Exclude<DecimalOperation, "both"> {
  if (operation !== "both") return operation;
  return rand() < 0.5 ? "add" : "subtract";
}

/** A sum, a difference, or a decimal taken so many times. */
export function drawStandard(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const operation = operationOf(config.operation, rand);
  const left = drawValue(config, rand);
  if (left === null) return null;

  if (operation === "multiply") {
    if (config.by === "decimal") return timesDecimal(config, left, rand);
    const by = between(MULTIPLIER.min, MULTIPLIER.max, rand);
    return written(
      operation,
      [fixedText(left), String(by)],
      fixedText(timesWhole(left, by)),
    );
  }

  const right = drawValue(config, rand);
  if (right === null) return null;
  if (operation === "add") {
    return written(
      operation,
      [fixedText(left), fixedText(right)],
      fixedText(plusFixed(left, right)),
    );
  }

  // Nothing on a decimals sheet goes below zero, so the pair is turned round
  // rather than thrown away — the same bargain the arithmetic family strikes.
  // A difference of nothing is thrown away, because it answers itself.
  if (left.units === right.units) return null;
  const [top, bottom] =
    left.units > right.units ? [left, right] : [right, left];
  return written(
    operation,
    [fixedText(top), fixedText(bottom)],
    fixedText(minusFixed(top, bottom)),
  );
}

/**
 * A decimal multiplied by a decimal: 3.7 × 2.4.
 *
 * The multiplier is under ten, as the whole one is, and carries one to
 * `places` places, so the answer's place count varies down the page and
 * "count the places in both numbers" is a thing to do rather than a number to
 * remember. Neither number ends in a zero: `3.70 × 2.4` has three places in
 * the question and two in its digits, and the count the sheet asks for has to
 * be the count that is true.
 */
function timesDecimal(
  config: DecimalConfig,
  left: Fixed,
  rand: () => number,
): Drawn | null {
  if (left.units % 10 === 0) return null;
  const places = between(1, placesOf(config), rand);
  const right = fixed(between(1, 10 * scale(places) - 1, rand), places);
  if (right.units % 10 === 0) return null;
  return written(
    "multiply",
    [fixedText(left), fixedText(right)],
    fixedText(timesFixed(left, right)),
  );
}

/**
 * A sum in both the shapes it can print: the sentence, and the stack.
 *
 * Column form is where the sheet earns its keep. Every value prints to the same
 * number of places, so two of them right-aligned in `tabular-nums` put their
 * points in a column without anything having to align them — which is the one
 * thing a child working a decimal sum has to get right.
 */
function written(
  operation: Exclude<DecimalOperation, "both">,
  operands: string[],
  answer: string,
): Drawn {
  const sign = SIGN[operation];
  // Addition folds — `1.4 + 0.25` and `0.25 + 1.4` are one problem — while a
  // difference and a multiple do not.
  const key =
    operation === "add"
      ? `${operation}:${[...operands].sort().join(":")}`
      : `${operation}:${operands.join(":")}`;
  return {
    key,
    prompt: `${operands[0]} ${sign} ${operands[1]} =`,
    operands,
    operator: sign,
    answer,
  };
}

/* ── Percents ──────────────────────────────────────────────────────────── */

/**
 * "25% of 80 =", with the amount drawn to suit the percent.
 *
 * The percent is chosen first and the amount is then walked in the steps that
 * keep the answer whole, rather than both being drawn freely and the pair
 * rejected when it isn't. That is not a saving, it is the difference between a
 * varied page and a page of one question: a percent divides a hundred well or
 * badly, and 5% comes out whole of one number in twenty while 50% does of one
 * in two — so a rejecting draw prints the friendliest percents over and over
 * and leaves the rest of the list off the sheet almost entirely. Choosing the
 * percent first gives every one of them the same share of the page.
 */
export function drawPercent(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const percent = AMOUNT_PERCENTS[Math.floor(rand() * AMOUNT_PERCENTS.length)];
  const { min, max } = bounds(config.range);
  // How far apart the amounts are that this percent comes out whole from: every
  // fourth number for a quarter, every second for a half, every twentieth for
  // 5%. A range with none of them in it is a request with no answers in it, and
  // an empty draw is the honest reply — the miss budget ends the page.
  const step = 100 / gcd(100, percent);
  const first = Math.ceil(Math.max(min, 1) / step);
  const last = Math.floor(max / step);
  if (first > last) return null;
  const amount = between(first, last, rand) * step;
  return {
    key: `percent:${percent}:${amount}`,
    prompt: `${percent}% of ${amount} =`,
    answer: String((percent * amount) / 100),
  };
}

/**
 * The same number in another form: a decimal as a percent, a percent as a
 * decimal, or a fraction as a decimal.
 *
 * Three directions rather than every pair, because the blank has to say what it
 * wants without a sentence beside it: a blank with a `%` after it wants a
 * percent and every other blank wants a decimal, which is one rule a child can
 * hold. "0.75 = _" answered with a fraction would be a right answer marked
 * wrong.
 *
 * Each direction draws only from what is legal at the places the sheet is set
 * at, rather than drawing freely and rejecting. That is not an optimisation:
 * a tenths sheet has ten legal percents and a hundred illegal ones, so a
 * rejecting draw spends nine tenths of its budget on the one direction that
 * always succeeds, and prints a page of "70% = _" with two other questions
 * hiding at the bottom.
 */
export function drawConvert(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const by = scale(places);
  const direction = between(0, 2, rand);

  if (direction === 0) {
    // A decimal, as a percent — drawn as the percent and written out as the
    // decimal, which is the same question from the end that has whole numbers
    // in it. Values up to one whole, which is where percents are taught before
    // anything is over a hundred of them.
    const percent = between(1, 100 / percentStep(by), rand) * percentStep(by);
    return {
      key: `convert:decimal:${percent}`,
      prompt: `${fixedText(fixed((percent * by) / 100, places))} = _%`,
      answer: String(percent),
    };
  }

  if (direction === 1) {
    const usable = PERCENTS.filter((percent) => (percent * by) % 100 === 0);
    if (usable.length === 0) return null;
    const percent = usable[Math.floor(rand() * usable.length)];
    return {
      key: `convert:percent:${percent}`,
      prompt: `${percent}% = _`,
      answer: fixedText(fixed((percent * by) / 100, places)),
    };
  }

  const usable = FRIENDLY.filter((d) => by % d === 0);
  if (usable.length === 0) return null;
  const d = usable[Math.floor(rand() * usable.length)];
  const n = between(1, d - 1, rand);
  // In lowest terms, so the fraction on the page is the one a child recognises:
  // `2/4 = 0.5` teaches them to simplify first and then convert, which is two
  // questions in one blank.
  if (gcd(n, d) !== 1) return null;
  return {
    key: `convert:fraction:${n}:${d}`,
    prompt: `${n}/${d} = _`,
    answer: fixedText(fixed((n * by) / d, places)),
  };
}
