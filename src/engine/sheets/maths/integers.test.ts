import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP } from "../layout";
import type {
  IntegerConfig,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
} from "../types";

import { INTEGERS_SHEET, integerLayout } from "./integers";

/**
 * Integers, order of operations, powers and roots — held to the bar the maths
 * families set.
 *
 * **Nothing here checks the generator against the generator.** The family holds
 * every number as a signed integer and prints it at the end; this file only ever
 * reads what was *printed*, tokenises it, and works the answer out again by a
 * path the family does not have:
 *
 * - **addition and subtraction are counted**, one step at a time along the
 *   number line, which is the only arithmetic in this file that is not built out
 *   of `walk`. A sign dropped anywhere between the draw and the paper fails
 *   here, because counting down from 7 nine times reaches −2 whatever the
 *   generator believed;
 * - **multiplication is repeated addition** and its sign comes from counting the
 *   negative factors, not from a product;
 * - **division is checked by multiplying back** — the classic independent check,
 *   and the only honest one for a quotient;
 * - **an expression is parsed**, with its own precedence, from the characters on
 *   the page. A template whose text and value disagree — the one bug an
 *   order-of-operations sheet can have — has nowhere to hide, because the value
 *   in the key was never consulted while reading the line.
 */

/* ── Arithmetic, from ±1 upwards ─────────────────────────────────────────── */

/** `from`, stepped one at a time. The only arithmetic here that is not this. */
function walk(from: number, by: number): number {
  let value = from;
  for (let step = 0; step < Math.abs(by); step += 1) value += by < 0 ? -1 : 1;
  return value;
}

/**
 * `a` added to itself `b` times, and the sign counted rather than computed.
 *
 * Added the fewer number of times of the two, which is the same product and a
 * great deal less counting: the roots below are searched for by raising every
 * candidate, and a suite that takes a minute is a suite nobody runs.
 */
function multiply(a: number, b: number): number {
  const negatives = (a < 0 ? 1 : 0) + (b < 0 ? 1 : 0);
  const [each, times] =
    Math.abs(a) > Math.abs(b)
      ? [Math.abs(a), Math.abs(b)]
      : [Math.abs(b), Math.abs(a)];
  let total = 0;
  for (let step = 0; step < times; step += 1) total = walk(total, each);
  return negatives === 1 ? -total : total;
}

/** The number that multiplies back, or nothing at all. */
function divide(a: number, b: number): number {
  if (b === 0) throw new Error("divided by nothing");
  for (let q = -SEARCH; q <= SEARCH; q += 1) {
    if (multiply(q, b) === a) return q;
  }
  throw new Error(`${a} ÷ ${b} is not a whole number`);
}

/** How far a quotient is looked for. Bigger than any sheet asks for. */
const SEARCH = 400;

/** And a root, which is a much smaller number: 20³ is eight thousand. */
const ROOT_SEARCH = 20;

/* ── Reading what was printed ────────────────────────────────────────────── */

/**
 * The characters of an expression, split into numbers, operators and brackets.
 *
 * A minus sign that belongs to a *number* is written against it — "−4" — and a
 * minus sign that is an operator has a space on each side, which is what tells
 * the two apart without knowing anything about where they came from.
 */
function tokens(text: string): string[] {
  const src = text.replace(/=$/, "").trim();
  const out: string[] = [];
  let at = 0;
  while (at < src.length) {
    const char = src[at];
    if (char === " ") {
      at += 1;
    } else if ("()+×÷²³√∛".includes(char)) {
      out.push(char);
      at += 1;
    } else if (
      /\d/.test(char) ||
      (char === "−" && /\d/.test(src[at + 1] ?? ""))
    ) {
      let end = char === "−" ? at + 1 : at;
      while (/\d/.test(src[end] ?? "")) end += 1;
      out.push(src.slice(at, end));
      at = end;
    } else if (char === "−") {
      out.push("−");
      at += 1;
    } else {
      throw new Error(`what is "${char}" doing in "${text}"?`);
    }
  }
  return out;
}

const numberOf = (token: string): number =>
  token.startsWith("−") ? -Number(token.slice(1)) : Number(token);

/**
 * What an expression works out to, read off the page.
 *
 * A recursive descent with the precedence a child is taught: brackets, then
 * powers and roots, then × and ÷, then + and −. Written out longhand rather
 * than handed to `eval`, both because the sheet prints × and ÷ rather than
 * their keyboard spellings and because the point of the exercise is to have a
 * second opinion about what the line says.
 */
function evaluate(text: string): number {
  const list = tokens(text);
  let at = 0;
  const peek = (): string | undefined => list[at];
  const take = (): string => list[at++];

  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "−") {
      const operator = take();
      const right = product();
      value = operator === "+" ? walk(value, right) : walk(value, -right);
    }
    return value;
  }

  function product(): number {
    let value = power();
    while (peek() === "×" || peek() === "÷") {
      const operator = take();
      const right = power();
      value = operator === "×" ? multiply(value, right) : divide(value, right);
    }
    return value;
  }

  function power(): number {
    const base = atom();
    if (peek() === "²") {
      take();
      return multiply(base, base);
    }
    if (peek() === "³") {
      take();
      return multiply(multiply(base, base), base);
    }
    return base;
  }

  function atom(): number {
    const token = take();
    if (token === "(") {
      const value = sum();
      if (take() !== ")") throw new Error(`unclosed bracket in "${text}"`);
      return value;
    }
    // A root is the one prefix on a sheet: the number under it is the whole of
    // the question, and what comes back is the number that powers up to it.
    if (token === "√" || token === "∛") {
      const under = atom();
      for (let root = -ROOT_SEARCH; root <= ROOT_SEARCH; root += 1) {
        const raised =
          token === "√"
            ? multiply(root, root)
            : multiply(multiply(root, root), root);
        // A square root is the positive one by convention, and nothing else.
        if (raised === under && (token === "∛" || root >= 0)) return root;
      }
      throw new Error(`${token}${under} is not a whole number`);
    }
    return numberOf(token);
  }

  const value = sum();
  if (at !== list.length) throw new Error(`did not read all of "${text}"`);
  return value;
}

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<IntegerConfig> = {}): IntegerConfig => ({
  kind: "integers",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "arithmetic",
  operation: "both",
  range: { min: 1, max: 12 },
  count: 12,
  columns: 3,
  ...over,
});

/**
 * Every shape the family can print: the four operations over the integers,
 * order of operations with two operations and with three, and powers with the
 * roots that undo them.
 */
const EVERY_SHAPE: Array<Partial<IntegerConfig>> = [
  {},
  { operation: "add" },
  { operation: "subtract" },
  { operation: "multiply" },
  { operation: "divide" },
  { operation: "both", negatives: false },
  { range: { min: 2, max: 30 } },
  { style: "order" },
  { style: "order", terms: 3 },
  { style: "order", negatives: false },
  { style: "order", terms: 3, negatives: false, range: { min: 2, max: 9 } },
  // The sheet the catalog prints: the rule, a term before exponents.
  { style: "order", powers: false },
  { style: "order", terms: 3, negatives: false, powers: false },
  { style: "powers" },
  { style: "powers", negatives: false },
  { style: "powers", range: { min: 2, max: 7 } },
  { workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block an integer sheet has, narrowed for the reader. */
function problemsOf(over: Partial<IntegerConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

const everyProblem = function* (
  shapes: Array<Partial<IntegerConfig>> = EVERY_SHAPE,
): Generator<[Partial<IntegerConfig>, Problem]> {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const problems = problemsOf(shape, seed);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) yield [shape, problem];
    }
  }
};

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the integers family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("integers")).toBe(INTEGERS_SHEET);
    expect(sheetSpec("integers").label).toBe("Integers and powers");
  });

  it("names the sheet in the words a parent chose it by", () => {
    expect(describeSheet(config({ operation: "multiply" }))).toBe(
      "Multiplying integers — positive and negative — numbers to 12",
    );
    expect(describeSheet(config({ style: "order", terms: 3 }))).toBe(
      "Order of operations — positive and negative — numbers to 12 — 3 operations",
    );
    expect(describeSheet(config({ style: "powers", negatives: false }))).toBe(
      "Powers and roots — positive numbers only — squares and cubes",
    );
    // A config arrives from a bookmark or from a sheet saved months ago, so the
    // numbers in it are not to be trusted: seven operations prints three, and
    // the line has to say three.
    expect(describeSheet(config({ style: "order", terms: 7 }))).toBe(
      "Order of operations — positive and negative — numbers to 12 — 3 operations",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 8 }), 3);
    const block = sheet.blocks[0];
    expect(sheet.header.title).toBe("Integer arithmetic");
    expect(sheet.header.instructions).toBe(
      "Work out each answer. Watch the signs.",
    );
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });

  it("tells a child which rule an order-of-operations sheet is about", () => {
    expect(buildSheet(config({ style: "order" }), 1).header.instructions).toBe(
      "Work out each answer. Brackets first, then powers, then × and ÷.",
    );
  });

  it("takes the squares off an order sheet, and says so at the top of it", () => {
    // Two lessons on one page: a child taught which operation binds tightest is
    // usually a term away from meeting exponents, and `3² + 10 × 2` is four
    // problems they cannot start. The instruction line moves with the switch,
    // because a sheet that told them to do powers first and then printed none
    // is teaching them to look for a step that is not there.
    expect(
      buildSheet(
        config({ style: "order", powers: false }),
        1,
      ) //
      .header.instructions,
    ).toBe("Work out each answer. Brackets first, then × and ÷, then + and −.");

    for (const terms of [2, 3]) {
      for (const seed of SEEDS) {
        const shape = { style: "order" as const, terms, powers: false };
        const problems = problemsOf({ ...shape, count: 9 }, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          expect(problem.prompt, problem.prompt).not.toContain("²");
        }
      }
    }

    // And the sheet that did not ask still has them, at both lengths — the rule
    // as it is taught is brackets, powers, then × and ÷.
    const squared = [2, 3]
      .flatMap((terms) =>
        SEEDS.flatMap((seed) =>
          problemsOf({ style: "order", terms, count: 12 }, seed),
        ),
      )
      .filter((problem) => problem.prompt.includes("²"));
    expect(squared.length).toBeGreaterThan(0);
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("gets the sign right on every sum, counted along the number line", () => {
    for (const [shape, problem] of everyProblem(
      EVERY_SHAPE.filter((one) => (one.style ?? "arithmetic") === "arithmetic"),
    )) {
      const said = JSON.stringify(shape);
      const [left, operator, right] = parts(problem.prompt);
      const answer = numberOf(problem.answer);
      if (operator === "+")
        expect(answer, `${problem.prompt} ${said}`).toBe(walk(left, right));
      if (operator === "−")
        expect(answer, `${problem.prompt} ${said}`).toBe(walk(left, -right));
      if (operator === "×")
        expect(answer, `${problem.prompt} ${said}`).toBe(multiply(left, right));
      // The one check that is not a second computation but a proof: a quotient
      // is right when it multiplies back to what it was divided out of.
      if (operator === "÷")
        expect(multiply(answer, right), `${problem.prompt} ${said}`).toBe(left);
    }
  });

  it("works every expression out again from the characters on the page", () => {
    for (const [shape, problem] of everyProblem(
      EVERY_SHAPE.filter((one) => one.style === "order"),
    )) {
      expect(
        numberOf(problem.answer),
        `${problem.prompt} ${JSON.stringify(shape)}`,
      ) //
        .toBe(evaluate(problem.prompt));
    }
  });

  it("raises and roots by repeated multiplication", () => {
    for (const [, problem] of everyProblem(
      EVERY_SHAPE.filter((one) => one.style === "powers"),
    )) {
      expect(numberOf(problem.answer), problem.prompt).toBe(
        evaluate(problem.prompt),
      );
    }
  });

  it("never asks for the square root of a negative number", () => {
    // There isn't one, and a sheet that asked would have a blank a child cannot
    // fill in however well they have been taught.
    for (const [, problem] of everyProblem([
      { style: "powers" },
      { style: "powers", range: { min: 2, max: 12 } },
    ])) {
      expect(problem.prompt, problem.prompt).not.toMatch(/√\s*−/);
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

/** The three parts of a sum written along a line: two numbers and a sign. */
function parts(prompt: string): [number, string, number] {
  const list = tokens(prompt);
  if (list.length !== 3 && list.length !== 5)
    throw new Error(`not a sum: "${prompt}"`);
  // A negative operand is bracketed, which is three tokens where one would do.
  const right = list.length === 3 ? list[2] : list[3];
  return [numberOf(list[0]), list[1], numberOf(right)];
}

/* ── Signs, which are the whole of this family (§20) ─────────────────────── */

describe("how a sign is written", () => {
  it("brackets a negative number that follows an operator", () => {
    // `7 + −4` is two operators in a row, and a child asked to read it aloud
    // has been asked the wrong question.
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt, problem.prompt).not.toMatch(/[+−×÷] −/);
    }
  });

  it("puts no minus sign at all on a sheet that turned them off", () => {
    // Not in the question, not in the answer, and not in the middle either:
    // `(4 − 9) × 3` has every number positive and is still an integers sheet.
    for (const [, problem] of everyProblem(
      EVERY_SHAPE.filter((one) => one.negatives === false),
    )) {
      const sentence = `${problem.prompt} ${problem.answer}`;
      expect(sentence, sentence).not.toMatch(/−\d/);
      expect(evaluate(problem.prompt), problem.prompt).toBeGreaterThanOrEqual(
        0,
      );
      const bracket = /\((\d+) ([+−]) (\d+)\)/.exec(problem.prompt);
      if (bracket) {
        const [left, right] = [Number(bracket[1]), Number(bracket[3])];
        expect(
          bracket[2] === "+" ? left + right : left - right,
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("puts minus signs on a sheet that asked for them", () => {
    // The other half of the switch: a family that quietly stopped drawing
    // negatives would pass every test above this one.
    const seen = problemsOf({ count: 20 }, 3).filter((problem) =>
      /−\d/.test(`${problem.prompt} ${problem.answer}`),
    );
    expect(seen.length).toBeGreaterThan(4);
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("draws its numbers inside the range a parent asked for", () => {
    // The sizes, sign aside — and the numbers *drawn*, which is what a range
    // means everywhere in the shop: a product or a dividend built from two of
    // them runs past it, exactly as a sum does on an addition sheet.
    for (const range of [
      { min: 1, max: 9 },
      { min: 2, max: 12 },
      { min: 5, max: 30 },
    ]) {
      for (const operation of ["add", "subtract", "multiply"] as const) {
        for (const problem of problemsOf({ range, operation, count: 12 }, 6)) {
          const [left, , right] = parts(problem.prompt);
          for (const value of [left, right]) {
            expect(Math.abs(value), problem.prompt).toBeGreaterThanOrEqual(
              range.min,
            );
            expect(Math.abs(value), problem.prompt).toBeLessThanOrEqual(
              range.max,
            );
          }
        }
      }
    }
  });

  it("keeps an order-of-operations expression inside the ceiling it declares", () => {
    // The family holds these numbers down to twelve whatever the range says,
    // because the rule being practised is which operation goes first. What the
    // cap must not do is turn the range round on the way: a range starting
    // above it would draw *between* the cap and the ask — thirteen to nineteen
    // on a sheet that asked for twenty to thirty — which is neither.
    //
    // Written out here rather than imported, as everything in this file is.
    const CEILING = 12;
    for (const range of [
      { min: 1, max: 9 },
      { min: 2, max: 30 },
      { min: 20, max: 30 },
    ]) {
      for (const terms of [2, 3]) {
        const shape = { style: "order" as const, terms, range, count: 9 };
        // A dividend runs past the range exactly as a product does — it is
        // built from two drawn numbers — so the lines it is on are read for
        // what they say about the draw everywhere else in this suite, and left
        // out of a bound on the numbers themselves.
        const problems = problemsOf(shape, 5).filter(
          (problem) => !problem.prompt.includes("÷"),
        );
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          for (const token of tokens(problem.prompt)) {
            if (!/\d/.test(token)) continue;
            expect(Math.abs(numberOf(token)), problem.prompt) //
              .toBeLessThanOrEqual(Math.min(range.max, CEILING));
          }
        }
      }
    }
  });

  it("never divides by nothing", () => {
    for (const [, problem] of everyProblem([
      { operation: "divide", count: 16 },
      { operation: "divide", range: { min: 1, max: 4 } },
      { style: "order", terms: 2 },
    ])) {
      expect(problem.prompt, problem.prompt).not.toMatch(/÷ \(?0/);
    }
  });

  it("gives every problem exactly one place to write the answer", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt.split("_").length - 1).toBe(0);
      expect(problem.answers).toBeUndefined();
    }
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const asked = problemsOf(shape, seed).map((problem) => problem.prompt);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(asked.length);
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // Cubes of numbers from fifty to sixty is a request with no answers in it.
    expect(
      problemsOf({ style: "powers", range: { min: 50, max: 60 } }, 1),
    ).toEqual([]);
    expect(problemsOf({ count: 0 }, 1)).toEqual([]);
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

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy.
    expect(problemsOf({ count: 4 }, 4242).map(said)).toEqual(GOLDEN.arithmetic);
    expect(problemsOf({ style: "order", count: 3 }, 7).map(said)).toEqual(
      GOLDEN.order,
    );
    expect(problemsOf({ style: "powers", count: 4 }, 11).map(said)).toEqual(
      GOLDEN.powers,
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

  it("never prints more problems than the paper holds", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row } = integerLayout(config(over));
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
    const { box, row, perPage, columns } = integerLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(20);
    const rows = perPage / columns;
    expect((rows + 1) * row + rows * PROBLEM_GAP.y).toBeGreaterThan(box.height);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 10 }, 1).length).toBe(10);
    for (const columns of [1, 2, 3]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Two columns of expressions, because `(9 − 4) × 3 + 7 =` is half a line
    // of type before its answer slot.
    const wide = buildSheet(config({ style: "order", columns: 6 }), 1)
      .blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(2);
  });
});

/**
 * What three sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — all three are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  arithmetic: [
    ["4 × 7 =", "28"],
    ["−4 − 5 =", "−9"],
    ["10 × (−12) =", "−120"],
    ["88 ÷ (−11) =", "−8"],
  ],
  order: [
    ["1 + 9 × (−5) =", "−44"],
    ["7 − (−4) × 10 =", "47"],
    ["−5 − (−7) × (−12) =", "−89"],
  ],
  powers: [
    ["5³ =", "125"],
    ["(−5)³ =", "−125"],
    ["(−4)³ =", "−64"],
    ["√81 =", "9"],
  ],
};
