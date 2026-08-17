/**
 * Decimals and percents.
 *
 * The same machinery as every family before it — answers computed when the
 * problem is built, the page a function of `(config, seed)`, problems drawn and
 * rejected rather than enumerated — over numbers that are famously easy to get
 * subtly wrong.
 *
 * **Nothing here is ever a float.** `0.1 + 0.2` is 0.30000000000000004 in the
 * language this is written in, and that answer would print. So a value is a
 * whole number of tenths, hundredths or thousandths from the moment it is drawn
 * to the moment `fixedText` writes the point into it, and the arithmetic is
 * whole-number arithmetic. `maths/exact.ts` holds the type and the reason.
 *
 * **Multiplying is by a whole number.** `0.25 × 0.4` has fewer places than
 * either number that made it and `2.5 × 2.5` has more, so a sheet set at two
 * places would quietly print answers at four. Three lots of 1.25 is the
 * question a child is actually set at this stage, and it keeps the promise the
 * config makes.
 *
 * **A percent answer is a whole number, by construction.** 15% of 80 is 12, and
 * 15% of 81 is 12.15 — a different lesson, and one that belongs on a money
 * sheet where two places are the point. So the draw rejects any pair that
 * doesn't come out whole rather than rounding one that doesn't.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  DecimalConfig,
  DecimalOperation,
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

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4). Stacked it is the two numbers, the rule and the
   answer under it — the same drawing an addition sheet has, with the points
   lined up.                                                                  */

const STACK_EMS = 4.4;

/**
 * How tall a problem written along a line stands: two lines of the body type,
 * and the air a wrap puts between them.
 *
 * Two rather than one, because `13.47 + 8.06 =` with a ruled blank after it is
 * a wide sentence, and `.sheet__problem` wraps rather than overflowing — so the
 * second line is either inside the row the layout declared, or it is the bottom
 * of the page coming out of the printer on a second sheet. Reserving for the
 * wrap is the only version of this a page can be laid out from without
 * measuring text.
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

/**
 * The percentages a sheet asks for.
 *
 * The ones a child is taught to recognise rather than every whole number
 * between 1 and 100: "37% of 200" is a calculator question, and "25% of 80" is
 * a quarter of eighty, which is the whole point of the lesson.
 */
const PERCENTS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 100];

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

const SIGN = { add: "+", subtract: "−", multiply: "×" } as const;

/* ── The numbers on the page ───────────────────────────────────────────────
   Both bounds are sanitised once, because they arrive from outside this build:
   a config in a bookmarked URL may ask for nine places, or for a range that
   runs backwards.                                                            */

const placesOf = (config: DecimalConfig): number =>
  Math.min(MAX_PLACES, Math.max(1, Math.floor(config.places ?? 2)));

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range?.min ?? 0));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 0)) };
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
   an answer. So each returns the same four answers: what it reads, what the
   answer is, how it is stacked if it is stacked, and what makes two of them the
   same problem.                                                              */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  operands?: string[];
  operator?: string;
};

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

/** "25% of 80 =", and only when the answer comes out whole. */
function drawPercent(config: DecimalConfig, rand: () => number): Drawn | null {
  const percent = PERCENTS[Math.floor(rand() * PERCENTS.length)];
  const { min, max } = bounds(config.range);
  const amount = between(min, max, rand);
  const part = percent * amount;
  if (amount <= 0 || part % 100 !== 0) return null;
  return {
    key: `percent:${percent}:${amount}`,
    prompt: `${percent}% of ${amount} =`,
    answer: String(part / 100),
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

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** Whether this sheet stacks its problems. Only the arithmetic one can. */
const stacked = (config: DecimalConfig): boolean =>
  config.style === "standard" && config.form === "vertical";

/** How tall one problem stands, working space and all. */
function rowHeight(config: DecimalConfig): Mil {
  // A stack is one flex item and cannot wrap, so it is reserved for as what it
  // is: two numbers, a rule and the answer under it.
  const body = stacked(config)
    ? points(config.fontPt * STACK_EMS)
    : writtenRow(config.fontPt);
  return body + (config.workspace ? WORKSPACE : 0);
}

/**
 * How many problems the paper holds, and how wide a column of them is.
 *
 * Arithmetic, not measurement, so `npm run test:unit` can answer "did it fit?"
 * without a browser — and so the same answer serves the catalog page built at
 * build time and the builder's preview (§4).
 */
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

/**
 * Every problem on the sheet, in the order they are printed.
 *
 * Exported because it is the whole of what a test has to check, and checking it
 * through the `Sheet` means unwrapping a block union to reach it.
 */
export function decimalProblems(
  config: DecimalConfig,
  seed: number,
): Problem[] {
  const { perPage } = decimalLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn =
      config.style === "percent"
        ? drawPercent(config, rand)
        : config.style === "convert"
          ? drawConvert(config, rand)
          : drawStandard(config, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({
      prompt: drawn.prompt,
      answer: drawn.answer,
      ...(drawn.operands
        ? { operands: drawn.operands, operator: drawn.operator }
        : {}),
      ...extras,
    });
    misses = 0;
  }
  return problems;
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME = {
  add: "Adding",
  subtract: "Subtracting",
  multiply: "Multiplying",
  both: "Adding and subtracting",
} as const;

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
      return `${OPERATION_NAME[config.operation] ?? OPERATION_NAME.add} decimals`;
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
      return stacked(config)
        ? "Work out each answer. Keep the points under one another."
        : "Work out each answer.";
  }
}

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
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
 * The two things the title leaves off are the two that decide whether a sheet
 * matches the lesson: how far past the point the numbers go, and whether the
 * sum is written along a line or worked in columns.
 */
export function describeDecimals(config: DecimalConfig): string {
  return [
    titleOf(config),
    config.style === "percent" ? null : PLACE_NAME[placesOf(config)],
    stacked(config) ? "in columns" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

export function buildDecimalSheet(config: DecimalConfig, seed: number): Sheet {
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
      // Out of what is actually on the page, not out of what was asked for: a
      // sheet that says "/ 20" over eighteen problems is wrong twice.
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const DECIMALS_SHEET: SheetSpec<DecimalConfig> = {
  id: "decimals",
  label: "Decimals and percents",
  world: SHEET_WORLD,
  build: buildDecimalSheet,
  // The whole of the answer-key mechanism: every answer on the page was
  // computed in whole units when the problem was built, so a key prints what is
  // already there rather than working it out a second time.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeDecimals,
};
