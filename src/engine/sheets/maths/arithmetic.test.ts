import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { inches } from "../paper";
import type {
  ArithmeticConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { ARITHMETIC_SHEET, GAP, arithmeticLayout } from "./arithmetic";

/**
 * The first generated family, and the one that sets the bar.
 *
 * A sheet of lined paper is right if it measures what it says. A sheet of sums
 * is right only if every answer on the key is right, so the whole of this file
 * is arranged around one rule:
 *
 * **Nothing here checks the generator against the generator.** Every answer is
 * verified from the *printed* problem — the string a child reads — by a path
 * the family does not use: addition by counting, subtraction by its inverse,
 * and carrying by the digit-sum identity. A test that re-ran `a + b` would
 * pass on a family that had `+` wrong, which is the one bug a worksheet site
 * cannot ship.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<ArithmeticConfig> = {}): ArithmeticConfig => ({
  kind: "arithmetic",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  operation: "add",
  style: "standard",
  form: "horizontal",
  range: { min: 1, max: 20 },
  count: 20,
  columns: 2,
  regrouping: "either",
  ...over,
});

/**
 * Every shape the family can print, which is every acceptance criterion of the
 * story: both layouts, both operations and the two together, regrouping on,
 * off and either, missing numbers, fact families, number lines and workspace.
 * The sweeps below run over all of it rather than over the default.
 */
const EVERY_SHAPE: Array<Partial<ArithmeticConfig>> = [
  {},
  { form: "vertical" },
  { operation: "subtract" },
  { operation: "subtract", form: "vertical" },
  { operation: "both" },
  { regrouping: "never" },
  { regrouping: "always" },
  { operation: "subtract", regrouping: "never" },
  { operation: "subtract", regrouping: "always" },
  { style: "missing" },
  { style: "missing", operation: "subtract" },
  { style: "fact-family", count: 8 },
  {
    operation: "both",
    numberLine: true,
    range: { min: 0, max: 10 },
    count: 10,
  },
  { workspace: true, count: 12 },
  { operation: "subtract", negatives: true },
  { range: { min: 10, max: 99 }, regrouping: "always", count: 12 },
  { range: { min: 100, max: 999 }, form: "vertical", count: 9, columns: 3 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block an arithmetic sheet has, narrowed for the reader. */
function problemsOf(over: Partial<ArithmeticConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ──────────────────────────────────
   Everything below works from the printed problem — the prompt, or the stack
   of numbers in column form — and never from the config that produced it. If
   the family printed one thing and computed another, these are what notice. */

/**
 * The problem, written out in full with its answer put where it belongs.
 *
 * Four shapes reduce to one sentence: a sum with a slot on the end, a sum with
 * the gap inside it, a stack of numbers in column form, and a fact family,
 * which is four sentences rather than one.
 */
function sentences(problem: Problem): string[] {
  if (problem.operands) {
    const stack = problem.operands.join(` ${problem.operator} `);
    return [`${stack} = ${problem.answer}`];
  }
  if (problem.prompt.includes("_")) {
    return [problem.prompt.replace("_", problem.answer)];
  }
  if (problem.prompt.trimEnd().endsWith("=")) {
    return [`${problem.prompt} ${problem.answer}`];
  }
  // A fact family: the prompt is three numbers, the answer is the four
  // sentences they make.
  return problem.answer.split(", ");
}

type Statement = { left: number; sign: string; right: number; result: number };

/** A written sentence, taken apart. Rejects anything that isn't one. */
function read(sentence: string): Statement {
  const match = /^(-?\d+) ([+−]) (-?\d+) = (-?\d+)$/.exec(sentence.trim());
  if (!match) throw new Error(`not a number sentence: "${sentence}"`);
  return {
    left: Number(match[1]),
    sign: match[2],
    right: Number(match[3]),
    result: Number(match[4]),
  };
}

/**
 * Addition, by counting — the point of the whole file.
 *
 * `a + b` is what the family computes, so a test that used it would agree with
 * the family however wrong the family was. Counting up one at a time is the
 * other definition of addition, and it is the one a child uses on the number
 * line these sheets print.
 */
function countUp(from: number, by: number): number {
  let total = from;
  for (let step = 0; step < by; step += 1) total += 1;
  return total;
}

/** Whether a written sentence is true, established by counting. */
function holds(sentence: string): boolean {
  const { left, sign, right, result } = read(sentence);
  // Subtraction is checked through its inverse: `a − b = c` is true exactly
  // when counting up from `c` by `b` arrives at `a`.
  return sign === "+"
    ? countUp(left, right) === result
    : countUp(result, right) === left;
}

const digitSum = (value: number): number =>
  Math.abs(value)
    .toString()
    .split("")
    .reduce((total, digit) => total + Number(digit), 0);

/**
 * Whether a sentence regroups — carries, or borrows — established by an
 * identity rather than by the family's own column loop.
 *
 * Adding without carrying preserves digit sums, and every carry costs exactly
 * nine of them: 34 + 25 = 59 keeps 7 + 7 = 14, while 38 + 25 = 63 turns
 * 11 + 7 into 9. So "the digit sums agree" and "no column carried" are the
 * same statement reached from opposite directions. Subtraction is the same
 * fact read backwards: `a − b = c` borrows exactly when `c + b` carries.
 */
function regroups(sentence: string): boolean {
  const { left, sign, right, result } = read(sentence);
  return sign === "+"
    ? digitSum(left) + digitSum(right) !== digitSum(result)
    : digitSum(result) + digitSum(right) !== digitSum(left);
}

/** The two numbers the sum is made of, read off the sentence as printed. */
function operandsOf(sentence: string): [number, number] {
  const { left, right } = read(sentence);
  return [left, right];
}

/** What makes two problems the same problem, worked out from the page. */
function factOf(sentence: string): string {
  const { left, sign, right } = read(sentence);
  return sign === "+"
    ? `+:${Math.min(left, right)}:${Math.max(left, right)}`
    : `−:${left}:${right}`;
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the arithmetic family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("arithmetic")).toBe(ARITHMETIC_SHEET);
    expect(sheetSpec("arithmetic").label).toBe("Addition and subtraction");
  });

  it("names what it prints, in the terms a parent chose it by", () => {
    expect(describeSheet(config())).toBe("Addition to 20");
    expect(describeSheet(config({ form: "vertical" }))).toBe(
      "Addition to 20 — in columns",
    );
    expect(
      describeSheet(
        config({
          operation: "subtract",
          regrouping: "never",
          form: "vertical",
        }),
      ),
    ).toBe("Subtraction to 20 — in columns — no regrouping");
    expect(
      describeSheet(config({ style: "missing", regrouping: "always" })),
    ).toBe("Addition to 20 — missing number — with regrouping");
    expect(describeSheet(config({ style: "fact-family" }))).toBe(
      "Fact families to 20",
    );
    expect(describeSheet(config({ operation: "both", numberLine: true }))).toBe(
      "Addition and subtraction to 20 — with a number line",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config(), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Addition to 20");
    expect(sheet.header.instructions).toBe("Work out each answer.");
    // Out of what is on the page, not out of what was asked for: a sheet that
    // says "/ 20" over eighteen problems is wrong twice.
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("is right on every problem of every sheet this family can print", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          for (const sentence of sentences(problem)) {
            expect(holds(sentence), `${JSON.stringify(shape)}: ${sentence}`) //
              .toBe(true);
          }
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
    // The key is not built again from the seed — it is the build, told to
    // print what it already worked out. So the problems on the two are the
    // same objects, and a key cannot disagree with the sheet it belongs to.
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });

  it("gives a fact family its four sentences, and only its own numbers", () => {
    for (const problem of problemsOf({ style: "fact-family", count: 8 }, 3)) {
      const written = sentences(problem);
      expect(written.length).toBe(4);
      // Two sums and two differences, all four true.
      expect(written.filter((line) => read(line).sign === "+").length).toBe(2);
      expect(written.every(holds)).toBe(true);
      // And built from the three numbers the prompt gives, with nothing
      // brought in from outside them.
      const family = new Set(problem.prompt.split(", "));
      for (const line of written) {
        for (const number of line.split(/[^\d]+/).filter(Boolean)) {
          expect(family.has(number)).toBe(true);
        }
      }
    }
  });

  it("puts the answer where the problem left the gap", () => {
    // A missing-number problem has exactly one blank, and it is inside the
    // sentence rather than after it — the renderer's rule, stated here as the
    // engine's half of it.
    for (const problem of problemsOf({ style: "missing" }, 2)) {
      expect(problem.prompt.split("_").length - 1).toBe(1);
      expect(holds(problem.prompt.replace("_", problem.answer))).toBe(true);
    }
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never puts a number outside the range a parent asked for", () => {
    const RANGES = [
      { min: 0, max: 5 },
      { min: 1, max: 20 },
      { min: 10, max: 99 },
      { min: 100, max: 999 },
    ];
    for (const range of RANGES) {
      for (const shape of EVERY_SHAPE) {
        for (const problem of problemsOf({ ...shape, range }, 9)) {
          // The first sentence is the sum itself; a fact family's other three
          // are that sum turned round, and its total is allowed past the top
          // of the range for the same reason every carried sum is.
          for (const value of operandsOf(sentences(problem)[0])) {
            expect(value).toBeGreaterThanOrEqual(range.min);
            expect(value).toBeLessThanOrEqual(range.max);
          }
        }
      }
    }
  });

  it("never dips below zero unless it was asked to", () => {
    for (const shape of EVERY_SHAPE.filter((shape) => !shape.negatives)) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const sentence of sentences(problem)) {
            expect(read(sentence).result).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it("does dip below zero when it was — or the switch is decoration", () => {
    const below = problemsOf({ operation: "subtract", negatives: true }, 4)
      .flatMap(sentences)
      .filter((sentence) => read(sentence).result < 0);
    expect(below.length).toBeGreaterThan(0);
    expect(below.every(holds)).toBe(true);
  });

  it("asks the same question twice on no sheet at all", () => {
    // Folded, because 3 + 5 and 5 + 3 are one sum — and independent of which
    // side a missing-number problem blanks out, because "7 + _ = 15" and
    // "_ + 8 = 15" are one fact in two hats.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const facts = problems.map((problem) => factOf(sentences(problem)[0]));
        expect(new Set(facts).size).toBe(problems.length);
      }
    }
  });

  it("carries on every problem, or on none, when it is told to", () => {
    for (const range of [
      { min: 1, max: 20 },
      { min: 10, max: 99 },
    ]) {
      for (const operation of ["add", "subtract", "both"] as const) {
        for (const [regrouping, want] of [
          ["always", true],
          ["never", false],
        ] as const) {
          const problems = problemsOf(
            { operation, regrouping, range, count: 12 },
            6,
          );
          expect(problems.length).toBeGreaterThan(0);
          for (const problem of problems) {
            const sentence = sentences(problem)[0];
            expect(regroups(sentence), `${regrouping}: ${sentence}`).toBe(want);
          }
        }
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // Nothing between 1 and 3 carries. A generator that kept drawing would
    // either hang or print a sum that does not regroup on a sheet that says it
    // does; an empty sheet is the honest answer, and the builder's job to
    // prevent (PRINT13).
    const problems = problemsOf(
      { range: { min: 1, max: 3 }, regrouping: "always" },
      1,
    );
    expect(problems).toEqual([]);
  });

  it("prints the whole small pool rather than repeating itself", () => {
    // Twenty different sums from 1 to 3 without regrouping is six sums, and
    // six is what a parent should get.
    const problems = problemsOf(
      { range: { min: 1, max: 3 }, regrouping: "never", count: 20 },
      1,
    );
    expect(problems.length).toBe(6);
    expect(new Set(problems.map((p) => p.prompt)).size).toBe(6);
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

  it("carries the seed into the footer, so the same sheet can be had again", () => {
    expect(buildSheet(config(), 12_345).footer.seed).toBe(12_345);
  });

  /** The problems of `seed`, `seed + 1` and `seed + 2`, pairwise. */
  function variants(shape: Partial<ArithmeticConfig>, seed: number) {
    // Compared as sentences rather than as prompts, because a column-form
    // problem has no prompt — the stack is the prompt.
    const [a, b, c] = [0, 1, 2].map((offset) =>
      problemsOf(shape, seed + offset).map((problem) => sentences(problem)[0]),
    );
    return [
      [a, b],
      [a, c],
      [b, c],
    ];
  }

  it("makes variants A, B and C genuinely different sets of problems", () => {
    // Three consecutive seeds are the whole of "a different sheet, same
    // settings" and of variants for a class (§7). Some overlap is inevitable
    // — the variants are drawn from one pool, and a narrow ask has a narrow
    // pool — so what is asserted is that a third of each variant is new,
    // whatever the config. Three sheets that were nearly the same sheet would
    // make the feature a lie.
    for (const shape of EVERY_SHAPE) {
      for (const [one, other] of variants(shape, 100)) {
        expect(one).not.toEqual(other);
        const shared = one.filter((sum) => other.includes(sum)).length;
        expect(shared, JSON.stringify(shape)).toBeLessThan(
          (one.length * 2) / 3,
        );
      }
    }
  });

  it("shares almost nothing between variants of an ordinary sheet", () => {
    // The bound above has to hold for a config whose pool is barely bigger
    // than the sheet. This is the sheet a parent actually prints: twenty sums
    // inside twenty, where two variants have no business having much in
    // common at all.
    for (const [one, other] of variants({}, 100)) {
      const shared = one.filter((sum) => other.includes(sum)).length;
      expect(shared).toBeLessThanOrEqual(2);
    }
  });
});

/* ── Capacity (§20) ────────────────────────────────────────────────────── */

describe("how much fits", () => {
  const SIZES: PaperSize[] = ["letter", "a4", "legal"];
  const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

  it("never prints more problems than the paper holds", () => {
    // The failure is silent on screen and obvious on paper: one row too many
    // is a second sheet out of the printer with two sums on it, and print is
    // the whole of the output path (§10).
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = arithmeticLayout(config(over));
            const rows = Math.ceil(problems.length / columns);
            const used = rows * row + Math.max(0, rows - 1) * GAP.y;
            expect(used, `${size}/${margin}/${fontPt}pt`).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("does not throw the page away either", () => {
    // The half a capacity check cannot see: a family that printed four
    // problems on a Letter page would satisfy every assertion above.
    const { box, row, perPage } = arithmeticLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    // One more row would not have fitted, which is what makes the reservation
    // testable in both directions.
    const rows = perPage / arithmeticLayout(config()).columns;
    expect((rows + 1) * row + rows * GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 12 }, 1).length).toBe(12);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3, 4]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
  });

  it("sizes the number line to the column it sits in", () => {
    // Declared, not measured (§4): the family already worked out how wide a
    // column is to decide how many fit, and a second answer discovered in the
    // browser would be a second answer.
    for (const columns of [1, 2, 3]) {
      const over = { columns, numberLine: true, range: { min: 0, max: 10 } };
      const [problem] = problemsOf(over, 2);
      expect(problem.line?.width).toBe(arithmeticLayout(config(over)).cell);
      // Zero is on it, and so is every result the config can reach.
      expect(problem.line?.from).toBe(0);
      expect(problem.line?.to).toBeGreaterThanOrEqual(20);
    }
  });

  it("gives a fact family room to write four sentences in", () => {
    for (const problem of problemsOf({ style: "fact-family", count: 6 }, 1)) {
      expect(problem.workspace).toBeGreaterThanOrEqual(inches(1));
    }
  });
});
