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
  DecimalOperation,
  DecimalStyle,
  DivisionHelp,
  Mil,
  Problem,
  RoundTo,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox, shortfall, shortfallPart } from "../chrome";
import {
  DIGIT_EM,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  numberRoom,
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
  stoppingDivisors,
  type Division,
} from "./decimal-division";
import {
  bounds,
  clamp,
  drawConvert,
  drawPercent,
  drawStandard,
  operationOf,
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
import {
  HELP_NAME,
  bracketHeight,
  bracketWidth,
  divisionHelp,
  divisionLines,
} from "./long";

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

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── Which draw a sheet is made of ───────────────────────────────────────── */

/**
 * Every style and its draw. A full record rather than a partial one, so a
 * style added to the union and not filed here fails to compile instead of
 * quietly printing sums under the wrong title.
 */
const DRAW: Record<DecimalStyle, Draw> = {
  standard: drawStandard,
  percent: drawPercent,
  convert: drawConvert,
  powers: drawPowers,
  compare: drawCompare,
  order: drawOrder,
  round: drawRound,
  place: drawPlace,
};

const STYLES = Object.keys(DRAW) as DecimalStyle[];

/**
 * The style, made safe to read from whatever a saved config says. A style
 * this build does not know is arithmetic, as it was before it existed.
 */
function styleOf(config: DecimalConfig): DecimalStyle {
  const asked = config.style;
  return STYLES.includes(asked) ? asked : "standard";
}

/** Whether the sheet is the arithmetic style's division, whichever of the three. */
const dividing = (config: DecimalConfig): boolean =>
  styleOf(config) === "standard" && operationOf(config) === "divide";

function drawerOf(config: DecimalConfig): Draw {
  if (!dividing(config)) return DRAW[styleOf(config)];
  const division = divisionOf(config);
  switch (division) {
    case "byDecimal":
      return drawByDecimal;
    case "wholeDividend":
      return drawWholeDividend;
    case "byWhole":
      return drawByWhole;
    default: {
      const unknown: never = division;
      return unknown;
    }
  }
}

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * Whether this sheet stacks its problems. Only the arithmetic one can, and a
 * division by a decimal is never bracketed (§22).
 */
const stacked = (config: DecimalConfig): boolean =>
  styleOf(config) === "standard" &&
  config.form === "vertical" &&
  !(dividing(config) && divisionOf(config) === "byDecimal");

/** Whether its divisions are set in the bracket. */
const bracketed = (config: DecimalConfig): boolean =>
  stacked(config) && dividing(config);

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

/**
 * How wide the widest bracket on the sheet stands: the longest dividend and
 * the longest divisor, in squares — the width the columns are cut to (§21).
 */
const widestBracket = (config: DecimalConfig): Mil =>
  bracketWidth(
    {
      into: dividendDigits(config),
      by: String(divisorOf(config).max).length,
    },
    config.fontPt,
  );

/** How tall one problem stands, working space and all. */
function rowHeight(config: DecimalConfig): Mil {
  // A bracket spends its reservation on the squares under the dividend and
  // takes no blank paper besides, as a long division does.
  const bracket = bracketOf(config);
  if (bracket)
    return bracketHeight(config.fontPt) + bracket.rows * bracket.cell;
  // An ordering's answer is the ruled line under the sentence, on a line of
  // its own; the line is its working space, so the config's is not added.
  if (styleOf(config) === "order")
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
  const style = styleOf(config);
  switch (style) {
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
    case "standard":
      if (!bracketed(config)) return asked;
      return Math.max(
        1,
        Math.min(
          asked,
          fitAcross(
            box.width,
            widestBracket(config) + numberRoom(config.fontPt),
            PROBLEM_GAP.x,
          ),
        ),
      );
    case "percent":
    case "convert":
    case "powers":
    case "compare":
    case "round":
      return asked;
    default: {
      const unknown: never = style;
      return unknown;
    }
  }
}

type Layout = {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
};

/** The layout under a given header — the printed one, which may carry a sentence the config's does not. */
function layoutOf(config: DecimalConfig, header: SheetOptions): Layout {
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(header, true);
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

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function decimalLayout(config: DecimalConfig): Layout {
  return layoutOf(config, headerOf(config));
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

/** How many problems were asked for. A count from outside this build may be nothing at all. */
const askedOf = (config: DecimalConfig): number =>
  Math.max(0, Math.floor(config.count) || 0);

/** Up to `wanted` problems, in the order they are printed. */
function drawProblems(
  config: DecimalConfig,
  seed: number,
  wanted: number,
): Problem[] {
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

/** Whether a whole-dividend sheet has been given a span with no divisor that can stop. */
const nothingStops = (config: DecimalConfig): boolean =>
  dividing(config) &&
  divisionOf(config) === "wholeDividend" &&
  stoppingDivisors(config).length === 0;

/**
 * What the paper says when it holds fewer than were asked for — with the one
 * reason this family can name said outright, because "nothing could be made"
 * over a sheet set to divide by 3 is true and unhelpful. A span with no
 * divisor that can stop is always one number: any two in a row hold an even
 * one.
 */
function shortfallOf(
  config: DecimalConfig,
  fit: number,
  made: number,
): string | null {
  const asked = askedOf(config);
  if (made >= asked) return null;
  if (made === 0 && fit > 0 && nothingStops(config)) {
    return `Dividing by ${divisorOf(config).min} never gives an answer that stops, so there is nothing to print.`;
  }
  return shortfall(asked, fit, made);
}

/**
 * The problems and the header they print under.
 *
 * A count is a request, not a promise: the page holds what it holds, and the
 * draw makes what it can. When either comes up short the instruction line says
 * so, and because that sentence can take a row from the page, the layout is
 * asked again under the header that will actually print, until the problems
 * are the ones that fit beneath it.
 */
function decimalPage(
  config: DecimalConfig,
  seed: number,
): { problems: Problem[]; header: SheetOptions; columns: number } {
  const asked = askedOf(config);
  let header = headerOf(config);
  let fit = layoutOf(config, header).perPage;
  let problems = drawProblems(config, seed, Math.min(asked, fit));
  for (;;) {
    header = headerOf(config, shortfallOf(config, fit, problems.length));
    const under = layoutOf(config, header);
    if (problems.length <= under.perPage) {
      return { problems, header, columns: under.columns };
    }
    fit = under.perPage;
    problems = problems.slice(0, fit);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME: Record<DecimalOperation, string> = {
  add: "Adding",
  subtract: "Subtracting",
  multiply: "Multiplying",
  divide: "Dividing",
  both: "Adding and subtracting",
};

/** The three divisions, named by what makes each a different lesson (§22). */
const DIVISION_NAME: Record<Division, string> = {
  byWhole: "Dividing decimals",
  byDecimal: "Dividing by a decimal",
  wholeDividend: "Division with decimal answers",
};

/** Every style's name; arithmetic has none, being named by its operation. */
const STYLE_NAME: Record<DecimalStyle, string | null> = {
  standard: null,
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
  const named = STYLE_NAME[styleOf(config)];
  if (named) return named;
  const operation = operationOf(config);
  if (operation === "divide") return DIVISION_NAME[divisionOf(config)];
  const name = `${OPERATION_NAME[operation]} decimals`;
  return operation === "multiply" && config.by === "decimal"
    ? `${name} by decimals`
    : name;
}

/**
 * What a child is told on a division sheet, which is the one sentence the
 * method turns on: where the point goes, or that the sum is rewritten first.
 */
function divisionInstruction(config: DecimalConfig): string {
  const division = divisionOf(config);
  switch (division) {
    case "byDecimal":
      return "Work out each answer. Multiply both numbers by 10, or by 100, until you are dividing by a whole number, then divide.";
    case "wholeDividend":
      return stacked(config)
        ? "Work out each answer. Keep dividing into the zeros after the point, and put the point in the answer straight above the point in the number."
        : "Work out each answer. Keep dividing past the point, writing zeros after it if you need them.";
    case "byWhole":
      return stacked(config)
        ? "Work out each answer. Put the point in the answer straight above the point in the number."
        : "Work out each answer.";
    default: {
      const unknown: never = division;
      return unknown;
    }
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
  const operation = operationOf(config);
  if (operation === "divide") return divisionInstruction(config);
  if (operation === "multiply" && config.by === "decimal") {
    return stacked(config)
      ? "Work out each answer. Line the digits up on the right and multiply as if there were no points, then count the decimal places in both numbers: the answer has that many."
      : "Work out each answer. Multiply as if there were no points, then count the decimal places in both numbers: the answer has that many.";
  }
  if (!stacked(config)) return "Work out each answer.";
  return operation === "multiply"
    ? "Work out each answer. Line the digits up on the right, then put the point back in."
    : "Work out each answer. Keep the points under one another.";
}

/**
 * The one line of guidance on the sheet. For the number-sense styles it names
 * the idea the sheet is for (§22), in the words the sheet wants a child to use
 * — "the digits move", never "move the point".
 */
function instructionOf(config: DecimalConfig): string {
  const style = styleOf(config);
  switch (style) {
    case "standard":
      return arithmeticInstruction(config);
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
    default: {
      const unknown: never = style;
      return unknown;
    }
  }
}

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`. `note` is the sentence that
 * says the page came out short, on the end of the instruction line.
 */
function headerOf(
  config: DecimalConfig,
  note: string | null = null,
): SheetOptions {
  const instructions = config.instructions ?? instructionOf(config);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions: note ? `${instructions} ${note}` : instructions,
  };
}

/**
 * The places a sheet is set at, said the way its values are set: a rounding
 * sheet's values are set by the place they round to, and a percent has none.
 */
function placesPart(config: DecimalConfig): string | null {
  const style = styleOf(config);
  if (style === "percent") return null;
  if (style === "round") return `to the nearest ${TO_NAME[roundTo(config)]}`;
  return PLACE_NAME[placesOf(config)];
}

/**
 * What the line that names a saved sheet can say about a page coming out
 * short without a seed to draw from: what the paper holds against what was
 * asked, and a divisor span nothing in it can stop. A draw that misses is the
 * page's to report.
 */
function describedShortfall(config: DecimalConfig): string | null {
  const asked = askedOf(config);
  const { perPage } = decimalLayout(config);
  const made = nothingStops(config) ? 0 : Math.min(asked, perPage);
  return shortfallOf(config, perPage, made);
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
  const squares = bracketOf(config);
  const short = describedShortfall(config);
  return [
    titleOf(config),
    dividing(config) && divisorOf(config).min >= 10
      ? "by two-digit numbers"
      : null,
    placesPart(config),
    stacked(config) ? "in columns" : null,
    squares ? HELP_NAME[squares.help] : null,
    short === null ? null : shortfallPart(short),
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

function buildDecimalSheet(config: DecimalConfig, seed: number): Sheet {
  const { problems: items, header: head, columns } = decimalPage(config, seed);

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
