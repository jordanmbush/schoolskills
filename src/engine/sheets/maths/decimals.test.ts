import { describe, expect, it } from "vitest";

import { buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { PROBLEM_GAP, answerLine, numberRoom } from "../layout";
import type {
  DecimalConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { decimalTableau, stoppingDivisors } from "./decimal-division";
import { DECIMALS_SHEET, decimalLayout } from "./decimals";
import { bracketHeight, bracketWidth } from "./long";

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
 *   division is where a float would get in;
 * - the number-sense styles are read the same way: a comparison is
 *   cross-multiplied, an ordering is the printed texts sorted by
 *   cross-multiplication, a rounding is held within half a unit, and a
 *   digit's worth is built from the text with no arithmetic at all.
 *   `decimal-sense.test.ts` holds each of those styles to its own promises.
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
  // The three divisions (§22): along a line and in the bracket, at each help
  // level and each place count, and by one- and two-digit divisors.
  { operation: "divide" },
  { operation: "divide", form: "vertical" },
  { operation: "divide", form: "vertical", help: "grid" },
  { operation: "divide", form: "vertical", help: "guided", places: 1 },
  {
    operation: "divide",
    form: "vertical",
    places: 3,
    range: { min: 0, max: 5 },
    count: 6,
  },
  {
    operation: "divide",
    form: "vertical",
    divisor: { min: 11, max: 25 },
    help: "steps",
  },
  { operation: "divide", by: "decimal" },
  { operation: "divide", by: "decimal", places: 1 },
  { operation: "divide", by: "decimal", places: 3 },
  { operation: "divide", by: "decimal", form: "vertical" },
  { operation: "divide", wholeDividend: true },
  { operation: "divide", wholeDividend: true, form: "vertical", help: "grid" },
  {
    operation: "divide",
    wholeDividend: true,
    places: 1,
    range: { min: 1, max: 20 },
  },
  { operation: "divide", wholeDividend: true, places: 3, form: "vertical" },
  // Decimal × decimal, and the five number-sense styles (§22), at each place
  // count they change shape at.
  { operation: "multiply", by: "decimal" },
  { operation: "multiply", by: "decimal", form: "vertical", places: 1 },
  {
    operation: "multiply",
    by: "decimal",
    places: 3,
    range: { min: 0, max: 5 },
  },
  { style: "powers" },
  { style: "powers", places: 1 },
  { style: "powers", places: 3, range: { min: 0, max: 5 } },
  { style: "compare" },
  { style: "compare", places: 1 },
  { style: "compare", places: 3 },
  { style: "order" },
  { style: "order", places: 1, columns: 1 },
  { style: "order", places: 3 },
  { style: "round" },
  { style: "round", to: "tenth" },
  { style: "round", to: "hundredth", range: { min: 1, max: 9 } },
  { style: "place" },
  { style: "place", places: 1 },
  { style: "place", places: 3, range: { min: 0, max: 99 } },
];

const SEEDS = [0, 1, 2, 7, 4242];

describeSheetFamily("decimals", {
  label: "Decimals and percents",
  spec: DECIMALS_SHEET,
  config,
  shapes: EVERY_SHAPE,
  seeds: SEEDS,
});

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
 * Five shapes reduce to one sentence: a sum along a line, a stack of numbers in
 * column form, a division in the bracket, a blank inside the sentence, and a
 * set with its answer on the line under it, written here with an arrow.
 */
function sentence(problem: Problem): string {
  if (problem.answers) {
    return `${problem.prompt} → ${problem.answer}`;
  }
  if (problem.bracket) {
    const { dividend, divisor } = problem.bracket;
    return `${dividend} ÷ ${divisor} = ${problem.answer}`;
  }
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
  const worked = /^(\S+) ([+−×÷]) (\S+) = (\S+)$/.exec(written.trim());
  if (worked) {
    const [, left, sign, right, answer] = worked;
    // A division is checked backwards — the answer, taken the divisor's
    // number of times, has to rebuild what was divided — because dividing is
    // where a float would get in, and because that is how a child checks one.
    if (sign === "÷") {
      return same(
        OPERATIONS["×"](readNumber(answer), readNumber(right)),
        readNumber(left),
      );
    }
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

  // "3.4 < 3.40": the sign a cross-multiplied comparison gives.
  const compared = /^(\S+) ([<>=]) (\S+)$/.exec(written.trim());
  if (compared && compared[2] !== "=") {
    const [, left, sign, right] = compared;
    const a = readNumber(left);
    const b = readNumber(right);
    return sign === "<" ? a.n * b.d < b.n * a.d : a.n * b.d > b.n * a.d;
  }

  // "3.4, 3.04, 3.5 → 3.04, 3.4, 3.5": the same texts, sorted.
  const ordered = /^(.+) → (.+)$/.exec(written.trim());
  if (ordered) {
    const asked = ordered[1].split(", ");
    const answered = ordered[2].split(", ");
    const sorted = [...asked].sort((a, b) => {
      const x = readNumber(a);
      const y = readNumber(b);
      return x.n * y.d - y.n * x.d;
    });
    return sorted.join(", ") === answered.join(", ");
  }

  // "2.97 ≈ 3.0": within half a unit of the answer's place, cross-multiplied,
  // and up on exactly a half.
  const rounded = /^(\S+) ≈ (\S+)$/.exec(written.trim());
  if (rounded) {
    const value = readNumber(rounded[1]);
    const answer = readNumber(rounded[2]);
    const gap = value.n * answer.d - answer.n * value.d;
    if (2 * Math.abs(gap) > value.d) return false;
    return 2 * Math.abs(gap) < value.d || gap < 0;
  }

  // "What is the 5 in 3.75 worth? 0.05": the worth built from the text alone
  // — the digit and a zero for every column to the units, or `0.` and a zero
  // for every column from the point.
  const place = /^What is the (\d) in (\S+) worth\? (\S+)$/.exec(
    written.trim(),
  );
  if (place) {
    const [, digit, number, answer] = place;
    const at = number.indexOf(digit);
    const point = number.indexOf(".");
    if (number.lastIndexOf(digit) !== at) return false;
    const worth =
      at < point
        ? digit + "0".repeat(point - 1 - at)
        : `0.${"0".repeat(at - point - 1)}${digit}`;
    return answer === worth;
  }

  // A conversion: two ways of writing one number, either of which may be a
  // percent, a fraction or a decimal — and "3.4 = 3.40", which is the same
  // claim.
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
    .split(/[\s=+−×÷<>,→≈?]+/)
    .filter((word) => /^\d+\.\d+$/.test(word));
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the decimals family", () => {
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
    // The three divisions (§22), with the divisor size and the help level in
    // the line because each changes what a saved sheet is.
    expect(describeSheet(config({ operation: "divide" }))).toBe(
      "Dividing decimals — hundredths",
    );
    const inColumns = {
      operation: "divide" as const,
      form: "vertical" as const,
      count: 4,
    };
    expect(describeSheet(config({ ...inColumns, help: "grid" }))).toBe(
      "Dividing decimals — hundredths — in columns — on a grid",
    );
    expect(
      describeSheet(
        config({
          ...inColumns,
          divisor: { min: 11, max: 25 },
          help: "steps",
        }),
      ),
    ).toBe(
      "Dividing decimals — by two-digit numbers — hundredths — in columns — with steps",
    );
    // Never in columns, whatever the form says, so never helped either.
    expect(
      describeSheet(
        config({
          operation: "divide",
          by: "decimal",
          form: "vertical",
          help: "grid",
        }),
      ),
    ).toBe("Dividing by a decimal — hundredths");
    expect(
      describeSheet(
        config({
          ...inColumns,
          wholeDividend: true,
          help: "guided",
          places: 1,
        }),
      ),
    ).toBe("Division with decimal answers — tenths — in columns — guided");
    // Help is only said where there is a bracket to help under.
    expect(describeSheet(config({ operation: "divide", help: "grid" }))).toBe(
      "Dividing decimals — hundredths",
    );
    // A page that will come out short says so in its line too, as far as the
    // line can know without a seed: what the paper holds against what was
    // asked, and a divisor nothing divides by to an answer that stops.
    expect(describeSheet(config({ ...inColumns, count: 12 }))).toBe(
      "Dividing decimals — hundredths — in columns — only 4 of the 12 asked for fit on the page at this size",
    );
    expect(
      describeSheet(
        config({
          operation: "divide",
          wholeDividend: true,
          divisor: { min: 3, max: 3 },
        }),
      ),
    ).toBe(
      "Division with decimal answers — hundredths — dividing by 3 never gives an answer that stops, so there is nothing to print",
    );
  });

  it("reads a saved config's style and operation back safely", () => {
    // Both arrive from outside this build. An unknown style is arithmetic,
    // as it was before the style existed; an unknown operation is addition
    // — and never a title that says one thing over sums that do another, or
    // a prompt with `undefined` for its sign. `toString` is the case a plain
    // lookup gets wrong: it is in every table, as a function.
    for (const style of ["pink", "toString", "constructor"]) {
      const stray = { style: style as unknown as "standard" };
      expect(buildSheet(config(stray), 1).header.title, style).toBe(
        "Adding decimals",
      );
      const problems = problemsOf(stray, 1);
      expect(problems.length, style).toBeGreaterThan(0);
      for (const problem of problems) {
        expect(problem.prompt, style).toMatch(/^\d+\.\d\d \+ \d+\.\d\d =$/);
        expect(holds(sentence(problem)), style).toBe(true);
      }
    }
    for (const operation of ["pink", "toString"]) {
      const stray = { operation: operation as unknown as "add" };
      expect(buildSheet(config(stray), 1).header.title, operation).toBe(
        "Adding decimals",
      );
      expect(describeSheet(config(stray)), operation).toBe(
        "Adding decimals — hundredths",
      );
      for (const problem of problemsOf(stray, 1)) {
        expect(problem.prompt, operation).toContain(" + ");
        expect(holds(sentence(problem)), operation).toBe(true);
      }
      expect(
        buildSheet(config({ ...stray, form: "vertical" }), 1).header
          .instructions,
        operation,
      ).toBe("Work out each answer. Keep the points under one another.");
    }
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Adding decimals");
    // Out of what is on the page, not out of what was asked for.
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
    const titled = (over: Partial<DecimalConfig>) =>
      buildSheet(config(over), 3).header.title;
    expect(titled({ operation: "divide" })).toBe("Dividing decimals");
    expect(titled({ operation: "divide", by: "decimal" })).toBe(
      "Dividing by a decimal",
    );
    expect(titled({ operation: "divide", wholeDividend: true })).toBe(
      "Division with decimal answers",
    );
    // Dividing by a decimal wins: two lessons, not one question with two
    // switches on.
    expect(
      titled({ operation: "divide", by: "decimal", wholeDividend: true }),
    ).toBe("Dividing by a decimal");
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
    // Each division turns on one sentence: where the point goes, or that the
    // sum is rewritten first.
    const told = (over: Partial<DecimalConfig>) =>
      buildSheet(config(over), 1).header.instructions;
    expect(told({ operation: "divide" })).toBe("Work out each answer.");
    expect(told({ operation: "divide", form: "vertical", count: 4 })).toBe(
      "Work out each answer. Put the point in the answer straight above the point in the number.",
    );
    expect(told({ operation: "divide", by: "decimal" })).toBe(
      "Work out each answer. Multiply both numbers by 10, or by 100, until you are dividing by a whole number, then divide.",
    );
    expect(told({ operation: "divide", wholeDividend: true })).toBe(
      "Work out each answer. Keep dividing past the point, writing zeros after it if you need them.",
    );
    expect(
      told({
        operation: "divide",
        wholeDividend: true,
        form: "vertical",
        count: 4,
      }),
    ).toBe(
      "Work out each answer. Keep dividing into the zeros after the point, and put the point in the answer straight above the point in the number.",
    );
  });

  it("says on the page when it came out short, and why when it can", () => {
    // A sheet that printed a title, a score box and nothing under them said
    // nothing about why. The paper is the one place a parent looks, so the
    // instruction line ends with the shortfall — and with the reason, where
    // the family can name it.
    const told = (over: Partial<DecimalConfig>) =>
      buildSheet(config(over), 1).header.instructions;
    // A bracket row taller than the page: every setting here is legal in the
    // builder, and together they reserve more squares than Letter holds.
    const tall = {
      operation: "divide" as const,
      form: "vertical" as const,
      places: 3,
      range: { min: 0, max: 999 },
      divisor: { min: 2, max: 99 },
      help: "grid" as const,
      fontPt: 24,
    };
    expect(decimalLayout(config(tall)).perPage).toBe(0);
    expect(problemsOf(tall, 1)).toEqual([]);
    expect(told(tall)).toMatch(/ Nothing fits on the page at this size\.$/);
    // A divisor with no factor of ten in it has no decimal quotient that
    // stops, and the page says which rather than "nothing could be made".
    const three = {
      operation: "divide" as const,
      wholeDividend: true,
      divisor: { min: 3, max: 3 },
    };
    expect(problemsOf(three, 1)).toEqual([]);
    expect(told(three)).toBe(
      "Work out each answer. Keep dividing past the point, writing zeros after it if you need them. Dividing by 3 never gives an answer that stops, so there is nothing to print.",
    );
    // A range of one value has no set to order and no value to round.
    for (const style of ["order", "round", "compare"] as const) {
      const one = { style, range: { min: 5, max: 5 } };
      expect(problemsOf(one, 1), style).toEqual([]);
      expect(told(one), style).toMatch(
        / Nothing could be made with these settings\.$/,
      );
    }
    // Fewer than were asked for: the count and the ask, on the page, and the
    // sheet marked out of what is on it.
    expect(told({ operation: "divide", form: "vertical" })).toBe(
      "Work out each answer. Put the point in the answer straight above the point in the number. Only 4 of the 12 asked for fit on the page at this size.",
    );
    expect(
      buildSheet(config({ operation: "divide", form: "vertical" }), 1).header
        .score?.outOf,
    ).toBe(4);
    // On the end of a parent's own instruction line as well as the family's.
    expect(told({ ...three, instructions: "Do these." })).toBe(
      "Do these. Dividing by 3 never gives an answer that stops, so there is nothing to print.",
    );
    // And a page that fits what it was asked for says nothing.
    expect(told({ operation: "divide", form: "vertical", count: 4 })).toBe(
      "Work out each answer. Put the point in the answer straight above the point in the number.",
    );
    // The sentence is part of the printed header, and the header is what the
    // page was laid out under — so the problems fit beneath it whatever row
    // the sentence took, at every type size.
    for (const fontPt of [12, 24, 36]) {
      const over = { form: "vertical" as const, fontPt, count: 200 };
      const sheet = buildSheet(config(over), 3);
      const block = sheet.blocks[0];
      if (block.kind !== "problems") throw new Error("no problems");
      const { row } = decimalLayout(config(over));
      const rows = Math.ceil(block.items.length / block.columns);
      expect(
        rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y,
        `${fontPt}pt`,
      ).toBeLessThanOrEqual(printedBlockBox(sheet).height);
      expect(sheet.header.instructions, `${fontPt}pt`).toMatch(
        /Only \d+ of the 200 asked for fit on the page at this size\.$/,
      );
    }
  });
});

/* ── Division (§22) ────────────────────────────────────────────────────── */

describe("division", () => {
  const DIVISIONS = EVERY_SHAPE.filter((shape) => shape.operation === "divide");

  /** What was divided, by what, and the answer — read off the paper. */
  function readDivision(problem: Problem): {
    dividend: string;
    divisor: string;
    answer: string;
  } {
    const match = /^(\S+) ÷ (\S+) = (\S+)$/.exec(sentence(problem));
    if (!match) throw new Error(`not a division: "${sentence(problem)}"`);
    return { dividend: match[1], divisor: match[2], answer: match[3] };
  }

  it("rebuilds every dividend from the answer and the divisor, in units", () => {
    // Answer × divisor = dividend, cross-multiplied over the powers of ten each
    // was read back as — whole numbers throughout, and never a division, so a
    // float has nowhere to get in and a misplaced point cannot pass.
    for (const shape of DIVISIONS) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const { dividend, divisor, answer } = readDivision(problem);
          const a = readNumber(answer);
          const d = readNumber(divisor);
          const n = readNumber(dividend);
          expect(a.n * d.n * n.d, sentence(problem)).toBe(n.n * a.d * d.d);
        }
      }
    }
  });

  it("keeps a whole-number divisor inside its span, and the answer at the sheet's places", () => {
    for (const shape of DIVISIONS) {
      if (shape.by === "decimal") continue;
      const places = shape.places ?? 2;
      const span = shape.divisor ?? { min: 2, max: 9 };
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          const { divisor, answer } = readDivision(problem);
          expect(divisor, sentence(problem)).toMatch(/^\d+$/);
          expect(Number(divisor)).toBeGreaterThanOrEqual(span.min);
          expect(Number(divisor)).toBeLessThanOrEqual(span.max);
          expect(placesOf(answer), sentence(problem)).toBe(places);
        }
      }
    }
  });

  it("sets a column division in the bracket, with the point carried in the dividend", () => {
    for (const shape of DIVISIONS) {
      const bracketed = shape.form === "vertical" && shape.by !== "decimal";
      const where = JSON.stringify(shape);
      for (const problem of SEEDS.flatMap((seed) => problemsOf(shape, seed))) {
        expect(problem.bracket !== undefined, where).toBe(bracketed);
        expect(problem.operands, where).toBeUndefined();
        if (!problem.bracket) {
          expect(problem.prompt, where).toMatch(/^\S+ ÷ \S+ =$/);
          continue;
        }
        // The bracket is the prompt, and its squares are the working space.
        expect(problem.prompt).toBe("");
        expect(problem.workspace).toBeUndefined();
        const { dividend, tableau } = problem.bracket;
        expect(dividend, where).toMatch(/^\d+\.\d+$/);
        expect(problem.bracket.cell).toBe(answerLine(config(shape).fontPt));
        expect(problem.bracket.help).toBe(shape.help ?? "none");
        if (!tableau) throw new Error("no tableau");
        expect(tableau.remainder).toBe(0);
        expect(tableau.rows.length).toBeLessThanOrEqual(problem.bracket.rows);
        // Two paths to one answer: `fixedText` of the quotient that was drawn,
        // and the tableau walked over the dividend's digits with the point put
        // back where the dividend's is. They have to agree, and the quotient
        // has to reach the units column so a value under one keeps its zero.
        const point = dividend.indexOf(".");
        const { text, start } = tableau.quotient;
        expect(start + text.length).toBe(dividend.length - 1);
        expect(start).toBeLessThanOrEqual(point - 1);
        const at = point - start;
        expect(`${text.slice(0, at)}.${text.slice(at)}`, where).toBe(
          problem.answer,
        );
      }
    }
  });

  it("writes a quotient below one with its leading zero", () => {
    // 0.69 ÷ 3: the tableau starts at the tenths column, and the family pads
    // it back to the units column so the key reads 0.23 and never .23.
    const padded = decimalTableau("0.69", 3);
    expect(padded.quotient).toEqual({ text: "023", start: 0 });
    expect(decimalTableau("0.06", 3).quotient).toEqual({
      text: "002",
      start: 0,
    });
    // Nothing to pad when the quotient already reaches the units column, and
    // no point at all is no padding at all.
    expect(decimalTableau("8.46", 3).quotient).toEqual({
      text: "282",
      start: 0,
    });
    expect(decimalTableau("12.5", 5).quotient).toEqual({
      text: "25",
      start: 1,
    });
    expect(decimalTableau("105", 7).quotient).toEqual({ text: "15", start: 1 });
    // The rows are the digits' own: the working never sees a point, so 0.69
    // ÷ 3 is worked as 069 ÷ 3 — nothing over the nought, then 6, then 9.
    expect(padded.rows).toEqual([
      { role: "take", text: "6", end: 1 },
      { role: "left", text: "09", end: 2 },
      { role: "take", text: "9", end: 2 },
      { role: "left", text: "0", end: 2 },
    ]);
    // And it happens on a sheet, not only by hand.
    let found = 0;
    for (let seed = 0; seed < 20; seed += 1) {
      const over = {
        operation: "divide" as const,
        form: "vertical" as const,
        range: { min: 0, max: 1 },
      };
      for (const problem of problemsOf(over, seed)) {
        if (!problem.answer.startsWith("0.")) continue;
        found += 1;
        expect(problem.bracket?.tableau?.quotient.start).toBe(0);
        expect(problem.bracket?.tableau?.quotient.text.startsWith("0")).toBe(
          true,
        );
      }
    }
    expect(found).toBeGreaterThan(0);
  });

  it("annexes exactly the sheet's places of zeros to a whole dividend, in the bracket only", () => {
    for (const places of [1, 2, 3]) {
      const over = {
        operation: "divide" as const,
        wholeDividend: true,
        places,
        range: { min: 1, max: 20 },
      };
      for (const seed of SEEDS) {
        const columns = problemsOf({ ...over, form: "vertical" }, seed);
        expect(columns.length).toBeGreaterThan(0);
        for (const problem of columns) {
          expect(problem.bracket?.dividend).toMatch(
            new RegExp(`^[1-9]\\d*\\.0{${places}}$`),
          );
          // Past the point, by construction: a whole answer is a remainder
          // sheet's, and this sheet promises otherwise.
          expect(readNumber(problem.answer).n % 10 ** places).not.toBe(0);
          expect(placesOf(problem.answer)).toBe(places);
          expect(holds(sentence(problem)), sentence(problem)).toBe(true);
        }
        const lines = problemsOf(over, seed);
        expect(lines.length).toBeGreaterThan(0);
        for (const problem of lines) {
          expect(problem.prompt).toMatch(/^[1-9]\d* ÷ \d+ =$/);
          expect(holds(sentence(problem)), sentence(problem)).toBe(true);
        }
      }
    }
  });

  it("spreads a whole-dividend page over the divisors that can stop, and leaves out the rest", () => {
    // 3, 7 and 9 have no decimal quotient that ends; 2, 4, 5, 6 and 8 do, and
    // a rejecting draw would have printed 5 four times as often as 2.
    const seen = new Map<string, number>();
    let total = 0;
    for (let seed = 0; seed < 40; seed += 1) {
      const over = {
        operation: "divide" as const,
        wholeDividend: true,
        range: { min: 1, max: 20 },
      };
      for (const problem of problemsOf(over, seed)) {
        const { divisor } = readDivision(problem);
        seen.set(divisor, (seen.get(divisor) ?? 0) + 1);
        total += 1;
      }
    }
    expect(total).toBeGreaterThan(300);
    expect([...seen.keys()].sort()).toEqual(["2", "4", "5", "6", "8"]);
    for (const [divisor, count] of seen) {
      expect(count / total, divisor).toBeLessThan(0.35);
    }
  });

  it("divides by a decimal of one to `places` places, with the dividend carrying at least as many", () => {
    for (const places of [1, 2, 3]) {
      for (const seed of SEEDS) {
        const over = {
          operation: "divide" as const,
          by: "decimal" as const,
          places,
          range: { min: 1, max: 40 },
        };
        const problems = problemsOf(over, seed);
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          const { dividend, divisor, answer } = readDivision(problem);
          // Neither side ends in a zero, and the divisor is a decimal.
          expect(divisor, sentence(problem)).toMatch(/^\d+\.\d*[1-9]$/);
          expect(placesOf(divisor)).toBeLessThanOrEqual(places);
          expect(dividend, sentence(problem)).toMatch(/^\d+\.\d*[1-9]$/);
          expect(placesOf(dividend)).toBeGreaterThanOrEqual(placesOf(divisor));
          expect(placesOf(dividend)).toBeLessThanOrEqual(places);
          // The answer is the whole quotient with its point moved back by the
          // difference, and a number is never divided by itself.
          expect(placesOf(answer)).toBe(placesOf(dividend) - placesOf(divisor));
          expect(answer).not.toBe("1");
          expect(holds(sentence(problem)), sentence(problem)).toBe(true);
          expect(problem.bracket).toBeUndefined();
        }
      }
    }
    // Never in the bracket, whatever the form says (§22).
    const asked = { operation: "divide" as const, by: "decimal" as const };
    for (const problem of problemsOf({ ...asked, form: "vertical" }, 2)) {
      expect(problem.bracket).toBeUndefined();
      expect(problem.operands).toBeUndefined();
      expect(problem.prompt).toContain("÷");
    }
    expect(decimalLayout(config({ ...asked, form: "vertical" })).row).toBe(
      decimalLayout(config(asked)).row,
    );
  });

  it("reserves the squares under a bracket from the range and the divisors, before anything is drawn", () => {
    for (const shape of DIVISIONS) {
      if (!(shape.form === "vertical" && shape.by !== "decimal")) continue;
      const layout = decimalLayout(config(shape));
      const problems = problemsOf(shape, 5);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) {
        const bracket = problem.bracket;
        if (!bracket) throw new Error("no bracket");
        expect(layout.row).toBe(
          bracketHeight(12) + bracket.rows * bracket.cell,
        );
      }
    }
    // Taller for a bigger range, because the dividends get longer. The same
    // for a bigger divisor: the dividend gains a digit and the quotient loses
    // one, and the squares are two per quotient digit.
    const divided = { operation: "divide" as const, form: "vertical" as const };
    const small = decimalLayout(
      config({ ...divided, range: { min: 0, max: 9 } }),
    );
    const large = decimalLayout(
      config({ ...divided, range: { min: 0, max: 99 } }),
    );
    expect(large.row).toBeGreaterThan(small.row);
    const two = decimalLayout(
      config({
        ...divided,
        range: { min: 0, max: 9 },
        divisor: { min: 11, max: 25 },
      }),
    );
    expect(two.row).toBe(small.row);
  });

  it("reads a saved config's division fields back safely", () => {
    const divided = {
      operation: "divide" as const,
      form: "vertical" as const,
      count: 4,
    };
    for (const help of ["none", "grid", "steps", "guided"] as const) {
      for (const problem of problemsOf({ ...divided, help }, 5)) {
        expect(problem.bracket?.help).toBe(help);
      }
    }
    const stray = { ...divided, help: "pink" as unknown as "grid" };
    for (const problem of problemsOf(stray, 5)) {
      expect(problem.bracket?.help).toBe("none");
    }
    // The level changes nothing about which problems are drawn.
    expect(
      problemsOf({ ...divided, help: "guided" }, 5).map((p) => p.answer),
    ).toEqual(problemsOf(divided, 5).map((p) => p.answer));
    // A divisor span from outside this build is clamped to 2…99 and put the
    // right way round rather than thrown.
    for (const problem of problemsOf(
      { ...divided, divisor: { min: 0, max: 1 } },
      5,
    )) {
      expect(problem.bracket?.divisor).toBe("2");
    }
    for (const problem of problemsOf(
      { operation: "divide", divisor: { min: 500, max: 9 } },
      5,
    )) {
      expect(readDivision(problem).divisor).toBe("99");
    }
    // A span that is not numbers at all — from a hand-edited link — is the
    // smallest divisor rather than a page of `NaN.NaN ÷ NaN`.
    for (const divisor of [{ min: "abc" }, "abc", { min: null, max: [] }]) {
      const stray = { operation: "divide" as const, divisor: divisor as never };
      const problems = problemsOf(stray, 5);
      expect(problems.length, JSON.stringify(divisor)).toBeGreaterThan(0);
      for (const problem of problems) {
        expect(readDivision(problem).divisor).toBe("2");
        expect(holds(sentence(problem)), sentence(problem)).toBe(true);
      }
    }
  });

  it("prints nothing rather than a rounded answer when no divisor can stop", () => {
    // 3 has no decimal quotient that ends, at any number of places.
    expect(
      problemsOf(
        {
          operation: "divide",
          wholeDividend: true,
          divisor: { min: 3, max: 3 },
        },
        1,
      ),
    ).toEqual([]);
    // The divisors that can: the ones sharing a factor with ten, whatever the
    // places, and none at all in a span of one odd number off the fives.
    expect(stoppingDivisors(config({ operation: "divide" }))).toEqual([
      2, 4, 5, 6, 8,
    ]);
    expect(stoppingDivisors(config({ operation: "divide", places: 1 }))) //
      .toEqual([2, 4, 5, 6, 8]);
    expect(
      stoppingDivisors(
        config({ operation: "divide", divisor: { min: 11, max: 25 } }),
      ),
    ).toEqual([12, 14, 15, 16, 18, 20, 22, 24, 25]);
    for (const alone of [3, 7, 9, 21]) {
      expect(
        stoppingDivisors(
          config({ operation: "divide", divisor: { min: alone, max: alone } }),
        ),
        `${alone}`,
      ).toEqual([]);
    }
  });

  it("never ends a decimal's quotient in a zero, and lets a whole dividend's", () => {
    // `20.50 ÷ 5 = 4.10` is `20.5 ÷ 5` written to two places — an exercise
    // nobody sets, with a tableau of nothing rows — so a quotient ending in
    // a zero is thrown away when the dividend is a decimal. A whole dividend
    // keeps one: `6 ÷ 4` at two places is `1.50`, the last annexed zero
    // divided into and found empty, which is part of that lesson (§22).
    for (const shape of DIVISIONS) {
      if (shape.by === "decimal" || shape.wholeDividend) continue;
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          expect(problem.answer, sentence(problem)).toMatch(/[1-9]$/);
        }
      }
    }
    const whole = SEEDS.flatMap((seed) =>
      problemsOf({ operation: "divide", wholeDividend: true }, seed),
    );
    expect(whole.some((problem) => problem.answer.endsWith("0"))).toBe(true);
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
      // A decimal times a decimal has as many places as the two together,
      // and that is the one shape whose answers run past three.
      const most =
        shape.operation === "multiply" && shape.by === "decimal"
          ? 2 * (shape.places ?? 2)
          : 3;
      const decimal = new RegExp(`^\\d+\\.\\d{1,${most}}$`);
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const word of sentence(problem).split(/[\s=+−×÷<>,→≈?]+/)) {
            if (word.includes(".")) {
              expect(word, JSON.stringify(shape)).toMatch(decimal);
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

    expect(
      problemsOf({ operation: "divide", count: 4 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.divide);
    expect(
      problemsOf({ operation: "divide", by: "decimal", count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.byDecimal);
    expect(
      problemsOf({ operation: "divide", wholeDividend: true, count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.wholeDividend);
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
    // Against the box the printed header leaves — which carries the sentence
    // that says the page came out short, and may be a row shorter for it —
    // rather than the config's.
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [8, 12, 18, 24, 36]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const where = `${size}/${margin}/${fontPt}pt ${JSON.stringify(shape)}`;
            const sheet = buildSheet(config({ ...over, count: 200 }), 8);
            const block = sheet.blocks[0];
            if (block.kind !== "problems")
              throw new Error(`${where}: no block`);
            const { row, perPage } = decimalLayout(config(over));
            const rows = Math.ceil(block.items.length / block.columns);
            const used = rows * row + Math.max(0, rows - 1) * PROBLEM_GAP.y;
            expect(used, where).toBeLessThanOrEqual(
              printedBlockBox(sheet).height,
            );
            // A bracket that reserves more than the box at the largest type
            // holds nothing, and says so, rather than printing a title over
            // blank paper.
            if (perPage === 0) {
              expect(block.items, where).toEqual([]);
              expect(sheet.header.instructions, where).toMatch(
                /Nothing fits on the page at this size\.$/,
              );
            }
          }
        }
      }
    }
  });

  it("cuts the columns to the widest bracket, at every type size", () => {
    // A bracket is a fixed drawing in squares and does not wrap to its
    // column: three places, a range to 999 and a two-digit divisor is an
    // eight-digit dividend, which at four columns on Letter is wider than
    // the column at any size. Read off the printed problem, with the number
    // in front, against the column the layout gave it.
    const SHAPES: Array<Partial<DecimalConfig>> = [
      { operation: "divide", form: "vertical" },
      { operation: "divide", form: "vertical", places: 3 },
      {
        operation: "divide",
        form: "vertical",
        places: 3,
        range: { min: 0, max: 999 },
        divisor: { min: 2, max: 99 },
      },
      { operation: "divide", form: "vertical", wholeDividend: true },
    ];
    for (const shape of SHAPES) {
      for (const fontPt of [8, 12, 18, 24, 36]) {
        for (const columns of [1, 2, 3, 4]) {
          const over = { ...shape, fontPt, columns, count: 200 };
          const where = `${JSON.stringify(shape)} ${fontPt}pt ${columns} columns`;
          const { cell } = decimalLayout(config(over));
          for (const problem of problemsOf(over, 8)) {
            const bracket = problem.bracket;
            if (!bracket) throw new Error(`${where}: no bracket`);
            const digits = {
              into: bracket.dividend.replace(".", "").length,
              by: bracket.divisor.length,
            };
            expect(
              bracketWidth(digits, fontPt) + numberRoom(fontPt),
              `${where}: ${bracket.dividend} ÷ ${bracket.divisor}`,
            ).toBeLessThanOrEqual(cell);
          }
        }
      }
    }
    // Cut only where it has to be: the plainest sheet keeps its columns at
    // the body size, and the widest bracket at the largest type gets one.
    const columnsOf = (over: Partial<DecimalConfig>) =>
      decimalLayout(config(over)).columns;
    expect(columnsOf({ ...SHAPES[0], columns: 3 })).toBe(3);
    expect(columnsOf({ ...SHAPES[2], columns: 4, fontPt: 36 })).toBe(1);
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
  divide: [
    ["43.72 ÷ 4 =", "10.93"],
    ["111.78 ÷ 6 =", "18.63"],
    ["53.52 ÷ 4 =", "13.38"],
    ["25.95 ÷ 5 =", "5.19"],
  ],
  byDecimal: [
    ["5.5 ÷ 0.5 =", "11"],
    ["8.4 ÷ 0.7 =", "12"],
    ["9.6 ÷ 0.6 =", "16"],
    ["0.36 ÷ 0.6 =", "0.6"],
  ],
  wholeDividend: [
    ["3 ÷ 2 =", "1.50"],
    ["41 ÷ 5 =", "8.20"],
    ["24 ÷ 5 =", "4.80"],
    ["73 ÷ 5 =", "14.60"],
  ],
};
