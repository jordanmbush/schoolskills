import { describe, expect, it } from "vitest";

import { buildSheet, describeSheet } from "../index";
import { answerLine } from "../layout";
import type { DecimalConfig, Paper, Problem } from "../types";

import { decimalLayout } from "./decimals";
import { compareFixed, shifted, timesFixed } from "./exact";

/**
 * The number-sense styles and decimal × decimal, held to what each promises
 * (§22). `decimals.test.ts` sweeps every shape for the family's contract and
 * checks every key; this file is the promises no sweep would notice — that
 * the trap pairs are on the page, that a rounding carries through a 9, that
 * the digit named is the one meant.
 *
 * As there, nothing checks the generator against the generator: a number is
 * read back off the printed text as a whole number over a power of ten, and
 * every claim is cross-multiplied rather than divided.
 */

const paper: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

const config = (over: Partial<DecimalConfig> = {}): DecimalConfig => ({
  kind: "decimals",
  paper,
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

const SEEDS = [0, 1, 2, 7, 4242];

function problemsOf(over: Partial<DecimalConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/** Every problem of a shape over every seed, with the shape named for a failure. */
function sweep(over: Partial<DecimalConfig>): Array<[Problem, string]> {
  return SEEDS.flatMap((seed) =>
    problemsOf(over, seed).map((problem): [Problem, string] => [
      problem,
      `${JSON.stringify(over)} seed ${seed}: ${problem.prompt} ${problem.answer}`,
    ]),
  );
}

type Value = { n: number; d: number };

/** A number as printed, as a whole number over a power of ten. Never parsed. */
function readNumber(text: string): Value {
  const point = /^(\d+)\.(\d+)$/.exec(text.trim());
  if (point)
    return { n: Number(point[1] + point[2]), d: 10 ** point[2].length };
  const whole = /^(\d+)$/.exec(text.trim());
  if (whole) return { n: Number(whole[1]), d: 1 };
  throw new Error(`not a decimal: "${text}"`);
}

const placesOf = (text: string): number => (text.split(".")[1] ?? "").length;

/** Negative, zero or positive, by cross-multiplication. */
const order = (a: Value, b: Value): number => a.n * b.d - b.n * a.d;

/* ── Multiplying and dividing by 10, 100 and 1000 ───────────────────────── */

describe("multiplying and dividing by 10, 100 and 1000", () => {
  const SHAPES: Array<Partial<DecimalConfig>> = [
    { style: "powers" },
    { style: "powers", places: 1 },
    { style: "powers", places: 3, range: { min: 0, max: 5 } },
  ];

  function read(problem: Problem) {
    const match = /^(\S+) ([×÷]) (\d+) =$/.exec(problem.prompt);
    if (!match) throw new Error(`not a power: "${problem.prompt}"`);
    return { value: match[1], sign: match[2], by: Number(match[3]) };
  }

  it("moves the digits and nothing else", () => {
    // The lesson, as a check: the answer's digits are the value's digits, once
    // the point and the zeros at either end are taken away.
    const digits = (text: string) =>
      text.replace(".", "").replace(/^0+|0+$/g, "");
    for (const shape of SHAPES) {
      for (const [problem, where] of sweep(shape)) {
        const { value, sign, by } = read(problem);
        expect([10, 100, 1000], where).toContain(by);
        expect(digits(problem.answer), where).toBe(digits(value));
        // And the size is right: cross-multiplied, never divided.
        const v = readNumber(value);
        const a = readNumber(problem.answer);
        if (sign === "×") expect(a.n * v.d, where).toBe(v.n * by * a.d);
        else expect(a.n * v.d * by, where).toBe(v.n * a.d);
        expect(placesOf(problem.answer), where).toBeLessThanOrEqual(3);
      }
    }
  });

  it("asks about whole numbers as well as decimals, in both directions", () => {
    const problems = SEEDS.flatMap((seed) =>
      problemsOf({ style: "powers", count: 20 }, seed),
    );
    const wholes = problems.filter((p) => !read(p).value.includes("."));
    expect(wholes.length).toBeGreaterThan(problems.length / 6);
    expect(wholes.length).toBeLessThan(problems.length / 2);
    expect(problems.some((p) => read(p).sign === "÷")).toBe(true);
    expect(problems.some((p) => read(p).sign === "×")).toBe(true);
    // Never a value ending in a zero: `37.0` is a fair answer with an unfair
    // look about it.
    for (const problem of problems) {
      expect(read(problem).value, problem.prompt).toMatch(/[1-9]$/);
    }
  });

  it("shifts exactly, in `exact.ts`", () => {
    expect(shifted({ units: 37, places: 1 }, 2)).toEqual({
      units: 370,
      places: 0,
    });
    expect(shifted({ units: 375, places: 2 }, 1)).toEqual({
      units: 375,
      places: 1,
    });
    expect(shifted({ units: 48, places: 0 }, -3)).toEqual({
      units: 48,
      places: 3,
    });
    expect(shifted({ units: 37, places: 1 }, -1)).toEqual({
      units: 37,
      places: 2,
    });
    expect(shifted({ units: 5, places: 0 }, 0)).toEqual({
      units: 5,
      places: 0,
    });
  });
});

/* ── Comparing ─────────────────────────────────────────────────────────── */

describe("comparing decimals", () => {
  function read(problem: Problem) {
    const match = /^(\S+) _ (\S+)$/.exec(problem.prompt);
    if (!match) throw new Error(`not a comparison: "${problem.prompt}"`);
    return {
      left: readNumber(match[1]),
      right: readNumber(match[2]),
      texts: [match[1], match[2]],
    };
  }

  it("writes the sign a whole-number comparison of the scaled units gives", () => {
    for (const shape of [
      { style: "compare" as const },
      { style: "compare" as const, places: 1 },
      { style: "compare" as const, places: 3 },
    ]) {
      for (const [problem, where] of sweep(shape)) {
        const { left, right } = read(problem);
        const expected = order(left, right);
        const sign = expected < 0 ? "<" : expected > 0 ? ">" : "=";
        expect(problem.answer, where).toBe(sign);
        // Every value on the page has one to `places` places and sits in the
        // range.
        for (const text of read(problem).texts) {
          expect(placesOf(text), where).toBeGreaterThanOrEqual(1);
          expect(placesOf(text), where).toBeLessThanOrEqual(shape.places ?? 2);
          const value = readNumber(text);
          expect(value.n, where).toBeLessThanOrEqual(20 * value.d);
        }
      }
    }
  });

  it("sets the traps: trailing zeros, and a longer number that is smaller", () => {
    const problems = SEEDS.flatMap((seed) =>
      problemsOf({ style: "compare", count: 20 }, seed),
    );
    const equal = problems.filter((p) => p.answer === "=");
    // Every equal pair is the same digits with zeros on the end of one side.
    for (const problem of equal) {
      const [a, b] = read(problem).texts;
      const [short, long] = a.length < b.length ? [a, b] : [b, a];
      expect(long.startsWith(short), problem.prompt).toBe(true);
      expect(long.slice(short.length), problem.prompt).toMatch(/^0+$/);
    }
    expect(equal.length).toBeGreaterThan(problems.length / 8);
    expect(equal.length).toBeLessThan(problems.length / 2);
    // Among the pairs with different place counts, the longer one is bigger
    // sometimes and smaller sometimes — both wrong rules get caught.
    const mixed = problems.filter((p) => {
      const [a, b] = read(p).texts;
      return placesOf(a) !== placesOf(b) && p.answer !== "=";
    });
    expect(mixed.length).toBeGreaterThan(problems.length / 4);
    const longerWins = mixed.filter((p) => {
      const [a, b] = read(p).texts;
      const longer = placesOf(a) > placesOf(b) ? "left" : "right";
      return (p.answer === ">") === (longer === "left");
    });
    expect(longerWins.length).toBeGreaterThan(mixed.length / 5);
    expect(longerWins.length).toBeLessThan((mixed.length * 4) / 5);
  });

  it("has no equal pair to set on a tenths sheet", () => {
    for (const [problem, where] of sweep({ style: "compare", places: 1 })) {
      expect(problem.answer, where).not.toBe("=");
    }
  });

  it("compares exactly, in `exact.ts`", () => {
    expect(
      compareFixed({ units: 34, places: 1 }, { units: 340, places: 2 }),
    ).toBe(0);
    expect(
      compareFixed({ units: 5, places: 1 }, { units: 45, places: 2 }),
    ).toBeGreaterThan(0);
    expect(
      compareFixed({ units: 5, places: 1 }, { units: 55, places: 2 }),
    ).toBeLessThan(0);
  });
});

/* ── Ordering ──────────────────────────────────────────────────────────── */

describe("ordering decimals", () => {
  const list = (text: string) => text.split(", ").map((t) => t.trim());

  it("answers with the set sorted, on one ruled line", () => {
    for (const shape of [
      { style: "order" as const },
      { style: "order" as const, places: 1 },
      { style: "order" as const, places: 3 },
    ]) {
      for (const [problem, where] of sweep(shape)) {
        const asked = list(problem.prompt);
        expect(asked.length, where).toBeGreaterThanOrEqual(4);
        expect(asked.length, where).toBeLessThanOrEqual(5);
        // The answer is the same numbers — the same texts — sorted by a
        // cross-multiplied comparison, and the question was not already.
        const sorted = [...asked].sort((a, b) =>
          order(readNumber(a), readNumber(b)),
        );
        expect(problem.answer, where).toBe(sorted.join(", "));
        expect(problem.answers, where).toEqual([problem.answer]);
        expect(asked, where).not.toEqual(sorted);
        // No two the same — 3.4 and 3.40 cannot be put in order.
        for (let i = 0; i < asked.length; i += 1) {
          for (let j = i + 1; j < asked.length; j += 1) {
            expect(
              order(readNumber(asked[i]), readNumber(asked[j])),
              where,
            ).not.toBe(0);
          }
        }
        // The line's height is the reservation `Ruled` divides.
        expect(problem.workspace, where).toBe(answerLine(12));
      }
    }
  });

  it("mixes place counts inside a set, at two places or more", () => {
    const problems = SEEDS.flatMap((seed) =>
      problemsOf({ style: "order" }, seed),
    );
    const mixed = problems.filter(
      (p) => new Set(list(p.prompt).map(placesOf)).size > 1,
    );
    expect(mixed.length).toBeGreaterThan(problems.length / 2);
    for (const [problem, where] of sweep({ style: "order", places: 1 })) {
      expect(new Set(list(problem.prompt).map(placesOf)), where).toEqual(
        new Set([1]),
      );
    }
  });

  it("cuts the columns to what the answer line can hold", () => {
    // Two at most, and one when the longest line would not fit the column:
    // the line cannot wrap, so a column too narrow for it clips the key.
    expect(decimalLayout(config({ style: "order", columns: 4 })).columns).toBe(
      2,
    );
    expect(
      decimalLayout(
        config({ style: "order", columns: 2, fontPt: 18, places: 3 }),
      ).columns,
    ).toBe(1);
    expect(decimalLayout(config({ style: "order", columns: 1 })).columns).toBe(
      1,
    );
    // And the row is the sentence plus the ruled line under it.
    expect(decimalLayout(config({ style: "order" })).row).toBeGreaterThan(
      decimalLayout(config({ style: "compare" })).row,
    );
    // The work-space switch changes nothing: the line is the working space.
    expect(decimalLayout(config({ style: "order", workspace: true })).row).toBe(
      decimalLayout(config({ style: "order" })).row,
    );
    for (const problem of problemsOf({ style: "order", workspace: true }, 1)) {
      expect(problem.workspace).toBe(answerLine(12));
    }
  });
});

/* ── Rounding ──────────────────────────────────────────────────────────── */

describe("rounding decimals", () => {
  const TARGETS = { whole: 0, tenth: 1, hundredth: 2 } as const;

  function read(problem: Problem) {
    const match = /^(\S+) ≈$/.exec(problem.prompt);
    if (!match) throw new Error(`not a rounding: "${problem.prompt}"`);
    return match[1];
  }

  it("rounds to within half a unit of the target place, and up on a half", () => {
    for (const to of ["whole", "tenth", "hundredth"] as const) {
      const target = TARGETS[to];
      for (const [problem, where] of sweep({ style: "round", to })) {
        const text = read(problem);
        // One place more than the target, and a digit there to round on.
        expect(placesOf(text), where).toBe(target + 1);
        expect(text, where).toMatch(/[1-9]$/);
        expect(placesOf(problem.answer), where).toBe(target);
        const value = readNumber(text);
        const answer = readNumber(problem.answer);
        // |value − answer| ≤ half a unit of the answer's place, cross-multiplied:
        // 2·|v.n·a.d − a.n·v.d| ≤ v.d, and on exactly a half the answer is
        // the larger.
        const gap = value.n * answer.d - answer.n * value.d;
        expect(2 * Math.abs(gap), where).toBeLessThanOrEqual(value.d);
        if (2 * Math.abs(gap) === value.d) expect(gap, where).toBeLessThan(0);
      }
    }
  });

  it("includes values that round up through a 9", () => {
    for (const to of ["whole", "tenth", "hundredth"] as const) {
      const problems = SEEDS.flatMap((seed) =>
        problemsOf({ style: "round", to, count: 20 }, seed),
      );
      const carried = problems.filter((p) =>
        /9[5-9]$/.test(read(p).replace(".", "")),
      );
      expect(carried.length, to).toBeGreaterThan(problems.length / 10);
    }
    // 2.97 to the nearest tenth is 3.0, with the zero that says "tenths".
    const found = SEEDS.flatMap((seed) =>
      problemsOf(
        { style: "round", to: "tenth", range: { min: 2, max: 3 } },
        seed,
      ),
    ).find((p) => read(p) === "2.97");
    expect(found?.answer).toBe("3.0");
  });

  it("reads a saved config's target back safely", () => {
    const stray = { style: "round" as const, to: "pink" as unknown as "whole" };
    for (const [problem, where] of sweep(stray)) {
      expect(placesOf(read(problem)), where).toBe(1);
      expect(placesOf(problem.answer), where).toBe(0);
    }
    expect(describeSheet(config(stray))).toBe(
      "Rounding decimals — to the nearest whole number",
    );
  });
});

/* ── Place value ───────────────────────────────────────────────────────── */

describe("decimal place value", () => {
  function read(problem: Problem) {
    const match = /^What is the (\d) in (\S+) worth\?$/.exec(problem.prompt);
    if (!match) throw new Error(`not a place question: "${problem.prompt}"`);
    return { digit: match[1], number: match[2] };
  }

  /**
   * What the digit is worth, built from the text alone: the digit followed by
   * a zero for every column between it and the units, or `0.` and a zero for
   * every column between the point and it.
   */
  function worthOf(digit: string, number: string): string {
    const at = number.indexOf(digit);
    const point = number.indexOf(".");
    if (at < point) return digit + "0".repeat(point - 1 - at);
    return `0.${"0".repeat(at - point - 1)}${digit}`;
  }

  it("names a digit that appears once, and answers with its column's worth", () => {
    for (const shape of [
      { style: "place" as const },
      { style: "place" as const, places: 1 },
      { style: "place" as const, places: 3, range: { min: 0, max: 99 } },
    ]) {
      for (const [problem, where] of sweep(shape)) {
        const { digit, number } = read(problem);
        expect(digit, where).not.toBe("0");
        expect(number.split(digit).length, where).toBe(2);
        expect(placesOf(number), where).toBe(shape.places ?? 2);
        expect(problem.answer, where).toBe(worthOf(digit, number));
      }
    }
  });

  it("asks about the columns after the point more often than the ones before", () => {
    const problems = SEEDS.flatMap((seed) =>
      problemsOf(
        { style: "place", count: 20, range: { min: 0, max: 99 } },
        seed,
      ),
    );
    const after = problems.filter((p) => p.answer.startsWith("0."));
    expect(after.length).toBeGreaterThan(problems.length / 2);
    expect(after.length).toBeLessThan(problems.length);
  });

  it("is written in two columns at most", () => {
    expect(decimalLayout(config({ style: "place", columns: 4 })).columns).toBe(
      2,
    );
    expect(decimalLayout(config({ style: "place", columns: 1 })).columns).toBe(
      1,
    );
  });
});

/* ── Decimal × decimal ─────────────────────────────────────────────────── */

describe("multiplying a decimal by a decimal", () => {
  function read(problem: Problem): { left: string; right: string } {
    if (problem.operands) {
      expect(problem.operator).toBe("×");
      return { left: problem.operands[0], right: problem.operands[1] };
    }
    const match = /^(\S+) × (\S+) =$/.exec(problem.prompt);
    if (!match) throw new Error(`not a product: "${problem.prompt}"`);
    return { left: match[1], right: match[2] };
  }

  it("multiplies the units and adds the places", () => {
    for (const shape of [
      { operation: "multiply" as const, by: "decimal" as const },
      { operation: "multiply" as const, by: "decimal" as const, places: 1 },
      {
        operation: "multiply" as const,
        by: "decimal" as const,
        form: "vertical" as const,
        places: 3,
      },
    ]) {
      for (const [problem, where] of sweep(shape)) {
        const { left, right } = read(problem);
        const a = readNumber(left);
        const b = readNumber(right);
        const answer = readNumber(problem.answer);
        expect(answer.n * a.d * b.d, where).toBe(a.n * b.n * answer.d);
        expect(placesOf(problem.answer), where).toBe(
          placesOf(left) + placesOf(right),
        );
        // The multiplier is under ten with one to `places` places, and
        // neither number ends in a zero, so the count is the count.
        expect(b.n, where).toBeLessThan(10 * b.d);
        expect(placesOf(right), where).toBeGreaterThanOrEqual(1);
        expect(placesOf(right), where).toBeLessThanOrEqual(shape.places ?? 2);
        expect(placesOf(left), where).toBe(shape.places ?? 2);
        expect(left, where).toMatch(/[1-9]$/);
        expect(right, where).toMatch(/[1-9]$/);
        expect(problem.operands !== undefined, where).toBe(
          shape.form === "vertical",
        );
      }
    }
    expect(
      timesFixed({ units: 37, places: 1 }, { units: 24, places: 1 }),
    ).toEqual({
      units: 888,
      places: 2,
    });
  });

  it("is named for what it multiplies by", () => {
    expect(
      describeSheet(config({ operation: "multiply", by: "decimal" })),
    ).toBe("Multiplying decimals by decimals — hundredths");
    expect(
      describeSheet(
        config({ operation: "multiply", by: "decimal", form: "vertical" }),
      ),
    ).toBe("Multiplying decimals by decimals — hundredths — in columns");
    // `by` means nothing to an addition.
    expect(describeSheet(config({ by: "decimal" }))).toBe(
      "Adding decimals — hundredths",
    );
    const told = (over: Partial<DecimalConfig>) =>
      buildSheet(config(over), 1).header.instructions;
    expect(told({ operation: "multiply", by: "decimal" })).toBe(
      "Work out each answer. Multiply as if there were no points, then count the decimal places in both numbers: the answer has that many.",
    );
    expect(
      told({ operation: "multiply", by: "decimal", form: "vertical" }),
    ).toBe(
      "Work out each answer. Line the digits up on the right and multiply as if there were no points, then count the decimal places in both numbers: the answer has that many.",
    );
  });
});

/* ── What the sheets are called ────────────────────────────────────────── */

describe("the number-sense sheets", () => {
  it("are named and told apart in one line", () => {
    expect(describeSheet(config({ style: "powers" }))).toBe(
      "Multiplying and dividing by 10, 100 and 1000 — hundredths",
    );
    expect(describeSheet(config({ style: "compare", places: 1 }))).toBe(
      "Comparing decimals — tenths",
    );
    expect(describeSheet(config({ style: "order" }))).toBe(
      "Ordering decimals — hundredths",
    );
    expect(describeSheet(config({ style: "round", to: "hundredth" }))).toBe(
      "Rounding decimals — to the nearest hundredth",
    );
    expect(describeSheet(config({ style: "place", places: 3 }))).toBe(
      "Decimal place value — thousandths",
    );
    // None of them stacks, whatever the form says.
    for (const style of [
      "powers",
      "compare",
      "order",
      "round",
      "place",
    ] as const) {
      expect(describeSheet(config({ style, form: "vertical" }))).not.toContain(
        "in columns",
      );
      for (const problem of problemsOf({ style, form: "vertical" }, 1)) {
        expect(problem.operands).toBeUndefined();
        expect(problem.bracket).toBeUndefined();
      }
    }
  });

  it("tell a child the idea, in the sheet's own words", () => {
    const told = (over: Partial<DecimalConfig>) =>
      buildSheet(config(over), 1).header.instructions;
    // "The digits move" and never "move the point" (§22).
    expect(told({ style: "powers" })).toBe(
      "Work out each answer. To multiply by 10, move every digit one place to the left; to divide by 10, move every digit one place to the right. The digits move; the point stays where it is.",
    );
    expect(told({ style: "compare" })).toBe(
      "Write <, > or = in each gap. Line the points up before you decide: a longer decimal is not always a bigger one.",
    );
    expect(told({ style: "order" })).toBe(
      "Write each set of decimals in order on the line under it, smallest first.",
    );
    expect(told({ style: "round" })).toBe(
      "Round each decimal to the nearest whole number. Look at the tenths digit: 5 or more rounds up, 4 or less leaves the number as it is.",
    );
    expect(told({ style: "round", to: "tenth" })).toBe(
      "Round each decimal to the nearest tenth. Look at the hundredths digit: 5 or more rounds up, 4 or less leaves the number as it is.",
    );
    expect(told({ style: "place" })).toBe(
      "Write what each digit is worth. In 3.75 the 7 is worth 0.7 and the 5 is worth 0.05.",
    );
  });

  it("draw the same problems for a seed as they did the day they shipped", () => {
    const drawn = (over: Partial<DecimalConfig>) =>
      problemsOf({ ...over, count: 4 }, 7).map((p) => [p.prompt, p.answer]);
    expect(drawn({ style: "powers" })).toEqual(GOLDEN.powers);
    expect(drawn({ style: "compare" })).toEqual(GOLDEN.compare);
    expect(drawn({ style: "order" })).toEqual(GOLDEN.order);
    expect(drawn({ style: "round", to: "tenth" })).toEqual(GOLDEN.round);
    expect(drawn({ style: "place" })).toEqual(GOLDEN.place);
    expect(drawn({ operation: "multiply", by: "decimal", places: 1 })).toEqual(
      GOLDEN.timesDecimal,
    );
  });
});

/**
 * What the sheets came out as on the day this shipped — recorded rather than
 * computed, as in `decimals.test.ts`: every one is proved right above, and
 * what these hold is that they do not silently change.
 */
const GOLDEN = {
  powers: [
    ["2 ÷ 1000 =", "0.002"],
    ["8.11 × 100 =", "811"],
    ["4 ÷ 1000 =", "0.004"],
    ["8 ÷ 10 =", "0.8"],
  ],
  compare: [
    ["4.55 _ 4.8", "<"],
    ["5.9 _ 5.97", "<"],
    ["3.81 _ 2.87", ">"],
    ["1.9 _ 1.49", ">"],
  ],
  order: [
    ["0.70, 0.41, 0.3, 0.73", "0.3, 0.41, 0.70, 0.73"],
    ["5.52, 5.4, 5.5, 5.9", "5.4, 5.5, 5.52, 5.9"],
    ["4.2, 4.3, 4.76, 4.9, 4.62", "4.2, 4.3, 4.62, 4.76, 4.9"],
    ["13.92, 13.04, 13.4, 13.1, 13.7", "13.04, 13.1, 13.4, 13.7, 13.92"],
  ],
  round: [
    ["1.99 ≈", "2.0"],
    ["10.43 ≈", "10.4"],
    ["9.32 ≈", "9.3"],
    ["11.98 ≈", "12.0"],
  ],
  place: [
    ["What is the 3 in 0.23 worth?", "0.03"],
    ["What is the 9 in 13.98 worth?", "0.9"],
    ["What is the 2 in 9.32 worth?", "0.02"],
    ["What is the 6 in 14.60 worth?", "0.6"],
  ],
  timesDecimal: [
    ["0.2 × 9.7 =", "1.94"],
    ["10.4 × 4.7 =", "48.88"],
    ["4.8 × 7.3 =", "35.04"],
    ["5.1 × 7.6 =", "38.76"],
  ],
};
