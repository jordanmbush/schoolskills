/**
 * Fractions.
 *
 * Everything the arithmetic and multiplication families established holds here
 * unchanged — the answers are computed when the problem is built and the key
 * only decides to print them, the page comes out of `(config, seed)` and
 * nothing else, and a problem is drawn and rejected rather than enumerated. So
 * this file is about the three things a fraction sheet has that a page of sums
 * does not.
 *
 * **An answer can be right and still be wrong.** `4/8` and `1/2` are the same
 * value, and only one of them is the answer a parent will mark as correct. So
 * every answer this family computes is reduced (`exact.ts` does the reducing),
 * every naming problem is drawn so that what is shaded is *already* in lowest
 * terms — a picture of four eighths has two right answers and no way for a
 * child to know which was wanted — and the sheet says so in its instructions.
 *
 * **Some fractions are pictures.** A naming sheet asks what fraction of a bar
 * or a circle is shaded, so the question is a drawing and the drawing is on the
 * blank sheet as well as on the key. It rides on the problem as `art`, the way
 * a number line does, and its size is in `fractionart.ts` where both the row
 * reservation and the renderer read it.
 *
 * **Like and unlike is the whole lesson.** Adding quarters to quarters is the
 * week before adding quarters to thirds, and `pairing` is the switch between
 * them — this family's `regrouping`. A sheet that mixed the two would be set at
 * a level nobody chose.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  Denominators,
  FractionArt,
  FractionConfig,
  FractionOperation,
  FractionStyle,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { artHeight, fractionArt } from "../fractionart";
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
import {
  gcd,
  minus,
  over,
  plus,
  times,
  whole,
  writeFraction,
  type Fraction,
} from "./exact";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/**
 * How tall a problem written along a line stands: two lines of the body type,
 * and the air a wrap puts between them.
 *
 * Two rather than one, because a fraction sentence is long. `3 5/12 ÷ 2 7/8 =`
 * with a ruled blank after it does not fit across a third of a page, and
 * `.sheet__problem` wraps rather than overflowing — so the second line is
 * either inside the row the layout declared, or it is the bottom of the page
 * coming out of the printer on a second sheet. Reserving for the wrap is the
 * only version of this that a page can be laid out from without measuring text,
 * and a sheet whose problems all fit on one line is left a little airier than it
 * needed to be — which on a fraction sheet is where the common denominator gets
 * worked out.
 */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work a problem out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Four columns of fractions, and three of pictures.
 *
 * Fewer than the six a page of tables holds, because the problems are wider:
 * `3/4 + 5/6 =` is three times the sentence `7 × 8 =` is, and a problem that
 * wraps is a row taller than the layout reserved for it.
 */
const MAX_COLUMNS = 4;
const MAX_ART_COLUMNS = 3;

/** Halves to twentieths. Beyond that a diagram is a bar with hairlines on it. */
const MAX_DENOMINATOR = 20;

/**
 * How far an equivalent or simplified fraction may be scaled up, and how far
 * the denominator it lands on may go.
 *
 * `3/4 = _/24` is a fair question; `3/4 = _/96` is arithmetic homework wearing
 * a fraction's clothes. Both bounds are needed: the multiplier keeps the
 * numbers a child can see, and the ceiling stops a pool of twelfths reaching
 * sixtieths.
 */
const MAX_SCALE = 5;
const MAX_SCALED_DENOMINATOR = 24;

/** The whole numbers in front of a mixed number: `2 1/4`, never `17 1/4`. */
const MAX_WHOLE = 3;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

const SIGN = {
  add: "+",
  subtract: "−",
  multiply: "×",
  divide: "÷",
} as const;

/* ── The pool ──────────────────────────────────────────────────────────────
   Sanitised once and drawn from many times, because it comes from outside this
   build: a config in a bookmarked URL may name a denominator twice, a
   fractional one, or a nought — and a nought is not a slow sheet, it is a
   division by zero.                                                          */

/** Whole, at least two, in range, deduplicated and in order. */
function denominatorsOf(config: FractionConfig): number[] {
  const clean = (config.denominators ?? [])
    .map((value) => Math.floor(value))
    .filter((value) => Number.isFinite(value) && value >= 2)
    .map((value) => Math.min(MAX_DENOMINATOR, value));
  return [...new Set(clean)].sort((a, b) => a - b);
}

const pick = <T>(items: T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

/* ── Drawing a problem ─────────────────────────────────────────────────────
   Each style draws its own shape and they have little in common — a picture, a
   pair with a gap in it, a fraction to cancel down, a sum — so each returns the
   same three answers instead: what it reads, what the answer is, and what makes
   two of them the same problem.                                              */

type Drawn = { key: string; prompt: string; answer: string; art?: FractionArt };

/**
 * A proper fraction over `d`, already in lowest terms — or `null`.
 *
 * The rejection is the point rather than a cost. Every style here needs a
 * fraction whose value has exactly one right way of being written: a naming
 * picture of `4/8` could be answered `4/8` or `1/2` and a child would be marked
 * wrong for the one the adult didn't think of, and `8/12` scaled up for a
 * simplifying sheet is a fraction whose "lowest terms" are not what the sheet
 * meant either.
 */
function properOver(d: number, rand: () => number): Fraction | null {
  const n = between(1, d - 1, rand);
  return gcd(n, d) === 1 ? { n, d } : null;
}

/** A picture with some of its parts shaded, and the fraction that names it. */
function drawIdentify(
  config: FractionConfig,
  pool: number[],
  rand: () => number,
): Drawn | null {
  const model = config.model ?? "bar";
  // The coin is spent only when the config asks for both, exactly as the other
  // families short-circuit theirs: a draw that took one anyway would shift
  // every subsequent problem, and every seed a parent had already printed would
  // produce a different sheet.
  const shape = model === "both" ? (rand() < 0.5 ? "bar" : "circle") : model;
  const value = properOver(pick(pool, rand), rand);
  if (value === null) return null;
  return {
    // Folded on the value rather than on the picture: a bar showing three
    // quarters and a circle showing three quarters are one question asked
    // twice, and a child notices that faster than the adult who printed it.
    key: `identify:${value.n}:${value.d}`,
    prompt: "",
    answer: writeFraction(value, false),
    art: fractionArt(shape, value.d, value.n),
  };
}

/**
 * The same value written over a bigger denominator, with one of the four
 * numbers missing: `3/4 = _/12`, or `3/4 = 9/_`.
 *
 * Which number is blank is drawn, because a sheet that always blanked the
 * numerator would teach a child to multiply the top and never ask them why.
 */
function drawEquivalent(pool: number[], rand: () => number): Drawn | null {
  const value = properOver(pick(pool, rand), rand);
  const by = between(2, MAX_SCALE, rand);
  const top = rand() < 0.5;
  if (value === null || value.d * by > MAX_SCALED_DENOMINATOR) return null;
  const scaled = { n: value.n * by, d: value.d * by };
  return {
    key: `equivalent:${value.n}:${value.d}:${by}:${top ? "n" : "d"}`,
    prompt: top
      ? `${value.n}/${value.d} = _/${scaled.d}`
      : `${value.n}/${value.d} = ${scaled.n}/_`,
    answer: String(top ? scaled.n : scaled.d),
  };
}

/** A fraction with something left to cancel, and what it cancels down to. */
function drawSimplify(pool: number[], rand: () => number): Drawn | null {
  const value = properOver(pick(pool, rand), rand);
  const by = between(2, MAX_SCALE, rand);
  if (value === null || value.d * by > MAX_SCALED_DENOMINATOR) return null;
  return {
    key: `simplify:${value.n * by}:${value.d * by}`,
    // Scaled up from a fraction already in lowest terms, so what the sheet
    // asks for is what `reduced` would answer and there is no second opinion.
    prompt: `${value.n * by}/${value.d * by} =`,
    answer: writeFraction(value, false),
  };
}

/** Which way round an `either` sheet's problem reads. */
function operationOf(
  operation: FractionOperation,
  rand: () => number,
): Exclude<FractionOperation, "both"> {
  if (operation !== "both") return operation;
  return rand() < 0.5 ? "add" : "subtract";
}

/**
 * One operand: a proper fraction, with a whole number in front of it when the
 * sheet is a mixed-number sheet.
 */
function operandOf(
  d: number,
  mixed: boolean,
  rand: () => number,
): Fraction | null {
  const part = properOver(d, rand);
  if (part === null) return null;
  return mixed ? plus(whole(between(1, MAX_WHOLE, rand)), part) : part;
}

/** A sum, a difference, a product or a quotient of two fractions. */
function drawArithmetic(
  config: FractionConfig,
  pool: number[],
  rand: () => number,
): Drawn | null {
  const operation = operationOf(config.operation, rand);
  const pairing: Denominators = config.pairing ?? "either";
  const mixed = config.mixed === true;

  const first = pick(pool, rand);
  // Like denominators take no second draw at all, which is what keeps a `like`
  // sheet and an `unlike` sheet from being the same sheet with two problems
  // swapped: they are different questions, drawn differently.
  const second = pairing === "like" ? first : pick(pool, rand);
  if (pairing === "unlike" && first === second) return null;

  const left = operandOf(first, mixed, rand);
  const right = operandOf(second, mixed, rand);
  if (left === null || right === null) return null;

  const pair = order(operation, left, right);
  if (pair === null) return null;
  const [a, b] = pair;

  const answer = ANSWER[operation](a, b);
  const written = [writeFraction(a, mixed), writeFraction(b, mixed)];
  return {
    // Addition and multiplication fold — `1/2 + 1/3` and `1/3 + 1/2` are one
    // problem — while subtraction and division do not, which is the same
    // distinction `masteryKey` and `drillKey` draw for the race.
    key: FOLDS[operation]
      ? `${operation}:${[...written].sort().join(":")}`
      : `${operation}:${written.join(":")}`,
    prompt: `${written[0]} ${SIGN[operation]} ${written[1]} =`,
    answer: writeFraction(answer, mixed),
  };
}

const ANSWER: Record<
  Exclude<FractionOperation, "both">,
  (a: Fraction, b: Fraction) => Fraction
> = { add: plus, subtract: minus, multiply: times, divide: over };

const FOLDS: Record<Exclude<FractionOperation, "both">, boolean> = {
  add: true,
  subtract: false,
  multiply: true,
  divide: false,
};

/**
 * The two operands in the order they are printed, or `null` when the pair makes
 * no problem.
 *
 * Nothing in the Print Shop prints a negative fraction, so a difference is
 * written larger first — the same bargain the arithmetic family strikes with
 * its subtraction, and for the same reason: rejecting half the draws instead
 * would halve the pool for no gain. A difference of nothing is thrown away
 * rather than turned round, because `3/4 − 3/4` is a question that answers
 * itself.
 */
function order(
  operation: Exclude<FractionOperation, "both">,
  left: Fraction,
  right: Fraction,
): [Fraction, Fraction] | null {
  if (operation !== "subtract") return [left, right];
  const difference = left.n * right.d - right.n * left.d;
  if (difference === 0) return null;
  return difference > 0 ? [left, right] : [right, left];
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * How tall the picture on a naming sheet stands.
 *
 * Measured through `artHeight` rather than from a number of its own, because
 * the renderer sizes the drawing with the same function: a second copy of "how
 * tall is a circle" here would be a reservation that agrees with the drawing
 * until somebody changes one of them.
 *
 * A circle is taller than a bar, and a `both` sheet reserves for the taller of
 * the two — the row height is one number for the whole grid of them.
 */
function artRow(config: FractionConfig): Mil {
  const shape = (config.model ?? "bar") === "bar" ? "bar" : "circle";
  return artHeight({ shape, parts: 1, shaded: 0 });
}

/** How tall one problem stands, picture and working space and all. */
function rowHeight(config: FractionConfig): Mil {
  // A naming problem is its picture and a ruled blank, and the blank is
  // reserved as a second line for the reason above: a bar and a blank do not
  // fit across a third of a page, so the row is the drawing, the wrap, and the
  // line the answer is written on.
  const body =
    config.style === "identify"
      ? artRow(config) + WRAP_GAP + answerLine(config.fontPt)
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
export function fractionLayout(config: FractionConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = config.style === "identify" ? MAX_ART_COLUMNS : MAX_COLUMNS;
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
 * Exported because it is the whole of what a test has to check, and checking it
 * through the `Sheet` means unwrapping a block union to reach it.
 */
export function fractionProblems(
  config: FractionConfig,
  seed: number,
): Problem[] {
  const { perPage } = fractionLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const pool = denominatorsOf(config);
  const seen = new Set<string>();
  const problems: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};
  if (pool.length === 0) return problems;

  let misses = 0;
  while (problems.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawOne(config, pool, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself: halves, thirds and quarters make eleven naming
    // problems, and eleven is the honest answer to a request for twenty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    problems.push({
      prompt: drawn.prompt,
      answer: drawn.answer,
      ...(drawn.art ? { art: drawn.art } : {}),
      ...extras,
    });
    misses = 0;
  }
  return problems;
}

function drawOne(
  config: FractionConfig,
  pool: number[],
  rand: () => number,
): Drawn | null {
  switch (config.style) {
    case "identify":
      return drawIdentify(config, pool, rand);
    case "equivalent":
      return drawEquivalent(pool, rand);
    case "simplify":
      return drawSimplify(pool, rand);
    default:
      return drawArithmetic(config, pool, rand);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const OPERATION_NAME = {
  add: "Adding",
  subtract: "Subtracting",
  multiply: "Multiplying",
  divide: "Dividing",
  both: "Adding and subtracting",
} as const;

/** Whether like and unlike denominators are a question this sheet answers. */
const takesDenominators = (config: FractionConfig): boolean =>
  config.style === "arithmetic" &&
  config.operation !== "multiply" &&
  config.operation !== "divide";

/**
 * "Adding fractions with unlike denominators" — the phrase a parent says out
 * loud, and the one they type into a search box.
 *
 * A mixed-number sheet says so in the noun rather than in a qualifier, because
 * that is what it is called: nobody searches for "adding fractions with whole
 * numbers in front".
 */
function titleOf(config: FractionConfig): string {
  switch (config.style) {
    case "identify":
      return "Naming fractions";
    case "equivalent":
      return "Equivalent fractions";
    case "simplify":
      return "Simplifying fractions";
    default: {
      const noun = config.mixed ? "mixed numbers" : "fractions";
      const name = `${OPERATION_NAME[config.operation]} ${noun}`;
      const pairing = config.pairing ?? "either";
      return takesDenominators(config) && pairing !== "either"
        ? `${name} with ${pairing} denominators`
        : name;
    }
  }
}

const INSTRUCTION: Record<FractionStyle, string> = {
  identify: "Write the fraction each picture shows.",
  equivalent: "Write the missing number in each blank.",
  simplify: "Write each fraction in its lowest terms.",
  arithmetic: "Work out each answer and write it in its lowest terms.",
};

function instructionOf(config: FractionConfig): string {
  const said = INSTRUCTION[config.style] ?? INSTRUCTION.arithmetic;
  // Said on the sheet rather than assumed, because it is the difference
  // between a right answer and a wrong one: a child who writes `7/6` on a
  // mixed-number sheet has answered the question nobody asked.
  return config.style === "arithmetic" && config.mixed
    ? `${said} Write anything over one as a mixed number.`
    : said;
}

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: FractionConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions: config.instructions ?? instructionOf(config),
  };
}

const MODEL_NAME = {
  bar: "fraction bars",
  circle: "fraction circles",
  both: "bars and circles",
} as const;

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * The two things the title leaves off are the two that decide whether a sheet
 * matches the lesson: which pictures a naming sheet draws, and how far up the
 * denominators go.
 */
export function describeFractions(config: FractionConfig): string {
  const pool = denominatorsOf(config);
  return [
    titleOf(config),
    config.style === "identify"
      ? MODEL_NAME[config.model ?? "bar"]
      : pool.length > 0
        ? `denominators to ${pool[pool.length - 1]}`
        : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

export function buildFractionSheet(
  config: FractionConfig,
  seed: number,
): Sheet {
  const items = fractionProblems(config, seed);
  const { columns } = fractionLayout(config);
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

export const FRACTIONS_SHEET: SheetSpec<FractionConfig> = {
  id: "fractions",
  label: "Fractions",
  world: SHEET_WORLD,
  build: buildFractionSheet,
  // The whole of the answer-key mechanism: every answer on the page was reduced
  // when the problem was built, so a key prints what is already there rather
  // than reducing a second time and risking a different answer to the same
  // question.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeFractions,
};
