import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP, answerLine } from "../layout";
import { points } from "../paper";
import type {
  GridSpec,
  MarginSize,
  MultiplicationConfig,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { BRACKET_EMS, divisionLines, longDigits, partialLines } from "./long";
import {
  MULTIPLICATION_SHEET,
  multiplicationGrid,
  multiplicationLayout,
} from "./multiplication";

/**
 * Multiplication and division, held to the bar the arithmetic family set.
 *
 * **Nothing here checks the generator against the generator.** Every answer is
 * verified from the *printed* problem — the string a child reads — by a path
 * the family does not use:
 *
 * - a product is checked by **repeated addition**, which is the definition of
 *   multiplication a child meets first and the one `×` is shorthand for;
 * - a division is checked by **its inverse**, built out of that same repeated
 *   addition: `a ÷ b = c r d` is true exactly when adding `b` to itself `c`
 *   times and then `d` more arrives at `a`, with `d` short of `b`;
 * - a partial product is checked by **shifting a string**, because the whole
 *   of long multiplication is which column a number lands in and a test that
 *   multiplied by a power of ten would agree with a family that had the shift
 *   wrong;
 * - a missing number is checked by **searching for every number that fits**,
 *   which catches the two ways that question goes bad at once: an answer that
 *   is wrong, and a blank that more than one answer would fill.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

/** The tables a mixed sheet draws from: the wall chart, without its edges. */
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const config = (
  over: Partial<MultiplicationConfig> = {},
): MultiplicationConfig => ({
  kind: "multiplication",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  operation: "multiply",
  style: "standard",
  form: "horizontal",
  tables: TABLES,
  factors: { min: 0, max: 12 },
  count: 20,
  columns: 2,
  ...over,
});

/**
 * Every shape of *problem* the family can print, which is every acceptance
 * criterion of the story bar the grid: tables and mixed sets, both operations
 * and the two together, written along a line and worked the way they are
 * worked, missing numbers, and both long forms with and without remainders.
 *
 * The grid is not here because it has no problems — it is one block with a
 * hundred and forty-four answers inside it — and it gets a section of its own.
 */
const EVERY_SHAPE: Array<Partial<MultiplicationConfig>> = [
  {},
  { form: "vertical" },
  { operation: "divide" },
  { operation: "divide", form: "vertical" },
  { operation: "both" },
  { operation: "both", form: "vertical" },
  { style: "missing" },
  { style: "missing", operation: "divide" },
  { style: "missing", operation: "both" },
  // One table rather than a mixed set — the difference between learning a
  // table and being tested on all of them, and one array long.
  { tables: [7], count: 6 },
  { tables: [7], operation: "divide", count: 6 },
  { tables: [7], operation: "both", count: 6 },
  { workspace: true, count: 12 },
  { factors: { min: 1, max: 9 }, tables: [3, 4], count: 10 },
  // The long forms.
  { style: "long", digits: { into: 3, by: 2 }, count: 6 },
  { style: "long", digits: { into: 2, by: 1 }, count: 6 },
  { style: "long", digits: { into: 4, by: 3 }, count: 4 },
  // Equal digit counts, which is the case the folding question turns on: it is
  // the only shape where a sheet can draw both `26 × 47` and `47 × 26`, and
  // this family says those are two exercises rather than one repetition. Two
  // digits by two is also the long multiplication most children are set, so
  // leaving it out left the headline ask of the story untested.
  { style: "long", digits: { into: 2, by: 2 }, count: 6 },
  { style: "long", operation: "divide", digits: { into: 3, by: 1 }, count: 6 },
  { style: "long", operation: "divide", digits: { into: 3, by: 2 }, count: 6 },
  { style: "long", operation: "divide", digits: { into: 3, by: 3 }, count: 4 },
  {
    style: "long",
    operation: "divide",
    digits: { into: 3, by: 1 },
    remainders: true,
    count: 6,
  },
  {
    style: "long",
    operation: "both",
    digits: { into: 4, by: 2 },
    remainders: true,
    count: 4,
  },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** Every column count the family will lay out — `MAX_COLUMNS` is six. */
const COLUMN_COUNTS = [1, 2, 3, 4, 5, 6];

/** The one block a fact or long-form sheet has, narrowed for the reader. */
function problemsOf(
  over: Partial<MultiplicationConfig>,
  seed: number,
): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ──────────────────────────────────
   Everything below works from the printed problem — the prompt, the stack of
   numbers, or the bracket — and never from the config that produced it. If the
   family printed one thing and computed another, these are what notice.     */

/**
 * Multiplication, by repeated addition — the point of the whole file.
 *
 * `a * b` is what the family computes, so a test that used it would agree with
 * the family however wrong the family was. Adding `a` to itself `b` times is
 * the other definition, and it is the one a child is taught first: four fives
 * are five and five and five and five.
 */
function times(a: number, b: number): number {
  let total = 0;
  for (let step = 0; step < b; step += 1) total += a;
  return total;
}

/** A number with `places` noughts stuck on the end, by string rather than sum. */
function shifted(value: number, places: number): number {
  return value === 0 ? 0 : Number(`${value}${"0".repeat(places)}`);
}

type Statement = {
  left: number;
  sign: string;
  right: number;
  result: number;
  remainder: number;
};

/** A written sentence, taken apart. Rejects anything that isn't one. */
function read(sentence: string): Statement {
  const match = /^(\d+) ([×÷]) (\d+) = (\d+)(?: r (\d+))?$/.exec(
    sentence.trim(),
  );
  if (!match) throw new Error(`not a number sentence: "${sentence}"`);
  return {
    left: Number(match[1]),
    sign: match[2],
    right: Number(match[3]),
    result: Number(match[4]),
    remainder: match[5] === undefined ? 0 : Number(match[5]),
  };
}

/**
 * Whether a written sentence is true.
 *
 * A division is checked through its inverse and never by dividing: `a ÷ b` is
 * `c` with `d` left over exactly when `b` added to itself `c` times and then
 * `d` more comes to `a`, and `d` is short of `b`. That last clause is what
 * makes "56 ÷ 5 = 10 r 6" false, which is the shape a wrong long division
 * takes far more often than a wrong quotient does.
 */
function holds(sentence: string): boolean {
  const { left, sign, right, result, remainder } = read(sentence);
  if (sign === "×") return times(left, right) === result && remainder === 0;
  if (right === 0) return false;
  return times(right, result) + remainder === left && remainder < right;
}

/**
 * The problem, written out in full with its answer put where it belongs.
 *
 * Four shapes reduce to one sentence: a fact with a slot on the end, a fact
 * with the gap inside it, a stack of numbers in column form, and the division
 * bracket, whose answer is written above it rather than after it.
 */
function sentences(problem: Problem): string[] {
  if (problem.bracket) {
    const { dividend, divisor } = problem.bracket;
    return [`${dividend} ÷ ${divisor} = ${problem.answer}`];
  }
  if (problem.operands) {
    const stack = problem.operands.join(` ${problem.operator} `);
    return [`${stack} = ${problem.answer}`];
  }
  if (problem.prompt.includes("_")) {
    return [problem.prompt.replace("_", problem.answer)];
  }
  return [`${problem.prompt} ${problem.answer}`];
}

/**
 * What makes two problems the same problem, worked out from the page.
 *
 * Multiplication folds and division does not — `masteryKey` against
 * `drillKey`, established here from the printed page rather than from the key
 * the family happened to compute.
 *
 * Except on a long form, where nothing folds. A fact sheet asks for an answer,
 * and `7 × 8` and `8 × 7` have the same one; a long form asks for a *method*,
 * and `26 × 47` and `47 × 26` are worked with different partials in different
 * columns and a different number of them. So they are two exercises, and
 * `longKey` in long.ts keeps them apart deliberately. A folding key here would
 * not be a stricter test — it would be a test of a rule the family does not
 * have, and it would fail the moment a sheet asked for equal digit counts.
 */
function factOf(sentence: string, folds: boolean): string {
  const { left, sign, right } = read(sentence);
  return sign === "×" && folds
    ? `×:${Math.min(left, right)}:${Math.max(left, right)}`
    : `${sign}:${left}:${right}`;
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the multiplication family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("multiplication")).toBe(MULTIPLICATION_SHEET);
    expect(sheetSpec("multiplication").label).toBe(
      "Multiplication and division",
    );
  });

  it("names what it prints, in the terms a parent chose it by", () => {
    expect(describeSheet(config())).toBe("Multiplication to 12");
    expect(describeSheet(config({ tables: [7] }))).toBe("The 7 times table");
    expect(describeSheet(config({ tables: [7], operation: "divide" }))).toBe(
      "Dividing by 7",
    );
    expect(describeSheet(config({ tables: [7], operation: "both" }))).toBe(
      "The 7 times table, both ways",
    );
    expect(describeSheet(config({ form: "vertical" }))).toBe(
      "Multiplication to 12 — worked in columns",
    );
    expect(describeSheet(config({ style: "missing" }))).toBe(
      "Multiplication to 12 — missing number",
    );
    expect(describeSheet(config({ style: "grid" }))).toBe(
      "Multiplication grid to 12",
    );
    expect(
      describeSheet(config({ style: "long", digits: { into: 3, by: 2 } })),
    ).toBe("Long multiplication — 3-digit by 2-digit");
    expect(
      describeSheet(
        config({
          style: "long",
          operation: "divide",
          digits: { into: 4, by: 1 },
          remainders: true,
        }),
      ),
    ).toBe("Long division with remainders — 4-digit by 1-digit");
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ tables: [7] }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("The 7 times table");
    expect(sheet.header.instructions).toBe("Work out each answer.");
    // Out of what is on the page, not out of what was asked for.
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child what to do with a form they have not met before", () => {
    expect(buildSheet(config({ style: "grid" }), 1).header.instructions).toBe(
      "Write each product in the square where its row meets its column.",
    );
    expect(
      buildSheet(
        config({ style: "long", operation: "divide", remainders: true }),
        1,
      ).header.instructions,
    ).toBe("Show your working. Write what is left over after an r.");
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("is right on every problem of every sheet this family can print", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
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
    // print what it already worked out. So the blocks on the two are equal,
    // and a key cannot disagree with the sheet it belongs to.
    for (const shape of [...EVERY_SHAPE, { style: "grid" as const }]) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });

  it("leaves exactly one number that would fit a missing-number blank", () => {
    // Two failures caught by one search: an answer that is wrong, and a blank
    // that more than one number would fill. "_ × 0 = 0" is the second — true
    // of every number there is — and it is the reason a missing-number sheet
    // never draws a zero.
    for (const operation of ["multiply", "divide", "both"] as const) {
      const problems = problemsOf({ style: "missing", operation }, 5);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const fits = [];
        for (let candidate = 0; candidate <= 200; candidate += 1) {
          const written = problem.prompt.replace("_", String(candidate));
          // A candidate that makes the sentence unreadable is not a candidate.
          try {
            if (holds(written)) fits.push(candidate);
          } catch {
            /* not a number sentence at all */
          }
        }
        expect(fits, problem.prompt).toEqual([Number(problem.answer)]);
      }
    }
  });

  it("shows the working of a long multiplication, not just its product", () => {
    // A long multiplication is marked on its partials as much as on its total,
    // so the key writes them. Each one is checked by shifting a *string*: the
    // whole of the exercise is which column a partial lands in, and a test
    // that multiplied by a power of ten would agree with a family that had the
    // shift wrong.
    for (const digits of [
      { into: 3, by: 2 },
      { into: 4, by: 3 },
    ]) {
      const problems = problemsOf({ style: "long", digits, count: 4 }, 2);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const [into, by] = problem.operands ?? [];
        const working = problem.working ?? [];
        expect(working.length).toBe(String(by).length);

        let total = 0;
        working.forEach((partial, place) => {
          // The digit of the multiplier this row is for, read off the printed
          // multiplier from the units end.
          const digit = Number(by[by.length - 1 - place]);
          expect(Number(partial)).toBe(
            shifted(times(Number(into), digit), place),
          );
          total += Number(partial);
        });
        // And they come to the answer on the total line.
        expect(total).toBe(Number(problem.answer));
      }
    }
  });

  it("writes a remainder the way a child is asked to write one", () => {
    const problems = problemsOf(
      {
        style: "long",
        operation: "divide",
        digits: { into: 3, by: 1 },
        remainders: true,
        count: 6,
      },
      3,
    );
    expect(problems.length).toBeGreaterThan(0);
    for (const problem of problems) {
      expect(problem.answer).toMatch(/^\d+ r \d+$/);
      expect(holds(sentences(problem)[0])).toBe(true);
    }
    // And never writes "r 0", which is a different and wrong sentence.
    for (const problem of problemsOf(
      { style: "long", operation: "divide", digits: { into: 3, by: 1 } },
      3,
    )) {
      expect(problem.answer).toMatch(/^\d+$/);
    }
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never divides by zero, on any sheet, at any seed", () => {
    // The one bound whose failure is not a wrong answer but no answer at all.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          const { sign, right } = read(sentences(problem)[0]);
          if (sign === "÷") expect(right).toBeGreaterThan(0);
          // And the printed divisor of a bracket is the same number.
          if (problem.bracket)
            expect(Number(problem.bracket.divisor)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("never puts a table or a factor a parent did not ask for on the page", () => {
    const ASKS = [
      { tables: [7], factors: { min: 0, max: 12 } },
      { tables: [3, 4, 6], factors: { min: 1, max: 10 } },
      { tables: TABLES, factors: { min: 2, max: 5 } },
    ];
    for (const ask of ASKS) {
      const wanted = new Set(ask.tables);
      const factors = ask.factors;
      for (const style of ["standard", "missing"] as const) {
        for (const operation of ["multiply", "divide"] as const) {
          const problems = problemsOf({ ...ask, style, operation }, 9);
          expect(problems.length).toBeGreaterThan(0);
          for (const problem of problems) {
            const { left, sign, right, result } = read(sentences(problem)[0]);
            // A multiplication prints table × factor; a division prints the
            // product first, so its two other numbers are the pair.
            const [table, factor] =
              sign === "×" ? [left, right] : [right, result];
            // Folded, so either of the two may be the table that was picked.
            expect(
              wanted.has(table) || wanted.has(factor),
              `${sentences(problem)[0]} from ${JSON.stringify(ask)}`,
            ).toBe(true);
            for (const value of [table, factor]) {
              if (!wanted.has(value)) {
                expect(value).toBeGreaterThanOrEqual(factors.min);
                expect(value).toBeLessThanOrEqual(factors.max);
              }
            }
          }
        }
      }
    }
  });

  it("gives a long form exactly the digits it was asked for", () => {
    // "Three-digit by two-digit" is the whole of what a parent chose, and a
    // sheet that quietly slipped a two-digit multiplicand in is a sheet set at
    // a level nobody picked.
    for (const digits of [
      { into: 2, by: 1 },
      { into: 3, by: 1 },
      { into: 3, by: 2 },
      { into: 4, by: 2 },
    ]) {
      for (const operation of ["multiply", "divide"] as const) {
        const problems = problemsOf(
          { style: "long", operation, digits, count: 4 },
          6,
        );
        expect(problems.length, JSON.stringify(digits)).toBeGreaterThan(0);
        for (const problem of problems) {
          const [into, by] = problem.bracket
            ? [problem.bracket.dividend, problem.bracket.divisor]
            : (problem.operands ?? []);
          expect(into.length, `${into} by ${by}`).toBe(digits.into);
          expect(by.length, `${into} by ${by}`).toBe(digits.by);
          // And never by one, which is a sheet with the answer already on it.
          expect(Number(by)).toBeGreaterThan(1);
        }
      }
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      // A long form is an exercise in a method rather than a fact, so its
      // repetitions are counted without folding — see `factOf`.
      const folds = shape.style !== "long";
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const facts = problems.map((problem) =>
          factOf(sentences(problem)[0], folds),
        );
        expect(new Set(facts).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("keeps a division's two questions apart, and folds a multiplication's", () => {
    // The note the story turns on: 7 × 8 and 8 × 7 are one problem, while
    // 56 ÷ 7 and 56 ÷ 8 are two questions with two answers — `masteryKey`
    // against `drillKey`, and a worksheet is a drill. Read off the page rather
    // than out of the family's own key.
    const divisions = problemsOf({ operation: "divide", count: 30 }, 12).map(
      (problem) => read(sentences(problem)[0]),
    );
    const bothWays = divisions.filter((one) =>
      divisions.some(
        (other) =>
          one.result !== one.right &&
          other.left === one.left &&
          other.right === one.result,
      ),
    );
    // A page of divisions that had folded them would never draw a pair, and
    // the sheet would be a third shorter than a parent asked for.
    expect(bothWays.length).toBeGreaterThan(0);

    const products = problemsOf({ count: 30 }, 12).map((problem) =>
      read(sentences(problem)[0]),
    );
    for (const one of products) {
      expect(
        products.filter(
          (other) => other.left === one.right && other.right === one.left,
        ).length,
        `${one.left} × ${one.right} is on the page twice`,
      ).toBe(one.left === one.right ? 1 : 0);
    }
  });

  it("counts a long multiplication as an exercise and not as a fact", () => {
    // The one place the folding rule above is deliberately off, and the reason
    // `factOf` has to be told. `26 × 47` and `47 × 26` are one product and two
    // different pieces of written work — different partials, in different
    // columns — so a long sheet may print both, and folding them would throw
    // away half the pool of a sheet whose digit counts are equal.
    //
    // Only equal digit counts can draw the pair at all: a three-digit-by-two
    // sheet has nowhere to put `47 × 269`. This uses the smallest such pool, a
    // single digit each way, because that is where a page is bound to contain
    // one rather than merely allowed to.
    for (const seed of SEEDS) {
      const drawn = problemsOf(
        { style: "long", digits: { into: 1, by: 1 }, count: 200, columns: 4 },
        seed,
      ).map((problem) => (problem.operands ?? []).map(Number));
      expect(drawn.length).toBeGreaterThan(0);
      const both = drawn.filter(([into, by]) =>
        drawn.some(([a, b]) => into !== by && a === by && b === into),
      );
      expect(both.length, `seed ${seed}`).toBeGreaterThan(0);
    }
  });

  it("prints the whole small pool rather than repeating itself", () => {
    // The two times table by nought to five is six facts, folded onto five —
    // 2 × 2 and 2 × 2 are one — and five is what a parent should get rather
    // than twenty problems with the same sum in them four times.
    const problems = problemsOf(
      { tables: [2], factors: { min: 0, max: 5 }, count: 20 },
      1,
    );
    expect(problems.length).toBe(6);
    expect(new Set(problems.map((p) => p.prompt)).size).toBe(6);
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // No tables at all, and a long division of a one-digit number by a
    // two-digit one. Both are empty sheets, which is the honest answer and the
    // builder's job to prevent (PRINT13).
    expect(problemsOf({ tables: [] }, 1)).toEqual([]);
    expect(
      problemsOf(
        {
          style: "long",
          operation: "divide",
          digits: { into: 1, by: 2 },
          count: 4,
        },
        1,
      ),
    ).toEqual([]);
  });
});

/* ── The grid ──────────────────────────────────────────────────────────── */

describe("the multiplication grid", () => {
  const gridOf = (over: Partial<MultiplicationConfig> = {}): GridSpec => {
    const grid = multiplicationGrid(config({ style: "grid", ...over }));
    if (!grid) throw new Error("no grid was built");
    return grid;
  };

  it("has a product in every square where a row meets a column", () => {
    // Verified off the printed headers by repeated addition, so a grid whose
    // rows and columns had drifted apart from its answers fails here.
    const grid = gridOf();
    const { columns, rows, cells = [], answers = [] } = grid;
    expect(cells.length).toBe(columns * rows);
    expect(answers.length).toBe(columns * rows);

    for (let row = 1; row < rows; row++) {
      for (let column = 1; column < columns; column++) {
        const table = Number(cells[row * columns]);
        const factor = Number(cells[column]);
        expect(Number(answers[row * columns + column])).toBe(
          times(table, factor),
        );
      }
    }
  });

  it("prints its headers on the sheet and its products only on the key", () => {
    const { columns, rows, cells = [], answers = [] } = gridOf();
    expect(cells[0]).toBe("×");
    for (let index = 0; index < columns * rows; index++) {
      const header = index < columns || index % columns === 0;
      // Every square is one or the other, and never both: a header a child
      // needs from the start, or an answer they are there to write.
      expect(cells[index] === "", `cell ${index}`).toBe(!header);
      expect(answers[index] === "", `answer ${index}`).toBe(header);
    }
  });

  it("rules the headers off, so they are not read as answers", () => {
    expect(gridOf().origin).toEqual({ column: 1, row: 1 });
  });

  it("is marked out of the squares a child has to fill", () => {
    const sheet = buildSheet(config({ style: "grid", tables: [2, 3, 4] }), 1);
    expect(sheet.header.score?.outOf).toBe(3 * 13);
    expect(sheet.header.title).toBe("Multiplication grid to 12");
  });

  it("is the same wall chart whatever seed it was printed from", () => {
    // Nothing about a grid is drawn, and that is correct rather than an
    // oversight: a parent who prints the twelve times square twice should get
    // the same object both times.
    expect(buildSheet(config({ style: "grid" }), 1).blocks).toEqual(
      buildSheet(config({ style: "grid" }), 99).blocks,
    );
  });

  it("fits the paper it is printed on, at every stock and margin", () => {
    for (const size of ["letter", "a4", "legal"] as PaperSize[]) {
      for (const margin of [
        "none",
        "narrow",
        "normal",
        "wide",
      ] as MarginSize[]) {
        const over = { style: "grid" as const, paper: paper({ size, margin }) };
        const grid = gridOf(over);
        const { box } = multiplicationLayout(config(over));
        expect(
          grid.cell * grid.columns,
          `${size}/${margin}`,
        ).toBeLessThanOrEqual(box.width);
        expect(grid.cell * grid.rows, `${size}/${margin}`).toBeLessThanOrEqual(
          box.height,
        );
      }
    }
  });
});

/* ── Determinism, and the three features it buys (§7) ──────────────────── */

describe("(config, seed)", () => {
  it("builds the same sheet twice", () => {
    for (const shape of [...EVERY_SHAPE, { style: "grid" as const }]) {
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

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // Building twice in one process only proves the draw is a function of
    // `(config, seed)`. The promise the footer makes is bigger than that: the
    // seed is printed on the paper so a parent can have the same sheet again
    // next week, across a deploy. Nothing else in this file would notice a
    // refactor that moved where the draw consumes `rand()` — the coin spent
    // only when both operations are asked for, the slot drawn whatever the
    // fact style, the remainder drawn before the quotient — and every seed a
    // parent had already printed would quietly start producing a different
    // sheet. These lists make that a decision somebody takes rather than one
    // they trip over.
    expect(
      problemsOf({ tables: [7], count: 5 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual([
      ["7 × 3 =", "21"],
      ["7 × 8 =", "56"],
      ["7 × 5 =", "35"],
      ["7 × 9 =", "63"],
      ["7 × 12 =", "84"],
    ]);

    expect(
      problemsOf({ style: "long", digits: { into: 3, by: 2 }, count: 3 }, 7) //
        .map((p) => [p.operands, p.working, p.answer]),
    ).toEqual([
      [["110", "15"], ["550", "1100"], "1650"],
      [["979", "72"], ["1958", "68530"], "70488"],
      [["569", "46"], ["3414", "22760"], "26174"],
    ]);

    expect(
      problemsOf(
        {
          style: "long",
          operation: "divide",
          digits: { into: 3, by: 1 },
          remainders: true,
          count: 3,
        },
        7,
      ).map((p) => [p.bracket, p.answer]),
    ).toEqual([
      [{ divisor: "2", dividend: "979" }, "489 r 1"],
      [{ divisor: "7", dividend: "466" }, "66 r 4"],
      [{ divisor: "5", dividend: "596" }, "119 r 1"],
    ]);
  });

  /** The problems of `seed`, `seed + 1` and `seed + 2`, pairwise. */
  function variants(shape: Partial<MultiplicationConfig>, seed: number) {
    // Compared as sentences rather than as prompts, because a column form and
    // a bracket have no prompt — the drawing is the prompt.
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
    // settings" and of variants for a class (§7). Some overlap is inevitable —
    // one table is thirteen facts however many sheets you print — so what is
    // asserted is that a third of each variant is new. Three sheets that were
    // nearly the same sheet would make the feature a lie.
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
});

/* ── Capacity (§20) ────────────────────────────────────────────────────── */

describe("how much fits", () => {
  const SIZES: PaperSize[] = ["letter", "a4", "legal"];
  const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

  it("never prints more problems than the paper holds", () => {
    // The failure is silent on screen and obvious on paper: one row too many
    // is a second sheet out of the printer with two problems on it, and print
    // is the whole of the output path (§10).
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = multiplicationLayout(config(over));
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
    const { box, row, perPage, columns } = multiplicationLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);

    // And a page of long division still holds six, which is what a parent
    // expects to get for the paper.
    expect(
      multiplicationLayout(
        config({
          style: "long",
          operation: "divide",
          digits: { into: 3, by: 1 },
        }),
      ).perPage,
    ).toBeGreaterThanOrEqual(6);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 12 }, 1).length).toBe(12);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of COLUMN_COUNTS) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Four is as many columns as a long form is laid out in: a long division
    // worked in a column an inch wide has nowhere to bring a digit down to.
    const long = buildSheet(config({ style: "long", columns: 6 }), 1).blocks[0];
    expect(long.kind === "problems" && long.columns).toBe(4);
  });

  it("reserves the working space a long form is going to use", () => {
    // The layout reserves the height and the build attaches the lines, and the
    // two reading the config differently is the bug the whole "declared, not
    // measured" design exists to exclude.
    for (const digits of [
      { into: 3, by: 2 },
      { into: 4, by: 3 },
      { into: 2, by: 1 },
      { into: 3, by: 3 },
    ]) {
      const over = { style: "long" as const, digits, count: 4 };
      const worked = problemsOf(over, 5);
      expect(worked.length, JSON.stringify(digits)).toBeGreaterThan(0);
      for (const problem of worked) {
        expect(problem.working?.length ?? 0).toBe(partialLines(digits));
      }

      // A division attaches no lines — its reservation is blank paper under
      // the bracket — so "the two agree" has to be checked against the number
      // itself rather than against a count of what was written.
      for (const remainders of [false, true]) {
        const divided = { ...over, operation: "divide" as const, remainders };
        const where = JSON.stringify(divided);
        const { fontPt } = config(divided);
        const reserved = divisionLines(digits) * answerLine(fontPt);
        const divisions = problemsOf(divided, 5);
        expect(divisions.length, where).toBeGreaterThan(0);

        for (const problem of divisions) {
          expect(problem.working, where).toBeUndefined();
          expect(problem.workspace, where).toBe(reserved);
          // And the row the layout hands the renderer is the bracket plus that
          // space, so the working a child is promised is inside the cell it is
          // printed in rather than over the problem below.
          expect(multiplicationLayout(config(divided)).row, where) //
            .toBeGreaterThanOrEqual(points(fontPt * BRACKET_EMS) + reserved);
          // The reservation is two ruled lines per digit of the quotient, on
          // the bound that a quotient can be no longer than `into − by + 1`
          // digits — a bound `divisionLines` computes before any division has
          // been drawn. This is the half of it a drawn quotient can falsify: a
          // longer one is a child working past the bottom of their own space.
          const [quotient] = problem.answer.split(" r ");
          expect(quotient.length, `${where}: ${problem.answer}`) //
            .toBeLessThanOrEqual(digits.into - digits.by + 1);
        }
      }
    }
  });

  it("reads a saved config's digit counts back safely", () => {
    // `digits` arrives from outside this build, so it is the one field here
    // that may be nonsense. A row taller than the paper is a sheet with
    // nothing on it.
    expect(longDigits(config({ style: "long" }))).toEqual({ into: 3, by: 2 });
    expect(
      longDigits(config({ style: "long", digits: { into: 0, by: 99 } })),
    ).toEqual({ into: 1, by: 5 });
    expect(divisionLines({ into: 1, by: 5 })).toBe(2);
  });
});

/* ── The facts they keep missing ───────────────────────────────────────────
   The other way into this family (docs/printables.md §14). The record book
   ranks the fact ids and this prints exactly those, in that order — still
   checked by repeated addition and by the inverse, because a practice sheet
   with a wrong answer on it is worse than no practice sheet.               */

describe("the facts they keep missing", () => {
  /** Three fact ids in the shape `decks/flashcards.ts` writes them. */
  const MISSED = ["7:8", "6:9", "12:4"];

  it("prints exactly those facts, in the order they were ranked", () => {
    const items = problemsOf({ facts: MISSED, count: 20 }, 5);
    expect(items.flatMap(sentences)).toEqual([
      "7 × 8 = 56",
      "6 × 9 = 54",
      "12 × 4 = 48",
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

  it("reads a division fact backwards, as the drill keeps it", () => {
    // `3:7` is the pair the deck builds "21 ÷ 3" from — the divisor, then the
    // answer — which is why 56 ÷ 7 and 56 ÷ 8 stay two facts where 7 × 8 and
    // 8 × 7 are one.
    const [sentence] = problemsOf(
      { facts: ["3:7"], operation: "divide" },
      1,
    ).flatMap(sentences);
    expect(sentence).toBe("21 ÷ 3 = 7");
    expect(holds(sentence)).toBe(true);
  });

  it("never divides by zero, whatever the record book hands over", () => {
    // A zero fact is real — 0 × 4 is a card the race asks — and it has no
    // division. So it is asked the one way it can be asked rather than
    // dropped or, worse, printed as "0 ÷ 0".
    for (const seed of SEEDS) {
      const items = problemsOf(
        { facts: ["0:4", "0:9"], operation: "both" },
        seed,
      );
      for (const sentence of items.flatMap(sentences)) {
        expect(read(sentence).sign, sentence).toBe("×");
        expect(holds(sentence), sentence).toBe(true);
      }
    }
  });

  it("prints them whatever the tables and factors say", () => {
    // Both describe a pool to draw from, and a named sheet does not draw: a
    // sheet of the eight facts a child keeps missing is not a sheet of the
    // eight times table, and clipping it to `tables` would print neither.
    expect(
      problemsOf(
        { facts: ["11:12"], tables: [2], factors: { min: 1, max: 3 } },
        2,
      ).flatMap(sentences),
    ).toEqual(["11 × 12 = 132"]);
  });

  it("leaves a zero out of a missing-number sheet", () => {
    // The same judgement the drawn path makes: a blank that any number would
    // fill is not a question, and "_ × 0 = 0" is true of every number there
    // is. Dropping it is the honest answer; printing it is a page a child
    // cannot answer.
    expect(
      problemsOf({ facts: ["0:4", "7:8"], style: "missing" }, 1).map(
        (p) => p.factId,
      ),
    ).toEqual(["7:8"]);
  });

  it("says on the page, and in the record, that it is a practice sheet", () => {
    const practice = config({ facts: MISSED });
    const sheet = buildSheet(practice, 1);
    // Not "the 7 times table" and not "Multiplication to 12": the sheet never
    // saw either pool, and a title claiming one would be the only untrue line
    // on the page.
    expect(sheet.header.title).toBe("Multiplication practice");
    expect(sheet.header.score).toEqual({ outOf: 3 });
    expect(describeSheet(practice)) //
      .toBe("Multiplication practice — 3 tricky facts");
  });

  it("keys them the way it keys everything else", () => {
    const key = answerKey(config({ facts: MISSED, operation: "both" }), 9);
    const block = key.blocks[0];
    if (block.kind !== "problems") throw new Error("expected problems");
    expect(key.answers).toBe(true);
    for (const sentence of block.items.flatMap(sentences)) {
      expect(holds(sentence), sentence).toBe(true);
    }
  });

  it("is ignored by the two styles that have no facts to name", () => {
    // A square is every fact there is and a long form is not one of the
    // twelve tables at all, so neither may quietly become a three-problem
    // sheet because a config carried a list it has no use for.
    const grid = config({ facts: MISSED, style: "grid" });
    expect(buildSheet(grid, 1).blocks[0].kind).toBe("grid");
    expect(problemsOf({ facts: MISSED, style: "long", count: 6 }, 1).length) //
      .toBe(6);
  });

  it("falls back to the ordinary sheet when nothing is standing out", () => {
    // A child with nothing in the record book is the commonest case on a
    // family machine rather than an error, and what they get is the mixed
    // sheet the tables describe — which is a sheet worth printing.
    expect(problemsOf({ facts: [] }, 4)).toEqual(problemsOf({}, 4));
    expect(buildSheet(config({ facts: [] }), 4).header.title) //
      .toBe("Multiplication to 12");
  });

  it("never prints more of them than the paper holds", () => {
    const many: string[] = [];
    for (let a = 1; a <= 12; a += 1) {
      for (let b = 1; b <= 12; b += 1) many.push(`${a}:${b}`);
    }
    const over = { facts: many, count: many.length };
    expect(problemsOf(over, 1).length) //
      .toBe(multiplicationLayout(config(over)).perPage);
  });
});
