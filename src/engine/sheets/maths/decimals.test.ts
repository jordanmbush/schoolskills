import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { sheetFamily } from "../families";
import { PROBLEM_GAP } from "../layout";
import type {
  DecimalConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { DECIMALS_SHEET, decimalLayout } from "./decimals";

/**
 * Decimals and percents, held to the bar the maths families set.
 *
 * **Nothing here checks the generator against the generator.** Every answer is
 * verified from the *printed* problem — the string a child reads — by a path the
 * family does not use:
 *
 * - a decimal is read back as **a whole number over a power of ten**, taken off
 *   the digits either side of the point, and the sentence is checked by
 *   **cross-multiplication**. The family never forms a denominator at all: it
 *   adds hundredths as whole numbers. So a misplaced point — the failure a
 *   decimals sheet actually has — cannot pass both of them;
 * - a product is checked by **repeated addition**, which is the definition of
 *   multiplication `×` is shorthand for, and which no part of `timesWhole`
 *   resembles;
 * - a percent is checked by **cross-multiplication too**: `p% of w` is `x`
 *   exactly when `x × 100` is `p × w`. No number read off a sheet is divided
 *   anywhere in this file, bounds included — which is the point, because
 *   division is where a float would get in.
 *
 * And every printed number is held to its *shape* as well as its value. A sheet
 * set at two places whose key says `0.5`, or `0.30000000000000004`, has printed
 * the right number in the wrong form, and a child taught to line up the points
 * cannot use either.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<DecimalConfig> = {}): DecimalConfig => ({
  kind: "decimals",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "standard",
  operation: "add",
  form: "horizontal",
  places: 2,
  range: { min: 0, max: 20 },
  count: 12,
  columns: 2,
  ...over,
});

/** The amounts a percentage sheet is taken of. */
const PERCENT_RANGE = { min: 10, max: 200 };

/**
 * Every shape the family can print: decimals added, taken away and multiplied,
 * along a line and in columns, at each of the three place counts, percentages
 * of amounts, and the conversions between all three forms.
 */
const EVERY_SHAPE: Array<Partial<DecimalConfig>> = [
  {},
  { form: "vertical" },
  { operation: "subtract" },
  { operation: "subtract", form: "vertical" },
  { operation: "both" },
  { operation: "both", form: "vertical" },
  { operation: "multiply" },
  { operation: "multiply", form: "vertical" },
  // The place counts, which are the whole of what makes one of these sheets
  // easy or hard.
  { places: 1 },
  { places: 3 },
  { places: 1, operation: "both" },
  { places: 3, operation: "multiply" },
  { places: 1, range: { min: 0, max: 5 }, count: 8 },
  { style: "percent", range: PERCENT_RANGE, count: 10 },
  { style: "percent", range: { min: 20, max: 60 }, count: 6 },
  { style: "convert", count: 10 },
  { style: "convert", places: 1, count: 8 },
  { style: "convert", places: 3, count: 10 },
  { workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a decimals sheet has, narrowed for the reader. */
function problemsOf(over: Partial<DecimalConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ────────────────────────────────── */

type Value = { n: number; d: number };

/**
 * A number as it is written on paper, read back as a whole number over a power
 * of ten: `0.25` is 25 over 100, and `3` is 3 over 1.
 *
 * The digits are counted rather than the number parsed, which is the only way
 * this can catch what it is here to catch. `Number("0.25")` is a float, and a
 * float that came out of a family printing `0.250000001` would compare equal to
 * everything a test asked it about.
 */
function readNumber(text: string): Value {
  const written = text.trim();
  const point = /^(\d+)\.(\d+)$/.exec(written);
  if (point)
    return { n: Number(point[1] + point[2]), d: 10 ** point[2].length };
  const number = /^(\d+)$/.exec(written);
  if (number) return { n: Number(number[1]), d: 1 };
  throw new Error(`not a decimal: "${text}"`);
}

/** How many digits are printed after the point. */
const placesOf = (text: string): number => (text.split(".")[1] ?? "").length;

/**
 * A whole number of hundredths, written out as a decimal — by moving the digits
 * rather than by dividing, so that not even the candidates a search tries are
 * built out of a float.
 */
function asDecimal(units: number, places: number): string {
  const digits = String(units).padStart(places + 1, "0");
  const point = digits.length - places;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** Whether two values are the same, cross-multiplied and never divided. */
const same = (a: Value, b: Value): boolean => a.n * b.d === b.n * a.d;

/**
 * `a` added to itself `b` times — the definition of multiplication a child
 * meets first, and the one `×` is shorthand for. A test that multiplied would
 * agree with a family that had multiplication wrong.
 */
function repeated(a: number, b: number): number {
  let total = 0;
  for (let step = 0; step < b; step += 1) total += a;
  return total;
}

const OPERATIONS: Record<string, (a: Value, b: Value) => Value> = {
  "+": (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }),
  "−": (a, b) => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }),
  // Over a common denominator, and by repeated addition of the numerators: the
  // multiplier on a decimals sheet is always a whole number, so `b.n` is a
  // count of how many times the value is taken.
  "×": (a, b) => ({ n: repeated(a.n, b.n) * b.d, d: a.d * b.d * b.d }),
};

/**
 * The problem, written out in full with its answer put where it belongs.
 *
 * Three shapes reduce to one sentence: a sum along a line, a stack of numbers in
 * column form, and a blank inside the sentence.
 */
function sentence(problem: Problem): string {
  if (problem.operands) {
    return `${problem.operands.join(` ${problem.operator} `)} = ${problem.answer}`;
  }
  if (problem.prompt.includes("_")) {
    return problem.prompt.replace("_", problem.answer);
  }
  return `${problem.prompt} ${problem.answer}`;
}

/** Whether a written sentence is true. */
function holds(written: string): boolean {
  const worked = /^(\S+) ([+−×]) (\S+) = (\S+)$/.exec(written.trim());
  if (worked) {
    const [, left, sign, right, answer] = worked;
    return same(
      OPERATIONS[sign](readNumber(left), readNumber(right)),
      readNumber(answer),
    );
  }

  // "25% of 80 = 20": the same claim as every other, with the percent written
  // as what it means — so many hundredths.
  const percent = /^(\d+)% of (\d+) = (\S+)$/.exec(written.trim());
  if (percent) {
    return same(
      { n: Number(percent[1]) * Number(percent[2]), d: 100 },
      readNumber(percent[3]),
    );
  }

  // A conversion: two ways of writing one number, either of which may be a
  // percent, a fraction or a decimal.
  const equal = /^(\S+) = (\S+)$/.exec(written.trim());
  if (!equal) throw new Error(`not a number sentence: "${written}"`);
  return same(readForm(equal[1]), readForm(equal[2]));
}

/** A number in any of the three forms a conversion sheet uses. */
function readForm(text: string): Value {
  const percent = /^(\d+)%$/.exec(text.trim());
  if (percent) return { n: Number(percent[1]), d: 100 };
  const fraction = /^(\d+)\/(\d+)$/.exec(text.trim());
  if (fraction) return { n: Number(fraction[1]), d: Number(fraction[2]) };
  return readNumber(text);
}

/** Every decimal printed on a problem, prompt and answer alike. */
function decimalsOn(problem: Problem): string[] {
  return sentence(problem)
    .split(/[\s=+−×]+/)
    .filter((word) => /^\d+\.\d+$/.test(word));
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the decimals family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("decimals")).toBe(DECIMALS_SHEET);
    expect(sheetFamily("decimals")?.label).toBe("Decimals and percents");
  });

  it("names what it prints, in the terms a parent chose it by", () => {
    expect(describeSheet(config())).toBe("Adding decimals — hundredths");
    expect(describeSheet(config({ places: 1 }))).toBe(
      "Adding decimals — tenths",
    );
    expect(describeSheet(config({ places: 3, form: "vertical" }))).toBe(
      "Adding decimals — thousandths — in columns",
    );
    expect(describeSheet(config({ operation: "both" }))).toBe(
      "Adding and subtracting decimals — hundredths",
    );
    expect(describeSheet(config({ operation: "multiply" }))).toBe(
      "Multiplying decimals — hundredths",
    );
    expect(describeSheet(config({ style: "percent" }))).toBe(
      "Percentages of amounts",
    );
    expect(describeSheet(config({ style: "convert" }))).toBe(
      "Fractions, decimals and percents — hundredths",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Adding decimals");
    // Out of what is on the page, not out of what was asked for.
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child what to do with a form they have not met before", () => {
    expect(buildSheet(config({ form: "vertical" }), 1).header.instructions) //
      .toBe("Work out each answer. Keep the points under one another.");
    // A stacked multiplication has nothing to line the points up on: the
    // multiplier is a whole number, so the sentence above would send a child
    // looking for a point that was never printed.
    expect(
      buildSheet(config({ form: "vertical", operation: "multiply" }), 1).header
        .instructions,
    ).toBe(
      "Work out each answer. Line the digits up on the right, then put the point back in.",
    );
    // The conversion sheet's blanks cannot say what they want, so the header
    // does: a child who writes a fraction where a decimal was wanted has
    // answered a question nobody asked and would be marked wrong for it.
    expect(buildSheet(config({ style: "convert" }), 1).header.instructions) //
      .toBe(
        "Fill in each blank. A blank with a % after it wants a percent; every other blank wants a decimal.",
      );
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
          const written = sentence(problem);
          expect(holds(written), `${JSON.stringify(shape)}: ${written}`) //
            .toBe(true);
        }
      }
    }
  });

  it("never prints a number a float would have made", () => {
    // The failure this family exists to design out. `0.1 + 0.2` is
    // 0.30000000000000004 in the language this is written in, and that answer
    // would print — so every number on the page is held to the shape a decimal
    // has, digit for digit, as well as to its value.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const word of sentence(problem).split(/[\s=+−×]+/)) {
            if (word.includes(".")) {
              expect(word, JSON.stringify(shape)).toMatch(/^\d+\.\d{1,3}$/);
            }
          }
        }
      }
    }
  });

  it("prints every decimal to the places the sheet was set at", () => {
    // Trailing zeros are not noise here: `0.5` on a two-place sheet is the same
    // number written in a form a child lining up the points cannot use, and it
    // is what a family that formatted with `toString` would print.
    for (const places of [1, 2, 3]) {
      for (const style of ["standard", "convert"] as const) {
        for (const seed of SEEDS) {
          const over = { places, style, count: 8 };
          const problems = problemsOf(over, seed);
          expect(problems.length, JSON.stringify(over)).toBeGreaterThan(0);
          for (const problem of problems) {
            for (const written of decimalsOn(problem)) {
              expect(placesOf(written), `${written} at ${places}`).toBe(places);
            }
          }
        }
      }
    }
  });

  it("keeps a percentage's answer a whole number", () => {
    // 15% of 80 is 12 and 15% of 81 is 12.15 — a different lesson, and one that
    // belongs on a money sheet. The draw rejects the pairs that don't come out
    // whole rather than rounding them.
    for (const seed of SEEDS) {
      const problems = problemsOf(
        { style: "percent", range: PERCENT_RANGE, count: 10 },
        seed,
      );
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        expect(problem.answer, problem.prompt).toMatch(/^\d+$/);
        expect(holds(sentence(problem)), sentence(problem)).toBe(true);
      }
    }
  });

  it("spreads a page over the percentages rather than over one of them", () => {
    // The other half of "the answer comes out whole", and the half a draw can
    // satisfy while printing nonsense: `p% of n` is whole for some pairs and
    // 100% of *every* number, so a draw that made a pair and then rejected it
    // put the identity on nearly half the page — and "100% of 63" is a question
    // a child answers by copying it out. Counted over forty sheets rather than
    // inside one, because three of a kind on one page is luck and a quarter of
    // every page is a bias.
    const seen = new Map<string, number>();
    let total = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      for (const problem of problemsOf(
        { style: "percent", range: PERCENT_RANGE, count: 12 },
        seed,
      )) {
        const percent = /^(\d+)%/.exec(problem.prompt)?.[1] ?? "";
        seen.set(percent, (seen.get(percent) ?? 0) + 1);
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(400);
    // The identity is not a calculation, so it is not on a sheet of them.
    expect(seen.has("100")).toBe(false);
    // Most of the list, rather than the three that divide a hundred best.
    expect(seen.size).toBeGreaterThan(8);
    for (const [percent, count] of seen) {
      expect(count / total, `${percent}%`).toBeLessThan(0.25);
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

  it("leaves exactly one number that would fit a conversion blank", () => {
    // Searched over the hundredths rather than over the whole numbers, because
    // that is the alphabet the answer is written in: two failures caught at
    // once, an answer that is wrong and a blank more than one would fill.
    for (const places of [1, 2, 3]) {
      const problems = problemsOf({ style: "convert", places, count: 8 }, 5);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const fits = [];
        // Far enough for either alphabet: every percent up to two hundred, and
        // every decimal up to one whole at the places the sheet is set at.
        for (let units = 1; units <= Math.max(200, 10 ** places); units += 1) {
          const candidate = problem.prompt.endsWith("%")
            ? String(units)
            : asDecimal(units, places);
          try {
            if (holds(problem.prompt.replace("_", candidate))) {
              fits.push(candidate);
            }
          } catch {
            /* not a number sentence at all */
          }
        }
        expect(fits, problem.prompt).toEqual([problem.answer]);
      }
    }
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never puts a number outside the range a parent asked for", () => {
    const ASKS = [
      { min: 0, max: 5 },
      { min: 1, max: 20 },
      { min: 10, max: 100 },
    ];
    for (const range of ASKS) {
      for (const operation of ["add", "subtract", "multiply"] as const) {
        const problems = problemsOf({ range, operation, count: 8 }, 9);
        expect(problems.length, JSON.stringify(range)).toBeGreaterThan(0);
        for (const problem of problems) {
          // The numbers a child *sees*, which is what a range promises: an
          // answer may run past the top of it, and that is what carrying is.
          const asked = problem.operands ?? problem.prompt.split(" ");
          for (const word of asked) {
            if (!/^\d+\.\d+$/.test(word)) continue;
            const value = readNumber(word);
            expect(value.n).toBeGreaterThan(0);
            // Cross-multiplied, like every other claim here: `n/d ≥ min` is
            // `n ≥ min·d` with both sides whole, and the divided form would put
            // back the one float this suite exists to keep out.
            expect(value.n).toBeGreaterThanOrEqual(range.min * value.d);
            expect(value.n).toBeLessThanOrEqual(range.max * value.d);
          }
        }
      }
    }
  });

  it("never asks a child to take more away than there is", () => {
    for (const shape of [
      { operation: "subtract" as const },
      { operation: "both" as const },
      { operation: "subtract" as const, form: "vertical" as const },
    ]) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf({ ...shape, count: 12 }, seed)) {
          expect(problem.answer, sentence(problem)).not.toContain("-");
          expect(readNumber(problem.answer).n, sentence(problem)) //
            .toBeGreaterThan(0);
        }
      }
    }
  });

  it("stacks a column sheet and writes a line sheet along the line", () => {
    for (const problem of problemsOf({ form: "vertical", count: 6 }, 2)) {
      expect(problem.operands?.length).toBe(2);
      expect(problem.operator).toBe("+");
      // No second copy of the sum written along a line for the two to disagree
      // about — the stack is the prompt.
      expect(problem.prompt).toBe("");
    }
    for (const problem of problemsOf({ count: 6 }, 2)) {
      expect(problem.operands).toBeUndefined();
      expect(problem.prompt).toMatch(/^\d+\.\d\d \+ \d+\.\d\d =$/);
    }
  });

  it("multiplies by a whole number, so the places stay where they were put", () => {
    // `0.25 × 0.4` is 0.1 and `2.5 × 2.5` is 6.25 — one has fewer places than
    // either number that made it and the other has more. A sheet set at two
    // places whose answers are at four is a sheet nobody chose.
    for (const seed of SEEDS) {
      const problems = problemsOf({ operation: "multiply", count: 8 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        // The second number of the problem, wherever it is written: the stack
        // holds two operands, and the sentence reads `value × by =`.
        const by = problem.operands
          ? problem.operands[1]
          : problem.prompt.split(" ")[2];
        expect(by, problem.prompt).toMatch(/^\d+$/);
        expect(placesOf(problem.answer)).toBe(2);
      }
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map((problem) => sentence(problem));
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // A range of nothing at all: every draw is a value of zero, which is not a
    // question about decimals. An empty sheet is the honest answer, and the
    // builder's job to prevent.
    expect(problemsOf({ range: { min: 0, max: 0 } }, 1)).toEqual([]);
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

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy. Nothing
    // else in this file would notice a refactor that moved where the draw
    // consumes `rand()` — the operation coin spent only when both are asked
    // for, the multiplier drawn instead of a second value — and every seed a
    // parent had already printed would quietly produce a different sheet.
    expect(
      problemsOf({ operation: "both", count: 4 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.both);

    expect(
      problemsOf({ style: "percent", range: PERCENT_RANGE, count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.percent);

    expect(
      problemsOf({ style: "convert", count: 4 }, 7).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.convert);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    for (const shape of EVERY_SHAPE) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 6 }, 100 + offset).map(sentence),
      );
      for (const [one, other] of [
        [a, b],
        [a, c],
        [b, c],
      ]) {
        expect(one).not.toEqual(other);
        const shared = one.filter((asked) => other.includes(asked)).length;
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
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = decimalLayout(config(over));
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
    const { box, row, perPage, columns } = decimalLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 10 }, 1).length).toBe(10);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3, 4]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Four is as many columns as a decimal sheet is laid out in: `13.47 + 8.06`
    // in a column an inch wide is a problem that wraps, and a wrapped problem
    // is a row taller than the layout reserved.
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(4);
  });

  it("reserves more room for a stacked sheet than for a written one", () => {
    // The layout reserves the height and the build attaches the stack, and the
    // two reading the config differently is the bug the whole "declared, not
    // measured" design exists to exclude.
    expect(decimalLayout(config({ form: "vertical" })).row).toBeGreaterThan(
      decimalLayout(config()).row,
    );
    // And a conversion sheet is never stacked, so `form` cannot make its rows
    // taller than the sentences it prints in them.
    expect(decimalLayout(config({ style: "convert", form: "vertical" })).row) //
      .toBe(decimalLayout(config({ style: "convert" })).row);
  });
});

/**
 * What three sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — every one of them is proved right by the
 * assertions above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  both: [
    ["18.63 − 5.57 =", "13.06"],
    ["13.38 − 5.76 =", "7.62"],
    ["8.03 + 6.88 =", "14.91"],
    ["15.09 − 14.63 =", "0.46"],
  ],
  percent: [
    ["5% of 20 =", "1"],
    ["90% of 140 =", "126"],
    ["40% of 85 =", "34"],
    ["40% of 55 =", "22"],
  ],
  convert: [
    ["0.07 = _%", "7"],
    ["13/25 = _", "0.52"],
    ["40% = _", "0.40"],
    ["0.56 = _%", "56"],
  ],
};
