/**
 * Expressions, equations, inequalities and slope.
 *
 * The family where the answer stops being a number. `x = 5` is a sentence,
 * `x > −4` is every number past a point, and a slope is a pair of numbers that
 * is only right written the smallest way — so three of the five styles here
 * have an answer that a generator can get *nearly* right, which is the same as
 * wrong on a page a child is marked against.
 *
 * Three decisions carry the family.
 *
 * **Every equation is built from its solution.** The number that makes it true
 * is drawn first and the equation is assembled around it, so the key is not the
 * result of solving anything — there is nothing to solve, and therefore nothing
 * to solve wrongly. The suite then puts the answer back into the printed
 * equation, which is the only check on a solution that is worth anything.
 *
 * **A sign flips when you divide by a negative.** `−2x > 8` is `x < −4`, and it
 * is the single most-missed step in pre-algebra. It lives in exactly one place
 * here — `solutionOf` — because a second copy of that rule is a second chance to
 * get it backwards, and a page of inequalities each turned the wrong way looks
 * completely plausible.
 *
 * **Algebra folds a sign into the operator.** The integers sheet writes
 * `7 + (−4)`, because two operators in a row cannot be read aloud; algebra
 * writes `3x − 4`, because that is what a textbook, a board and an exam paper
 * print. Both conventions are right for their sheet and neither is right for the
 * other, which is why `factorText` is imported by one of these files and not the
 * other.
 */
import { between, mulberry32, shuffled } from "@/engine/random";

import type {
  AlgebraStyle,
  GridMark,
  Mil,
  PreAlgebraConfig,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  BLOCK_GAP,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches } from "../paper";
import {
  letterAt,
  markAt,
  planeFloor,
  planeHeight,
  planeOf,
  type Plane,
} from "../plane";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { MINUS, fractionText, reduced, signedText } from "./exact";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/** Two lines of the body type and the air a wrap puts between them. */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an answer out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Three columns of equations, and two of expressions.
 *
 * `2x + 3y when x = 4, y = 2` is most of a line of type before its answer slot,
 * and a column narrower than the sentence is a page of problems each wrapped
 * onto three lines.
 */
const MAX_COLUMNS = 3;
const MAX_EXPRESSION_COLUMNS = 2;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/** The letter this family solves for. Every sheet in the world uses it. */
const X = "x";

/**
 * How many points a graph sheet marks on its plane.
 *
 * Six points make fifteen pairs, which is more questions than fit under a plane
 * that has taken half the page — and few enough that a child is not hunting
 * through an alphabet to find the one they were asked about.
 */
const POINTS = 6;

/* ── Writing algebra ───────────────────────────────────────────────────────
   Four small functions, and between them every line this family prints. The
   sign of a constant is folded into the operator in front of it, which is what
   makes `3x − 4` rather than `3x + (−4)`.                                    */

/**
 * A term in a letter: "x", "−x", "3x", "−3x" — or "3y", on the one sheet with
 * two letters on it.
 *
 * One is never printed: `1x` is not a thing anybody writes, and a child copying
 * it into their working would be copying a mistake.
 */
function termText(coefficient: number, letter = X): string {
  if (coefficient === 1) return letter;
  if (coefficient === -1) return `${MINUS}${letter}`;
  return `${signedText(coefficient)}${letter}`;
}

/** What follows it: " + 4", " − 4", or nothing at all when there is nothing. */
const thenText = (value: number): string =>
  value === 0 ? "" : ` ${value < 0 ? MINUS : "+"} ${Math.abs(value)}`;

/** A whole linear expression: "3x + 4", "−x − 5", "6" when the letter cancels. */
const linearText = (coefficient: number, constant: number): string =>
  coefficient === 0
    ? String(constant)
    : `${termText(coefficient)}${thenText(constant)}`;

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

/** Whether this sheet may put a minus sign on a number. On unless refused. */
const signed = (config: PreAlgebraConfig): boolean =>
  config.negatives !== false;

/**
 * One number of the size the config asked for, with its sign drawn separately.
 *
 * The range counts magnitudes, as it does on an integers sheet: a parent asks
 * for "numbers to twenty" and means twenty either way round.
 */
function draw(
  config: PreAlgebraConfig,
  rand: () => number,
  range = bounds(config.range),
): number {
  const size = between(range.min, range.max, rand);
  return signed(config) && rand() < 0.5 ? -size : size;
}

/** A coefficient never being one, which would make a two-step sheet one-step. */
const drawCoefficient = (
  config: PreAlgebraConfig,
  rand: () => number,
): number => {
  const { min, max } = bounds(config.range);
  return draw(config, rand, { min: Math.max(2, min), max: Math.max(2, max) });
};

type Drawn = { key: string; prompt: string; answer: string };

/* ── Expressions ───────────────────────────────────────────────────────────
   Two questions under one heading, because they are the two halves of one
   lesson: putting a number into a rule, and tidying a rule up before anybody
   puts a number into it.                                                    */

/**
 * A rule with a number put into it: "3x + 4 when x = 5".
 *
 * Every shape here is built so the arithmetic lands whole — the division form
 * draws the multiple rather than the value — and the answer is worked out from
 * the same three numbers the sentence is printed from.
 */
function drawEvaluate(config: PreAlgebraConfig, rand: () => number): Drawn {
  const coefficient = drawCoefficient(config, rand);
  const constant = draw(config, rand);
  const value = draw(config, rand);
  const shape = Math.floor(rand() * 4);

  if (shape === 0) {
    return evaluated(
      `${linearText(coefficient, constant)} when ${X} = ${signedText(value)}`,
      coefficient * value + constant,
    );
  }
  if (shape === 1) {
    // A bracket, which is the same rule with the multiplying done last — and
    // the one shape on the sheet where a child who works left to right gets a
    // different answer from one who does not.
    return evaluated(
      `${signedText(coefficient)}(${X}${thenText(constant)}) when ${X} = ${signedText(value)}`,
      coefficient * (value + constant),
    );
  }
  if (shape === 2) {
    // Over a divisor, so the value put in is a multiple of it: a sheet whose
    // answer is 4⅓ is a fractions sheet that got in by the back door.
    const divisor = Math.abs(drawCoefficient(config, rand));
    const multiple = draw(config, rand);
    return evaluated(
      `${X}/${divisor}${thenText(constant)} when ${X} = ${signedText(multiple * divisor)}`,
      multiple + constant,
    );
  }
  // Two letters, which is the first time a child meets an expression that
  // cannot be tidied up before the numbers arrive.
  const second = drawCoefficient(config, rand);
  const other = draw(config, rand);
  return evaluated(
    `${termText(coefficient)}${thenText(second)}y when ${X} = ${signedText(value)}, y = ${signedText(other)}`,
    coefficient * value + second * other,
  );
}

const evaluated = (prompt: string, value: number): Drawn => ({
  key: `evaluate:${prompt}`,
  prompt,
  answer: signedText(value),
});

/**
 * Like terms, collected: "5x + 3x − 2x =" makes "6x".
 *
 * The answer is assembled by `linearText` from two totals, which is what keeps
 * `0x + 7` off the page: an expression whose letters cancel is written as the
 * number it is, and one whose numbers cancel is written without them.
 */
function drawSimplify(
  config: PreAlgebraConfig,
  rand: () => number,
): Drawn | null {
  const first = drawCoefficient(config, rand);
  const second = drawCoefficient(config, rand);
  const withNumbers = rand() < 0.5;

  if (!withNumbers) {
    // A magnitude, because the sign is already printed in front of it: the
    // third term is the one this shape *subtracts*, and a negative third would
    // print "− 8x" while taking away minus eight of them.
    const third = Math.abs(drawCoefficient(config, rand));
    const total = first + second - third;
    // Every letter cancelling leaves "0", which is a true answer to a question
    // nobody asked: the sheet is about collecting terms, not about nought. And
    // three positive terms can still collect to a negative one, which is a
    // minus sign on a sheet that turned them off.
    if (total === 0) return null;
    if (!signed(config) && total < 0) return null;
    return {
      key: `simplify:${first}:${second}:${third}`,
      prompt: `${termText(first)}${thenText(second)}${X} ${MINUS} ${third}${X} =`,
      answer: termText(total),
    };
  }

  const constant = draw(config, rand);
  const other = draw(config, rand);
  const letters = first + second;
  const numbers = constant + other;
  if (letters === 0 && numbers === 0) return null;
  return {
    key: `simplify:${first}:${constant}:${second}:${other}`,
    prompt: `${termText(first)}${thenText(constant)}${thenText(second)}${X}${thenText(other)} =`,
    answer: linearText(letters, numbers),
  };
}

/* ── Equations and inequalities ────────────────────────────────────────────
   One shape for both, because they are the same six forms with a different
   sign in the middle — and because the flip that an inequality suffers when it
   is divided by a negative has to live in one place or be wrong in two.      */

/**
 * The left-hand side, and what it is worth at a given `x`.
 *
 * `(p·x + q) / r`, with `r` positive, which covers every form this family
 * prints and is exact by construction: the value the equation is set equal to
 * is worked out at the solution, not looked for afterwards.
 */
type Side = { text: string; p: number; q: number; r: number };

type Form = {
  id: string;
  /** How many moves it takes to undo. The switch `steps` chooses between. */
  steps: number;
  draw(config: PreAlgebraConfig, rand: () => number): { side: Side; x: number };
};

const FORMS: Form[] = [
  {
    id: "add",
    steps: 1,
    draw: (config, rand) => {
      const constant = draw(config, rand);
      const x = draw(config, rand);
      return {
        side: { text: linearText(1, constant), p: 1, q: constant, r: 1 },
        x,
      };
    },
  },
  {
    id: "times",
    steps: 1,
    draw: (config, rand) => {
      const coefficient = drawCoefficient(config, rand);
      const x = draw(config, rand);
      return {
        side: { text: termText(coefficient), p: coefficient, q: 0, r: 1 },
        x,
      };
    },
  },
  {
    id: "over",
    steps: 1,
    draw: (config, rand) => {
      // The divisor is never negative: dividing by a negative *number* is a
      // different lesson from multiplying by one, and `x/−3` is not how anybody
      // writes it. A negative coefficient is where that lesson lives.
      const divisor = Math.abs(drawCoefficient(config, rand));
      const multiple = draw(config, rand);
      return {
        side: { text: `${X}/${divisor}`, p: 1, q: 0, r: divisor },
        x: multiple * divisor,
      };
    },
  },
  {
    id: "times-add",
    steps: 2,
    draw: (config, rand) => {
      const coefficient = drawCoefficient(config, rand);
      const constant = draw(config, rand);
      const x = draw(config, rand);
      return {
        side: {
          text: linearText(coefficient, constant),
          p: coefficient,
          q: constant,
          r: 1,
        },
        x,
      };
    },
  },
  {
    id: "over-add",
    steps: 2,
    draw: (config, rand) => {
      const divisor = Math.abs(drawCoefficient(config, rand));
      const constant = draw(config, rand);
      const multiple = draw(config, rand);
      return {
        side: {
          text: `${X}/${divisor}${thenText(constant)}`,
          p: 1,
          q: constant * divisor,
          r: divisor,
        },
        x: multiple * divisor,
      };
    },
  },
  {
    id: "bracket",
    steps: 2,
    draw: (config, rand) => {
      const coefficient = drawCoefficient(config, rand);
      const constant = draw(config, rand);
      const x = draw(config, rand);
      return {
        side: {
          text: `${signedText(coefficient)}(${X}${thenText(constant)})`,
          p: coefficient,
          q: coefficient * constant,
          r: 1,
        },
        x,
      };
    },
  },
];

/** What the side is worth at the solution — a whole number, by construction. */
const valueAt = (side: Side, x: number): number =>
  (side.p * x + side.q) / side.r;

function drawSide(
  config: PreAlgebraConfig,
  rand: () => number,
): { side: Side; x: number } {
  const wanted = Math.max(1, Math.min(2, Math.floor(config.steps ?? 1)));
  return pick(
    FORMS.filter((form) => form.steps === wanted),
    rand,
  ).draw(config, rand);
}

function drawEquation(config: PreAlgebraConfig, rand: () => number): Drawn {
  const { side, x } = drawSide(config, rand);
  const value = valueAt(side, x);
  return {
    key: `equation:${side.text}:${value}`,
    prompt: `${side.text} = ${signedText(value)}`,
    // Written out as a sentence rather than as a bare number, because that is
    // what the child is asked to write and what the instruction says. A key
    // reading "5" beside a page of `x = …` is a key in a different language.
    answer: `${X} = ${signedText(x)}`,
  };
}

/** The four signs, and what each becomes when the inequality is turned round. */
const RELATIONS = ["<", ">", "≤", "≥"] as const;
const FLIPPED: Record<string, string> = {
  "<": ">",
  ">": "<",
  "≤": "≥",
  "≥": "≤",
};

/**
 * The solution to an inequality, sign and all.
 *
 * The one place the flip is written down. Dividing both sides by a negative
 * turns the sign round — and this family's forms put a negative in exactly one
 * place, the coefficient, because the divisor is drawn positive. So `p < 0` is
 * the whole of the condition, and a sheet of inequalities each turned the wrong
 * way is a mistake that can only be made here.
 */
const solutionOf = (side: Side, relation: string, x: number): string =>
  `${X} ${side.p < 0 ? FLIPPED[relation] : relation} ${signedText(x)}`;

function drawInequality(config: PreAlgebraConfig, rand: () => number): Drawn {
  const { side, x } = drawSide(config, rand);
  const relation = pick(RELATIONS, rand);
  const value = valueAt(side, x);
  return {
    key: `inequality:${side.text}:${relation}:${value}`,
    prompt: `${side.text} ${relation} ${signedText(value)}`,
    answer: solutionOf(side, relation, x),
  };
}

/* ── Slope ─────────────────────────────────────────────────────────────────
   Rise over run, which is a fraction — so it is held as one and reduced by the
   same greatest common divisor every fraction in the shop is reduced by. A key
   that said 6/4 where a child wrote 3/2 would mark the child wrong.          */

/** The slope of the line through two points, written the smallest way. */
function slopeText(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string | null {
  const run = to.x - from.x;
  // A vertical line has no slope at all — not nought, and not a number a child
  // can write in a blank. It is a lesson of its own, and not this one.
  if (run === 0) return null;
  // The denominator carries no sign: −3/4 and 3/−4 are one number written two
  // ways, and only the first is ever marked right.
  const sign = run < 0 ? -1 : 1;
  const slope = reduced({ n: sign * (to.y - from.y), d: sign * run });
  // The sign is written here rather than left to `fractionText`, which puts a
  // JavaScript hyphen in front of a negative numerator. This is the one family
  // in the shop whose fractions go below nought (see the note at the top of
  // `exact.ts`), and a page carrying two different minus signs — a hyphen in
  // the answers and a proper one everywhere else — reads as a typing error.
  return slope.n < 0
    ? `${MINUS}${fractionText({ n: -slope.n, d: slope.d })}`
    : fractionText(slope);
}

function drawSlope(config: PreAlgebraConfig, rand: () => number): Drawn | null {
  const points = [0, 1].map(() => ({
    x: draw(config, rand),
    y: draw(config, rand),
  }));
  const slope = slopeText(points[0], points[1]);
  if (slope === null) return null;
  // Two points with no minus sign between them still make a line that goes
  // downhill, and a sheet that promised no negative numbers has just printed
  // one in its key.
  if (!signed(config) && slope.startsWith(MINUS)) return null;
  const said = points
    .map((point) => `(${signedText(point.x)}, ${signedText(point.y)})`)
    .join(" and ");
  return { key: `slope:${said}`, prompt: said, answer: slope };
}

/* ── The graph ─────────────────────────────────────────────────────────────
   The same question with the numbers taken off the page and put on a plane:
   the child reads two points off the grid and works the slope out from them,
   which is where slope is met before it is ever an ordered pair in a bracket.  */

type Marked = { x: number; y: number; label: string };

/**
 * The points a graph sheet marks, every one of them at a different `x`.
 *
 * Which is not tidiness: two points sharing an `x` make a vertical line, whose
 * slope is not a number, and a sheet that asked for it would have a blank that
 * cannot be filled in. Drawing the `x` values without replacement means every
 * pair of points on the plane is a fair question, rather than most of them.
 *
 * Nothing sits on an axis, for the reason `geometry.ts` gives: a dot on one of
 * the two heavy rules is a dot a child has to look twice at.
 */
function markPoints(plane: Plane, rand: () => number): Marked[] {
  const low = planeFloor(plane);
  const places: number[] = [];
  for (let at = low; at <= plane.span; at += 1) if (at !== 0) places.push(at);

  const across = shuffled(places, rand).slice(0, POINTS);
  return across.map((x, index) => ({
    x,
    y: pick(places, rand),
    label: letterAt(index),
  }));
}

/** Two of the marked points, named by their letters. */
function drawPair(points: Marked[], rand: () => number): Drawn | null {
  if (points.length < 2) return null;
  const first = Math.floor(rand() * points.length);
  const second = Math.floor(rand() * points.length);
  if (first === second) return null;
  const [from, to] = [points[first], points[second]];
  const slope = slopeText(from, to);
  if (slope === null) return null;
  // Folded on the pair, because the slope of AB is the slope of BA: the same
  // question asked twice, and a child spots it faster than the adult printing
  // it does.
  const pair = [from.label, to.label].sort();
  return {
    key: `pair:${pair.join("")}`,
    prompt: `${from.label} and ${to.label}`,
    answer: slope,
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * How many problems the paper holds, how wide a column of them is, and — on a
 * graph sheet — the plane they are asked about.
 *
 * Arithmetic, not measurement, so `npm run test:unit` can answer "did it fit?"
 * without a browser — and so the same answer serves the catalog page built at
 * build time and the builder's preview (§4).
 */
export function preAlgebraLayout(config: PreAlgebraConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
  plane?: Plane;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most =
    config.style === "expression" ? MAX_EXPRESSION_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
  const row = writtenRow(config.fontPt) + (config.workspace ? WORKSPACE : 0);

  const plane =
    config.style === "graph" ? planeOf(config.quadrants ?? 4, box) : undefined;
  // The grid is a block of its own above the problems, so it takes its height
  // and the gap under it out of what is left for them.
  const left = plane
    ? Math.max(0, box.height - planeHeight(plane) - BLOCK_GAP)
    : box.height;

  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(left, row, PROBLEM_GAP.y),
    ...(plane ? { plane } : {}),
  };
}

/**
 * Every problem on the sheet, and the points marked on the plane above them.
 *
 * Exported because it is the whole of what a test has to check, and checking it
 * through the `Sheet` means unwrapping a block union to reach it. The marks come
 * back with the problems rather than being worked out again from them, so a dot
 * on the grid and the slope it is answered with cannot disagree.
 */
export function preAlgebraProblems(
  config: PreAlgebraConfig,
  seed: number,
): { items: Problem[]; marks: GridMark[] } {
  const { perPage, plane } = preAlgebraLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  // The points come first, before any problem is drawn, because they are what
  // the questions are *about* — a sheet whose plane depended on how many
  // questions fitted would redraw the whole graph when a margin changed.
  const points = plane ? markPoints(plane, rand) : [];
  const seen = new Set<string>();
  const items: Problem[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (items.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawOne(config, points, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself: six points make fifteen pairs, and fifteen is the
    // honest answer to a request for twenty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    items.push({ prompt: drawn.prompt, answer: drawn.answer, ...extras });
    misses = 0;
  }
  return {
    items,
    marks: plane
      ? points.map((point) => markAt(plane, point.x, point.y, point.label))
      : [],
  };
}

function drawOne(
  config: PreAlgebraConfig,
  points: Marked[],
  rand: () => number,
): Drawn | null {
  switch (config.style) {
    case "equation":
      return drawEquation(config, rand);
    case "inequality":
      return drawInequality(config, rand);
    case "slope":
      return drawSlope(config, rand);
    case "graph":
      return drawPair(points, rand);
    default:
      return rand() < 0.5
        ? drawEvaluate(config, rand)
        : drawSimplify(config, rand);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

/** "Two-step equations" — the phrase a parent says, and the one they search. */
function titleOf(config: PreAlgebraConfig): string {
  const steps = Math.floor(config.steps ?? 1) === 2 ? "Two-step" : "One-step";
  switch (config.style) {
    case "equation":
      return `${steps} equations`;
    case "inequality":
      return `${steps} inequalities`;
    case "slope":
      return "Slope from two points";
    case "graph":
      return "Slope from a graph";
    default:
      return "Expressions";
  }
}

const INSTRUCTION: Record<AlgebraStyle, string> = {
  expression: "Work out each expression.",
  equation: `Solve each equation. Write the value of ${X}.`,
  inequality: `Solve each inequality. Write it as ${X} and a sign.`,
  slope: "Work out the slope of the line through each pair of points.",
  graph: "Read each pair of points off the graph and write the slope.",
};

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: PreAlgebraConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ??
      INSTRUCTION[config.style] ??
      INSTRUCTION.expression,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * The title says which lesson it is; what it leaves off is whether there are
 * minus signs on it, which is the difference between this term's sheet and last
 * term's — and, on a graph, how much of the plane a child has to read.
 */
export function describePreAlgebra(config: PreAlgebraConfig): string {
  const title = titleOf(config);
  // A graph sheet takes neither of the other two: how far the plane runs is
  // what decides how hard it is, and `negatives` has nothing to say — a line
  // drawn downhill has a negative slope in any quadrant there is.
  if (config.style === "graph") {
    return `${title} — ${
      Math.floor(config.quadrants ?? 4) === 4
        ? "four quadrants"
        : "the first quadrant"
    }`;
  }
  return [
    title,
    signed(config) ? "positive and negative" : "positive numbers only",
    `numbers to ${bounds(config.range).max}`,
  ].join(" — ");
}

export function buildPreAlgebraSheet(
  config: PreAlgebraConfig,
  seed: number,
): Sheet {
  const { items, marks } = preAlgebraProblems(config, seed);
  const { columns, plane } = preAlgebraLayout(config);
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
    blocks: [
      // The plane, then the questions about it — one graph for the sheet rather
      // than one beside every problem, because a child reads the scale once and
      // then uses it a dozen times.
      ...(plane
        ? [{ kind: "grid" as const, grid: { ...plane.grid, marks } }]
        : []),
      { kind: "problems", columns, items },
    ],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const PREALGEBRA_SHEET: SheetSpec<PreAlgebraConfig> = {
  id: "prealgebra",
  label: "Pre-algebra",
  world: SHEET_WORLD,
  build: buildPreAlgebraSheet,
  // The whole of the answer-key mechanism: every equation was built around the
  // number that solves it, so a key prints what is already there rather than
  // solving anything a second time.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePreAlgebra,
};
