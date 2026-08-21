/**
 * Multiplication and division.
 *
 * The tables The Grid already drills, on paper. The shared machinery is
 * unchanged (§7, §11), so this file is about the three things that are
 * genuinely different.
 *
 * **A table is a pool, not a range.** "The seven times table" is thirteen
 * facts, not a span of numbers, and a mixed set is several of those pools
 * shuffled together. So a config names `tables` and what to multiply them by,
 * and the difference between a sheet that teaches one table and a sheet that
 * tests all of them is the length of one array.
 *
 * **Division folds in the record book and not in a drill.** 7 × 8 and 8 × 7 are
 * one fact and one problem — a child who finds both on a page has been given
 * nineteen problems and a joke — while 56 ÷ 7 and 56 ÷ 8 are two questions with
 * two answers. That is exactly the distinction `DeckSpec.masteryKey` and
 * `drillKey` already make for the race, reached here from the same direction: a
 * worksheet is a drill, so the commutative operation folds and the other does
 * not.
 *
 * **Some sheets have working rather than answers.** The grid is one block with
 * a hundred and forty-four answers in it, and the long forms are rows whose
 * height is decided by how many times a child brings a digit down. Both are in
 * `long.ts` and in `gridOf` below rather than smuggled into the problem shapes.
 */
import { arithmeticFactId, factPair } from "@/engine/decks/flashcards";
import { mulberry32 } from "@/engine/random";

import type {
  Block,
  GridSpec,
  Mil,
  MultiplicationConfig,
  MultiplicationOperation,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { PROBLEM_GAP, columnWidth, fitAcross, type Box } from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";
import {
  BRACKET_EMS,
  STACK_EMS,
  drawLong,
  longDigits,
  longKey,
  longProblem,
  longRow,
} from "./long";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4). A fact written along a line is one line of the
   body type; a fact worked the way it is worked is a column stack for a
   multiplication and a bracket for a division, which are the same two shapes
   the long forms use without their working.                                 */

const ROW_EMS = { horizontal: 1.7 } as const;

/** Blank space to work a fact out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/** More than six columns of facts is a page nobody can read. */
const MAX_COLUMNS = 6;

/**
 * And more than four columns of long forms is a page nobody can work in: a
 * long division worked in a column an inch wide has nowhere to bring a digit
 * down to, which is the one thing the sheet is for.
 */
const MAX_LONG_COLUMNS = 4;

/**
 * The largest number a fact sheet will put on either side of the sign.
 *
 * Twelve is the wall chart and twelve is what a parent picks; this is only
 * here so that a config arriving from outside this build can't ask for the
 * hundred times table and a grid ten thousand squares deep.
 */
const MAX_FACT = 20;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

const SIGN = { multiply: "×", divide: "÷" } as const;

/** The biggest square a grid is drawn at: bigger is a page with nothing on it. */
const MAX_GRID_CELL = inches(0.62);

/* ── The pool ──────────────────────────────────────────────────────────────
   Sanitised once and drawn from many times, because it comes from outside this
   build: a config in a bookmarked URL may name a table twice, a fractional
   one, or none at all.                                                      */

type Pool = {
  /** The tables to multiply, in order. */
  multiply: number[];
  /**
   * The tables to divide by. The same list without zero, which is the whole of
   * "no division by zero" (§20): there is no path from here to a divisor that
   * isn't in this array.
   */
  divide: number[];
  factors: number[];
};

/** Whole, in range, deduplicated and in order. */
function tablesOf(config: MultiplicationConfig): number[] {
  const clean = (config.tables ?? [])
    .map((table) => Math.floor(table))
    .filter((table) => Number.isFinite(table) && table >= 0)
    .map((table) => Math.min(MAX_FACT, table));
  return [...new Set(clean)].sort((a, b) => a - b);
}

/** What each table is multiplied by, ends included. */
function factorsOf(config: MultiplicationConfig): number[] {
  const min = Math.min(
    MAX_FACT,
    Math.max(0, Math.floor(config.factors?.min ?? 0)),
  );
  const max = Math.min(
    MAX_FACT,
    Math.max(min, Math.floor(config.factors?.max ?? 0)),
  );
  return Array.from({ length: max - min + 1 }, (_, step) => min + step);
}

function poolOf(config: MultiplicationConfig): Pool {
  const tables = tablesOf(config);
  return {
    multiply: tables,
    divide: tables.filter((table) => table > 0),
    factors: factorsOf(config),
  };
}

/* ── The facts a child keeps missing ──────────────────────────────────────
   The other way into this family (§14), and the reason `Problem.factId`
   exists: the record book hands over the fact ids the race already files runs
   under, and the pairs behind them are read here exactly as
   `decks/flashcards.ts` writes them — the table that was picked, then what it
   was paired with. So the eight facts a child keeps missing print as the eight
   problems they missed, in the order the record book ranked them, and neither
   side has learned anything about the other's shape.                       */

/** The named facts as (table, factor) pairs — whole, in range, in order. */
function namedFacts(config: MultiplicationConfig): Array<[number, number]> {
  // The two styles with no facts to name: a square is every fact there is, and
  // a long form's numbers are not one of the twelve tables at all.
  if (config.style === "grid" || config.style === "long") return [];
  return (config.facts ?? [])
    .map(factPair)
    .filter(([table, factor]) => table >= 0 && factor >= 0)
    .map(
      ([table, factor]) =>
        [Math.min(MAX_FACT, table), Math.min(MAX_FACT, factor)] as [
          number,
          number,
        ],
    )
    .filter(
      // The same judgement `drawFact` makes, reached from the other side: a
      // blank that any number would fill is not a question, so a fact with a
      // zero in it is dropped from a missing-number sheet rather than printed
      // as one a child cannot answer.
      ([table, factor]) =>
        config.style !== "missing" || (table !== 0 && factor !== 0),
    );
}

/* ── Drawing a fact ────────────────────────────────────────────────────── */

/**
 * One fact, as it will be printed. A multiplication reads `table × factor`; a
 * division is the same fact read backwards, `product ÷ table`, so the table a
 * parent picked is the divisor and the factor is the answer.
 */
type Fact = {
  operation: "multiply" | "divide";
  table: number;
  factor: number;
  product: number;
};

/**
 * Which way round this problem reads.
 *
 * The coin is spent only when the config asks for both, exactly as the deck
 * builder short-circuits it for a non-commutative operation: a draw that took
 * one anyway would shift every subsequent problem, and every seed a parent had
 * already printed would produce a different sheet.
 */
function operationOf(
  operation: MultiplicationOperation,
  rand: () => number,
): "multiply" | "divide" {
  if (operation !== "both") return operation;
  return rand() < 0.5 ? "multiply" : "divide";
}

/** One candidate fact, or `null` when what was drawn isn't what was asked for. */
function drawFact(
  config: MultiplicationConfig,
  pool: Pool,
  operation: "multiply" | "divide",
  rand: () => number,
): Fact | null {
  const tables = operation === "multiply" ? pool.multiply : pool.divide;
  if (tables.length === 0 || pool.factors.length === 0) return null;

  const table = tables[Math.floor(rand() * tables.length)];
  const factor = pool.factors[Math.floor(rand() * pool.factors.length)];

  // A blank that any number would fill is not a question. "_ × 0 = 0" is true
  // of every number there is, and so is "0 ÷ _ = 0" — so a sheet that blanks an
  // operand never draws a zero, whichever side the blank lands on.
  if (config.style === "missing" && (table === 0 || factor === 0)) return null;

  return { operation, table, factor, product: table * factor };
}

/**
 * What makes two facts the same problem.
 *
 * Multiplication folds and division does not, which is `masteryKey` versus
 * `drillKey` arrived at from the paper side. Which slot a missing-number
 * problem blanks is not part of it either: "7 × _ = 56" and "_ × 8 = 56" are
 * one fact wearing two hats, and a child spots that faster than the adult who
 * printed it does.
 */
function keyOf(fact: Fact): string {
  if (fact.operation === "multiply") {
    const low = Math.min(fact.table, fact.factor);
    return `×:${low}:${Math.max(fact.table, fact.factor)}`;
  }
  return `÷:${fact.product}:${fact.table}`;
}

/* ── Turning a fact into a problem ─────────────────────────────────────── */

/** The three numbers in the order they are printed: `left op right = result`. */
function sentenceOf(fact: Fact): [number, number, number] {
  return fact.operation === "multiply"
    ? [fact.table, fact.factor, fact.product]
    : [fact.product, fact.table, fact.factor];
}

function problemOf(
  fact: Fact,
  config: MultiplicationConfig,
  slot: number,
  extras: { workspace?: Mil },
): Problem {
  const sign = SIGN[fact.operation];
  const [left, right, result] = sentenceOf(fact);
  // The race's own vocabulary for a fact (§14), whichever way the sheet happens
  // to ask it.
  const factId = arithmeticFactId(fact.table, fact.factor);

  if (config.style === "missing") {
    // Along the line whatever `form` says, for the reason the arithmetic
    // family gives: a blank in column form sits beside an answer already
    // written under the rule, and a child who fills in the wrong one was not
    // wrong.
    return {
      prompt:
        slot === 0
          ? `_ ${sign} ${right} = ${result}`
          : `${left} ${sign} _ = ${result}`,
      answer: String(slot === 0 ? left : right),
      factId,
      ...extras,
    };
  }

  if (config.form === "vertical") {
    // Worked the way it is worked, which is two different drawings: a
    // multiplication is a column stack and a division is the bracket. There is
    // no stacked form of a division — nobody has ever written one — so the
    // bracket is what "vertical" means for it.
    return fact.operation === "multiply"
      ? {
          prompt: "",
          operands: [String(left), String(right)],
          operator: sign,
          answer: String(result),
          factId,
          ...extras,
        }
      : {
          prompt: "",
          bracket: { divisor: String(right), dividend: String(left) },
          answer: String(result),
          factId,
          ...extras,
        };
  }

  return {
    prompt: `${left} ${sign} ${right} =`,
    answer: String(result),
    factId,
    ...extras,
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** How tall one problem stands, working space and all. */
function rowHeight(config: MultiplicationConfig): Mil {
  if (config.style === "long") return longRow(config, config.fontPt);

  const worked = config.style === "standard" && config.form === "vertical";
  // A mixed sheet reserves for the taller of the two drawings, because the row
  // height is one number for the whole grid of them.
  const ems = !worked
    ? ROW_EMS.horizontal
    : config.operation === "divide"
      ? BRACKET_EMS
      : STACK_EMS;
  return points(config.fontPt * ems) + (config.workspace ? WORKSPACE : 0);
}

/** How many problems the paper holds, and how wide a column of them is (§4). */
export function multiplicationLayout(config: MultiplicationConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = config.style === "long" ? MAX_LONG_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
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
 * Exported because it is the whole of what a test has to check. A grid has
 * none — it is one block with the answers inside it — so this is empty there.
 */
export function multiplicationProblems(
  config: MultiplicationConfig,
  seed: number,
): Problem[] {
  if (config.style === "grid") return [];

  const { perPage } = multiplicationLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const pool = poolOf(config);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  // The list arrives ranked worst-first and already folded onto one entry per
  // fact, so there is nothing left to shuffle or reject — and it runs out where
  // it runs out: six missed facts are six problems, not the same six twice.
  const named = namedFacts(config);
  if (named.length > 0) {
    for (const [table, factor] of named.slice(0, wanted)) {
      const asked = operationOf(config.operation, rand);
      // Nothing is divided by zero, here or anywhere (§20). A zero fact can
      // only be asked as a multiplication, so that is how it is asked.
      const operation = asked === "divide" && table === 0 ? "multiply" : asked;
      const slot = rand() < 0.5 ? 0 : 1;
      const fact: Fact = {
        operation,
        table,
        factor,
        product: table * factor,
      };
      problems.push(problemOf(fact, config, slot, extras));
    }
    return problems;
  }

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const operation = operationOf(config.operation, rand);
    if (config.style === "long") {
      const form = drawLong(config, operation, rand);
      const key = form === null ? null : longKey(form);
      if (form === null || key === null || seen.has(key)) {
        misses += 1;
        continue;
      }
      seen.add(key);
      problems.push(longProblem(form, config));
      misses = 0;
      continue;
    }

    const fact = drawFact(config, pool, operation, rand);
    // Which side of a missing-number problem is blank. Drawn whatever the fact
    // style, so that switching between standard and missing does not reshuffle
    // every other problem on a sheet built from the same seed. The long forms
    // have no slot and take no coin for one.
    const slot = rand() < 0.5 ? 0 : 1;
    const key = fact === null ? null : keyOf(fact);
    if (fact === null || key === null || seen.has(key)) {
      misses += 1;
      continue;
    }
    seen.add(key);
    problems.push(problemOf(fact, config, slot, extras));
    misses = 0;
  }
  return problems;
}

/* ── The grid ──────────────────────────────────────────────────────────────
   The multiplication square: the tables down the side, what they are
   multiplied by along the top, and a product in every space where the two
   meet. Not a set of problems — one block, and the only sheet in the shop
   whose answers are not written on a rule.                                  */

/**
 * The square, or `null` when there is nothing to draw one of.
 *
 * Nothing here is random, and that is correct rather than an oversight: a
 * twelve by twelve grid is the same object every time it is printed, and a
 * parent who prints it twice should get the same wall chart. The seed still
 * rides in the footer, because the sheet is still reproducible from it.
 */
export function multiplicationGrid(
  config: MultiplicationConfig,
): GridSpec | null {
  const { multiply: tables, factors } = poolOf(config);
  if (tables.length === 0 || factors.length === 0) return null;

  const columns = factors.length + 1;
  const rows = tables.length + 1;
  const box = sheetBlockBox(headerOf(config), true);
  // The square shrinks to fit rather than the drawing being rescaled, for the
  // reason `Grid` clamps it too: a grid that overran the box would come off the
  // printer at a size nobody chose, silently.
  const cell = Math.min(
    MAX_GRID_CELL,
    Math.floor(box.width / columns),
    Math.floor(box.height / rows),
  );
  if (cell <= 0) return null;

  // Row-major, headers and body in one pass over the same indices, so the two
  // lists cannot disagree about which square is which. A cell is either always
  // printed or only printed on the key — never both, and never neither.
  const cells: string[] = [];
  const answers: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const header = row === 0 || column === 0;
      cells.push(
        row === 0 && column === 0
          ? SIGN.multiply
          : row === 0
            ? String(factors[column - 1])
            : column === 0
              ? String(tables[row - 1])
              : "",
      );
      answers.push(header ? "" : String(tables[row - 1] * factors[column - 1]));
    }
  }

  return {
    kind: "chart",
    columns,
    rows,
    cell,
    cells,
    answers,
    // The heavier pair of rules, under the header row and beside the header
    // column: without them a child reads the headers as part of the answer.
    origin: { column: 1, row: 1 },
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

/** The largest number a fact sheet puts on the page, either side of the sign. */
function topOf(config: MultiplicationConfig): number {
  const { multiply: tables, factors } = poolOf(config);
  return Math.max(0, ...tables, ...factors);
}

const LONG_NAME = {
  multiply: "Long multiplication",
  divide: "Long division",
  both: "Long multiplication and division",
} as const;

const MIXED_NAME = {
  multiply: "Multiplication",
  divide: "Division",
  both: "Multiplication and division",
} as const;

/** "The 7 times table" — the phrase a parent says, and the one they search. */
function titleOf(config: MultiplicationConfig): string {
  if (config.style === "long") {
    // The remainder switch is in the title rather than only in the catalog
    // line, because it changes what the sheet *is*: a child who has not been
    // taught remainders and meets one has been set an impossible problem.
    const divides = config.operation !== "multiply";
    return divides && config.remainders
      ? `${LONG_NAME[config.operation]} with remainders`
      : LONG_NAME[config.operation];
  }

  const top = topOf(config);
  if (config.style === "grid") return `Multiplication grid to ${top}`;

  // A sheet of named facts is not "the 7 times table" and not "multiplication
  // to 12" either — it is whatever the record book handed over, and a title
  // claiming a pool it never drew from would be the one untrue line on it.
  if (namedFacts(config).length > 0)
    return `${MIXED_NAME[config.operation]} practice`;

  const tables = poolOf(config).multiply;
  if (tables.length !== 1) return `${MIXED_NAME[config.operation]} to ${top}`;
  const [table] = tables;
  switch (config.operation) {
    case "multiply":
      return `The ${table} times table`;
    case "divide":
      return `Dividing by ${table}`;
    default:
      return `The ${table} times table, both ways`;
  }
}

function instructionOf(config: MultiplicationConfig): string {
  switch (config.style) {
    case "missing":
      return "Write the missing number in each blank.";
    case "grid":
      return "Write each product in the square where its row meets its column.";
    case "long":
      return config.remainders && config.operation !== "multiply"
        ? "Show your working. Write what is left over after an r."
        : "Show your working.";
    default:
      return "Work out each answer.";
  }
}

/**
 * The header this sheet will actually print, which is what the layout reserves
 * space against — see the note in `arithmetic.ts`.
 */
function headerOf(config: MultiplicationConfig): SheetOptions {
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
 * sheet matches the lesson: how the problem is written down, and — for a long
 * form — how big the numbers are.
 */
function describeMultiplication(config: MultiplicationConfig): string {
  const digits = longDigits(config);
  // "8 tricky facts" is the race's own phrase for the same list — see
  // `describeFlashConfig` — so a drill that was printed and one that was raced
  // read alike wherever the two end up beside each other.
  const named = namedFacts(config);
  if (named.length > 0) {
    const facts = named.length === 1 ? "fact" : "facts";
    return `${titleOf(config)} — ${named.length} tricky ${facts}`;
  }
  return [
    titleOf(config),
    config.style === "long"
      ? `${digits.into}-digit by ${digits.by}-digit`
      : null,
    config.style === "standard" && config.form === "vertical"
      ? "worked in columns"
      : null,
    config.style === "missing" ? "missing number" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

/** The blocks, and what the sheet is marked out of. */
function bodyOf(
  config: MultiplicationConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  if (config.style === "grid") {
    const grid = multiplicationGrid(config);
    if (grid === null) return { blocks: [], outOf: 0 };
    return {
      blocks: [{ kind: "grid", grid }],
      // Marked out of the squares a child has to fill, which is the grid
      // without its two headers.
      outOf: (grid.columns - 1) * (grid.rows - 1),
    };
  }

  const items = multiplicationProblems(config, seed);
  const { columns } = multiplicationLayout(config);
  return {
    blocks: [{ kind: "problems", columns, items }],
    outOf: items.length,
  };
}

function buildMultiplicationSheet(
  config: MultiplicationConfig,
  seed: number,
): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = bodyOf(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      score: { outOf },
    },
    blocks,
    footer: { credit: SHEET_CREDIT, url: gameUrl("grid"), seed },
    answers: false,
  };
}

export const MULTIPLICATION_SHEET: SheetSpec<MultiplicationConfig> = {
  world: SHEET_WORLD,
  build: buildMultiplicationSheet,
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeMultiplication,
};
