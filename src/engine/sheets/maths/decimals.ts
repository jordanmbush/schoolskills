/**
 * Decimals and percents — the same machinery as every family before it (§7,
 * §11), over numbers that are famously easy to get subtly wrong.
 *
 * This module is the spec: what a problem takes on the page, which draw a
 * sheet is made of, and what the sheet is called. The draws live beside it —
 * `decimal-draw.ts` for sums, percents and conversions, `decimal-division.ts`
 * for the three divisions (§22), `decimal-sense.ts` for the number-sense
 * styles — and every one of them returns the problem in each shape it can
 * take, so choosing the shape is done here, once, from the same arithmetic the
 * row was reserved by.
 *
 * **Nothing here is ever a float.** `maths/exact.ts` holds the shapes and the
 * reasons.
 */
import { mulberry32 } from "@/engine/random";

import type {
  DecimalConfig,
  DecimalStyle,
  DivisionHelp,
  Mil,
  Problem,
  RoundTo,
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
  divisionOf,
  divisorOf,
  drawByDecimal,
  drawByWhole,
  drawWholeDividend,
  decimalTableau,
  type Division,
} from "./decimal-division";
import {
  bounds,
  clamp,
  drawConvert,
  drawPercent,
  drawStandard,
  placesOf,
  type Draw,
  type Drawn,
} from "./decimal-draw";
import {
  ORDER_SET,
  drawCompare,
  drawOrder,
  drawPlace,
  drawPowers,
  drawRound,
  roundTo,
  roundingPlaces,
} from "./decimal-sense";
import { scale } from "./exact";
import { HELP_NAME, bracketHeight, divisionHelp, divisionLines } from "./long";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4). Stacked it is the two numbers, the rule and the
   answer under it — the same drawing an addition sheet has, with the points
   lined up. A division in columns is the bracket instead, and its height is
   the squares it reserves. An ordering has a ruled line under the sentence,
   and everything else is the sentence with a slot in it.                    */

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

/**
 * Two columns for the styles written as a sentence: "What is the 7 in 13.75
 * worth?" and a set of five decimals are three lines of a narrow column, and
 * the row reserves two.
 */
const SENTENCE_COLUMNS = 2;

/**
 * How wide a figure is, in ems of the body type. A tabular figure in the face
 * a sheet prints in is about six tenths of an em, and a comma and a space are
 * narrower, so a line reserved by this is wider than the line it holds.
 */
const DIGIT_EM = 0.6;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── Which draw a sheet is made of ───────────────────────────────────────── */

const DRAW: Partial<Record<DecimalStyle, Draw>> = {
  percent: drawPercent,
  convert: drawConvert,
  powers: drawPowers,
  compare: drawCompare,
  order: drawOrder,
  round: drawRound,
  place: drawPlace,
};

/** A style this build does not know is arithmetic, as it was before it existed. */
function drawerOf(config: DecimalConfig): Draw {
  const draw = DRAW[config.style];
  if (draw) return draw;
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
  // An ordering's answer is the ruled line under the sentence, on a line of
  // its own; the line is its working space, so the config's is not added.
  if (config.style === "order")
    return writtenRow(config.fontPt) + WRAP_GAP + answerLine(config.fontPt);
  // A stack is one flex item and cannot wrap, so it is reserved for as what it
  // is: two numbers, a rule and the answer under it.
  const body = stacked(config)
    ? points(config.fontPt * STACK_EMS)
    : writtenRow(config.fontPt);
  return body + (config.workspace ? WORKSPACE : 0);
}

/**
 * How wide the longest answer line an ordering sheet can print is: the most
 * values a set holds, each at its longest, with ", " between them. The line
 * cannot wrap — `.sheet__answer-line` clips instead, because a wrapped line
 * is a row taller than was reserved — so the columns are cut to fit it.
 */
function orderLine(config: DecimalConfig): Mil {
  const longest =
    String(bounds(config.range).max).length + 1 + placesOf(config);
  const characters = ORDER_SET.max * longest + (ORDER_SET.max - 1) * 2;
  return characters * points(config.fontPt * DIGIT_EM);
}

/** How many columns the sheet is set in: what was asked, cut to what the style can hold. */
function columnsOf(config: DecimalConfig, box: Box): number {
  const asked = clamp(config.columns, 1, MAX_COLUMNS);
  switch (config.style) {
    case "place":
      return Math.min(asked, SENTENCE_COLUMNS);
    case "order":
      return Math.max(
        1,
        Math.min(
          asked,
          SENTENCE_COLUMNS,
          fitAcross(box.width, orderLine(config), PROBLEM_GAP.x),
        ),
      );
    default:
      return asked;
  }
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
  const columns = columnsOf(config, box);
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
 * A draw as it is printed: in the bracket, on a ruled line, in a stack, or
 * along a line — decided by the layout, never by the draw.
 */
function problemOf(
  drawn: Drawn,
  config: DecimalConfig,
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
  if (drawn.answers) {
    return {
      prompt: drawn.prompt,
      answer: drawn.answer,
      answers: drawn.answers,
      workspace: answerLine(config.fontPt),
    };
  }
  if (drawn.operands && stacked(config)) {
    return {
      prompt: "",
      answer: drawn.answer,
      operands: drawn.operands,
      operator: drawn.operator,
      ...extras,
    };
  }
  return { prompt: drawn.prompt, answer: drawn.answer, ...extras };
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
    problems.push(problemOf(drawn, config, squares, extras));
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

/** Every style but arithmetic, which is named by its operation. */
const STYLE_NAME: Partial<Record<DecimalStyle, string>> = {
  percent: "Percentages of amounts",
  convert: "Fractions, decimals and percents",
  powers: "Multiplying and dividing by 10, 100 and 1000",
  compare: "Comparing decimals",
  order: "Ordering decimals",
  round: "Rounding decimals",
  place: "Decimal place value",
};

/** What a place count is called out loud, which is how a lesson names it. */
const PLACE_NAME = ["", "tenths", "hundredths", "thousandths"] as const;

const TO_NAME: Record<RoundTo, string> = {
  whole: "whole number",
  tenth: "tenth",
  hundredth: "hundredth",
};

/** "Adding decimals" — the phrase a parent says, and the one they search. */
function titleOf(config: DecimalConfig): string {
  const named = STYLE_NAME[config.style];
  if (named) return named;
  if (config.operation === "divide") return DIVISION_NAME[divisionOf(config)];
  const name = `${OPERATION_NAME[config.operation] ?? OPERATION_NAME.add} decimals`;
  return config.operation === "multiply" && config.by === "decimal"
    ? `${name} by decimals`
    : name;
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

/**
 * What a child is told on an arithmetic sheet.
 *
 * A stack of sums lines up on the point, because every value on the sheet is
 * printed to the same number of places. A multiplier is not a decimal at all —
 * `1.25 × 3` has one point in it — so "keep the points under one another"
 * describes a column that isn't there, and a decimal multiplier is the sheet
 * where the places are counted rather than lined up. §10 makes this sentence
 * the whole of the guidance a child gets.
 */
function arithmeticInstruction(config: DecimalConfig): string {
  if (config.operation === "divide") return divisionInstruction(config);
  if (config.operation === "multiply" && config.by === "decimal") {
    return stacked(config)
      ? "Work out each answer. Line the digits up on the right and multiply as if there were no points, then count the decimal places in both numbers: the answer has that many."
      : "Work out each answer. Multiply as if there were no points, then count the decimal places in both numbers: the answer has that many.";
  }
  if (!stacked(config)) return "Work out each answer.";
  return config.operation === "multiply"
    ? "Work out each answer. Line the digits up on the right, then put the point back in."
    : "Work out each answer. Keep the points under one another.";
}

/**
 * The one line of guidance on the sheet. For the number-sense styles it names
 * the idea the sheet is for (§22), in the words the sheet wants a child to use
 * — "the digits move", never "move the point".
 */
function instructionOf(config: DecimalConfig): string {
  switch (config.style) {
    case "percent":
      return "Work out each amount.";
    case "convert":
      // Said plainly, because the blank cannot say it: a child who writes a
      // fraction where a decimal was wanted has answered a question nobody
      // asked, and would be marked wrong for it.
      return "Fill in each blank. A blank with a % after it wants a percent; every other blank wants a decimal.";
    case "powers":
      return "Work out each answer. To multiply by 10, move every digit one place to the left; to divide by 10, move every digit one place to the right. The digits move; the point stays where it is.";
    case "compare":
      return "Write <, > or = in each gap. Line the points up before you decide: a longer decimal is not always a bigger one.";
    case "order":
      return "Write each set of decimals in order on the line under it, smallest first.";
    case "round":
      return `Round each decimal to the nearest ${TO_NAME[roundTo(config)]}. Look at the ${PLACE_NAME[roundingPlaces(config)]} digit: 5 or more rounds up, 4 or less leaves the number as it is.`;
    case "place":
      return "Write what each digit is worth. In 3.75 the 7 is worth 0.7 and the 5 is worth 0.05.";
    default:
      return arithmeticInstruction(config);
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
 * The places a sheet is set at, said the way its values are set: a rounding
 * sheet's values are set by the place they round to, and a percent has none.
 */
function placesPart(config: DecimalConfig): string | null {
  if (config.style === "percent") return null;
  if (config.style === "round")
    return `to the nearest ${TO_NAME[roundTo(config)]}`;
  return PLACE_NAME[placesOf(config)];
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
    placesPart(config),
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
