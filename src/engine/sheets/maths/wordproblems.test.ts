import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { PROBLEM_GAP } from "../layout";
import type {
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  WordProblemConfig,
  WordTopic,
} from "../types";

import {
  MAX_TEXT,
  WORD_PROBLEMS_SHEET,
  WORD_TEMPLATES,
  wordLayout,
  wordStories,
} from "./wordproblems";

/**
 * Word problems, and the two things that can be wrong with one.
 *
 * **The answer.** Nothing here checks the generator against the generator: the
 * numbers are read back out of the printed *sentence*, in the order they appear
 * in it, and the answer is worked out again by a formula written down in this
 * file — one per template, by hand, from what the story says. A template whose
 * text and answer drifted apart fails, and so does one whose sentence stopped
 * printing a number it depends on. Division is a search by repeated addition;
 * there is no `/` anywhere below.
 *
 * The formulae are keyed by template id, and the suite refuses to run unless
 * there is exactly one for every template the family ships (`WORD_TEMPLATES`).
 * That is the part that matters over time: a twenty-first template cannot reach
 * paper without somebody writing down, separately, what its answer ought to be.
 *
 * **The reading.** The other half of the story (§11) is that a page must not
 * read as generated, so the variety is asserted rather than hoped for: every
 * problem on a mixed page comes from a different template, every template the
 * family holds actually appears on some page, and every sentence is a sentence —
 * a capital, a question mark, and no gap where a name should be.
 */

/* ── Arithmetic, from repeated addition ──────────────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function multiply(a: number, b: number): number {
  const [each, times] = a > b ? [a, b] : [b, a];
  let total = 0;
  for (let step = 0; step < times; step += 1) total += each;
  return total;
}

/** How many `b`s make `a`, counted up. Throws rather than round. */
function divide(a: number, b: number): number {
  if (b <= 0 || a < 0) throw new Error(`${a} ÷ ${b} is not a counting sum`);
  let total = 0;
  let how = 0;
  while (total < a) {
    total += b;
    how += 1;
  }
  if (total !== a) throw new Error(`${a} ÷ ${b} is not a whole number`);
  return how;
}

const least = (values: number[]): number =>
  values.reduce((low, value) => (value < low ? value : low));

const most = (values: number[]): number =>
  values.reduce((high, value) => (value > high ? value : high));

/* ── What each story's answer ought to be ────────────────────────────────── */

/**
 * One formula per template, over the numbers the sentence prints, in order.
 *
 * Written from the *story* rather than from the generator — "the temperature
 * was `n0` and fell `n1`, so it is `n0 − n1`" — which is what makes this a check
 * rather than a copy. Every one of them is spelled out, including the ones that
 * look too obvious to be worth writing: the obvious ones are where a sign goes
 * missing.
 */
const CHECKS: Record<string, (n: number[]) => number> = {
  /* Integers. */
  temperature: (n) => n[0] - n[1],
  height: (n) => n[0] - n[1],
  points: (n) => n[0] - n[1],
  // The floor is printed as a negative number, so the sum is an addition.
  lift: (n) => n[0] + n[1],

  /* Rate. */
  speed: (n) => divide(n[0], n[1]),
  boxes: (n) => divide(n[1], n[0]),
  recipe: (n) => multiply(n[0], divide(n[2], n[1])),
  reading: (n) => multiply(divide(n[0], n[1]), n[2]),

  /* Percent. */
  score: (n) => divide(multiply(n[0], 100), n[1]),
  share: (n) => divide(multiply(n[0], n[1]), 100),
  left: (n) => divide(multiply(n[0], 100 - n[1]), 100),
  increase: (n) => divide(multiply(n[0], 100 + n[1]), 100),

  /* Equations. */
  think: (n) => divide(n[2] - n[1], n[0]),
  gave: (n) => n[0] + n[1],
  shared: (n) => multiply(n[0], n[1]),
  consecutive: (n) => divide(n[0] - 1, 2),

  /* Averages. */
  games: (n) => divide(n[0] + n[1] + n[2] + n[3], 4),
  total: (n) => multiply(n[0], n[1]),
  spread: (n) => most(n) - least(n),
  equally: (n) => divide(n[0] + n[1] + n[2], 3),
};

/** The numbers a story prints, in the order it prints them. */
const numbersIn = (text: string): number[] =>
  (text.match(/−?\d+/g) ?? []).map((written) =>
    Number(written.replace(/−/g, "-")),
  );

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const EVERY_TOPIC: WordTopic[] = [
  "integers",
  "rate",
  "percent",
  "equation",
  "average",
];

const config = (over: Partial<WordProblemConfig> = {}): WordProblemConfig => ({
  kind: "word-problems",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  topics: EVERY_TOPIC,
  range: { min: 2, max: 20 },
  count: 8,
  columns: 2,
  ...over,
});

/** Every shape the family can print: each topic on its own, and mixed. */
const EVERY_SHAPE: Array<Partial<WordProblemConfig>> = [
  {},
  ...EVERY_TOPIC.map((topic) => ({ topics: [topic] })),
  { topics: ["integers", "equation"] as WordTopic[] },
  { range: { min: 1, max: 9 } },
  { range: { min: 5, max: 40 } },
  { workspace: false },
  { columns: 1 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The one block a word-problem sheet has, narrowed for the reader. */
function problemsOf(over: Partial<WordProblemConfig>, seed: number): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

const everyStory = function* (
  shapes: Array<Partial<WordProblemConfig>> = EVERY_SHAPE,
) {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const stories = wordStories(config(shape), seed);
      expect(stories.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const story of stories) yield story;
    }
  }
};

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the word-problem family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("word-problems")).toBe(WORD_PROBLEMS_SHEET);
    expect(sheetSpec("word-problems").label).toBe("Word problems");
  });

  it("names the sheet after its topic, and a mixed sheet after none", () => {
    expect(describeSheet(config({ topics: ["percent"] }))).toBe(
      "Word problems: percentages",
    );
    expect(describeSheet(config({ topics: ["integers", "rate"] }))).toBe(
      "Word problems — integers, ratio and rate",
    );
  });

  it("tells a child what to do with a page of sentences", () => {
    expect(buildSheet(config(), 1).header.instructions).toBe(
      "Read each problem and write the answer.",
    );
  });

  it("marks the sheet out of what is on it", () => {
    const sheet = buildSheet(config({ count: 6 }), 3);
    const block = sheet.blocks[0];
    expect(block.kind === "problems" && block.items.length).toBe(
      sheet.header.score?.outOf,
    );
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("has a formula of its own for every template that ships", () => {
    // The check that keeps the rest of this file honest over time: a new
    // template cannot reach paper until somebody has written down, separately,
    // what its answer ought to be.
    expect([...WORD_TEMPLATES].sort()).toEqual(Object.keys(CHECKS).sort());
  });

  it("answers every story the way its sentence says it should", () => {
    for (const story of everyStory()) {
      const check = CHECKS[story.id];
      expect(check, `no check for ${story.id}`).toBeDefined();
      expect(
        Number(story.answer.replace(/−/g, "-")),
        `${story.id}: ${story.text} → ${story.answer}`,
      ).toBe(check(numbersIn(story.text)));
    }
  });

  it("prints a story's answer as a number and nothing else", () => {
    for (const story of everyStory()) {
      expect(story.answer, story.text).toMatch(/^−?\d+$/);
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

/* ── How the page reads (§11) ──────────────────────────────────────────── */

describe("a page that does not read as generated", () => {
  it("uses a different template for every problem on a mixed page", () => {
    // Twelve templates drawn at random out of twenty give the same one twice on
    // most pages, and two stories with one skeleton and two names is exactly
    // what a reader notices first.
    for (const seed of SEEDS) {
      // As many as the page holds, which is eight of the twenty templates.
      const stories = wordStories(config({ count: 12 }), seed);
      expect(stories.length).toBeGreaterThanOrEqual(8);
      expect(new Set(stories.map((story) => story.id)).size).toBe(
        stories.length,
      );
    }
  });

  it("asks about the topics it was given and no others", () => {
    for (const topic of EVERY_TOPIC) {
      for (const seed of SEEDS) {
        const stories = wordStories(config({ topics: [topic] }), seed);
        expect(stories.length).toBeGreaterThan(0);
        for (const story of stories) expect(story.topic).toBe(topic);
      }
    }
  });

  it("ships no template that never gets printed", () => {
    const seen = new Set<string>();
    for (const seed of [0, 1, 2, 3, 4, 5, 6, 7]) {
      for (const topic of EVERY_TOPIC) {
        for (const story of wordStories(
          config({ topics: [topic], count: 8 }),
          seed,
        )) {
          seen.add(story.id);
        }
      }
    }
    expect([...seen].sort()).toEqual([...WORD_TEMPLATES].sort());
  });

  it("writes a whole sentence every time", () => {
    for (const story of everyStory()) {
      // A capital at the front, a question at the end, and nothing in the
      // middle that gives away that it came out of a template.
      expect(story.text[0], story.text).toBe(story.text[0].toUpperCase());
      expect(story.text.endsWith("?"), story.text).toBe(true);
      expect(story.text, story.text).not.toMatch(/undefined|NaN|\{|\}|_/);
      expect(story.text, story.text).not.toMatch(/ {2}/);
    }
  });

  it("keeps every story inside the length the layout reserved for it", () => {
    // The row is declared, not measured (§4): a story longer than the cap is a
    // row taller than the page allowed for, which is the last problem printed
    // on a second sheet of paper.
    for (const story of everyStory()) {
      expect(story.text.length, story.text).toBeLessThanOrEqual(MAX_TEXT);
    }
  });

  it("varies the names, so a page is not one child's whole day", () => {
    const names = new Set(
      wordStories(config({ count: 12 }), 3).flatMap(
        (story) => story.text.match(/^[A-Z][a-z]+/) ?? [],
      ),
    );
    expect(names.size).toBeGreaterThan(3);
  });
});

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("gives every problem exactly one place to write the answer", () => {
    for (const [, problem] of everyProblem()) {
      expect(problem.prompt.split("_").length - 1).toBe(0);
      expect(problem.answers).toBeUndefined();
    }
  });

  it("leaves room to work in unless the sheet says not to", () => {
    // A word problem is the one sheet where the working is most of the task,
    // so the space is there unless a parent turns it off.
    expect(problemsOf({}, 1)[0].workspace).toBeGreaterThan(0);
    expect(problemsOf({ workspace: false }, 1)[0].workspace).toBeUndefined();
  });

  it("tells the same story twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const asked = problemsOf(shape, seed).map((problem) => problem.prompt);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(asked.length);
      }
    }
  });

  it("prints nothing rather than something wrong when the ask is impossible", () => {
    // A sheet with no topic on it has nothing to write about. An empty sheet is
    // the honest answer, and the builder's job to prevent.
    expect(problemsOf({ topics: [] }, 1)).toEqual([]);
    expect(problemsOf({ topics: ["algebra" as WordTopic] }, 1)).toEqual([]);
  });
});

const everyProblem = function* (
  shapes: Array<Partial<WordProblemConfig>> = EVERY_SHAPE,
): Generator<[Partial<WordProblemConfig>, Problem]> {
  for (const shape of shapes) {
    for (const seed of SEEDS) {
      const problems = problemsOf(shape, seed);
      expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
      for (const problem of problems) yield [shape, problem];
    }
  }
};

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
    expect(
      wordStories(config({ count: 3 }), 7).map((story) => [
        story.text,
        story.answer,
      ]),
    ).toEqual(GOLDEN);
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
        expect(shared, JSON.stringify(shape)).toBe(0);
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
            const { box, columns, row } = wordLayout(config(over));
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

  it("reserves more lines for bigger type and for a narrower column", () => {
    // The one row in the shop counted in lines of text, so the two things that
    // decide how many lines there are have to reach it.
    expect(wordLayout(config({ fontPt: 18 })).lines).toBeGreaterThan(
      wordLayout(config({ fontPt: 12 })).lines,
    );
    expect(wordLayout(config({ columns: 2 })).lines).toBeGreaterThan(
      wordLayout(config({ columns: 1 })).lines,
    );
  });

  it("does not throw the page away either", () => {
    const { perPage } = wordLayout(config());
    expect(perPage).toBeGreaterThanOrEqual(8);
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ count: 6 }, 1).length).toBe(6);
    for (const columns of [1, 2]) {
      const block = buildSheet(config({ columns }), 1).blocks[0];
      expect(block.kind === "problems" && block.columns).toBe(columns);
    }
    // Never three: a sentence set in a third of a page is a paragraph.
    const wide = buildSheet(config({ columns: 4 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(2);
  });
});

/**
 * What one sheet came out as on the day this shipped.
 *
 * Recorded rather than computed — it is proved right by the assertions above,
 * and what this holds is that it does not silently *change*.
 */
const GOLDEN: Array<[string, string]> = [
  [
    "Three friends have 19, 12 and 8 shells. If they share them equally, how many does each one get?",
    "13",
  ],
  [
    "Maya reads 16 pages in 8 days. At that rate, how many pages will Maya read in 3 days?",
    "6",
  ],
  [
    "A train travels 72 miles to the mountains in 8 hours. How far does it go in one hour?",
    "9",
  ],
];
