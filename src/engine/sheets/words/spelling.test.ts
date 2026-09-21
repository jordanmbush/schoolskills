import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet } from "../index";
import { printedBlockBox } from "../chrome";
import { describeSheetFamily } from "../contract";
import { answerLine } from "../layout";
import type {
  Blank,
  Block,
  Choice,
  MarginSize,
  Paper,
  PaperSize,
  Problem,
  Sheet,
  WordSheetStyle,
  WordShape,
  WordsConfig,
} from "../types";

import { letterShape } from "./shapes";
import {
  WORDS_SHEET,
  alphabetical,
  gapped,
  wordsLayout,
  wordsOf,
} from "./spelling";

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

/**
 * One block a page, in order, with a `break` between. A spelling sheet prints
 * nothing else, so a second block on a page is a failure here rather than a
 * page silently skipped.
 */
function pagesOf(sheet: Sheet): Block[] {
  const pages: Block[] = [];
  let open = false;
  for (const block of sheet.blocks) {
    if (block.kind === "break") {
      expect(open, "a break with no page before it").toBe(true);
      open = false;
      continue;
    }
    expect(open, "two blocks on one page").toBe(false);
    pages.push(block);
    open = true;
  }
  return pages;
}

/** The pages of a sheet, each narrowed to the block kind its style prints. */
function pagesAs<K extends Block["kind"]>(
  sheet: Sheet,
  kind: K,
): Array<Extract<Block, { kind: K }>> {
  return pagesOf(sheet).map((block) => {
    if (block.kind !== kind)
      throw new Error(`expected ${kind}, got ${block.kind}`);
    return block as Extract<Block, { kind: K }>;
  });
}

function problemsOf(over: Partial<WordsConfig>, seed = 1): Problem[] {
  return pagesAs(buildSheet(config(over), seed), "problems") //
    .flatMap((page) => page.items);
}

function blanksOf(over: Partial<WordsConfig>, seed = 1): Blank[] {
  return pagesAs(
    buildSheet(config({ style: "missing", ...over }), seed),
    "blanks",
  ) //
    .flatMap((page) => page.sentences);
}

function questionsOf(over: Partial<WordsConfig>, seed = 1): Choice[] {
  return pagesAs(buildSheet(config({ style: "find", ...over }), seed), "choice") //
    .flatMap((page) => page.questions);
}

function shapesOf(over: Partial<WordsConfig>, seed = 1): WordShape[] {
  return pagesAs(
    buildSheet(config({ style: "shapes", ...over }), seed),
    "wordshapes",
  ).flatMap((page) => page.words);
}

/** How many words a page put on the paper, whichever block it is. */
function countOf(block: Block): number {
  switch (block.kind) {
    case "problems":
      return block.items.length;
    case "blanks":
      return block.sentences.length;
    case "choice":
      return block.questions.length;
    case "wordshapes":
      return block.words.length;
    default:
      throw new Error(`unexpected block ${block.kind}`);
  }
}

/** The number a page's first word carries — every spelling block numbers. */
function startOf(block: Block): number | undefined {
  switch (block.kind) {
    case "problems":
    case "blanks":
    case "choice":
    case "wordshapes":
      return block.start;
    default:
      throw new Error(`unexpected block ${block.kind}`);
  }
}

/** How many across a page lays its words; a list down the page is one. */
const columnsOf = (block: Block): number =>
  block.kind === "problems" || block.kind === "wordshapes" ? block.columns : 1;

/** Every word a sheet printed, read back off whichever block it is in. */
function printedWords(sheet: Sheet): string[] {
  return pagesOf(sheet).flatMap((block) => {
    switch (block.kind) {
      case "problems":
        // A test sheet has nothing to read, so its word is the answer.
        return block.items.map((item) => item.prompt || item.answer);
      case "blanks":
        return block.sentences.map(refilled);
      case "choice":
        return block.questions.map((question) => question.prompt);
      case "wordshapes":
        return block.words.map((shape) => shape.word);
      default:
        throw new Error(`unexpected block ${block.kind}`);
    }
  });
}

/** The word a gapped sentence came from, rebuilt by putting the letters back. */
function refilled(blank: Blank): string {
  let at = 0;
  return blank.text.replaceAll("_", () => blank.answers[at++] ?? "?");
}

/* ── The registry ──────────────────────────────────────────────────────── */

const STYLES: WordSheetStyle[] = [
  "copy",
  "missing",
  "test",
  "abc",
  "shapes",
  "sentence",
  "find",
];

describeSheetFamily("words", {
  label: "Spelling list",
  spec: WORDS_SHEET,
  config,
  shapes: STYLES.map((style) => ({ style })),
});

describe("the spelling family", () => {
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

describe("ABC order", () => {
  it("prints the whole list as a bank, and answers it in alphabetical order", () => {
    // Two columns of one exercise: the bank on the left and the same words in
    // order on the lines beside it. The answers are checked against a sort done
    // here rather than against the family's own — a family that printed the bank
    // twice would pass otherwise.
    const items = problemsOf({ style: "abc" });
    expect([...items.map((item) => item.prompt)].sort()).toEqual(
      [...WORDS].sort(),
    );
    expect(items.map((item) => item.answer)).toEqual(
      [...WORDS].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });

  it("scrambles the bank, because every list it is set on arrives sorted", () => {
    // The shipped lists are alphabetical and so is anything typed out of a
    // dictionary, so printing the bank in the order it was given would put the
    // answer column next to its own question column.
    const sorted = ["ant", "bee", "cat", "dog", "eel", "fox", "gnu", "hen"];
    const banks = [1, 2].map((seed) =>
      problemsOf({ style: "abc", words: sorted, count: 8 }, seed) //
        .map((item) => item.prompt),
    );
    for (const bank of banks) expect(bank).not.toEqual(sorted);
    // And a different sheet is a different scramble (§7).
    expect(banks[0]).not.toEqual(banks[1]);
  });

  it("files a word where a child would look for it, whatever its case", () => {
    // "Because" belongs under B and not before every lower-case word there is,
    // which is what a codepoint sort would do with it.
    expect(alphabetical(["dog", "Cat", "ant"])).toEqual(["ant", "Cat", "dog"]);
    // And the order is the same wherever it is built — no platform collation.
    expect(alphabetical(["résumé", "red"])).toEqual(["red", "résumé"]);
  });
});

describe("word shapes", () => {
  it("draws a box per letter, in the band that letter is written in", () => {
    const [shape] = shapesOf({ words: ["big"], count: 1 });
    expect(shape).toEqual({ word: "big", letters: ["tall", "small", "tail"] });
  });

  it("knows a capital, a numeral and an apostrophe from a small letter", () => {
    // The printed convention rather than a font's own metrics: a capital is
    // drawn from the top line to the baseline whatever face the sheet is set in,
    // and an apostrophe is not a letter with a body at all.
    expect(letterShape("B")).toBe("tall");
    expect(letterShape("7")).toBe("tall");
    expect(letterShape("t")).toBe("tall");
    expect(letterShape("f")).toBe("tall");
    expect(letterShape("y")).toBe("tail");
    expect(letterShape("'")).toBe("small");
  });

  it("draws no box where a space is", () => {
    // A box is a thing a child writes a letter into, and a space is nothing to
    // write — so a two-word entry keeps the slot and loses the rectangle,
    // which is what makes "1 Samuel" read as two words on the paper.
    expect(letterShape(" ")).toBe("gap");
    const [samuel] = shapesOf({ words: ["1 Samuel"], count: 1 });
    expect(samuel.letters).toEqual([
      "tall",
      "gap",
      "tall",
      "small",
      "small",
      "small",
      "small",
      "tall",
    ]);
  });

  it("gives two words the same letters the same outline", () => {
    // The exercise only works because a word has a silhouette: "bed" and "bad"
    // are the same picture, and "big" is not.
    const [bed, bad, big] = shapesOf({
      words: ["bed", "bad", "big"],
      count: 3,
    });
    expect(bed.letters).toEqual(bad.letters);
    expect(big.letters).not.toEqual(bed.letters);
  });
});

describe("using it in a sentence", () => {
  it("rules lines with nothing written on them, on either half of the build", () => {
    // There is no right answer to a sentence a child wrote, so the lines are
    // empty on the key as well — and the word still sits above them, because it
    // is the question.
    const items = problemsOf({ style: "sentence", times: 2 });
    expect(items.map((item) => item.prompt)).toEqual(WORDS);
    for (const item of items) {
      expect(item.answers).toEqual(["", ""]);
      expect(item.answer).toBe("");
      expect(item.workspace).toBe(2 * answerLine(12));
    }
  });
});

describe("finding the word", () => {
  it("prints the word among words from the same list, and marks which", () => {
    for (const question of questionsOf({})) {
      expect(WORDS).toContain(question.prompt);
      expect(question.options).toContain(question.prompt);
      expect(question.options[question.answer]).toBe(question.prompt);
      // The near misses are the deck's own — drawn from the list rather than
      // invented — so every option on the line is a word being taught.
      for (const option of question.options) expect(WORDS).toContain(option);
      expect(new Set(question.options).size).toBe(question.options.length);
    }
  });

  it("offers what a short list can spare rather than repeating a word", () => {
    // Two words cannot make four options, and a line with the same word twice
    // on it is a question with two right answers.
    const [question] = questionsOf({ words: ["cat", "cot"], count: 2 });
    expect(question.options).toHaveLength(2);
    expect(new Set(question.options).size).toBe(2);
  });

  it("puts the word in a different place on a different sheet", () => {
    // "Another sheet like this one" is `seed + 1` (§7), and on this style it has
    // to move the answer or a child learns the position rather than the word.
    const places = (seed: number) =>
      questionsOf({}, seed).map((question) => question.answer);
    expect(places(1)).not.toEqual(places(2));
  });
});

/* ── The list ──────────────────────────────────────────────────────────── */

const SIZES: PaperSize[] = ["letter", "a4", "legal"];
const MARGINS: MarginSize[] = ["narrow", "normal", "wide"];

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

  it("runs a long list on to another page rather than cutting it", () => {
    // Two hundred words are however many pages that takes, not one page of
    // the first few (§4), in every one of the seven shapes. The numbering
    // carries on, the score box counts every page, and the key runs on page
    // for page.
    const many = Array.from({ length: 200 }, (_, i) => `word${i}`);
    for (const style of STYLES) {
      const over = { style, words: many, count: many.length };
      const { perPage } = wordsLayout(config(over));
      const sheet = buildSheet(config(over), 1);
      const pages = pagesOf(sheet);
      expect(pages.length, style).toBe(Math.ceil(many.length / perPage));
      expect(countOf(pages[0]), style).toBe(perPage);
      expect(startOf(pages[1]), style).toBe(perPage + 1);
      expect(sheet.header.score, style).toEqual({ outOf: many.length });
      expect(printedWords(sheet).length, style).toBe(many.length);
      // In list order, on the styles that keep it.
      if (style !== "abc") expect(printedWords(sheet), style).toEqual(many);
      expect(pagesOf(answerKey(config(over), 1)).map(countOf), style) //
        .toEqual(pages.map(countOf));
    }
  });

  it("never prints more words on a page than the paper holds", () => {
    // Against the box the printed header leaves rather than the config's,
    // and every page but the last full: a page cut short of what fits would
    // be a sheet of paper for nothing.
    const many = Array.from({ length: 200 }, (_, i) => `word${i}`);
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [8, 12, 18, 24, 36]) {
          for (const style of STYLES) {
            const over = {
              style,
              words: many,
              count: many.length,
              paper: paper({ size, margin }),
              fontPt,
            };
            const where = `${style} ${size}/${margin}/${fontPt}pt`;
            const sheet = buildSheet(config(over), 1);
            const pages = pagesOf(sheet);
            expect(pages.length, where).toBeGreaterThan(0);
            const { row, gap, perPage } = wordsLayout(config(over));
            for (const [at, page] of pages.entries()) {
              const rows = Math.ceil(countOf(page) / columnsOf(page));
              const used = rows * row + Math.max(0, rows - 1) * gap;
              expect(used, `${where}, page ${at + 1}`).toBeLessThanOrEqual(
                printedBlockBox(sheet).height,
              );
              if (at < pages.length - 1)
                expect(countOf(page), `${where}, page ${at + 1}`).toBe(
                  countOf(pages[0]),
                );
            }
            // A row taller than the page holds nothing at all.
            if (perPage === 0) expect(pages.map(countOf), where).toEqual([0]);
          }
        }
      }
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
