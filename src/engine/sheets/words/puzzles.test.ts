import { describe, expect, it } from "vitest";

import { WORD_LISTS, listWords } from "@/engine/decks/wordlists";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { sheetFamily } from "../families";
import type { Block, Paper, PuzzleConfig } from "../types";

import { SEARCH_CELL, findWord, searchCell, searchSteps } from "./search";
import {
  MAX_GRID,
  MIN_GRID,
  PUZZLE_SHEET,
  crosswordClue,
  crosswordLayout,
  letterHint,
  puzzleWords,
  scramble,
  searchLayout,
} from "./puzzles";

/**
 * The puzzle family, from the front door.
 *
 * `search.test.ts` and `crossword.test.ts` hold the two generators to their own
 * grids. This is the layer above: that the family routes, that a sheet is a
 * pure function of `(config, seed)`, that the key is the same build, that a
 * word which did not make it onto the page is *on the page saying so* — and
 * that nothing here can be handed a list it hangs on.
 */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const WORDS = ["because", "thought", "friend", "people", "through", "cat"];

const config = (over: Partial<PuzzleConfig> = {}): PuzzleConfig => ({
  kind: "puzzle",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "search",
  words: WORDS,
  size: 12,
  directions: "across-down",
  reverse: false,
  overlap: true,
  count: WORDS.length,
  columns: 2,
  ...over,
});

function blockOf<K extends Block["kind"]>(
  kind: K,
  over: Partial<PuzzleConfig>,
  seed = 1,
): Extract<Block, { kind: K }> {
  const block = buildSheet(config(over), seed).blocks[0];
  if (block.kind !== kind)
    throw new Error(`expected ${kind}, got ${block.kind}`);
  return block as Extract<Block, { kind: K }>;
}

describe("the family", () => {
  it("is in the registry, under the kind a saved sheet carries", () => {
    expect(sheetSpec("puzzle")).toBe(PUZZLE_SHEET);
    expect(sheetFamily("puzzle")?.label).toBe("Word puzzle");
  });

  it("makes one block, whichever puzzle it is", () => {
    expect(blockOf("wordsearch", {}).kind).toBe("wordsearch");
    expect(blockOf("crossword", { style: "crossword" }).kind).toBe("crossword");
    expect(blockOf("problems", { style: "scramble" }).kind).toBe("problems");
  });

  it("falls back to a word search for a style this build never had", () => {
    // A sheet saved in March opens in June, the same promise `sheetSpec` makes.
    const stale = { style: "acrostic" as PuzzleConfig["style"] };
    expect(buildSheet(config(stale), 1).blocks[0].kind).toBe("wordsearch");
  });

  it("is a pure function of its config and seed", () => {
    for (const style of ["search", "crossword", "scramble"] as const) {
      for (const seed of [0, 1, 4242]) {
        const once = buildSheet(config({ style }), seed);
        const twice = buildSheet(config({ style }), seed);
        expect(once).not.toBe(twice);
        expect(once).toEqual(twice);
      }
    }
  });

  it("stays deterministic across papers and type sizes", () => {
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const fontPt of [10, 12, 18]) {
        const over = { paper: paper({ size }), fontPt };
        expect(buildSheet(config(over), 7)).toEqual(
          buildSheet(config(over), 7),
        );
      }
    }
  });

  it("says in one line what it is about to print", () => {
    expect(describeSheet(config())).toBe("Word search — 6 words — 12 × 12");
    expect(describeSheet(config({ style: "scramble" }))).toBe(
      "Word scramble — 6 words",
    );
    expect(describeSheet(config({ reverse: true }))).toContain(
      "some backwards",
    );
  });

  it("marks the sheet out of what is on it, not out of what was asked for", () => {
    const sheet = buildSheet(config(), 1);
    const block = sheet.blocks[0];
    if (block.kind !== "wordsearch") throw new Error("expected a word search");
    expect(sheet.header.score).toEqual({ outOf: block.find.length });
  });
});

describe("the list a puzzle is given", () => {
  it("is held to the same shape a spelling sheet holds it to", () => {
    const { words } = puzzleWords(
      config({ words: ["  cat ", "", "cat", "Cat", "dog"] }),
    );
    expect(words.map((word) => word.given)).toEqual(["cat", "dog"]);
  });

  it("folds two words a grid cannot tell apart into one", () => {
    // "its" and "it's" are two words to a marker and one word to a letter
    // grid. Printing ITS twice on the word list would ask a child to find the
    // same squares again.
    const { words } = puzzleWords(config({ words: ["it's", "its", "sun"] }));
    expect(words.map((word) => word.form)).toEqual(["ITS", "SUN"]);
  });

  it("reports a word with no letters in it rather than swallowing it", () => {
    const { words, unusable } = puzzleWords(config({ words: ["cat", "123"] }));
    expect(words.map((word) => word.form)).toEqual(["CAT"]);
    expect(unusable).toEqual(["123"]);
  });

  it("prints on the sheet the same forms it hid in the grid", () => {
    const block = blockOf("wordsearch", { words: ["don't", "sun"], count: 2 });
    expect(block.find).toEqual(["DONT", "SUN"]);
    for (const row of block.letters)
      for (const letter of row) expect(letter).toMatch(/^[A-Z]$/);
  });
});

describe("a word the puzzle could not hold", () => {
  it("is named on the word search rather than dropped", () => {
    // The whole story. A word that vanishes is a child hunting for something
    // that is not there and a key that never mentions it.
    const block = blockOf("wordsearch", {
      words: ["extraordinarily", "cat"],
      size: MIN_GRID,
      count: 2,
    });
    expect(block.find).toEqual(["CAT"]);
    expect(block.omitted).toEqual(["EXTRAORDINARILY"]);
  });

  it("is named on the crossword rather than dropped", () => {
    const block = blockOf("crossword", {
      style: "crossword",
      words: ["abc", "def"],
      count: 2,
    });
    expect(block.omitted).toEqual(["DEF"]);
  });

  it("says nothing at all when every word landed", () => {
    // A line admitting a failure that did not happen is noise on a child's
    // page, so the field is absent rather than empty.
    expect(blockOf("wordsearch", {}).omitted).toBeUndefined();
  });

  it("counts the words the page had no room for as well", () => {
    // Two ways to be missing and one thing the marker needs to know. At the
    // largest type on the smallest usable grid, most of a long list has to go.
    const over = {
      words: listWords(WORD_LISTS[2]).slice(0, 30),
      count: 30,
      fontPt: 24,
      paper: paper({ margin: "wide" }),
    };
    const block = blockOf("wordsearch", over);
    expect(block.omitted?.length).toBeGreaterThan(0);
    expect(block.find.length).toBeGreaterThan(0);
    // Every word is accounted for: on the list, named, or counted.
    expect(
      block.find.length +
        (block.omitted?.length ?? 0) +
        (block.omittedMore ?? 0),
    ).toBe(30);
  });

  it("counts the ones the page cannot even name", () => {
    // At the largest type an 8 × 8 grid is nearly the whole writing space, and
    // naming thirty words under it would be nine rows of italic text on a page
    // with no puzzle left on it. So the line names what it was reserved room
    // for and counts the rest. A count is a poor substitute for a name; a
    // paragraph on a second sheet of paper is worse.
    const block = blockOf("wordsearch", {
      words: listWords(WORD_LISTS[2]).slice(0, 30),
      count: 30,
      fontPt: 36,
      paper: paper({ margin: "wide" }),
    });
    expect(block.omittedMore ?? 0).toBeGreaterThan(0);
    expect(
      block.find.length +
        (block.omitted?.length ?? 0) +
        (block.omittedMore ?? 0),
    ).toBe(30);
  });

  it("is never named on a sheet whose grid holds it", () => {
    // The lie the family exists to prevent, at the layout boundary rather than
    // the placer's: the page trims the word list to what fits, and the filler
    // was only ever told about the words that survived — so it was free to
    // spell the rest, and the sheet said "Not in the grid: HAS" over a grid
    // with HAS in it.
    const over = {
      words: listWords(WORD_LISTS[2]).slice(0, 30),
      count: 30,
      fontPt: 36,
      paper: paper({ margin: "wide" }),
    };
    const { dropped } = searchLayout(config(over));
    for (let seed = 1; seed <= 10; seed++) {
      const block = blockOf("wordsearch", over, seed);
      for (const word of block.omitted ?? []) {
        // Not findable the way the sheet says the words run …
        expect(
          findWord(block.letters, word, searchSteps("across-down", false)),
        ).toBeUndefined();
        // … and a word the *page* dropped is not there in any direction at
        // all. It is on no list, so a child who spots it running up a diagonal
        // has found something the sheet just called absent.
        if (dropped.includes(word))
          expect(
            findWord(block.letters, word, searchSteps("all", true)),
          ).toBeUndefined();
      }
    }
  });
});

describe("what fits on the paper", () => {
  it("shrinks the grid rather than running off the page", () => {
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const fontPt of [10, 12, 18, 24, 36]) {
        for (const margin of ["narrow", "normal", "wide"] as const) {
          const over = {
            paper: paper({ size, margin }),
            fontPt,
            size: MAX_GRID,
          };
          const grid = searchLayout(config(over));
          expect(grid.size).toBeGreaterThanOrEqual(MIN_GRID);
          expect(grid.size).toBeLessThanOrEqual(MAX_GRID);
          // The grid alone, before the word list under it, is inside the box.
          expect(grid.size * grid.cell).toBeLessThanOrEqual(grid.box.height);
        }
      }
    }
  });

  it("keeps the crossword inside the height it reserved", () => {
    // The reservation is made against `size × SEARCH_CELL` before the puzzle
    // exists; the finished grid is cropped, and a cropped grid has fewer
    // columns and therefore *bigger* squares. This is the assertion that would
    // fail if that were reserved at the bound's own square size.
    for (const fontPt of [10, 12, 18]) {
      const over = { style: "crossword" as const, fontPt, size: MAX_GRID };
      const { box, size } = crosswordLayout(config(over));
      const block = blockOf("crossword", over);
      const columns = block.cells[0]?.length ?? 0;
      const height = block.cells.length * searchCell(box.width, columns);
      expect(height).toBeLessThanOrEqual(size * SEARCH_CELL);
      expect(height).toBeLessThanOrEqual(box.height);
    }
  });

  it("reserves the line that admits a word did not fit", () => {
    // The line `<Omitted>` prints under the puzzle, which had no reserved
    // height at all — and it only ever appears on a page the trim loop has just
    // shrunk to exactly its capacity, because trimming is what creates it. It
    // was guaranteed to overflow precisely when it was guaranteed to be there.
    const words = listWords(WORD_LISTS[2]).slice(0, 30);
    for (const size of ["letter", "a4", "legal"] as const) {
      for (const margin of ["narrow", "normal", "wide"] as const) {
        for (const fontPt of [10, 12, 18, 24, 36]) {
          const over = {
            words,
            count: 30,
            fontPt,
            paper: paper({ size, margin }),
            size: MAX_GRID,
          };
          for (const layout of [
            searchLayout(config(over)),
            crosswordLayout(config({ ...over, style: "crossword" })),
          ]) {
            if (layout.height <= layout.box.height) continue;
            // The one page the arithmetic cannot rescue: at the largest type
            // the grid at MIN_GRID is already almost the whole writing space,
            // and the sheet is still not allowed to stay silent about the
            // twenty-odd words it dropped. Over by that single row, never by
            // the nine the whole list would have taken.
            expect(layout.missingRows).toBe(1);
            expect(fontPt).toBe(36);
          }
        }
      }
    }
  });

  it("never prints more scrambles than the page holds", () => {
    const many = listWords(WORD_LISTS[2]).slice(0, 30);
    const block = blockOf("problems", {
      style: "scramble",
      words: many,
      count: 30,
      fontPt: 36,
      columns: 1,
    });
    expect(block.items.length).toBeGreaterThan(0);
    expect(block.items.length).toBeLessThan(many.length);
  });
});

describe("the scramble", () => {
  it("prints an anagram of the word, never the word", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const block = blockOf("problems", { style: "scramble" }, seed);
      for (const item of block.items) {
        const shown = item.prompt.replaceAll(" ", "");
        expect([...shown].sort().join("")).toBe(
          [...item.answer].sort().join(""),
        );
        expect(shown).not.toBe(item.answer);
      }
    }
  });

  it("keeps every character, punctuation included", () => {
    // A permutation of the whole string, so a child rearranging what they can
    // see arrives at exactly the word on the key.
    const block = blockOf("problems", {
      style: "scramble",
      words: ["don't"],
      count: 1,
    });
    expect(block.items[0].prompt.replaceAll(" ", "")).toHaveLength(5);
    expect(block.items[0].answer).toBe("don't");
  });

  it("gives up on a word that has nothing to rearrange", () => {
    // `aa` has one anagram and it is itself. Eight draws and a swap cannot
    // change that, and the honest answer is the word — not a hung loop.
    const rand = () => 0.5;
    expect(scramble("aa", rand)).toBe("aa");
    expect(scramble("a", rand)).toBe("a");
    expect(scramble("", rand)).toBe("");
  });

  it("differs even where a shuffle keeps landing where it started", () => {
    // A rand that never moves anything: the fallback swap is what saves it.
    const stuck = () => 0;
    expect(scramble("ab", stuck)).toBe("ba");
    expect(scramble("aab", stuck)).not.toBe("aab");
  });
});

describe("a crossword's clues", () => {
  it("come from the sentence the list already gives the word", () => {
    // "Fish _ chips for tea." is what the jungle says when it reads `and`
    // aloud, and it is exactly the shape of a crossword clue (§11).
    expect(crosswordClue({ given: "and", form: "AND" })).toBe(
      "Fish ___ chips for tea.",
    );
    // Found on the grid form too, so a list typed in capitals still gets them.
    expect(crosswordClue({ given: "AND", form: "AND" })).toContain("chips");
  });

  it("fall back to the word's own letters where nobody wrote one", () => {
    const clue = crosswordClue({ given: "quokka", form: "QUOKKA" });
    expect(clue).toMatch(/^Jumbled: /);
    expect(clue.replace("Jumbled: ", "").replaceAll(" ", "")).not.toBe(
      "QUOKKA",
    );
    expect(
      [...clue.replace("Jumbled: ", "").replaceAll(" ", "")].sort().join(""),
    ).toBe([..."QUOKKA"].sort().join(""));
  });

  it("do not depend on the seed, because the layout has to measure them", () => {
    expect(letterHint("THROUGH")).toBe(letterHint("THROUGH"));
    expect(letterHint("CAT")).not.toBe("CAT");
    expect(letterHint("ABAB")).not.toBe("ABAB");
    // Nothing to disguise, so nothing is claimed.
    expect(letterHint("AA")).toBe("AA");
  });

  it("are on every entry the grid ended up with", () => {
    const block = blockOf("crossword", { style: "crossword" });
    for (const entry of [...block.across, ...block.down])
      expect(entry.clue.length).toBeGreaterThan(0);
  });
});

describe("the answer key", () => {
  it("is the same sheet with the answers turned on", () => {
    for (const style of ["search", "crossword", "scramble"] as const) {
      const sheet = buildSheet(config({ style }), 3);
      const key = answerKey(config({ style }), 3);
      // The blocks are identical — the answers were decided when the sheet was
      // built, so there is no second generation to disagree with the first.
      expect(key.blocks).toEqual(sheet.blocks);
      expect(sheet.answers).toBe(false);
      expect(key.answers).toBe(true);
      expect(key.footer.note).toBe("Answer key");
    }
  });

  it("carries a stroke for every word on the list and no others", () => {
    const block = blockOf("wordsearch", {});
    expect(block.solution?.map((found) => found.word)).toEqual(block.find);
  });
});

describe("a list nothing can be done with", () => {
  it("still produces a sheet", () => {
    // Twenty words as long as the grid, none allowed to touch: the pathological
    // case, and every one of these has to come back rather than spin.
    const impossible = Array.from(
      { length: 20 },
      (_, at) => `zzzzzzz${String.fromCharCode(97 + at)}`,
    );
    for (const style of ["search", "crossword", "scramble"] as const) {
      const sheet = buildSheet(
        config({
          style,
          words: impossible,
          count: 20,
          size: 8,
          overlap: false,
        }),
        1,
      );
      expect(sheet.blocks).toHaveLength(1);
      expect(sheet.header.title.length).toBeGreaterThan(0);
    }
  });

  it("still produces a sheet when there is no list at all", () => {
    for (const style of ["search", "crossword", "scramble"] as const) {
      const sheet = buildSheet(config({ style, words: [], count: 0 }), 1);
      expect(sheet.blocks).toHaveLength(1);
      expect(sheet.header.score).toEqual({ outOf: 0 });
    }
  });
});
