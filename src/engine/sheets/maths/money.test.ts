import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP } from "../layout";
import type {
  Currency,
  MarginSize,
  MoneyConfig,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { CURRENCIES, MONEY_SHEET, currencyOf, moneyLayout } from "./money";

/**
 * Money, held to the bar the maths families set.
 *
 * **Nothing here checks the generator against the generator.** Every answer is
 * verified from the *printed* problem by a path the family does not use: an
 * amount is read back as **a whole number of the smallest coin**, taken off the
 * digits either side of the point, and the sentence is checked in that coin —
 * with a product checked by **repeated addition**, which is what buying three
 * of something is. The family works in pence too, but it never parses anything:
 * a misplaced point, a dropped trailing zero or a symbol on the wrong side all
 * survive its arithmetic and fail here.
 *
 * The shape of the printed amount is held as tightly as its value, because on a
 * money sheet the shape *is* the value: `$6.5` is not an amount of money, and
 * `$6.50` written as `6.5` is what a family formatting with `toString` would
 * print.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<MoneyConfig> = {}): MoneyConfig => ({
  kind: "money",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  currency: "usd",
  operation: "add",
  form: "horizontal",
  range: { min: 0, max: 20 },
  count: 12,
  columns: 2,
  ...over,
});

const EVERY_CURRENCY: Currency[] = ["usd", "gbp", "eur"];

/**
 * Every shape the family can print, which is every acceptance criterion of the
 * story: amounts added, taken away and bought several of, along a line and in
 * columns, in each of the three currencies.
 */
const EVERY_SHAPE: Array<Partial<MoneyConfig>> = [
  {},
  { form: "vertical" },
  { operation: "subtract" },
  { operation: "subtract", form: "vertical" },
  { operation: "both" },
  { operation: "both", form: "vertical" },
  { operation: "multiply" },
  { operation: "multiply", form: "vertical" },
  { currency: "gbp" },
  { currency: "gbp", operation: "both" },
  { currency: "eur" },
  { currency: "eur", operation: "multiply" },
  // Small change only, which is where the pool gets thin and the draw has to
  // stop rather than repeat itself.
  { range: { min: 0, max: 1 }, count: 8 },
  { range: { min: 5, max: 50 }, count: 10 },
  { workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a money sheet has, narrowed for the reader. */
function problemsOf(over: Partial<MoneyConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ────────────────────────────────── */

/** Every symbol the shop can print, so a stray one is a stray one. */
const SYMBOLS = EVERY_CURRENCY.map((id) => CURRENCIES[id].symbol);

/**
 * An amount as it is printed, read back as a whole number of the smallest coin.
 *
 * The digits are counted rather than the number parsed. `Number("3.45") * 100`
 * is 344.99999999999994, which is the whole reason this family holds amounts in
 * pence — and a test that reached for it would be the one place the floats got
 * back in.
 */
function pence(text: string): number {
  const written = text.trim();
  const match = /^(.)(\d+)\.(\d\d)$/.exec(written);
  if (!match) throw new Error(`not an amount: "${text}"`);
  if (!SYMBOLS.includes(match[1])) throw new Error(`not money: "${text}"`);
  return Number(match[2]) * 100 + Number(match[3]);
}

/** `a` added to itself `b` times — what buying three of something is. */
function repeated(a: number, b: number): number {
  let total = 0;
  for (let step = 0; step < b; step += 1) total += a;
  return total;
}

/** The problem, written out in full with its answer put where it belongs. */
function sentence(problem: Problem): string {
  if (problem.operands) {
    return `${problem.operands.join(` ${problem.operator} `)} = ${problem.answer}`;
  }
  return `${problem.prompt} ${problem.answer}`;
}

/** Whether a written sentence is true, counted in the smallest coin there is. */
function holds(written: string): boolean {
  const worked = /^(\S+) ([+−×]) (\S+) = (\S+)$/.exec(written.trim());
  if (!worked) throw new Error(`not a money sentence: "${written}"`);
  const [, left, sign, right, answer] = worked;
  if (sign === "×") {
    // The count is a plain number rather than an amount: `$1.25 × $3` is not a
    // thing anybody can buy.
    if (!/^\d+$/.test(right)) return false;
    return repeated(pence(left), Number(right)) === pence(answer);
  }
  const total = pence(answer);
  return sign === "+"
    ? pence(left) + pence(right) === total
    : pence(left) - pence(right) === total;
}

/** Every amount printed on a problem, prompt and answer alike. */
function amountsOn(problem: Problem): string[] {
  return sentence(problem)
    .split(/[\s=+−×]+/)
    .filter((word) => SYMBOLS.some((symbol) => word.startsWith(symbol)));
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the money family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("money")).toBe(MONEY_SHEET);
    expect(sheetSpec("money").label).toBe("Money");
  });

  it("names the sheet in the words the country it is for uses", () => {
    // Not decoration: "adding pounds and pence" and "adding dollars and cents"
    // are two different searches, and a parent types the one their child says.
    expect(describeSheet(config())).toBe("Adding dollars and cents — to $20");
    expect(describeSheet(config({ currency: "gbp" }))).toBe(
      "Adding pounds and pence — to £20",
    );
    expect(
      describeSheet(config({ currency: "eur", operation: "subtract" })),
    ).toBe("Subtracting euros and cents — to €20");
    expect(describeSheet(config({ operation: "both", form: "vertical" }))).toBe(
      "Adding and subtracting dollars and cents — to $20 — in columns",
    );
    expect(describeSheet(config({ operation: "multiply" }))).toBe(
      "Multiplying dollars and cents — to $20",
    );
  });

  it("reads a currency this build has never heard of back safely", () => {
    // `currency` arrives from outside this build — a bookmarked URL, a sheet
    // saved before a fourth one was added — so the lookup has to answer rather
    // than hand back `undefined` and print `undefined3.45`.
    const stale = { ...config(), currency: "btc" as Currency };
    expect(currencyOf(stale)).toBe(CURRENCIES.usd);
    // And `toString` is the case a plain `??` fallback gets wrong: it resolves
    // on Object.prototype, is truthy, and is not a currency.
    expect(currencyOf({ ...config(), currency: "toString" as Currency })).toBe(
      CURRENCIES.usd,
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ currency: "gbp", count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Adding pounds and pence");
    expect(sheet.header.instructions).toBe("Work out each answer.");
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child to keep the points in line when the sums are stacked", () => {
    expect(buildSheet(config({ form: "vertical" }), 1).header.instructions) //
      .toBe("Work out each answer. Keep the points under one another.");
    // Except on a stacked multiplication, where there is no second point to
    // line the first one up on — `$1.25 × 3` stacks an amount over a count.
    expect(
      buildSheet(config({ form: "vertical", operation: "multiply" }), 1).header
        .instructions,
    ).toBe(
      "Work out each answer. Line the digits up on the right, then put the point back in.",
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

  it("writes every amount with both its digits of change", () => {
    // `$6.5` is not an amount of money, and it is exactly what a family that
    // formatted its answer with `toString` would print — right value, wrong
    // form, and useless to a child taught to line the points up.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          for (const amount of amountsOn(problem)) {
            expect(amount, JSON.stringify(shape)).toMatch(/^.\d+\.\d\d$/);
          }
        }
      }
    }
  });

  it("prints one currency's symbol and no other's", () => {
    for (const currency of EVERY_CURRENCY) {
      const { symbol } = CURRENCIES[currency];
      for (const seed of SEEDS) {
        const problems = problemsOf({ currency, count: 8 }, seed);
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          const amounts = amountsOn(problem);
          expect(amounts.length).toBeGreaterThan(0);
          for (const amount of amounts) {
            expect(amount.startsWith(symbol), `${currency}: ${amount}`) //
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
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("never puts an amount outside the range a parent asked for", () => {
    const ASKS = [
      { min: 0, max: 1 },
      { min: 1, max: 20 },
      { min: 5, max: 50 },
    ];
    for (const range of ASKS) {
      for (const operation of ["add", "subtract", "multiply"] as const) {
        const problems = problemsOf({ range, operation, count: 8 }, 9);
        expect(problems.length, JSON.stringify(range)).toBeGreaterThan(0);
        for (const problem of problems) {
          // The amounts a child *sees*, which is what a range promises: a total
          // may run past the top of it, which is what carrying is.
          const asked = problem.operands ?? problem.prompt.split(" ");
          for (const word of asked) {
            if (!SYMBOLS.some((symbol) => word.startsWith(symbol))) continue;
            expect(pence(word)).toBeGreaterThan(0);
            expect(pence(word)).toBeGreaterThanOrEqual(range.min * 100);
            expect(pence(word)).toBeLessThanOrEqual(range.max * 100);
          }
        }
      }
    }
  });

  it("never hands back less than nothing", () => {
    // No till does. A difference of nothing is thrown away too, because it
    // answers itself.
    for (const shape of [
      { operation: "subtract" as const },
      { operation: "both" as const },
      { operation: "subtract" as const, form: "vertical" as const },
    ]) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf({ ...shape, count: 12 }, seed)) {
          expect(problem.answer, sentence(problem)).not.toContain("-");
          expect(pence(problem.answer), sentence(problem)).toBeGreaterThan(0);
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
      expect(problem.prompt).toMatch(/^\$\d+\.\d\d \+ \$\d+\.\d\d =$/);
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map(sentence);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // A range with no money in it: every draw is nothing at all, which is not a
    // question about money. An empty sheet is the honest answer, and the
    // builder's job to prevent (PRINT13).
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

  it("draws the same amounts whatever currency they are printed in", () => {
    // The currency is a symbol and a title, and nothing else. Three sheets that
    // drew different sums would be three sheets, and "the same worksheet in
    // pounds" would stop being true.
    const inPence = (currency: Currency) =>
      problemsOf({ currency, count: 8 }, 5).map((problem) =>
        amountsOn(problem).map(pence),
      );
    expect(inPence("gbp")).toEqual(inPence("usd"));
    expect(inPence("eur")).toEqual(inPence("usd"));
  });

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy.
    expect(
      problemsOf({ operation: "both", count: 4 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.both);

    expect(
      problemsOf({ currency: "gbp", operation: "multiply", count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.pounds);
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
            const { box, columns, row } = moneyLayout(config(over));
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
    const { box, row, perPage, columns } = moneyLayout(config());
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
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(4);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  both: [
    ["$18.63 − $5.57 =", "$13.06"],
    ["$13.38 − $5.76 =", "$7.62"],
    ["$8.03 + $6.88 =", "$14.91"],
    ["$15.09 − $14.63 =", "$0.46"],
  ],
  pounds: [
    ["£0.23 × 2 =", "£0.46"],
    ["£19.54 × 7 =", "£136.78"],
    ["£10.43 × 5 =", "£52.15"],
    ["£9.32 × 3 =", "£27.96"],
  ],
};
