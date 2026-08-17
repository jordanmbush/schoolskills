import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP, answerLine } from "../layout";
import type {
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  StatisticsConfig,
} from "../types";

import { STATISTICS_SHEET, modeOf, statisticsLayout } from "./statistics";

/**
 * Mean, median, mode and range.
 *
 * **Nothing here checks the generator against the generator.** Every set is read
 * off the printed line and summarised again by a path the family does not have:
 *
 * - the **mean** is checked by multiplying back — the answer added to itself
 *   once per number in the set has to make the total — so there is no division
 *   anywhere in this file;
 * - the **median** is found with an insertion sort written out here, and
 *   compared *in halves*: a set of four whose middles are 9 and 10 has a median
 *   of nineteen halves, and the printed "9.5" has to be exactly that. A generator
 *   that rounded, floored or averaged in floating point fails;
 * - the **mode** is tallied, and the tally has to have a single winner. A set
 *   with two values tied has two right answers, and this is where a key naming
 *   one of them is caught;
 * - the **range** is the largest less the smallest, found by looking at every
 *   number rather than by trusting the order.
 */

/* ── Summarising a set, the long way round ───────────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function multiply(a: number, b: number): number {
  const [each, times] = a > b ? [a, b] : [b, a];
  let total = 0;
  for (let step = 0; step < times; step += 1) total += each;
  return total;
}

/** Smallest first, by insertion — nothing here calls the family's own sort. */
function ordered(values: number[]): number[] {
  const out: number[] = [];
  for (const value of values) {
    let at = 0;
    while (at < out.length && out[at] <= value) at += 1;
    out.splice(at, 0, value);
  }
  return out;
}

/** How many of each number there are. */
function tally(values: number[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

/**
 * The median in halves, so that a set of an even size can be checked exactly.
 *
 * Twice the median, which is a whole number whether the middle lands on one of
 * the numbers or between two of them — and which is what makes ".5" a fact to
 * assert rather than a rounding to hope about.
 */
function halves(values: number[]): number {
  const order = ordered(values);
  const middle = Math.floor(order.length / 2);
  return order.length % 2 === 1
    ? order[middle] + order[middle]
    : order[middle - 1] + order[middle];
}

/** And the same reading of what was printed: "9" is 18 halves, "9.5" is 19. */
function halvesOf(text: string): number {
  const half = /^(\d+)\.5$/.exec(text);
  if (half) return Number(half[1]) + Number(half[1]) + 1;
  if (!/^\d+$/.test(text)) throw new Error(`not a median: "${text}"`);
  return Number(text) + Number(text);
}

/** The numbers of a set, as they are printed. */
const setOn = (problem: Problem): number[] =>
  problem.prompt.split(", ").map((written) => {
    if (!/^\d+$/.test(written)) throw new Error(`not a number: "${written}"`);
    return Number(written);
  });

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<StatisticsConfig> = {}): StatisticsConfig => ({
  kind: "statistics",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "mean",
  size: 5,
  range: { min: 1, max: 20 },
  count: 8,
  columns: 2,
  ...over,
});

/**
 * Every shape the family can print, which is every acceptance criterion of the
 * story — including the two that are usually got wrong: a set of an even size,
 * whose median falls between two numbers, and a mode that has to be the only
 * one.
 */
const EVERY_SHAPE: Array<Partial<StatisticsConfig>> = [
  {},
  { size: 6 },
  { style: "median" },
  { style: "median", size: 4 },
  { style: "median", size: 8 },
  { style: "mode" },
  { style: "mode", size: 7 },
  { style: "range" },
  { style: "range", size: 4, range: { min: 0, max: 9 } },
  { style: "all" },
  { style: "all", size: 6 },
  { size: 4, range: { min: 1, max: 9 } },
  { workspace: true, count: 6 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a statistics sheet has, narrowed for the reader. */
function problemsOf(over: Partial<StatisticsConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

const everyProblem = function* (
  shapes: Array<Partial<StatisticsConfig>> = EVERY_SHAPE,
): Generator<[Partial<StatisticsConfig>, Problem]> {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const problems = problemsOf(shape, seed);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) yield [shape, problem];
    }
  }
};

const shapesOf = (style: string): Array<Partial<StatisticsConfig>> =>
  EVERY_SHAPE.filter((one) => (one.style ?? "mean") === style);

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the statistics family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("statistics")).toBe(STATISTICS_SHEET);
    expect(sheetSpec("statistics").label).toBe("Mean, median and mode");
  });

  it("names the sheet in the words a parent chose it by", () => {
    expect(describeSheet(config())).toBe(
      "Finding the mean — sets of 5 — numbers to 20",
    );
    expect(describeSheet(config({ style: "all", size: 6 }))).toBe(
      "Mean, median, mode and range — sets of 6 — numbers to 20",
    );
  });

  it("tells a child which of the four a sheet is about", () => {
    expect(buildSheet(config({ style: "mode" }), 1).header.instructions).toBe(
      "Write the mode of each set of numbers.",
    );
    expect(buildSheet(config({ style: "all" }), 1).header.instructions).toBe(
      "Write the mean, median, mode and range of each set.",
    );
  });

  it("marks the sheet out of what is on it", () => {
    const sheet = buildSheet(config({ count: 5 }), 3);
    const block = sheet.blocks[0];
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("means by multiplying back, so nothing is ever divided", () => {
    for (const [shape, problem] of everyProblem(shapesOf("mean"))) {
      const values = setOn(problem);
      const total = values.reduce((sum, value) => sum + value, 0);
      expect(
        multiply(Number(problem.answer), values.length),
        `${problem.prompt} ${JSON.stringify(shape)}`,
      ).toBe(total);
    }
  });

  it("medians in halves, so an even-sized set lands where it should", () => {
    for (const [shape, problem] of everyProblem(shapesOf("median"))) {
      expect(
        halvesOf(problem.answer),
        `${problem.prompt} → ${problem.answer} ${JSON.stringify(shape)}`,
      ).toBe(halves(setOn(problem)));
    }
  });

  it("names a mode only where there is exactly one", () => {
    for (const [shape, problem] of everyProblem(shapesOf("mode"))) {
      expectMode(setOn(problem), problem.answer, JSON.stringify(shape));
    }
  });

  it("names no mode at all where two values tie", () => {
    // The one rule here a set can fail, and the draw builds sets that pass it on
    // purpose — so it is checked directly, with a tie handed to it. A family
    // that lost this would print a question with two right answers on it.
    expect(modeOf([3, 3, 7, 7, 9])).toBeNull();
    expect(modeOf([1, 2, 3, 4])).toBeNull();
    expect(modeOf([4, 4, 9, 2])).toBe(4);
    expect(modeOf([5, 5, 5, 8, 8])).toBe(5);
  });

  it("ranges from the smallest number to the largest", () => {
    for (const [shape, problem] of everyProblem(shapesOf("range"))) {
      const order = ordered(setOn(problem));
      expect(
        Number(problem.answer),
        `${problem.prompt} ${JSON.stringify(shape)}`,
      ).toBe(order[order.length - 1] - order[0]);
    }
  });

  it("answers all four from one set, each on its own line", () => {
    for (const [shape, problem] of everyProblem(shapesOf("all"))) {
      const said = `${problem.prompt} ${JSON.stringify(shape)}`;
      const values = setOn(problem);
      const lines = problem.answers ?? [];
      expect(lines.length, said).toBe(4);
      // The one-line answer is the same four joined up, so anything that wants
      // the answer as a string cannot get a different one.
      expect(problem.answer, said).toBe(lines.join(", "));

      const written = Object.fromEntries(
        lines.map((line) => line.split(" = ") as [string, string]),
      );
      const total = values.reduce((sum, value) => sum + value, 0);
      expect(multiply(Number(written.mean), values.length), said).toBe(total);
      expect(halvesOf(written.median), said).toBe(halves(values));
      expectMode(values, written.mode, said);
      const order = ordered(values);
      expect(Number(written.range), said).toBe(
        order[order.length - 1] - order[0],
      );
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
 * That a printed mode is *the* mode: it appears more often than anything else,
 * and nothing else appears as often.
 *
 * The second half is the one that matters. A set with two values tied has two
 * right answers and belongs on no sheet at all, and a generator that named the
 * first of them would pass a check that only asked whether the answer was
 * common.
 */
function expectMode(values: number[], written: string, said: string): void {
  const counts = tally(values);
  const mode = Number(written);
  const most = counts.get(mode) ?? 0;
  expect(most, `${values.join(", ")} → ${written} ${said}`).toBeGreaterThan(1);
  for (const [value, count] of counts) {
    if (value === mode) continue;
    expect(count, `${values.join(", ")} ties on ${value} — ${said}`) //
      .toBeLessThan(most);
  }
}

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("draws every number inside the range a parent asked for", () => {
    for (const range of [
      { min: 1, max: 9 },
      { min: 0, max: 20 },
      { min: 5, max: 50 },
    ]) {
      for (const style of ["mean", "median", "mode", "range", "all"] as const) {
        for (const problem of problemsOf({ range, style, count: 6 }, 5)) {
          for (const value of setOn(problem)) {
            expect(value, problem.prompt).toBeGreaterThanOrEqual(range.min);
            expect(value, problem.prompt).toBeLessThanOrEqual(range.max);
          }
        }
      }
    }
  });

  it("puts as many numbers in a set as were asked for", () => {
    for (const size of [3, 4, 5, 6, 7, 9]) {
      for (const problem of problemsOf({ size, count: 5 }, 2)) {
        expect(setOn(problem).length, problem.prompt).toBe(size);
      }
    }
  });

  it("lands a median between two numbers when the set has an even size", () => {
    // The half is the whole reason an even-sized set is a different question,
    // so a family that never produced one would have quietly stopped asking it.
    const answers = SEEDS.flatMap((seed) =>
      problemsOf({ style: "median", size: 4, count: 8 }, seed).map(
        (problem) => problem.answer,
      ),
    );
    expect(answers.some((answer) => answer.endsWith(".5"))).toBe(true);
    expect(answers.some((answer) => !answer.endsWith(".5"))).toBe(true);
  });

  it("never prints a range of nothing", () => {
    // "The range of 7, 7, 7" is a question about nothing.
    for (const [, problem] of everyProblem(shapesOf("range"))) {
      expect(Number(problem.answer), problem.prompt).toBeGreaterThan(0);
    }
  });

  it("rules four lines for four answers, and one blank for one", () => {
    // A problem has exactly one place to write the answer: four ruled lines, or
    // a slot, and never both.
    for (const [shape, problem] of everyProblem()) {
      if (shape.style === "all") {
        expect(problem.answers?.length, problem.prompt).toBe(4);
        expect(problem.workspace, problem.prompt).toBe(4 * answerLine(12));
      } else {
        expect(problem.answers, problem.prompt).toBeUndefined();
      }
      expect(problem.prompt.split("_").length - 1).toBe(0);
    }
  });

  it("asks the same set twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const asked = problemsOf(shape, seed).map((problem) =>
          ordered(setOn(problem)).join(":"),
        );
        // Folded on the set sorted, because the same numbers in another order
        // are the same question and have all four of the same answers.
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
    expect(problemsOf({ count: 3 }, 7).map(said)).toEqual(GOLDEN.mean);
    expect(
      problemsOf({ style: "all", size: 6, count: 2 }, 7).map(said),
    ).toEqual(GOLDEN.all);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    for (const shape of EVERY_SHAPE) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 5 }, 100 + offset).map(
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
            const { box, columns, row } = statisticsLayout(config(over));
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

  it("reserves the four answer lines rather than adding to them", () => {
    // The lines a child writes on are the answer place, not paper under it —
    // and a row taller than the layout declared is the last problem of the page
    // printed on a second sheet.
    for (const fontPt of [10, 12, 18]) {
      const four = statisticsLayout(config({ style: "all", fontPt }));
      const one = statisticsLayout(config({ style: "mean", fontPt }));
      expect(four.row - one.row).toBe(4 * answerLine(fontPt));
    }
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 6 }, 1).length).toBe(6);
    for (const columns of [1, 2]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // One column when all four are asked at once: the answers are sentences
    // rather than numbers, and they go underneath.
    const wide = buildSheet(config({ style: "all", columns: 4 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(1);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  mean: [
    ["7, 8, 3, 3, 19", "8"],
    ["14, 19, 11, 17, 14", "15"],
    ["17, 13, 17, 3, 20", "14"],
  ],
  all: [
    ["11, 4, 18, 3, 18, 6", "mean = 10, median = 8.5, mode = 18, range = 15"],
    ["9, 16, 6, 16, 17, 2", "mean = 11, median = 12.5, mode = 16, range = 15"],
  ],
};
