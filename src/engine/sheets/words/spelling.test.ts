import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { answerLine } from "../layout";
import type { Blank, Paper, Problem, WordsConfig } from "../types";

import { WORDS_SHEET, gapped, wordsLayout, wordsOf } from "./spelling";

/**
 * Spelling, held to the bar the maths families set.
 *
 * The answers here are not arithmetic, so "verified by an independent path"
 * means something different and just as strict: a gapped word is checked by
 * **putting the letters back**. Reading `answers` into the underscores of
 * `text` has to rebuild the word exactly — a test that compared the generator's
 * gaps against the generator's answers would pass on a family that took out
 * one letter and printed another.
 *
 * The rest is what a list-driven family can get wrong that a generated one
 * cannot: dropping a word, printing one twice, or putting more of them on the
 * page than the paper holds.
 */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const WORDS = ["because", "thought", "friend", "people", "through"];

const config = (over: Partial<WordsConfig> = {}): WordsConfig => ({
  kind: "words",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "copy",
  words: WORDS,
  times: 3,
  gaps: 2,
  count: WORDS.length,
  columns: 2,
  ...over,
});

function problemsOf(over: Partial<WordsConfig>, seed = 1): Problem[] {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== "problems")
    throw new Error(`expected problems, got ${block.kind}`);
  return block.items;
}

function blanksOf(over: Partial<WordsConfig>, seed = 1): Blank[] {
  const block = buildSheet(config({ style: "missing", ...over }), seed)
    .blocks[0];
  if (block.kind !== "blanks")
    throw new Error(`expected blanks, got ${block.kind}`);
  return block.sentences;
}

/** The word a gapped sentence came from, rebuilt by putting the letters back. */
function refilled(blank: Blank): string {
  let at = 0;
  return blank.text.replaceAll("_", () => blank.answers[at++] ?? "?");
}

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the spelling family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("words")).toBe(WORDS_SHEET);
    expect(sheetSpec("words").label).toBe("Spelling list");
  });

  it("names what it prints, in the terms it was chosen by", () => {
    expect(describeSheet(config())) //
      .toBe("Spelling practice — 5 words — written 3 times");
    expect(describeSheet(config({ style: "missing", gaps: 1 }))) //
      .toBe("Missing letters — 5 words — 1 letter out");
    expect(describeSheet(config({ style: "test" }))) //
      .toBe("Spelling test — 5 words");
  });

  it("titles the sheet and marks it out of its own words", () => {
    const sheet = buildSheet(config(), 1);
    expect(sheet.header.title).toBe("Spelling practice");
    expect(sheet.header.instructions).toBe("Write each word 3 times.");
    expect(sheet.header.score).toEqual({ outOf: 5 });
  });

  it("points back at the game that reads these words aloud", () => {
    // §16: the child who just wrote out twenty words is the likeliest one to
    // race them, and the sheet is the only place that link can be made.
    expect(buildSheet(config(), 1).footer.url).toBe(
      "schoolskills.app/spelling/play",
    );
  });
});

/* ── The three styles ──────────────────────────────────────────────────── */

describe("writing it out", () => {
  it("gives every word its list order and a rule for each writing", () => {
    const items = problemsOf({ times: 4 });
    expect(items.map((item) => item.prompt)).toEqual(WORDS);
    for (const item of items) {
      expect(item.answers).toEqual(Array(4).fill(item.prompt));
      // The rules share the height the layout reserved rather than being added
      // under it, which is what keeps the row as tall as it was declared.
      expect(item.workspace).toBe(4 * answerLine(12));
    }
  });

  it("holds the number of writings inside what a page can take", () => {
    // A saved config may say anything; six writings of a word is a row taller
    // than the family ever reserved for.
    expect(problemsOf({ times: 99 })[0].answers).toHaveLength(5);
    expect(problemsOf({ times: 0 })[0].answers).toHaveLength(1);
  });
});

describe("missing letters", () => {
  it("takes out letters it can spare, and never the first", () => {
    // The number is a request rather than a promise, as `count` is everywhere
    // else in the shop: a six-letter word cannot spare three letters and keep
    // the gaps apart, and taking them anyway would print one long rule.
    for (const gaps of [1, 2, 3]) {
      for (const blank of blanksOf({ gaps })) {
        expect(blank.answers.length).toBeGreaterThan(0);
        expect(blank.answers.length).toBeLessThanOrEqual(gaps);
        expect(blank.text.startsWith("_")).toBe(false);
      }
    }
    // One letter out of a long word is a promise it can always keep.
    expect(blanksOf({ gaps: 1 })[0].answers).toHaveLength(1);
  });

  it("never takes two letters out side by side", () => {
    // A rendering constraint as much as a teaching one: `Blanks` reads a run
    // of underscores as *one* gap, so "bec__se" is a single rule expecting two
    // letters and a key that prints only the first of them.
    for (const seed of [0, 1, 2, 3, 4, 5]) {
      for (const gaps of [2, 3, 4]) {
        for (const blank of blanksOf({ gaps }, seed)) {
          expect(blank.text, blank.text).not.toContain("__");
          // One gap, one letter to write in it — however few the word spared.
          expect(blank.text.match(/_/g) ?? []) //
            .toHaveLength(blank.answers.length);
        }
      }
    }
  });

  it("puts back exactly the word it took the letters out of", () => {
    // The independent path: the answers are checked against the *word*, not
    // against the gaps the generator chose. A family that blanked one letter
    // and answered with another passes every other test in this file.
    for (const seed of [0, 1, 2, 99]) {
      const blanks = blanksOf({ gaps: 2 }, seed);
      expect(blanks.map(refilled)).toEqual(WORDS);
    }
  });

  it("leaves a word with nothing to take out whole", () => {
    // A single letter has no interior, and blanking it to nothing would be a
    // question with no word in it. Printing it whole is the honest answer.
    const [blank] = blanksOf({ words: ["a"], count: 1 });
    expect(blank).toEqual({ text: "a", answers: [] });
  });

  it("takes different letters out for a different sheet", () => {
    // "Another sheet like this one" is `seed + 1` here as everywhere (§7), and
    // on this style it has to change the gaps or it changes nothing at all.
    const first = blanksOf({ gaps: 2, words: ["thoroughly"], count: 1 }, 1);
    const next = blanksOf({ gaps: 2, words: ["thoroughly"], count: 1 }, 2);
    expect(first[0].text).not.toBe(next[0].text);
  });

  it("holds the number of gaps inside what a word can spare", () => {
    expect(gapped("cat", 99, () => 0.5).answers.length).toBeLessThanOrEqual(2);
  });
});

describe("the spelling test", () => {
  it("prints a numbered rule and nothing to copy from", () => {
    // The words are read aloud; a sheet with them on it is a copying exercise.
    const items = problemsOf({ style: "test" });
    expect(items.map((item) => item.prompt)).toEqual(["", "", "", "", ""]);
    expect(items.map((item) => item.answer)).toEqual(WORDS);
    expect(items.every((item) => item.answers === undefined)).toBe(true);
  });
});

/* ── The key ───────────────────────────────────────────────────────────── */

describe("the answer key", () => {
  it("prints the answers only when the sheet is a key", () => {
    expect(buildSheet(config(), 3).answers).toBe(false);
    const key = answerKey(config(), 3);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
  });

  it("is the same sheet keyed, never a second generation", () => {
    // The gaps are drawn from the seed, so a key that regenerated them would
    // ask for one letter and answer with another.
    const sheet = buildSheet(config({ style: "missing" }), 7);
    const key = answerKey(config({ style: "missing" }), 7);
    expect({ ...key, answers: false, footer: sheet.footer }).toEqual(sheet);
  });
});

/* ── The list ──────────────────────────────────────────────────────────── */

describe("the list itself", () => {
  it("reads a saved list back safely", () => {
    // The config comes through the same doors a deck does — a paste, a saved
    // sheet, a link somebody was sent — and only one of those has ever been
    // near a validator.
    expect(
      wordsOf(config({ words: ["  cat ", "", "cat", "Cat", "dog\tfox"] })),
    ).toEqual(["cat", "dog fox"]);
  });

  it("keeps the order it was given", () => {
    // A spelling list is often taught in order, and a list of missed words
    // arrives ranked worst-first. Neither is ours to shuffle.
    expect(wordsOf(config())).toEqual(WORDS);
  });

  it("builds the same sheet twice", () => {
    expect(buildSheet(config({ style: "missing" }), 12)).toEqual(
      buildSheet(config({ style: "missing" }), 12),
    );
  });

  it("never prints more words than the paper holds", () => {
    const many = Array.from({ length: 200 }, (_, i) => `word${i}`);
    for (const style of ["copy", "missing", "test"] as const) {
      const over = { style, words: many, count: many.length };
      const { perPage } = wordsLayout(config(over));
      const sheet = buildSheet(config(over), 1);
      const block = sheet.blocks[0];
      const printed =
        block.kind === "blanks"
          ? block.sentences.length //
          : block.kind === "problems"
            ? block.items.length
            : 0;
      expect(printed, style).toBe(perPage);
      expect(sheet.header.score).toEqual({ outOf: perPage });
    }
  });

  it("prints an empty list as an empty page rather than throwing", () => {
    // A `kind` with no list behind it is a sheet somebody arrived at from a
    // link, and the promise everywhere else in the shop holds here: it prints
    // something, and says what it is.
    const sheet = buildSheet(config({ words: [], count: 0 }), 1);
    expect(sheet.header.title).toBe("Spelling practice");
    expect(sheet.header.score).toEqual({ outOf: 0 });
  });
});
