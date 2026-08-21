import { describe, expect, it } from "vitest";

import { buildSheet, describeSheet } from "../index";
import { describeSheetFamily } from "../contract";
import { PROBLEM_GAP } from "../layout";
import type {
  FractionConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { FRACTIONS_SHEET, fractionLayout } from "./fractions";

/**
 * Fractions, held to the bar the two families before it set.
 *
 * **Nothing here checks the generator against the generator.** Every answer is
 * verified from the *printed* problem — the string a child reads, and the
 * picture they look at — by a path the family does not use:
 *
 * - an answer is checked by **cross-multiplication**, which is the definition of
 *   two fractions being equal and is not how any of them was computed: `a/b` is
 *   `c/d` exactly when `a × d` is `c × b`, and no division happens anywhere in
 *   this file;
 * - "in its lowest terms" is checked by **looking for a common factor**, one
 *   number at a time. A test that called the same `gcd` the family reduces with
 *   would agree with a broken `gcd` about everything;
 * - a missing number is checked by **searching for every number that fits**,
 *   which catches the two ways that question goes bad at once: an answer that is
 *   wrong, and a blank that more than one answer would fill;
 * - a picture is read as **what is shaded out of how many parts**, off the art
 *   the sheet actually carries.
 *
 * The last of those is the one this family adds. A fraction answer can be right
 * and still be wrong — `4/8` is the same value as `1/2` and only one of them
 * will be marked correct — so "right" here is two assertions, always: the value
 * is equal, and it is written the smallest way it can be.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

/** The denominators a mixed sheet draws from: what a primary book covers. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

const config = (over: Partial<FractionConfig> = {}): FractionConfig => ({
  kind: "fractions",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "arithmetic",
  operation: "add",
  denominators: DENOMINATORS,
  pairing: "either",
  count: 12,
  columns: 2,
  ...over,
});

/**
 * Every shape the family can print: naming from bars and from circles,
 * equivalence, simplifying, the four operations, like and unlike denominators,
 * and mixed numbers through all of it.
 */
const EVERY_SHAPE: Array<Partial<FractionConfig>> = [
  {},
  { pairing: "like" },
  { pairing: "unlike" },
  { operation: "subtract" },
  { operation: "subtract", pairing: "like" },
  { operation: "subtract", pairing: "unlike" },
  { operation: "both" },
  { operation: "both", pairing: "unlike" },
  { operation: "multiply" },
  { operation: "divide" },
  // Mixed numbers, through every operation that can carry one.
  { mixed: true },
  { mixed: true, pairing: "unlike" },
  { mixed: true, operation: "subtract" },
  { mixed: true, operation: "both" },
  { mixed: true, operation: "multiply" },
  { mixed: true, operation: "divide" },
  // The three styles that are not arithmetic at all.
  { style: "identify", count: 6 },
  { style: "identify", model: "circle", count: 6 },
  { style: "identify", model: "both", count: 6 },
  { style: "equivalent", count: 10 },
  { style: "simplify", count: 10 },
  { workspace: true, count: 8 },
  // A small pool, which is where the draw has to stop rather than repeat.
  { denominators: [2, 4], count: 6 },
];

const SEEDS = [0, 1, 2, 7, 4242];

describeSheetFamily("fractions", {
  label: "Fractions",
  spec: FRACTIONS_SHEET,
  config,
  shapes: EVERY_SHAPE,
  seeds: SEEDS,
});

/** The one block a fraction sheet has, narrowed for the reader. */
function problemsOf(over: Partial<FractionConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

/* ── Reading a sheet the way a child does ──────────────────────────────────
   Everything below works from the printed problem — the prompt, the answer and
   the picture — and never from the config that produced it.                 */

type Value = { n: number; d: number };

/**
 * A fraction as it is written on paper, read back.
 *
 * Three forms, because the family prints three: `3/4`, the whole number `2`,
 * and the mixed number `2 1/4`. Anything else is not a fraction, and saying so
 * is half the point — a family that started printing `2.25` would fail here
 * rather than quietly change what the sheet asks for.
 */
function readFraction(text: string): Value {
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(text.trim());
  if (mixed) {
    const [whole, n, d] = [+mixed[1], +mixed[2], +mixed[3]];
    // A mixed number whose fraction is not proper is written wrong even when
    // its value is right: `1 5/4` is nobody's answer.
    expect(n, `${text} has an improper part`).toBeLessThan(d);
    expect(d, `${text} is over nothing`).toBeGreaterThan(0);
    return { n: whole * d + n, d };
  }
  const parts = /^(\d+)\/(\d+)$/.exec(text.trim());
  if (parts) {
    expect(+parts[2], `${text} is over nothing`).toBeGreaterThan(0);
    return { n: +parts[1], d: +parts[2] };
  }
  const number = /^(\d+)$/.exec(text.trim());
  if (number) return { n: +number[1], d: 1 };
  throw new Error(`not a fraction: "${text}"`);
}

/** Whether two fractions are the same value, cross-multiplied and not divided. */
const same = (a: Value, b: Value): boolean => a.n * b.d === b.n * a.d;

/**
 * Whether two whole numbers share a factor, found by looking for one.
 *
 * The long way round on purpose. `gcd` is what the family reduces with, so a
 * test that asked it whether a fraction was in lowest terms would agree with a
 * broken `gcd` about every fraction on the page.
 */
function shareAFactor(a: number, b: number): boolean {
  const most = Math.min(Math.abs(a), Math.abs(b));
  for (let by = 2; by <= most; by += 1) {
    if (a % by === 0 && b % by === 0) return true;
  }
  return false;
}

/** Whether a printed answer is written the smallest way it can be. */
function lowestTerms(text: string): boolean {
  const written = text.trim();
  const mixed = /^(\d+) (\d+)\/(\d+)$/.exec(written);
  if (mixed) return !shareAFactor(+mixed[2], +mixed[3]);
  const parts = /^(\d+)\/(\d+)$/.exec(written);
  // A whole number has nothing to cancel; a fraction over one is a whole number
  // that was written the long way, which is not lowest terms either.
  if (!parts) return true;
  return +parts[2] !== 1 && !shareAFactor(+parts[1], +parts[2]);
}

/** The two sides of a printed sentence, with the answer put in its blank. */
function completed(problem: Problem): string {
  return problem.prompt.includes("_")
    ? problem.prompt.replace("_", problem.answer)
    : `${problem.prompt} ${problem.answer}`;
}

const OPERATIONS: Record<string, (a: Value, b: Value) => Value> = {
  // Not one of these divides. Each is the identity that defines the operation
  // over a common denominator of `b × d`, left unreduced — `same` compares by
  // cross-multiplication, so an unreduced left-hand side is not a problem.
  "+": (a, b) => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }),
  "−": (a, b) => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d }),
  "×": (a, b) => ({ n: a.n * b.n, d: a.d * b.d }),
  "÷": (a, b) => ({ n: a.n * b.d, d: a.d * b.n }),
};

/** Whether a written sentence — `3/4 + 1/6 = 11/12` — is true. */
function holds(sentence: string): boolean {
  const worked = /^(.+?) ([+−×÷]) (.+?) = (.+)$/.exec(sentence.trim());
  if (worked) {
    const [, left, sign, right, answer] = worked;
    return same(
      OPERATIONS[sign](readFraction(left), readFraction(right)),
      readFraction(answer),
    );
  }
  // The other three styles are all one claim: these two fractions are equal.
  const equal = /^(.+?) = (.+)$/.exec(sentence.trim());
  if (!equal) throw new Error(`not a fraction sentence: "${sentence}"`);
  return same(readFraction(equal[1]), readFraction(equal[2]));
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the fractions family", () => {
  it("names what it prints, in the terms a parent chose it by", () => {
    expect(describeSheet(config())).toBe(
      "Adding fractions — denominators to 12",
    );
    expect(describeSheet(config({ pairing: "unlike" }))).toBe(
      "Adding fractions with unlike denominators — denominators to 12",
    );
    expect(describeSheet(config({ operation: "both", pairing: "like" }))).toBe(
      "Adding and subtracting fractions with like denominators — denominators to 12",
    );
    // Multiplying has no like-and-unlike lesson, so the title doesn't claim one.
    expect(
      describeSheet(config({ operation: "multiply", pairing: "unlike" })),
    ).toBe("Multiplying fractions — denominators to 12");
    expect(describeSheet(config({ mixed: true, operation: "divide" }))).toBe(
      "Dividing mixed numbers — denominators to 12",
    );
    expect(describeSheet(config({ style: "identify", model: "both" }))).toBe(
      "Naming fractions — bars and circles",
    );
    expect(describeSheet(config({ style: "simplify" }))).toBe(
      "Simplifying fractions — denominators to 12",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ style: "equivalent", count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Equivalent fractions");
    expect(sheet.header.instructions).toBe(
      "Write the missing number in each blank.",
    );
    // Out of what is on the page, not out of what was asked for.
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child which of two right answers is wanted", () => {
    // The whole hazard of the family in one line of the header: `7/6` and
    // `1 1/6` are the same value, and a sheet that didn't say which it wanted
    // would mark half its class wrong.
    expect(buildSheet(config(), 1).header.instructions).toBe(
      "Work out each answer and write it in its lowest terms.",
    );
    expect(buildSheet(config({ mixed: true }), 1).header.instructions).toBe(
      "Work out each answer and write it in its lowest terms. Write anything over one as a mixed number.",
    );
    expect(
      buildSheet(config({ style: "identify" }), 1).header.instructions,
    ).toBe("Write the fraction each picture shows.");
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
          // A naming problem's sentence is its picture: what is shaded, out of
          // how many parts the whole was cut into.
          const sentence = problem.art
            ? `${problem.art.shaded}/${problem.art.parts} = ${problem.answer}`
            : completed(problem);
          expect(holds(sentence), `${JSON.stringify(shape)}: ${sentence}`) //
            .toBe(true);
        }
      }
    }
  });

  it("writes every answer in its lowest terms", () => {
    // The half of "right" that cross-multiplication cannot see: `4/8` is the
    // same value as `1/2` and is not the answer. Every style, because every
    // style has an answer a parent will mark.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          expect(
            lowestTerms(problem.answer),
            `${JSON.stringify(shape)}: ${problem.answer}`,
          ).toBe(true);
        }
      }
    }
  });

  it("leaves exactly one number that would fit an equivalence blank", () => {
    // Two failures caught by one search: an answer that is wrong, and a blank
    // more than one number would fill.
    for (const seed of SEEDS) {
      const problems = problemsOf({ style: "equivalent", count: 10 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const fits = [];
        for (let candidate = 1; candidate <= 200; candidate += 1) {
          try {
            if (holds(problem.prompt.replace("_", String(candidate)))) {
              fits.push(candidate);
            }
          } catch {
            /* not a fraction sentence at all */
          }
        }
        expect(fits, problem.prompt).toEqual([Number(problem.answer)]);
      }
    }
  });

  it("gives a simplifying sheet something to simplify", () => {
    // A page of fractions already in their lowest terms is a page of nothing to
    // do, and every answer on it would still be "right".
    for (const seed of SEEDS) {
      const problems = problemsOf({ style: "simplify", count: 10 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const [written] = problem.prompt.split(" =");
        expect(lowestTerms(written), problem.prompt).toBe(false);
        expect(lowestTerms(problem.answer), problem.answer).toBe(true);
      }
    }
  });

  it("writes a mixed-number sheet's answers as mixed numbers", () => {
    // `7/6` is the right value and the wrong answer on a sheet whose header
    // asked for mixed numbers — and the top-heavy form is what a family that
    // had forgotten the switch would print. An answer *under* one is a fraction
    // on any sheet, so what is checked is that nothing top-heavy survives.
    for (const operation of ["add", "multiply", "both", "subtract"] as const) {
      for (const seed of SEEDS) {
        const problems = problemsOf({ mixed: true, operation }, seed);
        expect(problems.length).toBeGreaterThan(0);
        for (const problem of problems) {
          const top = /^(\d+)\/(\d+)$/.exec(problem.answer);
          if (top) {
            expect(+top[1], `${problem.prompt} ${problem.answer}`) //
              .toBeLessThan(+top[2]);
          }
        }
      }
    }
    // And a sheet that did not ask for them keeps the top-heavy form, which is
    // the same assertion from the other side: over a hundred problems, some
    // sum of two proper fractions is bound to pass one.
    const improper = problemsOf({ count: 30, columns: 4 }, 3).filter(
      (problem) => /^\d+\/\d+$/.test(problem.answer),
    );
    expect(improper.length).toBeGreaterThan(0);
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  /** Every denominator printed in a problem, answer included. */
  function denominatorsOn(problem: Problem): number[] {
    const written = problem.art
      ? [`${problem.art.shaded}/${problem.art.parts}`, problem.answer]
      : [completed(problem)];
    return written
      .join(" ")
      .split(/[\s=+−×÷]+/)
      .filter((word) => word.includes("/"))
      .map((word) => readFraction(word).d);
  }

  it("never draws a denominator a parent did not ask for", () => {
    // The naming and arithmetic styles print the pool itself. Equivalence and
    // simplifying scale one of their fractions up on purpose, so what is
    // checked there is that the fraction in lowest terms — the one the parent
    // picked — is from the pool.
    const ASKS = [[2, 4], [3, 6, 9], DENOMINATORS];
    for (const denominators of ASKS) {
      const wanted = new Set(denominators);
      for (const style of ["identify", "arithmetic"] as const) {
        for (const seed of SEEDS) {
          const problems = problemsOf({ denominators, style, count: 6 }, seed);
          expect(problems.length, JSON.stringify(denominators)) //
            .toBeGreaterThan(0);
          for (const problem of problems) {
            for (const d of denominatorsOn(problem)) {
              // An answer may land on a denominator the pool has never heard
              // of — a half plus a third is a sixth — so only the fractions in
              // the question itself are held to the pool.
              if (problem.art || problem.prompt.includes(`/${d}`)) {
                expect(wanted.has(d), `${problem.prompt} ${problem.answer}`) //
                  .toBe(true);
              }
            }
          }
        }
      }
    }
  });

  it("keeps like denominators alike, and unlike ones apart", () => {
    // The switch the family turns on: adding quarters to quarters is the week
    // before adding quarters to thirds.
    for (const seed of SEEDS) {
      for (const problem of problemsOf({ pairing: "like", count: 10 }, seed)) {
        const [left, right] = problem.prompt.split(/ [+−×÷] /);
        expect(readFraction(left).d, problem.prompt).toBe(
          readFraction(right.replace(" =", "")).d,
        );
      }
      for (const problem of problemsOf(
        { pairing: "unlike", count: 10 },
        seed,
      )) {
        const [left, right] = problem.prompt.split(/ [+−×÷] /);
        expect(readFraction(left).d, problem.prompt).not.toBe(
          readFraction(right.replace(" =", "")).d,
        );
      }
    }
  });

  it("never asks a child to take more away than there is", () => {
    // Nothing in the Print Shop prints a negative fraction, and a difference of
    // nothing is a question that answers itself.
    for (const shape of [
      { operation: "subtract" as const },
      { operation: "subtract" as const, mixed: true },
      { operation: "both" as const },
    ]) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf({ ...shape, count: 12 }, seed)) {
          expect(problem.answer, problem.prompt).not.toContain("-");
          expect(readFraction(problem.answer).n, problem.prompt) //
            .toBeGreaterThan(0);
        }
      }
    }
  });

  it("draws a picture whose answer can only be written one way", () => {
    // A bar in eighths with four of them shaded has two right answers — `4/8`
    // and `1/2` — and a child would be marked wrong for the one the adult
    // didn't think of. So a naming sheet only ever draws a fraction that is
    // already in its lowest terms.
    for (const model of ["bar", "circle", "both"] as const) {
      for (const seed of SEEDS) {
        const problems = problemsOf(
          { style: "identify", model, count: 6 },
          seed,
        );
        expect(problems.length).toBeGreaterThan(0);
        for (const { art, answer, prompt } of problems) {
          if (!art) throw new Error("a naming problem with no picture");
          expect(art.shaded).toBeGreaterThan(0);
          expect(art.shaded).toBeLessThan(art.parts);
          expect(
            shareAFactor(art.shaded, art.parts),
            `${art.shaded}/${art.parts}`,
          ) //
            .toBe(false);
          if (model !== "both") expect(art.shape).toBe(model);
          // The picture is the whole question: there is nothing written to
          // read, and one place to write the answer.
          expect(prompt).toBe("");
          expect(answer).toBe(`${art.shaded}/${art.parts}`);
        }
      }
    }
    // A `both` sheet draws both, rather than picking one and calling it a mix.
    const shapes = new Set(
      problemsOf({ style: "identify", model: "both", count: 12 }, 5) //
        .map((problem) => problem.art?.shape),
    );
    expect(shapes).toEqual(new Set(["bar", "circle"]));
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map((problem) =>
          problem.art
            ? `${problem.art.shaded}/${problem.art.parts}`
            : problem.prompt,
        );
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("asks one equivalence once, whichever side the blank is on", () => {
    // The repeat the prompt does not show: `1/5 = 3/_` and `1/5 = _/15` are two
    // sentences and one fact, so a page with both on it has given a child one
    // problem fewer than it claims to hold — they work the first out and copy
    // the second. Read off the printed page rather than off the key, which is
    // where a child reads it.
    for (const seed of SEEDS) {
      const problems = problemsOf({ style: "equivalent", count: 12 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      const facts = problems.map((problem) => {
        const [left, right] = problem.prompt.split(" = ");
        const filled = right.replace("_", problem.answer);
        return `${left} = ${filled}`;
      });
      expect(new Set(facts).size, facts.join(", ")).toBe(facts.length);
    }
  });

  it("prints the whole small pool rather than repeating itself", () => {
    // Halves and quarters make three naming problems — 1/2, 1/4 and 3/4 — and
    // three is what a parent should get rather than twelve problems with the
    // same picture in them four times.
    const problems = problemsOf(
      { style: "identify", denominators: [2, 4], count: 12 },
      1,
    );
    expect(problems.length).toBe(3);
    expect(new Set(problems.map((p) => p.answer)).size).toBe(3);
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // No denominators at all, and unlike denominators from a pool with one
    // denominator in it. Both are empty sheets, which is the honest answer and
    // the builder's job to prevent.
    expect(problemsOf({ denominators: [] }, 1)).toEqual([]);
    expect(problemsOf({ denominators: [4], pairing: "unlike" }, 1)).toEqual([]);
    // And a nought in a saved config is not a slow sheet — it is a fraction
    // over nothing, which is why the pool drops it rather than drawing from it.
    expect(problemsOf({ denominators: [0, 1] }, 1)).toEqual([]);
  });
});

/* ── Determinism, and the three features it buys (§7) ──────────────────── */

describe("(config, seed)", () => {
  it("draws the same problems for a seed as it did the day it shipped", () => {
    // Building twice in one process only proves the draw is a function of
    // `(config, seed)`. The promise the footer makes is bigger than that: the
    // seed is printed on the paper so a parent can have the same sheet again
    // next week, across a deploy. Nothing else in this file would notice a
    // refactor that moved where the draw consumes `rand()` — the operation coin
    // spent only when both are asked for, the second denominator not drawn at
    // all on a like sheet, the whole number drawn only on a mixed one — and
    // every seed a parent had already printed would quietly start producing a
    // different sheet.
    expect(
      problemsOf({ pairing: "unlike", count: 4 }, 4242).map((p) => [
        p.prompt,
        p.answer,
      ]),
    ).toEqual(GOLDEN.unlike);

    expect(
      problemsOf({ mixed: true, operation: "subtract", count: 4 }, 7).map(
        (p) => [p.prompt, p.answer],
      ),
    ).toEqual(GOLDEN.mixed);

    expect(
      problemsOf({ style: "identify", model: "both", count: 4 }, 7).map((p) => [
        p.art?.shape,
        p.art?.parts,
        p.art?.shaded,
        p.answer,
      ]),
    ).toEqual(GOLDEN.identify);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    // Three consecutive seeds are the whole of "a different sheet, same
    // settings" and of variants for a class (§7). Some overlap is inevitable —
    // halves and quarters are three naming problems however many sheets you
    // print — so what is asserted is that a third of each variant is new.
    //
    // Six problems rather than the shape's own count, because what is being
    // asserted is that the *draw* moves and some of these pools are genuinely
    // small: subtracting like denominators from a primary pool is about thirty
    // problems, and three sheets of twelve out of thirty would overlap however
    // well the draw worked.
    for (const shape of EVERY_SHAPE) {
      // The one shape with no room to differ: a pool of two denominators has
      // three naming problems in it and every sheet prints all three.
      if (shape.denominators?.length === 2) continue;
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 6 }, 100 + offset).map((problem) =>
          problem.art ? problem.answer : problem.prompt,
        ),
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
    // The failure is silent on screen and obvious on paper: one row too many is
    // a second sheet out of the printer with two problems on it, and print is
    // the whole of the output path (§10).
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = fractionLayout(config(over));
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
    // The half a capacity check cannot see: a family that printed four problems
    // on a Letter page would satisfy every assertion above.
    const { box, row, perPage, columns } = fractionLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(18);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);

    // And a page of pictures still holds a dozen, which is what a parent
    // expects to get for the paper.
    expect(
      fractionLayout(config({ style: "identify", model: "circle", columns: 3 }))
        .perPage,
    ).toBeGreaterThanOrEqual(12);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 8 }, 1).length).toBe(8);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3, 4]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Three is as many columns of pictures as a page is laid out in: a bar an
    // inch wide beside a ruled blank has nowhere to be.
    const drawn = buildSheet(config({ style: "identify", columns: 6 }), 1)
      .blocks[0];
    expect(drawn.kind === "problems" && drawn.columns).toBe(3);
  });

  it("reserves the room the picture is going to take", () => {
    // The layout reserves the height and the build attaches the drawing, and
    // the two reading the config differently is the bug the whole "declared,
    // not measured" design exists to exclude. A circle is taller than a bar, so
    // a sheet of circles reserves more — and a `both` sheet reserves for the
    // taller of the two, because the row height is one number for the grid.
    const bars = fractionLayout(config({ style: "identify", model: "bar" }));
    const circles = fractionLayout(
      config({ style: "identify", model: "circle" }),
    );
    const mixture = fractionLayout(
      config({ style: "identify", model: "both" }),
    );
    expect(circles.row).toBeGreaterThan(bars.row);
    expect(mixture.row).toBe(circles.row);
    // And a written sheet reserves less than either, because it draws nothing.
    expect(fractionLayout(config()).row).toBeLessThan(bars.row);
  });
});

/**
 * What three sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — every one of them is proved right by the
 * assertions above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  unlike: [
    ["1/2 + 1/3 =", "5/6"],
    ["5/6 + 2/5 =", "37/30"],
    ["7/10 + 3/5 =", "13/10"],
    ["11/12 + 2/3 =", "19/12"],
  ],
  mixed: [
    ["3 1/2 − 2 1/2 =", "1"],
    ["3 3/5 − 1 1/3 =", "2 4/15"],
    ["3 7/8 − 2 5/6 =", "1 1/24"],
    ["2 1/2 − 1 1/3 =", "1 1/6"],
  ],
  identify: [
    ["bar", 2, 1, "1/2"],
    ["bar", 3, 2, "2/3"],
    ["circle", 4, 1, "1/4"],
    ["circle", 6, 1, "1/6"],
  ],
};
