import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP } from "../layout";
import type {
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  RatioConfig,
} from "../types";

import { RATIO_SHEET, ratioLayout } from "./ratio";

/**
 * Ratio, proportion and unit rate.
 *
 * **Nothing here checks the generator against the generator.** Every number is
 * read off the printed line and put back together by a path the family does not
 * have:
 *
 * - a **simplified ratio** is checked by cross-multiplication — `a : b` reduces
 *   to `c : d` only if `a·d = b·c` — and then held to lowest terms by searching
 *   for a common factor, rather than by the greatest common divisor the family
 *   reduced with. An answer of `4 : 6` where the child wrote `2 : 3` fails
 *   there, and it is the failure that matters: both are true, and only one is
 *   marked right;
 * - a **proportion** is checked the same way, with the answer put back into the
 *   gap it came out of;
 * - a **rate** is checked by multiplying back, in repeated addition, which is
 *   the only honest check on something that was divided.
 */

/* ── Arithmetic, from repeated addition ──────────────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function multiply(a: number, b: number): number {
  const [each, times] = a > b ? [a, b] : [b, a];
  let total = 0;
  for (let step = 0; step < times; step += 1) total += each;
  return total;
}

/** The greatest common divisor, found by trying every factor there is. */
function commonFactor(a: number, b: number): number {
  let most = 1;
  for (let by = 1; by <= Math.min(a, b); by += 1) {
    if (a % by === 0 && b % by === 0) most = by;
  }
  return most;
}

/** The numbers on a line, in the order they are printed. */
const numbersOn = (text: string): number[] =>
  [...text.matchAll(/\d+/g)].map((found) => Number(found[0]));

/** The problem, written out in full with its answer put where the gap is. */
const sentence = (problem: Problem): string =>
  problem.prompt.replace("_", problem.answer);

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<RatioConfig> = {}): RatioConfig => ({
  kind: "ratio",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "simplify",
  range: { min: 1, max: 12 },
  count: 12,
  columns: 3,
  ...over,
});

/** Every shape the family can print: ratio, proportion and unit rate. */
const EVERY_SHAPE: Array<Partial<RatioConfig>> = [
  {},
  { range: { min: 2, max: 20 } },
  { style: "proportion" },
  { style: "proportion", range: { min: 1, max: 9 } },
  { style: "rate" },
  { style: "rate", range: { min: 2, max: 20 } },
  { workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a ratio sheet has, narrowed for the reader. */
function problemsOf(over: Partial<RatioConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

const everyProblem = function* (
  shapes: Array<Partial<RatioConfig>> = EVERY_SHAPE,
): Generator<[Partial<RatioConfig>, Problem]> {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const problems = problemsOf(shape, seed);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) yield [shape, problem];
    }
  }
};

const shapesOf = (style: string): Array<Partial<RatioConfig>> =>
  EVERY_SHAPE.filter((one) => (one.style ?? "simplify") === style);

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the ratio family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("ratio")).toBe(RATIO_SHEET);
    expect(sheetSpec("ratio").label).toBe("Ratio and rate");
  });

  it("names the sheet in the words a parent chose it by", () => {
    expect(describeSheet(config())).toBe("Simplifying ratios — numbers to 12");
    expect(describeSheet(config({ style: "rate" }))).toBe(
      "Unit rate — numbers to 12",
    );
  });

  it("tells a child what to write", () => {
    expect(buildSheet(config(), 1).header.instructions).toBe(
      "Write each ratio in its simplest form.",
    );
    expect(buildSheet(config({ style: "rate" }), 1).header.instructions).toBe(
      "Work out the amount for one.",
    );
  });

  it("marks the sheet out of what is on it", () => {
    const sheet = buildSheet(config({ count: 7 }), 3);
    const block = sheet.blocks[0];
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("simplifies every ratio, cross-multiplied and in lowest terms", () => {
    for (const [shape, problem] of everyProblem(shapesOf("simplify"))) {
      const said = `${problem.prompt} ${problem.answer} ${JSON.stringify(shape)}`;
      const [left, right] = numbersOn(problem.prompt);
      const [small, large] = numbersOn(problem.answer);
      // The same ratio: `left : right` is `small : large` when the two
      // cross-products match, and there is no division in the check.
      expect(multiply(left, large), said).toBe(multiply(right, small));
      expect(commonFactor(small, large), `${said} is not in lowest terms`).toBe(
        1,
      );
    }
  });

  it("fills a proportion's gap with the number that scales", () => {
    for (const [shape, problem] of everyProblem(shapesOf("proportion"))) {
      const said = `${sentence(problem)} ${JSON.stringify(shape)}`;
      const [a, b, c, d] = numbersOn(sentence(problem));
      expect(multiply(a, d), said).toBe(multiply(b, c));
    }
  });

  it("works a rate back out by multiplying it up again", () => {
    for (const [shape, problem] of everyProblem(shapesOf("rate"))) {
      const said = `${sentence(problem)} ${JSON.stringify(shape)}`;
      const [total, many, each] = numbersOn(sentence(problem));
      expect(multiply(each, many), said).toBe(total);
    }
  });

  it("names the same thing on both sides of a rate", () => {
    // "240 words in 4 minutes = 60 miles per minute" is arithmetic with a story
    // stapled to it, and a child who read it would be right to be confused.
    for (const [, problem] of everyProblem(shapesOf("rate"))) {
      const said = /^\d+ (.+) in \d+ (.+) = _ (.+) per (.+)$/.exec(
        problem.prompt,
      );
      expect(said, problem.prompt).not.toBeNull();
      expect(said?.[1], problem.prompt).toBe(said?.[3]);
      // The plural is what several of them are called and the singular is what
      // one is: "minutes" and "minute", never the same word twice.
      expect(said?.[2], problem.prompt).toBe(`${said?.[4]}s`);
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

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never asks a child to simplify something already simple", () => {
    // `7 : 12` is in its simplest form, and asking for it teaches only that
    // the sheet sometimes asks for nothing.
    for (const [, problem] of everyProblem(shapesOf("simplify"))) {
      const [left, right] = numbersOn(problem.prompt);
      expect(commonFactor(left, right), problem.prompt).toBeGreaterThan(1);
    }
  });

  it("never prints a ratio of one to one, or a rate of one", () => {
    for (const [, problem] of everyProblem()) {
      expect(sentence(problem), problem.prompt).not.toMatch(/\b1 : 1\b/);
    }
    for (const [, problem] of everyProblem(shapesOf("rate"))) {
      // One of something is the answer written into the question.
      const [, many] = numbersOn(sentence(problem));
      expect(many, problem.prompt).toBeGreaterThan(1);
    }
  });

  it("gives every problem exactly one place to write the answer", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt.split("_").length - 1).toBeLessThanOrEqual(1);
      expect(problem.answers).toBeUndefined();
    }
  });

  it("puts the gap in all four places on a proportion sheet", () => {
    // A gap that is always in the same corner is a gap a child fills in by
    // pattern rather than by proportion.
    const places = new Set<number>();
    for (const seed of SEEDS) {
      for (const problem of problemsOf(
        { style: "proportion", count: 12 },
        seed,
      )) {
        places.add(problem.prompt.split(" ").indexOf("_"));
      }
    }
    expect(places.size).toBe(4);
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
    expect(problemsOf({ count: 3 }, 7).map(said)).toEqual(GOLDEN.simplify);
    expect(problemsOf({ style: "rate", count: 3 }, 7).map(said)).toEqual(
      GOLDEN.rate,
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
            const { box, columns, row } = ratioLayout(config(over));
            const rows = Math.ceil(problems.length / columns);
            const used = rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y;
            expect(used, `${size}/${margin}/${fontPt}pt`).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("does not throw the page away either", () => {
    const { box, row, perPage, columns } = ratioLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 10 }, 1).length).toBe(10);
    for (const columns of [1, 2, 3]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Two columns of rates, because a rate is a sentence rather than a sum.
    const wide = buildSheet(config({ style: "rate", columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(2);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  simplify: [
    ["45 : 35 =", "9 : 7"],
    ["27 : 12 =", "9 : 4"],
    ["30 : 21 =", "10 : 7"],
  ],
  rate: [
    ["18 words in 9 minutes = _ words per minute", "2"],
    ["35 seats in 5 rows = _ seats per row", "7"],
    ["24 litres in 6 minutes = _ litres per minute", "4"],
  ],
};
