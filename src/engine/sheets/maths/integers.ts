/**
 * Integers, order of operations, powers and roots.
 *
 * The first family where a *right* answer and a *wrong* answer are the same
 * digits. 7 − 9 is 2 to a child who has not met the number line going the other
 * way, and −2 to one who has; both look like an answer, and a key that lost a
 * minus sign somewhere between the draw and the print would be marked as
 * correct by a parent reading down the column. So a sign is never inferred from
 * a subtraction and never recovered from a string: every number in this file is
 * a signed JavaScript integer from the moment it is drawn, and the only place a
 * minus sign is written is `signedText` and `factorText`, at the point of
 * printing.
 *
 * **A negative operand is bracketed.** `7 + −4` is two operators in a row and
 * `7 − −4` is worse; every worksheet, board and textbook writes `7 + (−4)`, so
 * the bracket is not decoration but the notation, and a sheet without it is one
 * a child cannot read aloud. `factorText` in `exact.ts` is where that lives.
 *
 * **Order of operations is the one sheet whose answer depends on nothing but
 * the reading.** `4 + 3 × 2` is 10 or 14 depending only on which rule a child
 * has been taught, so the expression printed on the page and the value in the
 * key must come from one structure — which is what each template returns. The
 * suite then reads the *printed* expression back with a precedence-aware parser
 * of its own, so a template whose text and value disagree fails there rather
 * than on paper.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  IntegerConfig,
  IntegerOperation,
  IntegerStyle,
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
import { inches } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { MINUS, factorText, signedText } from "./exact";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/**
 * Two lines of the body type and the air a wrap puts between them: `−12 ÷ (−4)
 * =` with a ruled slot after it is wider than a third of a page.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an answer out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Three columns of sums, and two of expressions.
 *
 * `(9 − 4) × 3 + 7 =` is half a line of type before its answer slot, and a
 * column narrower than the sentence is a page of problems each wrapped onto
 * three lines.
 */
const MAX_COLUMNS = 3;
const MAX_EXPRESSION_COLUMNS = 2;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

const SIGN: Record<Exclude<IntegerOperation, "both">, string> = {
  add: "+",
  subtract: MINUS,
  multiply: "×",
  divide: "÷",
};

const OPERATIONS = ["add", "subtract", "multiply", "divide"] as const;

/* ── Drawing a number ──────────────────────────────────────────────────── */

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(1, Math.floor(range?.min ?? 1));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

const pick = <T>(items: readonly T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

/** Whether this sheet may print a minus sign on a number. On unless refused. */
const signed = (config: IntegerConfig): boolean => config.negatives !== false;

/**
 * Whether an order-of-operations sheet may put a square on the page.
 *
 * On unless refused, because the rule is taught with powers in it. Turned off
 * it is the same rule a year earlier — and the sheet says so, because the
 * instruction line is written from this too.
 */
const powered = (config: IntegerConfig): boolean => config.powers !== false;

/**
 * One number of the size the config asked for, with its sign drawn separately.
 *
 * The range counts magnitudes — "numbers to twenty" is what a parent says, and
 * they mean twenty either way — so the sign is a coin rather than the bottom of
 * the range. Nought is never drawn: it is not an integer question, it is the
 * one number with no sign, and `0 ÷ 4` teaches nothing.
 */
function draw(
  config: IntegerConfig,
  rand: () => number,
  range = bounds(config.range),
): number {
  const size = between(range.min, range.max, rand);
  return signed(config) && rand() < 0.5 ? -size : size;
}

/* ── The four operations ───────────────────────────────────────────────── */

type Drawn = { key: string; prompt: string; answer: string };

/**
 * One sum over the integers.
 *
 * Division is built from its answer outwards — the quotient and the divisor are
 * drawn and the dividend is their product — for the same reason a unit
 * conversion is built from the larger unit (`measure.ts`): a dividend drawn on
 * its own divides exactly about a tenth of the time, and the nine draws thrown
 * away are nine chances for the sheet to come up short. Every sign follows from
 * the two numbers drawn, so the key cannot disagree with the page.
 */
function drawSum(config: IntegerConfig, rand: () => number): Drawn | null {
  const operation =
    config.operation === "both" || !OPERATIONS.includes(config.operation)
      ? pick(OPERATIONS, rand)
      : config.operation;

  if (operation === "divide") {
    const divisor = draw(config, rand);
    const quotient = draw(config, rand);
    return sum(operation, divisor * quotient, divisor, quotient);
  }

  const left = draw(config, rand);
  const right = draw(config, rand);
  if (operation === "add") return sum(operation, left, right, left + right);
  if (operation === "subtract") {
    // A sheet with the minus signs turned off means the *answers* too, and a
    // difference is the one operation here that goes below nought out of two
    // numbers that never did. So the pair is turned round rather than thrown
    // away — the same move `arithmetic.ts` makes, and for the same reason:
    // rejecting half the draws would halve the pool for no gain.
    const top = signed(config) ? left : Math.max(left, right);
    const bottom = signed(config) ? right : Math.min(left, right);
    return sum(operation, top, bottom, top - bottom);
  }
  return sum(operation, left, right, left * right);
}

/**
 * The sum as it is printed, and what makes two of them the same problem.
 *
 * Adding and multiplying fold on the pair — `3 × (−5)` and `−5 × 3` are one
 * fact, and a child who finds both on a page has been given nineteen problems
 * and a joke — while subtracting and dividing do not: turning those two round
 * gives a different answer, which is most of what this sheet is teaching.
 */
function sum(
  operation: Exclude<IntegerOperation, "both">,
  left: number,
  right: number,
  result: number,
): Drawn {
  const folds = operation === "add" || operation === "multiply";
  const pair = folds
    ? [Math.min(left, right), Math.max(left, right)]
    : [left, right];
  return {
    key: `${operation}:${pair[0]}:${pair[1]}`,
    prompt: `${signedText(left)} ${SIGN[operation]} ${factorText(right)} =`,
    answer: signedText(result),
  };
}

/* ── Powers and roots ──────────────────────────────────────────────────────
   Written with the superscripts and the radicals a child will meet, because a
   sheet that printed "5^2" would be teaching them to read a keyboard.        */

/** The two powers a child is taught by name, and the roots that undo them. */
const POWERS = [
  { exponent: 2, mark: "²", radical: "√" },
  { exponent: 3, mark: "³", radical: "∛" },
] as const;

/**
 * How big a base may get, by power.
 *
 * A square to fifteen is 225 and a cube to seven is 343; a cube of twelve is
 * 1728, which is not a harder question so much as a different one — the child
 * is being asked to multiply three-digit numbers, and that sheet lives in the
 * multiplication family.
 */
const BIGGEST_BASE = { 2: 15, 3: 7 } as const;

/**
 * A power, or the root that undoes it.
 *
 * The root is the same draw read backwards, which is why both are here rather
 * than in two functions: `√81` is `9²` printed the other way round, so there is
 * one number in this problem and no second computation of it to be wrong. A
 * square root is never asked of a negative — there isn't one — while a cube
 * root of a negative is a perfectly good question, and the one place a minus
 * sign lives inside a radical.
 */
function drawPower(config: IntegerConfig, rand: () => number): Drawn | null {
  const { exponent, mark, radical } = pick(POWERS, rand);
  const { min, max } = bounds(config.range);
  // Nothing to draw when the range starts above the biggest base this power
  // allows — "cubes of numbers from ten to twenty" is a request with no
  // answers in it, and an empty draw is the honest reply.
  const low = Math.max(2, min);
  const high = Math.min(max, BIGGEST_BASE[exponent]);
  if (low > high) return null;

  const base = draw(config, rand, { min: low, max: high });
  const value = exponent === 2 ? base * base : base * base * base;
  const root = rand() < 0.5;

  if (!root) {
    return {
      key: `power:${exponent}:${base}`,
      // A negative base is bracketed for a reason a child is about to be
      // examined on: `−3²` is minus nine, because the power binds tighter than
      // the sign, and `(−3)²` is nine. The bracket is the question.
      prompt: `${factorText(base)}${mark} =`,
      answer: signedText(value),
    };
  }
  // The root of a square is the positive one, always: √81 is 9, and a sheet
  // whose key said −9 would be marked wrong by every teacher there is.
  if (exponent === 2 && base < 0) return null;
  return {
    key: `root:${exponent}:${value}`,
    prompt: `${radical}${factorText(value)} =`,
    answer: signedText(base),
  };
}

/* ── Order of operations ───────────────────────────────────────────────────
   The one style whose answer depends on nothing but how the line is read, so
   the text and the value are returned together by the template that made them:
   there is no second reading of the printed sentence anywhere in this file for
   the first one to disagree with.

   Every template names the numbers it draws `a`, `b`, `c`, `d` in the order
   they are printed, and a division is built from its quotient outwards — so a
   number *drawn* is inside the range a parent asked for, while a product or a
   dividend built from two of them may run past it, exactly as a sum does on an
   addition sheet.                                                            */

type Expression = { text: string; value: number };

type Template = {
  id: string;
  /** How many operations it holds, which is what `terms` chooses between. */
  ops: number;
  /**
   * Whether the line it prints has a square in it, which is what `powers`
   * chooses between. Declared rather than read back off the printed text: the
   * template knows, and a sheet that decided by looking for a `²` would be one
   * regex away from a page a child cannot start.
   */
  squared?: true;
  draw(pull: () => number, rand: () => number): Expression | null;
};

const TEMPLATES: Template[] = [
  {
    id: "add-times",
    ops: 2,
    draw: (pull) => {
      const [a, b, c] = [pull(), pull(), pull()];
      return {
        text: `${signedText(a)} + ${factorText(b)} × ${factorText(c)} =`,
        value: a + b * c,
      };
    },
  },
  {
    id: "minus-times",
    ops: 2,
    draw: (pull) => {
      const [a, b, c] = [pull(), pull(), pull()];
      return {
        text: `${signedText(a)} ${MINUS} ${factorText(b)} × ${factorText(c)} =`,
        value: a - b * c,
      };
    },
  },
  {
    id: "bracket-times",
    ops: 2,
    draw: (pull) => {
      const [a, b, c] = [pull(), pull(), pull()];
      return {
        text: `(${signedText(a)} + ${factorText(b)}) × ${factorText(c)} =`,
        value: (a + b) * c,
      };
    },
  },
  {
    id: "bracket-minus-times",
    ops: 2,
    draw: (pull) => {
      const [a, b, c] = [pull(), pull(), pull()];
      return {
        text: `${signedText(c)} × (${signedText(a)} ${MINUS} ${factorText(b)}) =`,
        value: c * (a - b),
      };
    },
  },
  {
    id: "divide-add",
    ops: 2,
    draw: (pull) => {
      const [quotient, divisor, c] = [pull(), pull(), pull()];
      // Dividing by one is not the step this sheet is about — the line would
      // read as an addition with a decoration on the front of it.
      if (Math.abs(divisor) === 1) return null;
      return {
        text: `${signedText(quotient * divisor)} ÷ ${factorText(divisor)} + ${factorText(c)} =`,
        value: quotient + c,
      };
    },
  },
  {
    id: "bracket-divide",
    ops: 2,
    draw: (pull) => {
      const [quotient, divisor, c] = [pull(), pull(), pull()];
      if (Math.abs(divisor) === 1) return null;
      return {
        text: `(${signedText(quotient * divisor - c)} + ${factorText(c)}) ÷ ${factorText(divisor)} =`,
        value: quotient,
      };
    },
  },
  {
    id: "square-add",
    ops: 2,
    squared: true,
    draw: (pull, rand) => {
      const [a, b] = [pull(), pull()];
      const plus = rand() < 0.5;
      return {
        text: `${factorText(a)}² ${plus ? "+" : MINUS} ${factorText(b)} =`,
        value: plus ? a * a + b : a * a - b,
      };
    },
  },
  {
    id: "times-add-times",
    ops: 3,
    draw: (pull) => {
      const [a, b, c, d] = [pull(), pull(), pull(), pull()];
      return {
        text: `${signedText(a)} × ${factorText(b)} + ${factorText(c)} × ${factorText(d)} =`,
        value: a * b + c * d,
      };
    },
  },
  {
    id: "add-times-minus",
    ops: 3,
    draw: (pull) => {
      const [a, b, c, d] = [pull(), pull(), pull(), pull()];
      return {
        text: `${signedText(a)} + ${factorText(b)} × ${factorText(c)} ${MINUS} ${factorText(d)} =`,
        value: a + b * c - d,
      };
    },
  },
  {
    id: "bracket-times-minus",
    ops: 3,
    draw: (pull) => {
      const [a, b, c, d] = [pull(), pull(), pull(), pull()];
      return {
        text: `(${signedText(a)} + ${factorText(b)}) × ${factorText(c)} ${MINUS} ${factorText(d)} =`,
        value: (a + b) * c - d,
      };
    },
  },
  {
    id: "add-bracket-times",
    ops: 3,
    draw: (pull) => {
      const [a, b, c, d] = [pull(), pull(), pull(), pull()];
      return {
        text: `${signedText(a)} + (${signedText(b)} ${MINUS} ${factorText(c)}) × ${factorText(d)} =`,
        value: a + (b - c) * d,
      };
    },
  },
  {
    id: "square-times",
    ops: 3,
    squared: true,
    draw: (pull) => {
      const [a, b, c] = [pull(), pull(), pull()];
      return {
        text: `${factorText(a)}² + ${factorText(b)} × ${factorText(c)} =`,
        value: a * a + b * c,
      };
    },
  },
];

/**
 * How big an expression's numbers may be, whatever the range says.
 *
 * Three operations over numbers to fifty is a page of five-digit answers, which
 * is a multiplication lesson wearing an order-of-operations sheet's clothes.
 * The rule being practised is which operation goes first, and it is practised
 * on numbers a child can hold in their head.
 */
const EXPRESSION_MAX = 12;

/**
 * How many operations an expression on this sheet has.
 *
 * Read by the draw and by the line that names the sheet, from one place. A
 * config arrives from a bookmarked URL or from a sheet saved months ago, so
 * `terms: 7` is a thing that happens — it draws three operations, and a
 * description reading the raw number would advertise seven of them.
 */
const termsOf = (config: IntegerConfig): number =>
  Math.max(2, Math.min(3, Math.floor(config.terms ?? 2)));

/**
 * One expression, or `null` when what came out is not what the sheet asked for.
 *
 * A sheet with no negatives on it means no negative *anywhere*: not in the
 * numbers, not in the answer, and not in the middle either. `(4 − 9) × 3` has
 * every number positive and is a question about integers, which is the sheet a
 * parent turned off. Checking the printed text for a minus sign is what makes
 * that one rule rather than a condition inside every template.
 */
function drawExpression(
  config: IntegerConfig,
  rand: () => number,
): Drawn | null {
  const wanted = termsOf(config);
  // Filtered before the draw rather than rejected after it, so a sheet with the
  // squares off is the same page of expressions with two templates fewer rather
  // than a page that spends its budget printing what it then throws away.
  const pool = TEMPLATES.filter(
    (one) => one.ops === wanted && (powered(config) || one.squared !== true),
  );
  if (pool.length === 0) return null;
  const template = pick(pool, rand);
  const { min, max } = bounds(config.range);
  // Both ends, because the cap moves the top: a range that started above it
  // would come out inverted, and `between(20, 12)` draws from thirteen to
  // nineteen — numbers that are neither what the parent asked for nor what this
  // cap allows. `drawPower` guards the same thing.
  const high = Math.min(max, EXPRESSION_MAX);
  const range = { min: Math.min(min, high), max: high };
  const drawn = template.draw(() => draw(config, rand, range), rand);
  if (drawn === null) return null;

  if (!signed(config)) {
    // Three checks and not one, because a minus sign has three ways onto a
    // page that promised none: on a number the template printed (`−12 ÷ 3`),
    // on the answer, and inside the one bracket, which is the only intermediate
    // an expression works out before its result. A minus sign *on a number* is
    // written without the space a binary one carries, which is what tells the
    // two apart in the printed line.
    if (/−\d/.test(drawn.text)) return null;
    if (drawn.value < 0) return null;
    if (bracketed(drawn.text) < 0) return null;
  }
  return {
    key: `${template.id}:${drawn.text}`,
    prompt: drawn.text,
    answer: signedText(drawn.value),
  };
}

/**
 * The value of the one bracket in an expression, or nought where there is none.
 *
 * The templates put at most one bracketed sub-expression on a line and it is
 * the only place a positive-only sheet can go negative in the middle, so this
 * is the whole of "no negative anywhere" rather than a condition repeated
 * twelve times. `(−3)` is a bracketed *number* rather than a sub-expression,
 * and never appears on a sheet with no negatives to draw.
 */
function bracketed(text: string): number {
  const inner = /\((\d+) ([+−]) (\d+)\)/.exec(text);
  if (!inner) return 0;
  const [left, right] = [Number(inner[1]), Number(inner[3])];
  return inner[2] === "+" ? left + right : left - right;
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function integerLayout(config: IntegerConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = config.style === "order" ? MAX_EXPRESSION_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
  const row = writtenRow(config.fontPt) + (config.workspace ? WORKSPACE : 0);
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
 * Exported because it is the whole of what a test has to check.
 */
export function integerProblems(
  config: IntegerConfig,
  seed: number,
): Problem[] {
  const { perPage } = integerLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawOne(config, rand);
    // A pool that has run out ends the draw rather than repeating itself:
    // there are twenty-eight squares and cubes under a hundred, and
    // twenty-eight is the honest answer to a request for forty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({ prompt: drawn.prompt, answer: drawn.answer, ...extras });
    misses = 0;
  }
  return problems;
}

function drawOne(config: IntegerConfig, rand: () => number): Drawn | null {
  switch (config.style) {
    case "order":
      return drawExpression(config, rand);
    case "powers":
      return drawPower(config, rand);
    default:
      return drawSum(config, rand);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME: Record<IntegerOperation, string> = {
  add: "Adding integers",
  subtract: "Subtracting integers",
  multiply: "Multiplying integers",
  divide: "Dividing integers",
  both: "Integer arithmetic",
};

/** "Multiplying integers" — the phrase a parent says, and the one they search. */
function titleOf(config: IntegerConfig): string {
  if (config.style === "order") return "Order of operations";
  if (config.style === "powers") return "Powers and roots";
  return OPERATION_NAME[config.operation] ?? OPERATION_NAME.both;
}

const INSTRUCTION: Record<IntegerStyle, string> = {
  arithmetic: "Work out each answer. Watch the signs.",
  order: "Work out each answer. Brackets first, then powers, then × and ÷.",
  powers: "Work out each answer.",
};

/**
 * The same line for an order sheet with the squares turned off.
 *
 * The instruction has to describe the page it is printed at the top of. A sheet
 * that told a child to do powers first and then printed none is teaching them
 * to look for a step that is not there — and one that printed them without
 * saying so is worse. So `powers` moves both, from here.
 */
const ORDER_WITHOUT_POWERS =
  "Work out each answer. Brackets first, then × and ÷, then + and −.";

/** What the sheet tells a child to do, which is a function of what is on it. */
function instructionOf(config: IntegerConfig): string {
  if (config.style === "order" && !powered(config)) return ORDER_WITHOUT_POWERS;
  return INSTRUCTION[config.style] ?? INSTRUCTION.arithmetic;
}

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: IntegerConfig): SheetOptions {
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
 * What the title leaves off is the one thing that decides whether the sheet is
 * this term's work or last term's: whether there are minus signs on it at all.
 */
export function describeIntegers(config: IntegerConfig): string {
  const { max } = bounds(config.range);
  return [
    titleOf(config),
    signed(config) ? "positive and negative" : "positive numbers only",
    config.style === "powers" ? "squares and cubes" : `numbers to ${max}`,
    config.style === "order" ? `${termsOf(config)} operations` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

export function buildIntegerSheet(config: IntegerConfig, seed: number): Sheet {
  const items = integerProblems(config, seed);
  const { columns } = integerLayout(config);
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

export const INTEGERS_SHEET: SheetSpec<IntegerConfig> = {
  world: SHEET_WORLD,
  build: buildIntegerSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeIntegers,
};
