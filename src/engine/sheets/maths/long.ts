/**
 * The long forms: long multiplication, and the division bracket.
 *
 * Every sheet before this one asked for an answer. These two ask for a
 * *method*: the partial products written one under another and shifted a place
 * each time, or the bring-down-and-subtract of long division. So the thing the
 * page has to get right is not the answer — it is the room to work in and the
 * columns to work in it, and both of those are declared here rather than
 * discovered in a browser (§4).
 *
 * Which makes the two numbers that matter the digit counts. `into` is the
 * number being worked on — the multiplicand, or the dividend — and `by` the one
 * doing the working, the multiplier or the divisor. Everything else on the row
 * follows from them: how many partial products there are to write, how many
 * times a division brings a digit down, and therefore how tall the row stands.
 *
 * It lives beside `multiplication.ts` rather than inside it because it shares
 * almost nothing with the fact styles: no tables, no factors, no folding of
 * commutative pairs (347 × 26 and 26 × 347 are the same product and two
 * different exercises), and a row height that comes from digits rather than
 * from the body type alone.
 */
import { between } from "@/engine/random";

import type { LongDigits, Mil, MultiplicationConfig, Problem } from "../types";

import { answerLine } from "../layout";
import { points } from "../paper";

/**
 * How many digits a long form may be asked for.
 *
 * Five into one is already past anything a primary child is set, and the cap
 * is here so that a config from outside this build can't ask for a
 * twenty-digit dividend and a row taller than the paper.
 */
const MAX_DIGITS = 5;

/** Three-digit by two-digit: the long multiplication everybody means. */
export const DEFAULT_DIGITS: LongDigits = { into: 3, by: 2 };

/**
 * The two shapes a problem worked on paper takes, in ems of the body type and
 * trailing sheet.css the way every declared height here does.
 *
 * Exported because the fact styles print the same two drawings without any
 * working in them — a column form times-table sheet is this stack and nothing
 * else — and a second copy of either number would be a second thing to keep in
 * step with `.sheet__column` and `.sheet__bracket`.
 */
export const STACK_EMS = 4.4;
/* The bracket is two lines of body type, the bar between them and the padding
   either side of it — which comes to a shade over three ems at every size the
   sheet is set at, and is rounded up rather than down. Reserving a tenth of an
   inch too much costs one problem at the bottom of the page; reserving too
   little puts that problem on a second sheet of paper. */
export const BRACKET_EMS = 3.1;

/** The smallest and largest whole number with exactly this many digits. */
function span(digits: number): { min: number; max: number } {
  const places = Math.max(1, Math.min(MAX_DIGITS, Math.floor(digits) || 1));
  return { min: places === 1 ? 1 : 10 ** (places - 1), max: 10 ** places - 1 };
}

/** The digit counts, made safe to draw from whatever a saved config says. */
export function longDigits(config: MultiplicationConfig): LongDigits {
  const asked = config.digits ?? DEFAULT_DIGITS;
  const clamp = (value: number, low: number): number =>
    Math.max(low, Math.min(MAX_DIGITS, Math.floor(value) || low));
  return { into: clamp(asked.into, 1), by: clamp(asked.by, 1) };
}

/* ── What is drawn ─────────────────────────────────────────────────────── */

export type LongMultiplication = {
  operation: "multiply";
  into: number;
  by: number;
  product: number;
  /**
   * One partial product per digit of the multiplier, units first — `347 × 26`
   * is 2082 and then 6940, not 2082 and 694. The shift is part of the
   * arithmetic rather than something the renderer does with padding, because a
   * partial written in the wrong column is the entire mistake this sheet
   * exists to practise out of a child.
   *
   * A zero digit keeps its row. The algorithm writes it, so the key shows it.
   */
  partials: number[];
};

export type LongDivision = {
  operation: "divide";
  divisor: number;
  dividend: number;
  quotient: number;
  /** Zero unless the config asked for remainders, and never as large as the divisor. */
  remainder: number;
};

export type LongForm = LongMultiplication | LongDivision;

/**
 * The multiplier and the divisor never come out as one.
 *
 * "Long multiplication by 1" and "long division by 1" are the same sheet with
 * the answer already written on it, and a single-digit draw would produce them
 * about a ninth of the time.
 */
const workingMin = (digits: number): number => Math.max(2, span(digits).min);

/** The partial products of `into × by`, units place first. */
function partialsOf(into: number, by: number): number[] {
  const places = String(by).length;
  return Array.from({ length: places }, (_, place) => {
    const digit = Math.floor(by / 10 ** place) % 10;
    return into * digit * 10 ** place;
  });
}

/**
 * One long multiplication, drawn from the digit counts the config asked for.
 *
 * Both numbers have exactly the number of digits requested, which is the whole
 * of what "three-digit by two-digit" promises: a sheet that quietly slipped a
 * two-digit multiplicand in is a sheet set at a level nobody chose.
 */
function drawMultiplication(
  digits: LongDigits,
  rand: () => number,
): LongMultiplication {
  const top = span(digits.into);
  const bottom = span(digits.by);
  const into = between(top.min, top.max, rand);
  const by = between(workingMin(digits.by), bottom.max, rand);
  return {
    operation: "multiply",
    into,
    by,
    product: into * by,
    partials: partialsOf(into, by),
  };
}

/**
 * One long division, or `null` when the digit counts leave nothing to draw.
 *
 * Built from the answer outwards — divisor, remainder, quotient, and the
 * dividend last — because that is the only order in which every one of the
 * config's promises can be kept at once. Drawing a dividend first and dividing
 * it would give a remainder nobody asked for and a quotient with no bound on
 * it; this way the dividend lands inside its digit count by construction, and
 * "without remainders" means the division comes out exactly rather than nearly.
 *
 * There is no division by zero here and there cannot be: a divisor is drawn
 * from two upwards (§20).
 */
function drawDivision(
  digits: LongDigits,
  remainders: boolean,
  rand: () => number,
): LongDivision | null {
  const divisor = between(workingMin(digits.by), span(digits.by).max, rand);
  const remainder = remainders ? between(1, divisor - 1, rand) : 0;

  // The quotient is whatever leaves the dividend with exactly `into` digits.
  const { min, max } = span(digits.into);
  const low = Math.max(1, Math.ceil((min - remainder) / divisor));
  const high = Math.floor((max - remainder) / divisor);
  // Nothing to draw: a two-digit divisor into a one-digit dividend is not a
  // division, and an empty sheet is the honest answer to asking for one.
  if (high < low) return null;

  const quotient = between(low, high, rand);
  return {
    operation: "divide",
    divisor,
    dividend: divisor * quotient + remainder,
    quotient,
    remainder,
  };
}

/** One long form of whichever kind the config asks for, or `null`. */
export function drawLong(
  config: MultiplicationConfig,
  operation: "multiply" | "divide",
  rand: () => number,
): LongForm | null {
  const digits = longDigits(config);
  return operation === "multiply"
    ? drawMultiplication(digits, rand)
    : drawDivision(digits, config.remainders === true, rand);
}

/**
 * What makes two long forms the same exercise.
 *
 * Multiplication does *not* fold here, though it folds everywhere else on a
 * times-table sheet: 26 × 47 and 47 × 26 are one product and two different
 * pieces of written work, with the partials in different places and a
 * different number of them. Folding them would throw away half the pool of a
 * sheet whose two digit counts are equal, to prevent a repetition that is not
 * one.
 */
export function longKey(form: LongForm): string {
  return form.operation === "multiply"
    ? `×:${form.into}:${form.by}`
    : `÷:${form.dividend}:${form.divisor}`;
}

/* ── What it takes on the page ─────────────────────────────────────────── */

/**
 * How many ruled lines of working a long division reserves.
 *
 * Two per digit of the quotient — the product you take away, and what is left
 * of the dividend after you have. The quotient can be no longer than
 * `into − by + 1` digits, which is a bound rather than a measurement and so
 * can be computed before a single division has been drawn: the layout has to
 * know how tall the row is before the row exists.
 */
export function divisionLines(digits: LongDigits): number {
  return 2 * Math.max(1, digits.into - digits.by + 1);
}

/**
 * How many partial products a long multiplication writes: one per digit of the
 * multiplier, and none at all when there is only one of them — `347 × 6` is
 * worked in the total line, and a row of blank rules over the answer would be
 * a sheet asking a child to show working that does not exist.
 */
export function partialLines(digits: LongDigits): number {
  return digits.by > 1 ? digits.by : 0;
}

/** How tall a long form of this shape stands, working space included. */
export function longRow(config: MultiplicationConfig, fontPt: number): Mil {
  const digits = longDigits(config);
  const line = answerLine(fontPt);
  const multiplication =
    points(fontPt * STACK_EMS) + partialLines(digits) * line;
  const division = points(fontPt * BRACKET_EMS) + divisionLines(digits) * line;
  switch (config.operation) {
    case "multiply":
      return multiplication;
    case "divide":
      return division;
    // A mixed sheet reserves for whichever is taller, because it prints both
    // and the row height is one number for the whole grid of them.
    default:
      return Math.max(multiplication, division);
  }
}

/**
 * A drawn long form, as it will be printed.
 *
 * The two shapes are as different on paper as they are in a child's exercise
 * book: a multiplication is the column stack the `arithmetic` family already
 * prints, with ruled lines between the rule and the total for the partials; a
 * division is the bracket, whose answer goes *above* the problem and whose
 * working goes underneath it.
 */
export function longProblem(
  form: LongForm,
  config: MultiplicationConfig,
): Problem {
  const digits = longDigits(config);
  const line = answerLine(config.fontPt);

  if (form.operation === "multiply") {
    // What the layout reserved, and what the draw produced. They are the same
    // number by construction — a multiplier drawn inside its digit count has
    // exactly that many digits — and the reservation is what decides whether
    // the bottom row of the page comes out on a second sheet, so the count the
    // page was measured for is the one that governs.
    const lines = partialLines(digits);
    return {
      // Empty, because the stack is the prompt — the same bargain the column
      // sums make. There is no second copy of the problem written along a line
      // for the two to disagree about.
      prompt: "",
      operands: [String(form.into), String(form.by)],
      operator: "×",
      answer: String(form.product),
      ...(lines > 0
        ? {
            working: form.partials.slice(0, lines).map(String),
            workspace: lines * line,
          }
        : {}),
    };
  }

  return {
    prompt: "",
    bracket: { divisor: String(form.divisor), dividend: String(form.dividend) },
    // "234 r 2" — the way it is written on paper, and the way a child is asked
    // to write it. A remainder of nothing is not written at all rather than
    // written as "r 0", which is a different (and wrong) sentence.
    answer:
      form.remainder > 0
        ? `${form.quotient} r ${form.remainder}`
        : String(form.quotient),
    workspace: divisionLines(digits) * line,
  };
}
