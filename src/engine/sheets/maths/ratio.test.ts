import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { PROBLEM_GAP } from "../layout";
import type {
  Block,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  RatioConfig,
  Sheet,
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

describeSheetFamily("ratio", {
  label: "Ratio and rate",
  spec: RATIO_SHEET,
  config,
  shapes: EVERY_SHAPE,
  seeds: SEEDS,
});

/** Every problem on the sheet, page after page. */
function problemsOf(over: Partial<RatioConfig>, seed: number): Problem[] {
  return pagesOf(buildSheet(config(over), seed)).flatMap((page) => page.items);
}

/**
 * The problems block of each page, in order. A ratio sheet prints one such
 * block a page and nothing else, so anything else on a page is a failure here
 * rather than a page silently skipped.
 */
function pagesOf(sheet: Sheet): Array<Extract<Block, { kind: "problems" }>> {
  const pages: Array<Extract<Block, { kind: "problems" }>> = [];
  let open = false;
  for (const block of sheet.blocks) {
    if (block.kind === "break") {
      expect(open, "a break with no page before it").toBe(true);
      open = false;
      continue;
    }
    if (block.kind !== "problems")
      throw new Error(`expected problems, got ${block.kind}`);
    expect(open, "two problems blocks on one page").toBe(false);
    pages.push(block);
    open = true;
  }
  return pages;
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
    expect(pagesOf(sheet).flatMap((page) => page.items).length).toBe(
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

  it("never prints more problems on a page than the paper holds", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const one = config({
              ...shape,
              paper: paper({ size, margin }),
              fontPt,
              count: 200,
            });
            const sheet = buildSheet(one, 8);
            const { row } = ratioLayout(one);
            const pages = pagesOf(sheet);
            for (const [at, page] of pages.entries()) {
              const where = `${size}/${margin}/${fontPt}pt, page ${at + 1}`;
              const rows = Math.ceil(page.items.length / page.columns);
              const used = rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y;
              expect(used, where).toBeLessThanOrEqual(
                printedBlockBox(sheet).height,
              );
              if (at < pages.length - 1)
                expect(page.items.length, where).toBe(pages[0].items.length);
            }
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
      expect(pagesOf(buildSheet(config({ columns }), 1))[0].columns).toBe(
        columns,
      );
    }
    // Two columns of rates, because a rate is a sentence rather than a sum.
    expect(
      pagesOf(buildSheet(config({ style: "rate", columns: 6 }), 1))[0].columns,
    ).toBe(2);
  });

  it("runs on to another page rather than cutting the count to the paper", () => {
    // Fifty ratios are however many pages fifty ratios take, not one page's
    // worth: a parent who wanted one page prints page one (§4). The numbering
    // carries on, so a child told to do 30 to 40 finds them.
    const asked = config({ count: 50 });
    const sheet = buildSheet(asked, 3);
    const { perPage } = ratioLayout(asked);
    expect(perPage).toBeLessThan(50);
    const pages = pagesOf(sheet);
    expect(pages.length).toBe(Math.ceil(50 / perPage));
    expect(pages.flatMap((page) => page.items).length).toBe(50);
    expect(sheet.header.score?.outOf).toBe(50);
    for (const [at, page] of pages.entries()) {
      expect(page.start, `page ${at + 1}`).toBe(
        at > 0 ? at * perPage + 1 : undefined,
      );
      if (at < pages.length - 1)
        expect(page.items.length, `page ${at + 1}`).toBe(perPage);
    }
    // And the key runs on with it, page for page.
    expect(pagesOf(answerKey(asked, 3)).map((page) => page.items.length)) //
      .toEqual(pages.map((page) => page.items.length));
  });

  it("draws nothing when not even one row fits", () => {
    // No number of pages mends a row taller than the paper (§4).
    const tall = config({ fontPt: 200 });
    expect(ratioLayout(tall).perPage).toBe(0);
    const sheet = buildSheet(tall, 1);
    expect(pagesOf(sheet).map((page) => page.items)).toEqual([[]]);
    expect(sheet.header.score?.outOf).toBe(0);
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
