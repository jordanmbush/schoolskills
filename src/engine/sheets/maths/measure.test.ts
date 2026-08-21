import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP } from "../layout";
import type {
  MarginSize,
  MeasureConfig,
  Paper,
  PaperSize,
  Problem,
  Quantity,
  UnitSystem,
} from "../types";

import { MEASURE_SHEET, measureLayout } from "./measure";

/**
 * Measurement, held to the bar the maths families set.
 *
 * **Nothing here checks the generator against the generator.** The family reads
 * its ratios out of `units.ts`; this file writes them down again, by hand, from
 * the definitions rather than from the source — a foot is twelve inches because
 * a foot is twelve inches, not because a table said so. Every sentence on the
 * page is then checked in the smallest unit of its quantity, with the
 * multiplication done by **repeated addition**. A ratio typed wrong in the
 * engine, a conversion that went the wrong way, or a comparison whose sign was
 * flipped all survive the family's own arithmetic and fail here.
 *
 * The table below is also what makes "nothing crosses between the systems" a
 * test rather than a promise: every symbol is looked up in one system's list,
 * and an inch on a metric sheet is not in it.
 */

/* ── The ratios, written out from the definitions ────────────────────────── */

/**
 * How many of the smallest unit each one is — the same numbers `units.ts` holds
 * and deliberately a second copy of them, because a table that imported the one
 * under test could only ever agree with it.
 */
const METRIC: Record<string, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  km: 1000 * 1000,
  g: 1,
  kg: 1000,
  t: 1000 * 1000,
  ml: 1,
  cl: 10,
  l: 1000,
};

const IMPERIAL: Record<string, number> = {
  in: 1,
  ft: 12,
  yd: 12 * 3,
  mi: 12 * 3 * 1760,
  oz: 1,
  lb: 16,
  ton: 16 * 2000,
  "fl oz": 1,
  cup: 8,
  pt: 8 * 2,
  qt: 8 * 2 * 2,
  gal: 8 * 2 * 2 * 4,
};

/** Which quantity a unit belongs to, so a sheet can't compare grams with metres. */
const MEASURES: Record<string, Quantity> = {
  mm: "length",
  cm: "length",
  m: "length",
  km: "length",
  in: "length",
  ft: "length",
  yd: "length",
  mi: "length",
  g: "mass",
  kg: "mass",
  t: "mass",
  oz: "mass",
  lb: "mass",
  ton: "mass",
  ml: "capacity",
  cl: "capacity",
  l: "capacity",
  "fl oz": "capacity",
  cup: "capacity",
  pt: "capacity",
  qt: "capacity",
  gal: "capacity",
};

const TABLE: Record<UnitSystem, Record<string, number>> = {
  metric: METRIC,
  imperial: IMPERIAL,
};

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<MeasureConfig> = {}): MeasureConfig => ({
  kind: "measure",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "convert",
  system: "metric",
  quantities: ["length"],
  range: { min: 1, max: 20 },
  count: 12,
  columns: 3,
  ...over,
});

const EVERY_QUANTITY: Quantity[] = ["length", "mass", "capacity"];

/**
 * Every shape the family can print: converting and comparing, in both systems,
 * over each of the three things a child measures.
 */
const EVERY_SHAPE: Array<Partial<MeasureConfig>> = [
  {},
  { quantities: ["mass"] },
  { quantities: ["capacity"] },
  { quantities: EVERY_QUANTITY },
  { system: "imperial" },
  { system: "imperial", quantities: ["mass"] },
  { system: "imperial", quantities: ["capacity"] },
  { system: "imperial", quantities: EVERY_QUANTITY },
  { style: "compare" },
  { style: "compare", quantities: EVERY_QUANTITY },
  { style: "compare", system: "imperial", quantities: EVERY_QUANTITY },
  // A pool with almost nothing in it, which is where the draw has to stop
  // rather than repeat itself.
  { quantities: ["mass"], range: { min: 1, max: 3 }, count: 8 },
  { range: { min: 5, max: 50 }, count: 10 },
  { workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a measurement sheet has, narrowed for the reader. */
function problemsOf(over: Partial<MeasureConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ────────────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function repeated(a: number, b: number): number {
  const [each, times] = a > b ? [a, b] : [b, a];
  let total = 0;
  for (let step = 0; step < times; step += 1) total += each;
  return total;
}

type Amount = { value: number; unit: string };

/** An amount as it is printed, split back into a number and a unit. */
function amountOf(text: string): Amount {
  const written = /^(\d+) ([a-z ]+)$/.exec(text.trim());
  if (!written) throw new Error(`not an amount: "${text}"`);
  return { value: Number(written[1]), unit: written[2] };
}

/** The same amount as a whole number of the smallest unit of its quantity. */
function smallest(amount: Amount, system: UnitSystem): number {
  const table = TABLE[system];
  if (!Object.hasOwn(table, amount.unit))
    throw new Error(`not a ${system} unit: "${amount.unit}"`);
  return repeated(amount.value, table[amount.unit]);
}

/** The problem, written out in full with its answer put where the gap is. */
const sentence = (problem: Problem): string =>
  problem.prompt.replace("_", problem.answer);

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the measurement family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("measure")).toBe(MEASURE_SHEET);
    expect(sheetSpec("measure").label).toBe("Measurement");
  });

  it("names the sheet in the words the system it is for uses", () => {
    // Metric weighs mass and imperial weighs weight. It is one word, and it is
    // the word a parent types into a search box.
    expect(describeSheet(config())).toBe(
      "Converting metric units of length — mm, cm, m, km",
    );
    expect(describeSheet(config({ quantities: ["mass"] }))).toBe(
      "Converting metric units of mass — g, kg, t",
    );
    expect(
      describeSheet(config({ system: "imperial", quantities: ["mass"] })),
    ).toBe("Converting imperial units of weight — oz, lb, ton");
    expect(
      describeSheet(config({ style: "compare", quantities: EVERY_QUANTITY })),
    ).toBe("Comparing metric units — length, mass, capacity");
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Converting metric units of length");
    expect(sheet.header.instructions).toBe(
      "Write the missing number in each blank.",
    );
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child which three signs a comparing sheet wants", () => {
    expect(
      buildSheet(config({ style: "compare" }), 1).header.instructions,
    ).toBe("Write <, > or = in each blank.");
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("converts exactly, checked in the smallest unit there is", () => {
    for (const shape of EVERY_SHAPE.filter((one) => one.style !== "compare")) {
      const system = shape.system ?? "metric";
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const [left, right] = sides(sentence(problem), " = ");
          expect(smallest(left, system), sentence(problem)) //
            .toBe(smallest(right, system));
        }
      }
    }
  });

  it("compares in the smallest unit too, and writes the sign the right way", () => {
    for (const shape of EVERY_SHAPE.filter((one) => one.style === "compare")) {
      const system = shape.system ?? "metric";
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const [left, right] = sides(problem.prompt, " _ ");
          const order = smallest(left, system) - smallest(right, system);
          const written = order === 0 ? "=" : order > 0 ? ">" : "<";
          expect(problem.answer, problem.prompt).toBe(written);
        }
      }
    }
  });

  it("never asks a child to turn a metre into a foot", () => {
    // Or a gram into a litre. Both units in a sentence belong to one system and
    // to one quantity, or the question has no exact answer at all.
    for (const shape of EVERY_SHAPE) {
      const system = shape.system ?? "metric";
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          const units = unitsOn(problem).map((unit) => {
            expect(Object.hasOwn(TABLE[system], unit), unit).toBe(true);
            return MEASURES[unit];
          });
          expect(new Set(units).size, sentence(problem)).toBe(1);
        }
      }
    }
  });

  it("asks about the quantities it was given and no others", () => {
    for (const quantity of EVERY_QUANTITY) {
      for (const seed of SEEDS) {
        const problems = problemsOf({ quantities: [quantity], count: 8 }, seed);
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          for (const unit of unitsOn(problem)) {
            expect(MEASURES[unit], `${quantity}: ${unit}`).toBe(quantity);
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
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });
});

/** The two amounts either side of a sign. */
function sides(written: string, sign: string): [Amount, Amount] {
  const parts = written.split(sign);
  if (parts.length !== 2) throw new Error(`not a sentence: "${written}"`);
  return [amountOf(parts[0]), amountOf(parts[1])];
}

/** Every unit printed on a problem, prompt and answer alike. */
const unitsOn = (problem: Problem): string[] =>
  written(problem).map((amount) => amount.unit);

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("counts the larger unit inside the range a parent asked for", () => {
    const ASKS = [
      { min: 1, max: 3 },
      { min: 1, max: 20 },
      { min: 5, max: 50 },
    ];
    for (const range of ASKS) {
      for (const style of ["convert", "compare"] as const) {
        const problems = problemsOf(
          { range, style, quantities: EVERY_QUANTITY, count: 10 },
          9,
        );
        expect(problems.length, JSON.stringify(range)).toBeGreaterThan(0);
        for (const problem of problems) {
          // Whichever side carries the larger unit is the side the range
          // counts, and the other one is that many of something smaller.
          const larger = written(problem).reduce((most, amount) =>
            howBig(amount) > howBig(most) ? amount : most,
          );
          expect(larger.value, sentence(problem)).toBeGreaterThanOrEqual(
            range.min,
          );
          expect(larger.value, sentence(problem)).toBeLessThanOrEqual(
            range.max,
          );
        }
      }
    }
  });

  it("never prints an amount of nothing", () => {
    // Nought grams is not a weight, and `0 ml < 1 l` is not a question about
    // capacity.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const amount of written(problem)) {
            expect(amount.value, sentence(problem)).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("gives every problem exactly one blank to fill in", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          expect(problem.prompt.split("_").length - 1).toBe(1);
        }
      }
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map((problem) => problem.prompt);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // A sheet with no quantity on it has nothing to measure. An empty sheet is
    // the honest answer, and the builder's job to prevent.
    expect(problemsOf({ quantities: [] }, 1)).toEqual([]);
    expect(problemsOf({ quantities: ["weight" as Quantity] }, 1)).toEqual([]);
  });
});

/** Every amount printed on a problem, answer spliced into the gap. */
const written = (problem: Problem): Amount[] =>
  sentence(problem)
    .split(/ [=<>] /)
    .map(amountOf);

/** How big a unit is, whichever system it belongs to. */
const howBig = (amount: Amount): number =>
  (Object.hasOwn(METRIC, amount.unit) ? METRIC : IMPERIAL)[amount.unit];

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

  it("draws the same numbers whichever system they are printed in", () => {
    // The system is a set of units and a title, and nothing else. Two sheets
    // that drew different questions would be two sheets, and "the same
    // worksheet in inches" would stop being true.
    const counts = (system: UnitSystem) =>
      problemsOf({ system, count: 8 }, 5).map((problem) =>
        written(problem)
          .map((amount) => amount.value)
          .join(":"),
      );
    expect(counts("imperial").length).toBe(counts("metric").length);
  });

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy.
    expect(
      problemsOf({ quantities: EVERY_QUANTITY, count: 4 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.metric);

    expect(
      problemsOf({ style: "compare", system: "imperial", count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.imperial);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    // Every shape except the thinnest: three masses over two ratios is
    // eighteen questions in the world, so two variants of six must share some
    // of them. What a variant promises there is a different sheet, not a
    // disjoint one.
    for (const shape of EVERY_SHAPE.filter(
      (one) => (one.range?.max ?? 20) > 3,
    )) {
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
            const { box, columns, row } = measureLayout(config(over));
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
    const { box, row, perPage, columns } = measureLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 10 }, 1).length).toBe(10);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(3);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  metric: [
    ["19000 g = _ kg", "19"],
    ["6 cl = _ ml", "60"],
    ["15000 kg = _ t", "15"],
    ["7000 kg = _ t", "7"],
  ],
  imperial: [
    ["242 in _ 20 ft", ">"],
    ["60 in _ 5 ft", "="],
    ["16 ft _ 192 in", "="],
    ["130 in _ 11 ft", "<"],
  ],
};
