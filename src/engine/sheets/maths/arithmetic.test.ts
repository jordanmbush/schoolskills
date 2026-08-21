import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { describeSheetFamily } from "../contract";
import { PROBLEM_GAP } from "../layout";
import { LINE_INSET, labelRoom, ticks } from "../numberline";
import { inches } from "../paper";
import type {
  ArithmeticConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { ARITHMETIC_SHEET, arithmeticLayout } from "./arithmetic";

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
 * Every shape the family can print: both layouts, both operations and the two
 * together, regrouping on, off and either, missing numbers, fact families,
 * number lines and workspace. The sweeps below run over all of it rather than
 * over the default.
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
  // A family with the number-line switch on, which it ignores: the combination
  // is legal, and the layout and the build have to agree that it draws none.
  { style: "fact-family", numberLine: true, count: 8 },
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

describeSheetFamily("arithmetic", {
  label: "Addition and subtraction",
  spec: ARITHMETIC_SHEET,
  config,
  shapes: EVERY_SHAPE,
  seeds: SEEDS,
});

/** Every column count the family will lay out — `MAX_COLUMNS` is six. */
const COLUMN_COUNTS = [1, 2, 3, 4, 5, 6];

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
  // A fact family: the prompt is three numbers, and the answer is the four
  // sentences they make, each written on a ruled line of its own.
  if (problem.answers) return problem.answers;
  if (problem.operands) {
    const stack = problem.operands.join(` ${problem.operator} `);
    return [`${stack} = ${problem.answer}`];
  }
  if (problem.prompt.includes("_")) {
    return [problem.prompt.replace("_", problem.answer)];
  }
  return [`${problem.prompt} ${problem.answer}`];
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

  it("gives a fact family its four sentences, and only its own numbers", () => {
    for (const problem of problemsOf({ style: "fact-family", count: 8 }, 3)) {
      const written = sentences(problem);
      expect(written.length).toBe(4);
      // Carried as a list, which is what makes the sheet rule four lines for
      // it. Four sentences smuggled through the one-answer field would print a
      // slot the size of one of them, and a key four times too long for it.
      expect(problem.answers).toEqual(written);
      expect(problem.prompt).not.toContain("_");
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
    // prevent.
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
  it("draws the same problems for a seed as it did the day it shipped", () => {
    // Building twice in one process only proves the draw is a function of
    // `(config, seed)`. The promise the footer makes is bigger than that: the
    // seed is printed on the paper so a parent can have the same sheet again
    // next week, across a deploy — the same durability constraint `configKey`
    // is under for saved runs.
    //
    // Nothing else in this file would notice a refactor that moved where the
    // draw consumes `rand()` — the `slot` draw taken whatever the style, or
    // the `operation` draw taken only when both are asked for. Every seed a
    // parent had already printed would quietly start producing a different
    // sheet. These two lists make that a decision somebody has to take rather
    // than one they can trip over: if they change, the change was deliberate.
    expect(
      problemsOf({ count: 6 }, 4242).map((p) => [p.prompt, p.answer]),
    ).toEqual([
      ["11 + 6 =", "17"],
      ["11 + 14 =", "25"],
      ["6 + 9 =", "15"],
      ["12 + 15 =", "27"],
      ["13 + 20 =", "33"],
      ["16 + 18 =", "34"],
    ]);

    expect(
      problemsOf({ style: "fact-family", count: 3 }, 7).map((p) => [
        p.prompt,
        p.answers,
      ]),
    ).toEqual([
      ["1, 2, 3", ["1 + 2 = 3", "2 + 1 = 3", "3 − 1 = 2", "3 − 2 = 1"]],
      [
        "14, 11, 25",
        ["14 + 11 = 25", "11 + 14 = 25", "25 − 14 = 11", "25 − 11 = 14"],
      ],
      [
        "10, 5, 15",
        ["10 + 5 = 15", "5 + 10 = 15", "15 − 10 = 5", "15 − 5 = 10"],
      ],
    ]);
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
    // The half a capacity check cannot see: a family that printed four
    // problems on a Letter page would satisfy every assertion above.
    const { box, row, perPage } = arithmeticLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    // One more row would not have fitted, which is what makes the reservation
    // testable in both directions.
    const rows = perPage / arithmeticLayout(config()).columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
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
    for (const columns of COLUMN_COUNTS) {
      const over = { columns, numberLine: true, range: { min: 0, max: 10 } };
      const [problem] = problemsOf(over, 2);
      expect(problem.line?.width).toBe(arithmeticLayout(config(over)).cell);
      // Zero is on it, and so is every result the config can reach.
      expect(problem.line?.from).toBe(0);
      expect(problem.line?.to).toBeGreaterThanOrEqual(20);
    }
  });

  it("spaces its labels so they can be read in the narrowest column", () => {
    // `columns` is a setting a parent picks and six of them is legal, which
    // leaves a number line about an inch of paper. A tick spacing chosen from
    // a fixed budget rather than from the width would put nine two-digit
    // labels across that inch — unreadable paper for a legal config, printed,
    // with nothing on screen to warn about it first.
    for (const columns of COLUMN_COUNTS) {
      for (const range of [
        { min: 0, max: 10 },
        { min: 0, max: 20 },
        { min: 1, max: 20 },
      ]) {
        const over = { columns, numberLine: true, range, count: 6 };
        const [problem] = problemsOf(over, 2);
        const line = problem.line;
        if (!line) throw new Error(`no line at ${columns} columns`);

        const marks = ticks(line);
        expect(marks.length).toBeGreaterThanOrEqual(2);
        const pitch = (line.width - LINE_INSET * 2) / (marks.length - 1);
        expect(
          pitch,
          `${columns} columns, ${JSON.stringify(range)}: ${marks.join(" ")}`,
        ).toBeGreaterThanOrEqual(labelRoom(marks));
      }
    }
  });

  it("gives a fact family room to write four sentences in", () => {
    for (const problem of problemsOf({ style: "fact-family", count: 6 }, 1)) {
      expect(problem.workspace).toBeGreaterThanOrEqual(inches(1));
      // The room is shared out between the four lines rather than added under
      // a slot, so the height reserved is the height rendered.
      expect(problem.answers?.length).toBe(4);
    }
  });

  it("reserves room for a number line only where it draws one", () => {
    // The layout reserves the height and the build attaches the line, and the
    // two reading the config differently is the bug the whole "declared, not
    // measured" design exists to exclude. A family asks for four sentences,
    // not a line to count along, so `numberLine` may not cost it a row.
    const family = { style: "fact-family", count: 8 } as const;
    for (const problem of problemsOf({ ...family, numberLine: true }, 3)) {
      expect(problem.line).toBeUndefined();
    }
    expect(arithmeticLayout(config({ ...family, numberLine: true }))).toEqual(
      arithmeticLayout(config(family)),
    );
    // And it does cost one everywhere it is actually drawn.
    expect(arithmeticLayout(config({ numberLine: true })).row).toBeGreaterThan(
      arithmeticLayout(config()).row,
    );
  });
});

/* ── The facts they keep missing ───────────────────────────────────────────
   The other way into this family (docs/printables.md §14): the record book
   hands over the fact ids it already ranked, and the sheet is those facts and
   nothing else. Every sentence below is still verified by counting, because a
   practice sheet with a wrong answer on it is worse than no practice sheet. */

describe("the facts they keep missing", () => {
  /** Three fact ids in the shape `decks/flashcards.ts` writes them. */
  const MISSED = ["3:5", "7:8", "9:6"];

  it("prints exactly those facts, in the order they were ranked", () => {
    const items = problemsOf({ facts: MISSED, count: 20 }, 5);
    expect(items.flatMap(sentences)).toEqual([
      "3 + 5 = 8",
      "7 + 8 = 15",
      "9 + 6 = 15",
    ]);
    for (const sentence of items.flatMap(sentences)) {
      expect(holds(sentence), sentence).toBe(true);
    }
  });

  it("carries the id the race files each of them under", () => {
    // The hand-off in both directions: `troubleFacts` speaks in these strings
    // and `Problem.factId` answers in them, so neither side has to learn the
    // other's shape.
    expect(problemsOf({ facts: MISSED }, 5).map((p) => p.factId)) //
      .toEqual(MISSED);
  });

  it("reads a subtraction fact back the way the deck asked it", () => {
    // `3:5` is the pair the deck builds "8 − 3" from — the number taken away,
    // then what is left — so the answer is the 5 that was already in the id.
    // Getting this backwards would print "5 − 3" and drill the wrong fact.
    const [sentence] = problemsOf(
      { facts: ["3:5"], operation: "subtract" },
      1,
    ).flatMap(sentences);
    expect(sentence).toBe("8 − 3 = 5");
    expect(holds(sentence)).toBe(true);
  });

  it("prints them whatever the range and the regrouping say", () => {
    // Both describe a pool to draw from, and a named sheet does not draw.
    // Dropping a fact for carrying, or for sitting outside a range nobody
    // chose, would print a different list from the one handed over.
    expect(
      problemsOf(
        { facts: ["8:7"], range: { min: 1, max: 3 }, regrouping: "never" },
        2,
      ).flatMap(sentences),
    ).toEqual(["8 + 7 = 15"]);
  });

  it("scales the number line to the facts rather than to the range", () => {
    // A line to twenty under a sum whose answer is thirty is worse than no
    // line: a child counts along it and runs off the end.
    const [problem] = problemsOf(
      { facts: ["18:14"], numberLine: true, columns: 1 },
      3,
    );
    expect(problem.line?.to).toBeGreaterThanOrEqual(32);
  });

  it("says on the page, and in the record, that it is a practice sheet", () => {
    const practice = config({ facts: MISSED });
    const sheet = buildSheet(practice, 1);
    // Not "Addition to 20": the sheet never saw the range, and a title
    // claiming one would be the only untrue line on the page.
    expect(sheet.header.title).toBe("Addition practice");
    expect(sheet.header.score).toEqual({ outOf: 3 });
    expect(describeSheet(practice)).toBe("Addition practice — 3 tricky facts");
  });

  it("keys them the way it keys everything else", () => {
    const practice = config({ facts: MISSED, operation: "both" });
    const key = answerKey(practice, 9);
    const block = key.blocks[0];
    if (block.kind !== "problems") throw new Error("expected problems");
    expect(key.answers).toBe(true);
    for (const sentence of block.items.flatMap(sentences)) {
      expect(holds(sentence), sentence).toBe(true);
    }
  });

  it("falls back to the ordinary sheet when nothing is standing out", () => {
    // A child with nothing in the record book is the commonest case on a
    // family machine rather than an error, and what they get is the sheet the
    // range describes — which is a sheet worth printing.
    expect(problemsOf({ facts: [] }, 4)).toEqual(problemsOf({}, 4));
    expect(buildSheet(config({ facts: [] }), 4).header.title) //
      .toBe("Addition to 20");
  });

  it("never prints more of them than the paper holds", () => {
    const many: string[] = [];
    for (let a = 1; a <= 20; a += 1) {
      for (let b = 1; b <= 10; b += 1) many.push(`${a}:${b}`);
    }
    const over = { facts: many, count: many.length };
    expect(problemsOf(over, 1).length) //
      .toBe(arithmeticLayout(config(over)).perPage);
  });
});
