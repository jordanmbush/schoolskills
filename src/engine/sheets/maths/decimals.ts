/**
 * Decimals and percents — the same machinery as every family before it (§7,
 * §11), over numbers that are famously easy to get subtly wrong.
 *
 * **Nothing here is ever a float**, and a decimal is only ever multiplied by a
 * whole number. `maths/exact.ts` holds both shapes and the reasons. Division
 * keeps to that by running backwards: the answer is drawn and the dividend is
 * made from it, so no quotient is ever found (§22).
 *
 * **A percent answer is a whole number, by construction.** 15% of 80 is 12, and
 * 15% of 81 is 12.15 — a different lesson, and one that belongs on a money sheet
 * where two places are the point. So the amount is walked in steps that keep the
 * answer whole rather than rounded back to one that isn't.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  DecimalConfig,
  DecimalOperation,
  DivisionHelp,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import {
  fixed,
  fixedText,
  gcd,
  minusFixed,
  plusFixed,
  scale,
  timesWhole,
  type Fixed,
} from "./exact";
import { HELP_NAME, bracketHeight, divisionHelp, divisionLines } from "./long";
import { divisionTableau, type Tableau } from "./tableau";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4). Stacked it is the two numbers, the rule and the
   answer under it — the same drawing an addition sheet has, with the points
   lined up. A division in columns is the bracket instead, and its height is
   the squares it reserves.                                                  */

const STACK_EMS = 4.4;

/**
 * Two lines of the body type and the air a wrap puts between them: `13.47 +
 * 8.06 =` with a ruled blank after it is a wide sentence.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work a problem out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** Four columns. `13.47 + 8.06 =` is twice the sentence `7 × 8 =` is. */
const MAX_COLUMNS = 4;

/** Tenths, hundredths, thousandths. Past that it is a physics sheet. */
const MAX_PLACES = 3;

/** What a decimal is multiplied by: three lots of 1.25, never seventy of it. */
const MULTIPLIER = { min: 2, max: 9 };

/** What a decimal is divided by unless the config says: the single digits. */
const DIVISOR = { min: 2, max: 9 };

/**
 * As far as a divisor may run. Two digits is the harder sheet a parent asks
 * for by name; three is a calculator's, and the squares it would take under
 * the bracket would not fit the column.
 */
const MAX_DIVISOR = 99;

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

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

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

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

const placesOf = (config: DecimalConfig): number =>
  clamp(config.places ?? 2, 1, MAX_PLACES);

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range?.min ?? 0));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 0)) };
}

/** The divisor span, made safe to draw from whatever a saved config says. */
function divisorOf(config: DecimalConfig): { min: number; max: number } {
  const asked = config.divisor ?? DIVISOR;
  const min = clamp(asked.min ?? DIVISOR.min, DIVISOR.min, MAX_DIVISOR);
  const max = clamp(Math.max(min, asked.max ?? min), DIVISOR.min, MAX_DIVISOR);
  return { min, max };
}

/**
 * The three divisions a sheet can set (§22), decided once so the draw, the
 * layout and the title cannot disagree about which it is. Dividing *by* a
 * decimal wins over a whole dividend: they are two lessons rather than one
 * question with two switches on.
 */
type Division = "byWhole" | "byDecimal" | "wholeDividend";

function divisionOf(config: DecimalConfig): Division {
  if (config.by === "decimal") return "byDecimal";
  return config.wholeDividend === true ? "wholeDividend" : "byWhole";
}

/**
 * One value from the range, in the smallest unit the sheet counts in.
 *
 * Drawn as a whole number of hundredths rather than as a decimal rounded
 * afterwards: rounding is where a place count stops being a promise. A value of
 * nothing is rejected — `0.00 + 3.45` is not a question about decimals.
 */
function drawValue(config: DecimalConfig, rand: () => number): Fixed | null {
  const places = placesOf(config);
  const by = scale(places);
  const { min, max } = bounds(config.range);
  const units = between(min * by, max * by, rand);
  return units > 0 ? fixed(units, places) : null;
}

/* ── Drawing a problem ─────────────────────────────────────────────────────
   Each style draws its own shape, and they have little in common beyond having
   an answer. So each returns the same answers: what it reads, what the answer
   is, how it is stacked if it is stacked, and what makes two of them the same
   problem.                                                                   */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  operands?: string[];
  operator?: string;
  /** The bracket as far as the draw decides it; the layout adds the squares. */
  bracket?: { divisor: string; dividend: string };
};

type Draw = (config: DecimalConfig, rand: () => number) => Drawn | null;

/** Which way round an `either` sheet's problem reads. */
function operationOf(
  operation: DecimalOperation,
  rand: () => number,
): Exclude<DecimalOperation, "both"> {
  if (operation !== "both") return operation;
  return rand() < 0.5 ? "add" : "subtract";
}

/** A sum, a difference, or a decimal taken so many times. */
function drawStandard(config: DecimalConfig, rand: () => number): Drawn | null {
  const operation = operationOf(config.operation, rand);
  const left = drawValue(config, rand);
  if (left === null) return null;

  if (operation === "multiply") {
    const by = between(MULTIPLIER.min, MULTIPLIER.max, rand);
    return written(
      config,
      operation,
      [fixedText(left), String(by)],
      fixedText(timesWhole(left, by)),
    );
  }

  const right = drawValue(config, rand);
  if (right === null) return null;
  if (operation === "add") {
    return written(
      config,
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
    config,
    operation,
    [fixedText(top), fixedText(bottom)],
    fixedText(minusFixed(top, bottom)),
  );
}

/**
 * A problem written the way the config asks: along a line, or stacked.
 *
 * Column form is where the sheet earns its keep. Every value prints to the same
 * number of places, so two of them right-aligned in `tabular-nums` put their
 * points in a column without anything having to align them — which is the one
 * thing a child working a decimal sum has to get right.
 */
function written(
  config: DecimalConfig,
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
  if (config.form === "vertical") {
    return { key, prompt: "", operands, operator: sign, answer };
  }
  return { key, prompt: `${operands[0]} ${sign} ${operands[1]} =`, answer };
}

/**
 * A decimal divided by a whole number: 8.46 ÷ 3.
 *
 * The quotient is drawn and the dividend made from it, so the division comes
 * out exactly and every promise the config makes holds of the answer — which
 * is the number a parent set the places and the range for.
 */
function drawByWhole(config: DecimalConfig, rand: () => number): Drawn | null {
  const quotient = drawValue(config, rand);
  if (quotient === null) return null;
  const { min, max } = divisorOf(config);
  const divisor = between(min, max, rand);
  const dividend = fixedText(timesWhole(quotient, divisor));
  return divided(config, dividend, divisor, quotient);
}

/**
 * A whole number divided to a decimal answer: 7 ÷ 4 = 1.75.
 *
 * The divisor is drawn first and the quotient then walked in the steps that
 * make their product whole, for the reason `drawPercent` gives: a divisor
 * makes a whole number of one quotient in fifty at two places (2) or one in
 * twenty-five (4), so a draw that made a pair and rejected it would print the
 * friendliest divisors over and over. A divisor with no factor of ten in it —
 * 3, 7, 9 — makes a whole number of no decimal quotient at all, and is left
 * out rather than rounded in. A whole quotient is left out too, because an
 * answer that runs past the point is what this sheet promises.
 *
 * In columns the dividend prints with the zeros annexed, `7.00`, which is the
 * form a child keeps dividing into; along a line it is the whole number it is.
 */
function drawWholeDividend(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const by = scale(places);
  const span = divisorOf(config);
  const divisor = between(span.min, span.max, rand);
  const step = by / gcd(by, divisor);
  if (step === by) return null;
  const { min, max } = bounds(config.range);
  const first = Math.ceil(Math.max(min * by, 1) / step);
  const last = Math.floor((max * by) / step);
  if (first > last) return null;
  const units = between(first, last, rand) * step;
  if (units % by === 0) return null;
  const quotient = fixed(units, places);
  const product = timesWhole(quotient, divisor);
  const whole = String(product.units / by);
  return divided(config, whole, divisor, quotient, fixedText(product));
}

/**
 * A decimal divided by a decimal: 8.4 ÷ 0.2.
 *
 * Drawn as the whole-number division a child rewrites it into — 84 ÷ 2 — and
 * then each side is given its places: the divisor one to `places`, and the
 * dividend at least as many, so the answer is the whole quotient with the
 * point moved back by the difference, exact by construction. Neither side
 * ends in a zero, because the two sides carry different place counts by
 * design and `8.40 ÷ 0.2` is a number written the long way for no column to
 * line up on. Along a line only: set in a bracket it would be the rewritten
 * sum rather than the question, and the rewriting is the lesson (§22).
 */
function drawByDecimal(
  config: DecimalConfig,
  rand: () => number,
): Drawn | null {
  const places = placesOf(config);
  const { min, max } = bounds(config.range);
  if (max < 1) return null;
  const quotient = between(Math.max(1, min), max, rand);
  const span = divisorOf(config);
  const divisor = between(span.min, span.max, rand);
  const dividend = quotient * divisor;
  if (dividend % 10 === 0 || divisor % 10 === 0) return null;
  const divisorPlaces = between(1, places, rand);
  const dividendPlaces = between(divisorPlaces, places, rand);
  // A number divided by itself answers itself.
  if (quotient === 1 && dividendPlaces === divisorPlaces) return null;
  const left = fixedText(fixed(dividend, dividendPlaces));
  const right = fixedText(fixed(divisor, divisorPlaces));
  return {
    key: `divide:${left}:${right}`,
    prompt: `${left} ÷ ${right} =`,
    answer: fixedText(fixed(quotient, dividendPlaces - divisorPlaces)),
  };
}

/**
 * A division written the way the config asks: along a line, or in the bracket.
 *
 * `annexed` is what the bracket prints where that differs from what the
 * sentence says — `7.00` for a whole dividend, so there are zeros to divide
 * into. The key is the sentence's, so the same division is one problem in
 * either form.
 */
function divided(
  config: DecimalConfig,
  dividend: string,
  divisor: number,
  quotient: Fixed,
  annexed = dividend,
): Drawn {
  const key = `divide:${dividend}:${divisor}`;
  const answer = fixedText(quotient);
  if (bracketed(config)) {
    return {
      key,
      prompt: "",
      answer,
      bracket: { divisor: String(divisor), dividend: annexed },
    };
  }
  return { key, prompt: `${dividend} ÷ ${divisor} =`, answer };
}

/**
 * The working under a decimal dividend (§22).
 *
 * Computed on the digits alone — the point is not a column — and then the
 * quotient is padded back to the units column with zeros, so a quotient below
 * one is written `0.23` and never `.23`. The zeros are written digits: a child
 * writes them, and a guided sheet shades their squares.
 */
export function decimalTableau(dividend: string, divisor: number): Tableau {
  const point = dividend.indexOf(".");
  const digits = dividend.replace(".", "");
  const tableau = divisionTableau(digits, divisor);
  const units = point < 0 ? digits.length - 1 : Math.max(0, point - 1);
  const { text, start } = tableau.quotient;
  if (start <= units) return tableau;
  return {
    ...tableau,
    quotient: { text: "0".repeat(start - units) + text, start: units },
  };
}

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
function drawPercent(config: DecimalConfig, rand: () => number): Drawn | null {
  const percent = AMOUNT_PERCENTS[Math.floor(rand() * AMOUNT_PERCENTS.length)];
  const { min, max } = bounds(config.range);
  // How far apart the amounts are that this percent comes out whole from: every
  // fourth number for a quarter, every second for a half, every twentieth for
  // 5%. A range with none of them in it is a request with no answers in it, and
  // an empty draw is the honest reply — the miss budget above ends the page.
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
function drawConvert(config: DecimalConfig, rand: () => number): Drawn | null {
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

/** Which draw a sheet is made of. */
function drawerOf(config: DecimalConfig): Draw {
  if (config.style === "percent") return drawPercent;
  if (config.style === "convert") return drawConvert;
  if (config.operation !== "divide") return drawStandard;
  switch (divisionOf(config)) {
    case "byDecimal":
      return drawByDecimal;
    case "wholeDividend":
      return drawWholeDividend;
    default:
      return drawByWhole;
  }
}

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * Whether this sheet stacks its problems. Only the arithmetic one can, and a
 * division by a decimal never is: it is rewritten before it is worked, and a
 * bracket round it would be the rewritten sum rather than the question (§22).
 */
const stacked = (config: DecimalConfig): boolean =>
  config.style === "standard" &&
  config.form === "vertical" &&
  !(config.operation === "divide" && divisionOf(config) === "byDecimal");

/** Whether its divisions are set in the bracket. */
const bracketed = (config: DecimalConfig): boolean =>
  stacked(config) && config.operation === "divide";

/**
 * How many digits the longest dividend on the sheet can have, the point aside:
 * the largest quotient the range allows times the largest divisor. A bound
 * rather than a measurement, so the squares can be reserved before a division
 * is drawn — the same reason `divisionLines` takes digit counts.
 */
function dividendDigits(config: DecimalConfig): number {
  const { max } = bounds(config.range);
  const largest = Math.max(1, max) * scale(placesOf(config));
  return String(largest * divisorOf(config).max).length;
}

/** The squares reserved under every bracket, or `null` when nothing is bracketed. */
function bracketOf(
  config: DecimalConfig,
): { cell: Mil; rows: number; help: DivisionHelp } | null {
  if (!bracketed(config)) return null;
  const by = String(divisorOf(config).min).length;
  return {
    cell: answerLine(config.fontPt),
    rows: divisionLines({ into: dividendDigits(config), by }),
    help: divisionHelp(config),
  };
}

/** How tall one problem stands, working space and all. */
function rowHeight(config: DecimalConfig): Mil {
  // A bracket spends its reservation on the squares under the dividend and
  // takes no blank paper besides, as a long division does.
  const bracket = bracketOf(config);
  if (bracket)
    return bracketHeight(config.fontPt) + bracket.rows * bracket.cell;
  // A stack is one flex item and cannot wrap, so it is reserved for as what it
  // is: two numbers, a rule and the answer under it.
  const body = stacked(config)
    ? points(config.fontPt * STACK_EMS)
    : writtenRow(config.fontPt);
  return body + (config.workspace ? WORKSPACE : 0);
}

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function decimalLayout(config: DecimalConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const columns = clamp(config.columns, 1, MAX_COLUMNS);
  const row = rowHeight(config);
  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(box.height, row, PROBLEM_GAP.y),
  };
}

/** A draw as it is printed: along a line, in a stack, or in the bracket. */
function problemOf(
  drawn: Drawn,
  squares: ReturnType<typeof bracketOf>,
  extras: { workspace?: Mil },
): Problem {
  if (drawn.bracket && squares) {
    const { dividend, divisor } = drawn.bracket;
    return {
      prompt: "",
      answer: drawn.answer,
      bracket: {
        ...drawn.bracket,
        ...squares,
        tableau: decimalTableau(dividend, Number(divisor)),
      },
    };
  }
  return {
    prompt: drawn.prompt,
    answer: drawn.answer,
    ...(drawn.operands
      ? { operands: drawn.operands, operator: drawn.operator }
      : {}),
    ...extras,
  };
}

/**
 * Every problem on the sheet, in the order they are printed.
 *
 * Exported because it is the whole of what a test has to check.
 */
export function decimalProblems(
  config: DecimalConfig,
  seed: number,
): Problem[] {
  const { perPage } = decimalLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const draw = drawerOf(config);
  const squares = bracketOf(config);
  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = draw(config, rand);
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push(problemOf(drawn, squares, extras));
    misses = 0;
  }
  return problems;
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME = {
  add: "Adding",
  subtract: "Subtracting",
  multiply: "Multiplying",
  divide: "Dividing",
  both: "Adding and subtracting",
} as const;

/** The three divisions, named by what makes each a different lesson (§22). */
const DIVISION_NAME: Record<Division, string> = {
  byWhole: "Dividing decimals",
  byDecimal: "Dividing by a decimal",
  wholeDividend: "Division with decimal answers",
};

/** What a place count is called out loud, which is how a lesson names it. */
const PLACE_NAME = ["", "tenths", "hundredths", "thousandths"] as const;

/** "Adding decimals" — the phrase a parent says, and the one they search. */
function titleOf(config: DecimalConfig): string {
  switch (config.style) {
    case "percent":
      return "Percentages of amounts";
    case "convert":
      return "Fractions, decimals and percents";
    default:
      if (config.operation === "divide")
        return DIVISION_NAME[divisionOf(config)];
      return `${OPERATION_NAME[config.operation] ?? OPERATION_NAME.add} decimals`;
  }
}

/**
 * What a child is told on a division sheet, which is the one sentence the
 * method turns on: where the point goes, or that the sum is rewritten first.
 */
function divisionInstruction(config: DecimalConfig): string {
  switch (divisionOf(config)) {
    case "byDecimal":
      return "Work out each answer. Multiply both numbers by 10, or by 100, until you are dividing by a whole number, then divide.";
    case "wholeDividend":
      return stacked(config)
        ? "Work out each answer. Keep dividing into the zeros after the point, and put the point in the answer straight above the point in the number."
        : "Work out each answer. Keep dividing past the point, writing zeros after it if you need them.";
    default:
      return stacked(config)
        ? "Work out each answer. Put the point in the answer straight above the point in the number."
        : "Work out each answer.";
  }
}

function instructionOf(config: DecimalConfig): string {
  switch (config.style) {
    case "percent":
      return "Work out each amount.";
    case "convert":
      // Said plainly, because the blank cannot say it: a child who writes a
      // fraction where a decimal was wanted has answered a question nobody
      // asked, and would be marked wrong for it.
      return "Fill in each blank. A blank with a % after it wants a percent; every other blank wants a decimal.";
    default:
      if (config.operation === "divide") return divisionInstruction(config);
      if (!stacked(config)) return "Work out each answer.";
      // A stack of sums lines up on the point, because every value on the sheet
      // is printed to the same number of places. A multiplier is not a decimal
      // at all — `1.25 × 3` has one point in it — so "keep the points under one
      // another" describes a column that isn't there, and §10 makes this
      // sentence the whole of the guidance a child gets.
      return config.operation === "multiply"
        ? "Work out each answer. Line the digits up on the right, then put the point back in."
        : "Work out each answer. Keep the points under one another.";
  }
}

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: DecimalConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions: config.instructions ?? instructionOf(config),
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * The things the title leaves off are the ones that decide whether a sheet
 * matches the lesson: how big the divisors are, how far past the point the
 * numbers go, whether the sum is written along a line or worked in columns,
 * and how much help is drawn under the bracket.
 */
function describeDecimals(config: DecimalConfig): string {
  const dividing = config.style === "standard" && config.operation === "divide";
  const squares = bracketOf(config);
  return [
    titleOf(config),
    dividing && divisorOf(config).min >= 10 ? "by two-digit numbers" : null,
    config.style === "percent" ? null : PLACE_NAME[placesOf(config)],
    stacked(config) ? "in columns" : null,
    squares ? HELP_NAME[squares.help] : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

function buildDecimalSheet(config: DecimalConfig, seed: number): Sheet {
  const items = decimalProblems(config, seed);
  const { columns } = decimalLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const DECIMALS_SHEET: SheetSpec<DecimalConfig> = {
  world: SHEET_WORLD,
  build: buildDecimalSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeDecimals,
};
