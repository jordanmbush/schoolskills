import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { BLOCK_GAP, PROBLEM_GAP } from "../layout";
import type {
  GridMark,
  MarginSize,
  Paper,
  PaperSize,
  PreAlgebraConfig,
  Problem,
} from "../types";

import { PREALGEBRA_SHEET, preAlgebraLayout } from "./prealgebra";

/**
 * Pre-algebra, held to the bar the maths families set — and to one more, because
 * three of these five styles have an answer that can be nearly right.
 *
 * **Nothing here checks the generator against the generator.** Every assertion
 * starts from the characters that were printed:
 *
 * - **an equation is checked by substitution**, which is the only check on a
 *   solution worth having: the answer goes back into the printed left-hand side
 *   and has to come out as the printed right-hand one. The family never
 *   substituted anything — it built the equation around the answer — so this is
 *   a path it does not have;
 * - **an inequality is checked by trying numbers.** Forty candidates either side
 *   of the boundary are put into the printed inequality and into the printed
 *   answer, and the two have to agree about every one of them. A sign that
 *   should have flipped and didn't disagrees on all forty;
 * - **a slope is cross-multiplied** against the two points it was read from, and
 *   proved to be in lowest terms by a factor search rather than by the greatest
 *   common divisor the family reduced with;
 * - **a graph's points are recovered from the marks on the grid**, so the dots a
 *   child reads and the key they are marked against are tied together on the
 *   page rather than in the generator.
 */

/* ── Reading algebra back off the page ───────────────────────────────────── */

/** A number as this family writes one: the proper minus sign, U+2212. */
const num = (text: string): number => Number(text.replace(/−/g, "-"));

/**
 * A linear expression, as `(p·x + q) / r` with `r` positive.
 *
 * Parsed from the printed text and from nothing else — the family's own
 * description of the same side is never consulted, which is what makes the
 * substitution below a check rather than a restatement.
 */
type Side = { p: number; q: number; r: number };

function sideOf(text: string): Side {
  const bracket = /^(−?\d+)\(x( ([+−]) (\d+))?\)$/.exec(text);
  if (bracket) {
    const outside = num(bracket[1]);
    const inside = constantOf(bracket[3], bracket[4]);
    return { p: outside, q: outside * inside, r: 1 };
  }
  const over = /^x\/(\d+)( ([+−]) (\d+))?$/.exec(text);
  if (over) {
    const divisor = Number(over[1]);
    return { p: 1, q: divisor * constantOf(over[3], over[4]), r: divisor };
  }
  const times = /^(−?\d*)x( ([+−]) (\d+))?$/.exec(text);
  if (times) {
    return {
      p: coefficientOf(times[1]),
      q: constantOf(times[3], times[4]),
      r: 1,
    };
  }
  throw new Error(`not a linear expression: "${text}"`);
}

/** "" is one and "−" is minus one — nobody writes `1x`. */
const coefficientOf = (written: string): number =>
  written === "" ? 1 : written === "−" ? -1 : num(written);

/** The constant on the end, with the sign that the operator in front carries. */
const constantOf = (
  sign: string | undefined,
  size: string | undefined,
): number => (size === undefined ? 0 : (sign === "−" ? -1 : 1) * Number(size));

/** What a side is worth at a value, as a fraction so nothing is rounded. */
const worth = (side: Side, x: number): { n: number; d: number } => ({
  n: side.p * x + side.q,
  d: side.r,
});

/**
 * Every term of a collected expression: how many `x` and how many units.
 *
 * The first term carries its own sign against it — "−10x" — and every later one
 * has an operator with a space on each side, which is exactly how the printed
 * line distinguishes them.
 */
function collected(text: string): { x: number; units: number } {
  const parts = text
    .replace(/ =$/, "")
    .trim()
    .split(/ ([+−]) /);
  let x = 0;
  let units = 0;
  for (let at = 0; at < parts.length; at += 2) {
    // The operator in front of a term is the element before it, which is what
    // splitting on a capture leaves behind. The first term has none, and wears
    // its own sign instead.
    const sign = at === 0 ? 1 : parts[at - 1] === "−" ? -1 : 1;
    const piece = parts[at];
    const letter = /^(−?\d*)x$/.exec(piece);
    if (letter) x += sign * coefficientOf(letter[1]);
    else if (/^−?\d+$/.test(piece)) units += sign * num(piece);
    else throw new Error(`what is "${piece}" in "${text}"?`);
  }
  return { x, units };
}

/** The greatest common divisor, found by trying every factor there is. */
function commonFactor(a: number, b: number): number {
  let most = 1;
  for (let by = 1; by <= Math.min(Math.abs(a), Math.abs(b)); by += 1) {
    if (a % by === 0 && b % by === 0) most = by;
  }
  return most;
}

/** A slope as it is written: "3", "−1/2", "0". */
function slopeOf(text: string): { n: number; d: number } {
  const over = /^(−?\d+)\/(−?\d+)$/.exec(text);
  if (over) return { n: num(over[1]), d: num(over[2]) };
  if (/^−?\d+$/.test(text)) return { n: num(text), d: 1 };
  throw new Error(`not a slope: "${text}"`);
}

/**
 * That a printed slope really is the slope of the line through two points.
 *
 * Cross-multiplied, so there is no division anywhere in the check, and held to
 * lowest terms with a positive denominator: 6/4, 3/−2 and −3/2 are one number
 * written three ways, and a child who wrote either of the first two would be
 * marked wrong by the same teacher who accepted the key.
 */
function expectSlope(
  written: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  said: string,
): void {
  const { n, d } = slopeOf(written);
  expect(d, said).toBeGreaterThan(0);
  expect(
    commonFactor(n, d),
    `${written} is not in lowest terms — ${said}`,
  ).toBe(1);
  // Compared rather than asserted equal, because a slope of nought over a line
  // drawn right to left is minus nought, which `toBe` and a child both call
  // zero and only one of them means it.
  expect(n * (to.x - from.x) === d * (to.y - from.y), said).toBe(true);
}

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<PreAlgebraConfig> = {}): PreAlgebraConfig => ({
  kind: "prealgebra",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "expression",
  range: { min: 1, max: 12 },
  count: 10,
  columns: 2,
  ...over,
});

/**
 * Every shape the family can print: expressions, one- and two-step equations,
 * inequalities, slope from a pair of points and slope from a graph.
 */
const EVERY_SHAPE: Array<Partial<PreAlgebraConfig>> = [
  {},
  { negatives: false },
  { style: "equation" },
  { style: "equation", steps: 2 },
  { style: "equation", steps: 2, negatives: false },
  { style: "equation", range: { min: 2, max: 30 } },
  { style: "inequality" },
  { style: "inequality", steps: 2 },
  { style: "inequality", steps: 2, negatives: false },
  { style: "slope" },
  { style: "slope", negatives: false },
  { style: "graph" },
  { style: "graph", quadrants: 1 },
  { workspace: true, count: 6 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The problems block, which is the last one whatever else is on the sheet. */
function problemsOf(over: Partial<PreAlgebraConfig>, seed: number): Problem[] {
  const blocks = buildSheet(config(over), seed).blocks;
  const block = blocks[blocks.length - 1];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/** And the plane above them, on the one style that has one. */
function marksOf(over: Partial<PreAlgebraConfig>, seed: number): GridMark[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "grid")
    throw new Error(`expected a grid, got ${block.kind}`);
  return block.grid.marks ?? [];
}

const everyProblem = function* (
  shapes: Array<Partial<PreAlgebraConfig>> = EVERY_SHAPE,
): Generator<[Partial<PreAlgebraConfig>, Problem]> {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const problems = problemsOf(shape, seed);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) yield [shape, problem];
    }
  }
};

const shapesOf = (style: string): Array<Partial<PreAlgebraConfig>> =>
  EVERY_SHAPE.filter((one) => (one.style ?? "expression") === style);

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the pre-algebra family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("prealgebra")).toBe(PREALGEBRA_SHEET);
    expect(sheetSpec("prealgebra").label).toBe("Pre-algebra");
  });

  it("names the sheet in the words a parent chose it by", () => {
    expect(describeSheet(config({ style: "equation", steps: 2 }))).toBe(
      "Two-step equations — positive and negative — numbers to 12",
    );
    expect(
      describeSheet(config({ style: "inequality", negatives: false })),
    ).toBe("One-step inequalities — positive numbers only — numbers to 12");
    expect(describeSheet(config({ style: "graph", quadrants: 1 }))).toBe(
      "Slope from a graph — the first quadrant",
    );
    // A config arrives from a bookmark or from a sheet saved months ago, so the
    // numbers in it are not to be trusted: five steps prints two-step problems,
    // and the name has to be the name of what came out.
    expect(describeSheet(config({ style: "equation", steps: 5 }))).toBe(
      "Two-step equations — positive and negative — numbers to 12",
    );
    expect(describeSheet(config({ style: "inequality", steps: 0 }))).toBe(
      "One-step inequalities — positive and negative — numbers to 12",
    );
  });

  it("tells a child what to write, which is not a number on three of these", () => {
    expect(
      buildSheet(config({ style: "equation" }), 1).header.instructions,
    ).toBe("Solve each equation. Write the value of x.");
    expect(
      buildSheet(config({ style: "inequality" }), 1).header.instructions,
    ).toBe("Solve each inequality. Write it as x and a sign.");
    expect(buildSheet(config({ style: "graph" }), 1).header.instructions).toBe(
      "Read each pair of points off the graph and write the slope.",
    );
  });

  it("marks the sheet out of what is on it", () => {
    const sheet = buildSheet(config({ count: 7 }), 3);
    const block = sheet.blocks[sheet.blocks.length - 1];
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("solves every equation, checked by putting the answer back in", () => {
    for (const [shape, problem] of everyProblem(shapesOf("equation"))) {
      const said = `${problem.prompt} → ${problem.answer} ${JSON.stringify(shape)}`;
      const [left, right] = problem.prompt.split(" = ");
      const answer = /^x = (−?\d+)$/.exec(problem.answer);
      expect(answer, said).not.toBeNull();
      const value = worth(sideOf(left), num(answer?.[1] ?? "0"));
      // Cross-multiplied rather than divided out: `x/4 + 2 = 5` is checked as
      // whole numbers, and there is no division in this file at all.
      expect(value.n, said).toBe(num(right) * value.d);
    }
  });

  it("turns an inequality round when it has to, checked by trying numbers", () => {
    for (const [shape, problem] of everyProblem(shapesOf("inequality"))) {
      const said = `${problem.prompt} → ${problem.answer} ${JSON.stringify(shape)}`;
      const asked = /^(.+) ([<>≤≥]) (−?\d+)$/.exec(problem.prompt);
      const told = /^x ([<>≤≥]) (−?\d+)$/.exec(problem.answer);
      expect(asked, said).not.toBeNull();
      expect(told, said).not.toBeNull();
      if (!asked || !told) continue;

      const side = sideOf(asked[1]);
      const against = num(asked[3]);
      const boundary = num(told[2]);
      for (let x = boundary - 20; x <= boundary + 20; x += 1) {
        const value = worth(side, x);
        // `r` is positive, so multiplying both sides by it leaves the sense of
        // the comparison alone — which is the whole of why `Side` carries a
        // positive denominator.
        expect(
          holds(value.n, asked[2], against * value.d),
          `${said} at x = ${x}`,
        ) //
          .toBe(holds(x, told[1], boundary));
      }
    }
  });

  it("works out every expression again from the letters on the page", () => {
    for (const [shape, problem] of everyProblem(shapesOf("expression"))) {
      const said = `${problem.prompt} → ${problem.answer} ${JSON.stringify(shape)}`;
      const two = /^(−?\d*)x ([+−]) (\d+)y when x = (−?\d+), y = (−?\d+)$/.exec(
        problem.prompt,
      );
      if (two) {
        // Two letters, so each term is multiplied by its own value and the
        // operator between them says what happens to the second.
        const first = coefficientOf(two[1]) * num(two[4]);
        const second = Number(two[3]) * num(two[5]);
        expect(num(problem.answer), said).toBe(
          two[2] === "−" ? first - second : first + second,
        );
        continue;
      }
      const one = /^(.+) when x = (−?\d+)$/.exec(problem.prompt);
      if (one) {
        const value = worth(sideOf(one[1]), num(one[2]));
        expect(num(problem.answer) * value.d, said).toBe(value.n);
        continue;
      }
      // Nothing to put in: the question is the tidying up, so both sides are
      // collected the same way and have to come out the same.
      expect(collected(problem.answer), said).toEqual(
        collected(problem.prompt),
      );
    }
  });

  it("reduces every slope, and never writes one over a negative", () => {
    for (const [shape, problem] of everyProblem(shapesOf("slope"))) {
      const points = [...problem.prompt.matchAll(/\((−?\d+), (−?\d+)\)/g)].map(
        (found) => ({ x: num(found[1]), y: num(found[2]) }),
      );
      expect(points.length, problem.prompt).toBe(2);
      expectSlope(
        problem.answer,
        points[0],
        points[1],
        `${problem.prompt} ${JSON.stringify(shape)}`,
      );
    }
  });

  it("reads a graph's slopes off the dots that are printed on it", () => {
    for (const shape of shapesOf("graph")) {
      for (const seed of SEEDS) {
        const points = plotted(marksOf(shape, seed), shape);
        for (const problem of problemsOf(shape, seed)) {
          const named = /^([A-Z]) and ([A-Z])$/.exec(problem.prompt);
          expect(named, problem.prompt).not.toBeNull();
          const [from, to] = [
            points[named?.[1] ?? ""],
            points[named?.[2] ?? ""],
          ];
          expect(from, problem.prompt).toBeDefined();
          expect(to, problem.prompt).toBeDefined();
          expectSlope(problem.answer, from, to, problem.prompt);
        }
      }
    }
  });

  it("prints the answers only when the sheet is a key", () => {
    const sheet = buildSheet(config(), 5);
    const key = answerKey(config(), 5);
    expect(sheet.answers).toBe(false);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
  });

  it("is the same sheet keyed, never a second generation", () => {
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });
});

/**
 * The two things that can have been done to the letter: multiplied by
 * something, and had something added to it.
 *
 * Which is what "one step" and "two steps" mean at the top of the page — one of
 * these, or both — read off the printed side rather than taken from the config.
 */
function movesOf(prompt: string): { scaled: boolean; shifted: boolean } {
  const side = sideOf(prompt.split(/ [=<>≤≥] /)[0]);
  return { scaled: side.p !== 1 || side.r !== 1, shifted: side.q !== 0 };
}

/** Whether a comparison is true, in the four signs a sheet may print. */
function holds(left: number, relation: string, right: number): boolean {
  if (relation === "<") return left < right;
  if (relation === ">") return left > right;
  if (relation === "≤") return left <= right;
  if (relation === "≥") return left >= right;
  throw new Error(`what sign is "${relation}"?`);
}

/**
 * Where each lettered point sits, recovered from the marks on the grid.
 *
 * Counted back through the origin, the same way a child counts squares out from
 * where the two heavy rules cross — so what the suite marks against is the dot
 * on the paper rather than the number the generator drew.
 */
function plotted(
  marks: GridMark[],
  shape: Partial<PreAlgebraConfig>,
): Record<string, { x: number; y: number }> {
  const quadrants = Math.floor(shape.quadrants ?? 4);
  // One square of margin on a quarter plane, and a whole span on a full one:
  // the numerals live in that margin, and the origin sits past it.
  const span = quadrants === 4 ? 8 : 10;
  const origin = { column: quadrants === 4 ? span : 1, row: span };
  const out: Record<string, { x: number; y: number }> = {};
  for (const mark of marks) {
    out[mark.label] = {
      x: mark.column - origin.column,
      y: origin.row - mark.row,
    };
  }
  return out;
}

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never prints a coefficient of one, which nobody writes", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt, problem.prompt).not.toMatch(/(^|[^\d])1x/);
      expect(problem.answer, problem.answer).not.toMatch(/(^|[^\d])1x/);
    }
  });

  it("never divides by nothing, and never asks for a vertical line", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt, problem.prompt).not.toMatch(/x\/0/);
      // A vertical line's slope is not a number, so no answer may say it is.
      expect(problem.answer, problem.answer).not.toMatch(/\/0$/);
    }
  });

  it("puts no minus sign at all on a sheet that turned them off", () => {
    for (const [, problem] of everyProblem(
      EVERY_SHAPE.filter((one) => one.negatives === false),
    )) {
      const sentence = `${problem.prompt} ${problem.answer}`;
      expect(sentence, sentence).not.toMatch(/−\d/);
      expect(sentence, sentence).not.toMatch(/−x/);
    }
  });

  it("asks about one step or two, and says which at the top of the page", () => {
    // A two-step sheet whose problems come undone in one move is a sheet set at
    // a level nobody chose — and the title says which, so it is also a lie.
    for (const style of ["equation", "inequality"] as const) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(
          { style, steps: 1, count: 10 },
          seed,
        )) {
          // One step: the letter is either multiplied by something or has
          // something added to it, and never both.
          const { scaled, shifted } = movesOf(problem.prompt);
          expect(scaled !== shifted, problem.prompt).toBe(true);
        }
        for (const problem of problemsOf(
          { style, steps: 2, count: 10 },
          seed,
        )) {
          // Two steps: something done to the letter, and something done after.
          const { scaled, shifted } = movesOf(problem.prompt);
          expect(scaled && shifted, problem.prompt).toBe(true);
        }
      }
      // And a number nobody chose — a saved config, or a bookmarked URL — is
      // drawn as the nearest one that exists and *named* as that one. A page of
      // two-step problems under "One-step equations" is the same lie the other
      // way round.
      const wild = { style, steps: 5, count: 10 };
      expect(buildSheet(config(wild), 1).header.title, style).toBe(
        `Two-step ${style === "equation" ? "equations" : "inequalities"}`,
      );
      for (const problem of problemsOf(wild, 1)) {
        const { scaled, shifted } = movesOf(problem.prompt);
        expect(scaled && shifted, problem.prompt).toBe(true);
      }
    }
  });

  it("marks every point on a graph inside the plane, each at its own x", () => {
    // Two points at the same x make a vertical line, whose slope is not a
    // number a child can write in a blank.
    for (const shape of shapesOf("graph")) {
      for (const seed of SEEDS) {
        const points = Object.values(plotted(marksOf(shape, seed), shape));
        const span = Math.floor(shape.quadrants ?? 4) === 4 ? 8 : 10;
        const low = Math.floor(shape.quadrants ?? 4) === 4 ? -span : 1;
        expect(new Set(points.map((point) => point.x)).size).toBe(
          points.length,
        );
        for (const point of points) {
          for (const at of [point.x, point.y]) {
            expect(at, JSON.stringify(point)).toBeGreaterThanOrEqual(low);
            expect(at, JSON.stringify(point)).toBeLessThanOrEqual(span);
            // Never on an axis: a dot on one of the two heavy rules is a dot a
            // child has to look twice at.
            expect(at, JSON.stringify(point)).not.toBe(0);
          }
        }
      }
    }
  });

  it("gives every problem exactly one place to write the answer", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt.split("_").length - 1).toBe(0);
      expect(problem.answers).toBeUndefined();
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const asked = problemsOf(shape, seed).map((problem) => problem.prompt);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(asked.length);
      }
    }
  });
});

/* ── Determinism, and the three features it buys (§7) ──────────────────── */

describe("(config, seed)", () => {
  it("builds the same sheet twice", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const once = buildSheet(config(shape), seed);
        const twice = buildSheet(config(shape), seed);
        expect(once).not.toBe(twice);
        expect(once).toEqual(twice);
      }
    }
  });

  it("draws the same problems for a seed as it did the day it shipped", () => {
    expect(problemsOf({ style: "equation", steps: 2, count: 3 }, 7).map(said)) //
      .toEqual(GOLDEN.equation);
    expect(
      problemsOf({ style: "inequality", steps: 2, count: 3 }, 7).map(said),
    ).toEqual(GOLDEN.inequality);
    expect(problemsOf({ style: "slope", count: 3 }, 7).map(said)).toEqual(
      GOLDEN.slope,
    );
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    for (const shape of EVERY_SHAPE) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 6 }, 100 + offset).map(
          (problem) => problem.prompt,
        ),
      );
      for (const [one, other] of [
        [a, b],
        [a, c],
        [b, c],
      ]) {
        expect(one, JSON.stringify(shape)).not.toEqual(other);
        const shared = one.filter((asked) => other.includes(asked)).length;
        expect(shared, JSON.stringify(shape)).toBeLessThan(
          (one.length * 2) / 3,
        );
      }
    }
  });
});

const said = (problem: Problem): [string, string] => [
  problem.prompt,
  problem.answer,
];

/* ── Capacity (§20) ────────────────────────────────────────────────────── */

describe("how much fits", () => {
  const SIZES: PaperSize[] = ["letter", "a4", "legal"];
  const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

  it("never prints more problems than the paper holds", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row, plane } = preAlgebraLayout(config(over));
            const rows = Math.ceil(problems.length / columns);
            const used =
              rows * row +
              Math.max(0, rows - 1) * PROBLEM_GAP.y +
              (plane ? plane.grid.rows * plane.grid.cell + BLOCK_GAP : 0);
            expect(used, `${size}/${margin}/${fontPt}pt`).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("does not throw the page away either", () => {
    const { box, row, perPage, columns } = preAlgebraLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(12);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ style: "equation", count: 9 }, 1).length).toBe(9);
    for (const columns of [1, 2, 3]) {
      const blocks = buildSheet(
        config({ style: "equation", columns }),
        1,
      ).blocks;
      const block = blocks[blocks.length - 1];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Two columns of expressions, because `2x + 3y when x = 4, y = 2` is most
    // of a line of type before its answer slot.
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(2);
  });
});

/**
 * What three sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — all three are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  equation: [
    ["2x + 9 = −1", "x = −5"],
    ["8x − 4 = 76", "x = 10"],
    ["−6x − 7 = 65", "x = −12"],
  ],
  inequality: [
    ["2x + 9 < −1", "x < −5"],
    ["x/10 + 2 > −5", "x > −70"],
    ["−7x − 12 < 65", "x > −11"],
  ],
  slope: [
    ["(−1, 12) and (−7, −6)", "3"],
    ["(7, −4) and (10, −3)", "1/3"],
    ["(4, 4) and (3, −3)", "7"],
  ],
};
