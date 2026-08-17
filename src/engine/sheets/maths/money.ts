/**
 * Money.
 *
 * A two-place decimal with a symbol in front of it, which is why this family is
 * small: the values are the `Fixed` of `exact.ts` at two places, so £3.45 is 345
 * pence from the moment it is drawn to the moment the point is written into it,
 * and there is no arithmetic here that isn't whole-number arithmetic. A money
 * sheet whose key says $6.500000000000001 is the failure this design exists to
 * make impossible.
 *
 * **The currency is a switch, not a constant.** The same reason A4 is (§4): a
 * British child counting dollars has been set a question about a foreign
 * country, and the sheet is otherwise identical. It changes the symbol, the
 * title — "Adding pounds and pence" is what that sheet is called and what a
 * parent searches for — and nothing else, because the arithmetic of money is
 * the same everywhere.
 *
 * The amount is written the way an English-language worksheet writes it: the
 * symbol in front, a point between the units and the change. A euro sheet
 * printed in Germany would want `5,00 €`, and that is a locale question rather
 * than a currency one — it belongs with the day a sheet is printed in German.
 *
 * **Word problems are not here.** "Ella buys two apples at 45c" is PRINT09's
 * templated set; this is the arithmetic underneath it, which a child has to be
 * able to do before the words are a help rather than a second obstacle.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  Currency,
  Mil,
  MoneyConfig,
  MoneyOperation,
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
import { inches, own, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import {
  fixed,
  fixedText,
  minusFixed,
  plusFixed,
  timesWhole,
  type Fixed,
} from "./exact";

/* ── The currencies ────────────────────────────────────────────────────────
   Three, and what each one calls its small change. The name is not decoration:
   it is the title of the sheet, and "Adding pounds and pence" is a different
   search from "Adding dollars and cents".                                    */

export type CurrencySpec = {
  id: Currency;
  /** How it is offered in a picker. */
  label: string;
  symbol: string;
  /** What the sheet is about, in the words that country uses. */
  units: string;
};

export const CURRENCIES: Record<Currency, CurrencySpec> = {
  usd: { id: "usd", label: "Dollars", symbol: "$", units: "dollars and cents" },
  gbp: { id: "gbp", label: "Pounds", symbol: "£", units: "pounds and pence" },
  eur: { id: "eur", label: "Euros", symbol: "€", units: "euros and cents" },
};

/**
 * Two digits of change, in all three. Not a per-currency field, because a
 * currency with a different number of them — yen has none — is a currency this
 * family has not been taught to draw, and a config that named one would want
 * more than a symbol changing.
 */
const PLACES = 2;

/** Resolves a currency. Never throws — a saved config may name a fourth one. */
export const currencyOf = (config: MoneyConfig): CurrencySpec =>
  own(CURRENCIES, config.currency, CURRENCIES.usd);

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4), and the same two shapes an addition sheet has:
   a sentence along a line, or the numbers stacked with a rule under them.    */

const STACK_EMS = 4.4;

/**
 * How tall a problem written along a line stands: two lines of the body type,
 * and the air a wrap puts between them.
 *
 * Two rather than one, because `$13.47 + $8.06 =` with a ruled blank after it
 * is a wide sentence, and `.sheet__problem` wraps rather than overflowing — so
 * the second line is either inside the row the layout declared, or it is the
 * bottom of the page coming out of the printer on a second sheet.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an amount out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** Four columns. `$13.47 + $8.06 =` is a wide sentence. */
const MAX_COLUMNS = 4;

/** How many of a thing a child is asked to buy. */
const MULTIPLIER = { min: 2, max: 9 };

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

const SIGN = { add: "+", subtract: "−", multiply: "×" } as const;

/* ── Drawing an amount ─────────────────────────────────────────────────── */

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(0, Math.floor(range?.min ?? 0));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 0)) };
}

/**
 * One amount, drawn in the smallest coin there is.
 *
 * The range is in whole units — a parent asks for "amounts up to ten pounds" —
 * and the draw is over the pence inside it, so every amount between £0.01 and
 * £10.00 can come up rather than the ten round ones. Nothing is ever nothing:
 * `$0.00 + $3.45` is not a question about money.
 */
function drawAmount(config: MoneyConfig, rand: () => number): Fixed | null {
  const { min, max } = bounds(config.range);
  const units = between(min * 100, max * 100, rand);
  return units > 0 ? fixed(units, PLACES) : null;
}

/** An amount as it is printed: the symbol, then two digits of change. */
const amountText = (money: CurrencySpec, value: Fixed): string =>
  `${money.symbol}${fixedText(value)}`;

/* ── Drawing a problem ─────────────────────────────────────────────────── */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  operands?: string[];
  operator?: string;
};

/** Which way round an `either` sheet's problem reads. */
function operationOf(
  operation: MoneyOperation,
  rand: () => number,
): Exclude<MoneyOperation, "both"> {
  if (operation !== "both") return operation;
  return rand() < 0.5 ? "add" : "subtract";
}

function drawProblem(config: MoneyConfig, rand: () => number): Drawn | null {
  const money = currencyOf(config);
  const operation = operationOf(config.operation, rand);
  const left = drawAmount(config, rand);
  if (left === null) return null;

  if (operation === "multiply") {
    // How many of a thing, so the count is a plain number and only the price
    // carries a symbol: `$1.25 × 3` is three of them, and `$1.25 × $3` is not
    // an amount of money at all.
    const by = between(MULTIPLIER.min, MULTIPLIER.max, rand);
    return written(
      config,
      operation,
      [amountText(money, left), String(by)],
      amountText(money, timesWhole(left, by)),
    );
  }

  const right = drawAmount(config, rand);
  if (right === null) return null;
  if (operation === "add") {
    return written(
      config,
      operation,
      [amountText(money, left), amountText(money, right)],
      amountText(money, plusFixed(left, right)),
    );
  }

  // No till hands back less than nothing, so the larger amount goes on top —
  // the same bargain the arithmetic family strikes with its subtraction. A
  // difference of nothing is thrown away, because it answers itself.
  if (left.units === right.units) return null;
  const [top, bottom] =
    left.units > right.units ? [left, right] : [right, left];
  return written(
    config,
    operation,
    [amountText(money, top), amountText(money, bottom)],
    amountText(money, minusFixed(top, bottom)),
  );
}

/**
 * A problem written the way the config asks: along a line, or stacked.
 *
 * Stacked is worth more on a money sheet than anywhere else: every amount has
 * two digits of change, so right-aligning them in `tabular-nums` puts the
 * points — and the pence — in a column with nothing having to align them.
 */
function written(
  config: MoneyConfig,
  operation: Exclude<MoneyOperation, "both">,
  operands: string[],
  answer: string,
): Drawn {
  const sign = SIGN[operation];
  // Addition folds — `$1.40 + $0.25` and `$0.25 + $1.40` are one problem —
  // while a difference and a multiple do not.
  const key =
    operation === "add"
      ? `${operation}:${[...operands].sort().join(":")}`
      : `${operation}:${operands.join(":")}`;
  if (config.form === "vertical") {
    return { key, prompt: "", operands, operator: sign, answer };
  }
  return { key, prompt: `${operands[0]} ${sign} ${operands[1]} =`, answer };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** How tall one problem stands, working space and all. */
function rowHeight(config: MoneyConfig): Mil {
  // A stack is one flex item and cannot wrap, so it is reserved for as what it
  // is: two amounts, a rule and the answer under it.
  const body =
    config.form === "vertical"
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
export function moneyLayout(config: MoneyConfig): {
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
export function moneyProblems(config: MoneyConfig, seed: number): Problem[] {
  const { perPage } = moneyLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawProblem(config, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself: amounts up to ten cents are nine problems, and nine is
    // the honest answer to a request for twenty.
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

/** "Adding pounds and pence" — the phrase that country says, and searches. */
function titleOf(config: MoneyConfig): string {
  const name = OPERATION_NAME[config.operation] ?? OPERATION_NAME.add;
  return `${name} ${currencyOf(config).units}`;
}

function instructionOf(config: MoneyConfig): string {
  if (config.form !== "vertical") return "Work out each answer.";
  // Stacked amounts line up on the point, because every one of them has two
  // digits of change. A multiplier does not: `$1.25 × 3` is three of them, and
  // the `3` has no point to put under anything — so the stacking sentence would
  // describe a column that isn't there, and §10 makes this line the whole of
  // the guidance a child gets.
  return config.operation === "multiply"
    ? "Work out each answer. Line the digits up on the right, then put the point back in."
    : "Work out each answer. Keep the points under one another.";
}

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: MoneyConfig): SheetOptions {
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
 * The two things the title leaves off are how big the amounts get and whether
 * they are stacked — which is the difference between a sheet a child adds in
 * their head and one they work in columns.
 */
export function describeMoney(config: MoneyConfig): string {
  const money = currencyOf(config);
  const { max } = bounds(config.range);
  return [
    titleOf(config),
    `to ${money.symbol}${max}`,
    config.form === "vertical" ? "in columns" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

export function buildMoneySheet(config: MoneyConfig, seed: number): Sheet {
  const items = moneyProblems(config, seed);
  const { columns } = moneyLayout(config);
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

export const MONEY_SHEET: SheetSpec<MoneyConfig> = {
  id: "money",
  label: "Money",
  world: SHEET_WORLD,
  build: buildMoneySheet,
  // The whole of the answer-key mechanism: every answer on the page was
  // computed in whole pence when the problem was built, so a key prints what is
  // already there rather than working it out a second time.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeMoney,
};
