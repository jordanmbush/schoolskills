/**
 * Addition and subtraction.
 *
 * The first *generated* family, and the one that sets the bar for every maths
 * family after it. Lined paper is correct if it measures what it says it
 * measures; a page of sums is correct only if every answer on the key is right,
 * every problem is inside the range a parent asked for, and no two problems on
 * the page are the same problem. An answer key is the single most expected
 * feature of a worksheet site and the most common thing done badly (§7), so the
 * answers are computed once, when the problem is built, and the key only
 * decides to print them.
 *
 * Everything on the page comes out of `(config, seed)` and nothing else. That
 * one property is three features: the key is the same build, "another sheet
 * like this one" is `seed + 1`, and variants A/B/C for a class are `seed`,
 * `seed + 1` and `seed + 2` printed as consecutive pages.
 *
 * ── Why the problems are drawn rather than enumerated ──────────────────────
 * The obvious generator lists every pair in the range, shuffles it and takes
 * twenty. It is exact, and it allocates a million pairs for a sheet of
 * three-digit sums — at build time, on every catalog page, three times over for
 * the variants. So a problem is drawn, checked against what the config asked
 * for, and rejected if it fails or repeats. The draw gives up after a run of
 * rejections and prints what it has, which is the honest answer to "twenty
 * different sums from 1 to 3": there are six, and six is what a parent should
 * get rather than the same sum three times.
 */
import { arithmeticFactId } from "@/engine/decks/flashcards";
import { between, mulberry32 } from "@/engine/random";

import type {
  ArithmeticConfig,
  ArithmeticStyle,
  Mil,
  NumberLine,
  Problem,
  Regrouping,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  PROBLEM_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { NUMBER_LINE_HEIGHT, numberLine } from "../numberline";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4), and trailing sheet.css the same way chrome.ts
   does: a problem written along a line is one line of the body type with a
   little air round it, and a column sum is the two numbers, the rule and the
   answer under it. The gap between them belongs to the shared problem grid and
   lives with the rest of its arithmetic, in layout.ts.                       */

const ROW_EMS = { horizontal: 1.7, vertical: 4.4 } as const;

/** Blank space to work a sum out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** A fact family is four number sentences, and each one gets a line. */
const FAMILY_LINES = 4;

/** The room a fact family's four sentences take, lines and all. */
const familySpace = (fontPt: number): Mil => FAMILY_LINES * answerLine(fontPt);

/** More than six columns of sums is a page nobody can read. */
const MAX_COLUMNS = 6;

/**
 * How many rejections in a row before the draw accepts it has run out.
 *
 * Generous, because a rejection is a few arithmetic operations and the cost of
 * being wrong is a sheet that silently prints fifteen problems where sixteen
 * were possible. It is a budget rather than a guarantee, which is fine: the
 * draw is deterministic, so a config that stops short stops short every time
 * rather than intermittently.
 */
const MISS_BUDGET = 500;

const SIGN = { add: "+", subtract: "−" } as const;

/* ── Regrouping ────────────────────────────────────────────────────────────
   The switch between the week a child learns to add and the week they learn
   to carry, so it is a property of the columns rather than of the result: 8 +
   9 regroups and 80 + 9 does not, though both are additions inside twenty.  */

/** Whether working `a + b` in columns carries out of any column. */
export function carries(a: number, b: number): boolean {
  let left = a;
  let right = b;
  while (left > 0 || right > 0) {
    if ((left % 10) + (right % 10) >= 10) return true;
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

/**
 * Whether working `top − bottom` in columns borrows from any column.
 *
 * The first column whose top digit is short of its bottom one settles it, so
 * there is nothing to propagate: a borrow that a *previous* borrow caused can
 * only happen in a column to the left of one that already answered true.
 */
export function borrows(top: number, bottom: number): boolean {
  let left = top;
  let right = bottom;
  while (right > 0) {
    if (left % 10 < right % 10) return true;
    left = Math.floor(left / 10);
    right = Math.floor(right / 10);
  }
  return false;
}

const allowed = (want: Regrouping, regrouped: boolean): boolean =>
  want === "either" || (want === "always") === regrouped;

/* ── Drawing a sum ─────────────────────────────────────────────────────── */

/** One sum, as it will be printed: `left` op `right` makes `result`. */
type Sum = {
  operation: "add" | "subtract";
  left: number;
  right: number;
  result: number;
};

/** The range, made safe to draw from whatever a saved config says. */
function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range.min));
  return { min, max: Math.max(min, Math.floor(range.max)) };
}

/**
 * One candidate sum, or `null` when what was drawn isn't what was asked for.
 *
 * Both numbers come from the range, which is the promise the config makes: a
 * parent who says "to twenty" is saying what their child will see on the page,
 * not what the answers add up to. A sum that runs past twenty is what carrying
 * is for.
 */
function drawSum(config: ArithmeticConfig, rand: () => number): Sum | null {
  const { min, max } = bounds(config.range);
  // A fact family is both operations by definition — 3, 5 and 8 make two sums
  // and two differences — so it is always drawn as an addition and turned
  // round afterwards.
  const operation =
    config.style === "fact-family"
      ? "add"
      : config.operation === "both"
        ? rand() < 0.5
          ? "add"
          : "subtract"
        : config.operation;

  const first = between(min, max, rand);
  const second = between(min, max, rand);

  if (operation === "add") {
    // A doubles pair has no family: 4 + 4 = 8 turned round is 4 + 4 = 8, and
    // the four sentences a family sheet asks for are two.
    if (config.style === "fact-family" && first === second) return null;
    return allowed(config.regrouping, carries(first, second))
      ? { operation, left: first, right: second, result: first + second }
      : null;
  }

  // Below zero is off unless asked for, so the pair is turned round rather
  // than thrown away — rejecting half the draws would halve the pool for no
  // gain, and a child subtracting inside twenty writes the larger first.
  const top = config.negatives ? first : Math.max(first, second);
  const bottom = config.negatives ? second : Math.min(first, second);
  const sum: Sum = {
    operation,
    left: top,
    right: bottom,
    result: top - bottom,
  };

  // A negative difference has no column arithmetic to speak of — nobody
  // borrows their way from 3 − 8 — so it is only ever drawn when regrouping is
  // left open. Asking for "always borrows" and being handed 3 − 8 would answer
  // a question the parent did not ask.
  if (sum.result < 0) return config.regrouping === "either" ? sum : null;
  return allowed(config.regrouping, borrows(top, bottom)) ? sum : null;
}

/**
 * What makes two problems the same problem.
 *
 * Addition folds — 3 + 5 and 5 + 3 are one sum, and a child who finds both on
 * a page has been given nineteen problems and a joke — while subtraction does
 * not. Which slot is blank is not part of it either: "7 + _ = 15" and
 * "_ + 8 = 15" are one fact wearing two hats, and a child spots that faster
 * than the adult who printed it does.
 */
function keyOf(sum: Sum, style: ArithmeticStyle): string {
  const low = Math.min(sum.left, sum.right);
  const high = Math.max(sum.left, sum.right);
  if (style === "fact-family") return `family:${low}:${high}`;
  const pair =
    sum.operation === "add" ? `${low}:${high}` : `${sum.left}:${sum.right}`;
  return `${sum.operation}:${pair}`;
}

/* ── Turning a sum into a problem ──────────────────────────────────────── */

/**
 * The race's own vocabulary for a fact, so a sheet printed from the record
 * book's trouble facts (§14) names the same things the race does. Addition is
 * its two addends; a subtraction is the number taken away and what is left,
 * which is how `decks/flashcards.ts` builds the pair it asks about.
 */
function factOf(sum: Sum): string {
  return sum.operation === "add"
    ? arithmeticFactId(sum.left, sum.right)
    : arithmeticFactId(sum.right, sum.result);
}

function problemOf(
  sum: Sum,
  config: ArithmeticConfig,
  slot: number,
  extras: { line?: NumberLine; workspace?: Mil },
): Problem {
  const sign = SIGN[sum.operation];
  const factId = factOf(sum);

  if (config.style === "fact-family") {
    const { left, right, result } = sum;
    // One list, printed two ways and built once, so the two cannot disagree:
    // `answers` is what the sheet rules lines for and the key writes on them,
    // `answer` the same sentences on one line for anything wanting a string.
    const written = [
      `${left} + ${right} = ${result}`,
      `${right} + ${left} = ${result}`,
      `${result} − ${left} = ${right}`,
      `${result} − ${right} = ${left}`,
    ];
    return {
      prompt: `${left}, ${right}, ${result}`,
      answer: written.join(", "),
      answers: written,
      factId,
      ...extras,
      // Four sentences to write, whatever the config said about workspace —
      // and this is the height those four lines share, not blank paper under
      // a slot. `rowHeight` reserves exactly the same number.
      workspace: familySpace(config.fontPt),
    };
  }

  if (config.style === "missing") {
    // A missing number in column form is a blank where a number should be and
    // the answer already written under the rule — two gaps, one to fill in,
    // and a child who fills in the wrong one was not wrong. So it reads along
    // the line whatever `form` says.
    const prompt =
      slot === 0
        ? `_ ${sign} ${sum.right} = ${sum.result}`
        : `${sum.left} ${sign} _ = ${sum.result}`;
    return {
      prompt,
      answer: String(slot === 0 ? sum.left : sum.right),
      factId,
      ...extras,
    };
  }

  if (config.form === "vertical") {
    return {
      // Empty, because the stack is the prompt. There is no second copy of the
      // sum written along a line for the two to disagree about.
      prompt: "",
      operands: [String(sum.left), String(sum.right)],
      operator: sign,
      answer: String(sum.result),
      factId,
      ...extras,
    };
  }

  return {
    prompt: `${sum.left} ${sign} ${sum.right} =`,
    answer: String(sum.result),
    factId,
    ...extras,
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * Whether this sheet prints a number line.
 *
 * One predicate with four readers — the row height reserves for it, the build
 * attaches it, the instruction line tells a child to use it and the record line
 * names it — because the two halves disagreeing is the exact bug the
 * "declared, not measured" design exists to exclude: reserving for a line the
 * build never emits throws two problems a page away, and the other way round is
 * a row below the bottom margin.
 *
 * A fact family never gets one however the config asks. Its prompt is three
 * numbers rather than a sum, so there is nothing on it to count along.
 */
function hasNumberLine(config: ArithmeticConfig): boolean {
  return config.numberLine === true && config.style !== "fact-family";
}

/** How tall one problem stands, extras included. */
function rowHeight(config: ArithmeticConfig): Mil {
  const stacked = config.style === "standard" && config.form === "vertical";
  const body = points(
    config.fontPt * (stacked ? ROW_EMS.vertical : ROW_EMS.horizontal),
  );
  const workspace =
    config.style === "fact-family"
      ? familySpace(config.fontPt)
      : config.workspace
        ? WORKSPACE
        : 0;
  return body + workspace + (hasNumberLine(config) ? NUMBER_LINE_HEIGHT : 0);
}

/**
 * How many problems the paper holds, and how wide a column of them is.
 *
 * Arithmetic, not measurement, so `npm run test:unit` can answer "did it fit?"
 * without a browser — and so the same answer serves the catalog page built at
 * build time and the builder's preview (§4).
 */
export function arithmeticLayout(config: ArithmeticConfig): {
  box: Box;
  columns: number;
  /** The width of one column of problems. */
  cell: Mil;
  /** How tall one problem stands, extras included. */
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of
  // them. Reserving for a config with no title and then printing the family's
  // own is a last row of problems below the bottom margin — invisible on
  // screen, and a second sheet out of the printer.
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
 * Exported because it is the whole of what a test has to check, and checking
 * it through the `Sheet` means unwrapping a block union to reach it.
 */
export function arithmeticProblems(
  config: ArithmeticConfig,
  seed: number,
): Problem[] {
  const { cell, perPage } = arithmeticLayout(config);
  // The count is a request, not a promise. Print is the whole of the output
  // path (§10), so a count that overruns is a second sheet out of the printer
  // with two problems on it — worse than printing the ones that fit.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = sheetExtras(config, cell);

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const sum = drawSum(config, rand);
    // Which side of a missing-number problem is blank. Drawn whatever the
    // style, so that switching between standard, missing and column form does
    // not reshuffle every other problem on a sheet built from the same seed. A
    // fact family does reshuffle, because it skips the operation draw that
    // `operation: "both"` takes — it is both operations by definition.
    const slot = rand() < 0.5 ? 0 : 1;
    const key = sum === null ? null : keyOf(sum, config.style);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself.
    if (sum === null || key === null || seen.has(key)) {
      misses += 1;
      continue;
    }
    seen.add(key);
    problems.push(problemOf(sum, config, slot, extras));
    misses = 0;
  }
  return problems;
}

/**
 * What every problem on this sheet carries besides its own numbers.
 *
 * One number line for the whole page rather than one per problem: a child
 * reads the scale once and uses it twenty times. It spans zero to the largest
 * result the config can produce, so no problem falls off the end of it.
 */
function sheetExtras(
  config: ArithmeticConfig,
  cell: Mil,
): { line?: NumberLine; workspace?: Mil } {
  const { max } = bounds(config.range);
  // The far end is the largest result the config can reach: two numbers from
  // the range added together, or — where nothing is added — the range itself.
  const top = config.operation === "subtract" ? max : max * 2;
  const line = hasNumberLine(config)
    ? numberLine(config.negatives ? -max : 0, top, cell)
    : undefined;
  return {
    ...(line ? { line } : {}),
    ...(config.workspace ? { workspace: WORKSPACE } : {}),
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME = {
  add: "Addition",
  subtract: "Subtraction",
  both: "Addition and subtraction",
} as const;

/** "Addition to 20" — the phrase a parent says, and the one they search. */
function titleOf(config: ArithmeticConfig): string {
  const { max } = bounds(config.range);
  if (config.style === "fact-family") return `Fact families to ${max}`;
  return `${OPERATION_NAME[config.operation]} to ${max}`;
}

const INSTRUCTION: Record<ArithmeticStyle, string> = {
  standard: "Work out each answer.",
  missing: "Write the missing number in each blank.",
  "fact-family": "Write the four number sentences each family makes.",
};

function instructionOf(config: ArithmeticConfig): string {
  return hasNumberLine(config)
    ? `${INSTRUCTION[config.style]} Use the number line to help.`
    : INSTRUCTION[config.style];
}

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: ArithmeticConfig): SheetOptions {
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
 * The two things a shop's label leaves off are the two that decide whether a
 * sheet matches the lesson: whether it carries, and whether the sum is written
 * along a line or worked in columns.
 */
export function describeArithmetic(config: ArithmeticConfig): string {
  const REGROUPING: Record<Regrouping, string | null> = {
    either: null,
    never: "no regrouping",
    always: "with regrouping",
  };
  return [
    titleOf(config),
    config.style === "standard" && config.form === "vertical"
      ? "in columns"
      : null,
    config.style === "missing" ? "missing number" : null,
    REGROUPING[config.regrouping],
    hasNumberLine(config) ? "with a number line" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

export function buildArithmeticSheet(
  config: ArithmeticConfig,
  seed: number,
): Sheet {
  const items = arithmeticProblems(config, seed);
  const { columns } = arithmeticLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Marked out of what is actually on the page, not out of what was asked
      // for: a sheet that says "/ 20" over eighteen problems is wrong twice.
      score: { outOf: items.length },
    },
    blocks: [{ kind: "problems", columns, items }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const ARITHMETIC_SHEET: SheetSpec<ArithmeticConfig> = {
  id: "arithmetic",
  label: "Addition and subtraction",
  world: SHEET_WORLD,
  build: buildArithmeticSheet,
  // The whole of the answer-key mechanism: the answers were computed when each
  // problem was built, so a key prints what is already there rather than
  // generating it a second time and risking a different answer to the same
  // question.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeArithmetic,
};
