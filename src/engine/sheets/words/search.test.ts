import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/engine/random";

import type { Found } from "../types";

import {
  SEARCH_CELL,
  buildSearch,
  findWord,
  gridForm,
  searchCell,
  searchSteps,
  type Step,
} from "./search";

/**
 * A word search, held to the one bar that matters: **the paper is right.**
 *
 * Every claim below is checked by reading the finished grid with a reader
 * written here, in the test, rather than by asking the generator what it thinks
 * it did. `buildSearch` derives its own answer key by searching the grid, so a
 * test that called `findWord` to check `solution` would be comparing a function
 * against itself and would pass on a `findWord` that was wrong in exactly the
 * same direction. `spell` below walks the letters and joins them, and that is
 * all it does.
 */

const WORDS = ["BECAUSE", "THOUGHT", "FRIEND", "PEOPLE", "THROUGH"];

const across = searchSteps("across", false);
const usual = searchSteps("across-down", false);
const every = searchSteps("all", true);

/** Reads a word out of the grid the long way. The whole point of this file. */
function spell(letters: string[][], found: Found): string {
  let out = "";
  for (let i = 0; i < found.word.length; i++) {
    out +=
      letters[found.row + found.dy * i]?.[found.column + found.dx * i] ?? "";
  }
  return out;
}

const build = (
  words: string[],
  size: number,
  steps: Step[] = usual,
  overlap = true,
  seed = 1,
) => buildSearch(words, size, { steps, overlap }, mulberry32(seed));

describe("the grid form of a word", () => {
  it("is upper case, and only letters", () => {
    // A square holds one letter, so there is nowhere for an apostrophe or a
    // space to go. The word list under the puzzle prints the same form, which
    // is what keeps "printed" and "findable" the same set.
    expect(gridForm("don't")).toBe("DONT");
    expect(gridForm("ice cream")).toBe("ICECREAM");
    expect(gridForm("Because")).toBe("BECAUSE");
    expect(gridForm("123")).toBe("");
  });
});

describe("which ways a word may run", () => {
  it("is one direction across, two down the page, and four with diagonals", () => {
    expect(searchSteps("across", false)).toHaveLength(1);
    expect(searchSteps("across-down", false)).toHaveLength(2);
    expect(searchSteps("all", false)).toHaveLength(4);
  });

  it("doubles when words may be backwards", () => {
    expect(searchSteps("across", true)).toHaveLength(2);
    expect(searchSteps("all", true)).toHaveLength(8);
    // Each backwards step is exactly some forwards step negated, which is what
    // makes "reversed" mean the same thing on every direction set.
    for (const step of searchSteps("all", true)) {
      expect(
        searchSteps("all", true).some(
          (other) => other.dx === -step.dx && other.dy === -step.dy,
        ),
      ).toBe(true);
    }
  });

  it("falls back to the usual set for a direction this build never had", () => {
    // A saved sheet outlives the options it was made with, the same as a kind.
    expect(searchSteps("sideways-only" as "all", false)).toEqual(
      searchSteps("across-down", false),
    );
  });
});

describe("the answer key", () => {
  it("points at squares that really do spell the word", () => {
    const puzzle = build(WORDS, 12);
    expect(puzzle.solution).toHaveLength(WORDS.length);
    for (const found of puzzle.solution) {
      expect(spell(puzzle.letters, found)).toBe(found.word);
    }
  });

  it("names every word it hid, and hides every word it names", () => {
    const puzzle = build(WORDS, 12);
    expect(puzzle.find).toEqual(WORDS);
    expect(puzzle.solution.map((found) => found.word)).toEqual(puzzle.find);
    expect(puzzle.omitted).toEqual([]);
  });

  it("holds at every direction set, and backwards", () => {
    for (const steps of [across, usual, every]) {
      for (const seed of [1, 2, 7, 4242]) {
        const puzzle = build(WORDS, 14, steps, true, seed);
        for (const found of puzzle.solution)
          expect(spell(puzzle.letters, found)).toBe(found.word);
        expect(puzzle.omitted).toEqual([]);
      }
    }
  });

  it("only ever runs a word the way the puzzle said it could", () => {
    const puzzle = build(WORDS, 14, across);
    for (const found of puzzle.solution) {
      expect(found.dy).toBe(0);
      // Not backwards: `reverse` was off, so left-to-right is the only run.
      expect(found.dx).toBe(1);
    }
  });
});

describe("a word that cannot be placed", () => {
  it("is reported rather than dropped", () => {
    // Nine letters will not go in a six-square grid however hard it is tried,
    // and the honest answer is to say so on the sheet.
    const puzzle = build(["ELEPHANTS", "CAT"], 6);
    expect(puzzle.omitted).toContain("ELEPHANTS");
    expect(puzzle.find).not.toContain("ELEPHANTS");
    expect(puzzle.find).toContain("CAT");
  });

  it("never appears on the word list without appearing in the grid", () => {
    // The property the whole design rests on: `find` is derived from the
    // search, so a word on the list is a word the letters contain.
    const crowded = ["ABANDONING", "BUTTERFLY", "MOUNTAIN", "ORCHESTRA", "CAT"];
    const puzzle = build(crowded, 8, across, false);
    expect(puzzle.find.length + puzzle.omitted.length).toBe(crowded.length);
    for (const word of puzzle.find) {
      expect(findWord(puzzle.letters, word, across)).toBeDefined();
    }
    for (const word of puzzle.omitted) {
      expect(findWord(puzzle.letters, word, across)).toBeUndefined();
    }
  });

  it("returns on a list that cannot possibly fit", () => {
    // No retry loop anywhere: every position is offered once. Twenty words of
    // exactly the grid's width, none allowed to touch another, is the worst
    // case there is — and it produces a sheet rather than a hung tab.
    const impossible = Array.from({ length: 20 }, (_, at) =>
      `WORD${String(at).padStart(4, "X")}`.slice(0, 8),
    );
    const puzzle = build(impossible, 8, across, false);
    expect(puzzle.find.length + puzzle.omitted.length).toBe(impossible.length);
    expect(puzzle.omitted.length).toBeGreaterThan(0);
  });
});

describe("a word the page had no room to list", () => {
  const avoided = (avoid: string[], seed: number) =>
    buildSearch(
      WORDS,
      12,
      { steps: usual, overlap: true, avoid },
      mulberry32(seed),
    );

  it("is never spelled out by the filler", () => {
    // The failure this exists for: the family trims the word list to what the
    // paper holds, prints "Not in the grid: HAS" under the puzzle, and the
    // random letters spell HAS three rows down. The filler has to know about
    // the words it is not being given.
    const avoid = ["HAS", "BY", "OF", "MAY", "PUT", "OLD"];
    for (const seed of [1, 2, 3, 8, 9, 99]) {
      const puzzle = avoided(avoid, seed);
      for (const word of avoid) {
        const hits = [];
        for (let row = 0; row < puzzle.letters.length; row++)
          for (let column = 0; column < puzzle.letters[row].length; column++)
            for (const { dx, dy } of every)
              if (spell(puzzle.letters, { word, column, row, dx, dy }) === word)
                hits.push({ column, row });
        expect(hits).toEqual([]);
      }
    }
  });

  it("is named as missing, but never put on the word list", () => {
    // Two lists and a word may only be on one of them. `find` is what the page
    // asks a child to hunt for and the page has no room for this word;
    // `omitted` is what the sheet admits it does not hold.
    const puzzle = avoided(["HAS", "BY"], 4);
    expect(puzzle.find).toEqual(WORDS);
    expect(puzzle.omitted).toEqual(["HAS", "BY"]);
  });

  it("is not called missing when the grid turns out to hold it", () => {
    // The filler is not the only way a word can appear: two placed words
    // crossing spell a third nobody asked for, and no care over the *empty*
    // squares undoes that. So the claim is read off the finished grid — a word
    // the letters contain goes on neither list rather than onto a lie.
    const puzzle = avoided(["BECAUSE", "OUGH"], 1);
    expect(puzzle.omitted).toEqual([]);
    expect(puzzle.find).toEqual(WORDS);
  });

  it("passes through a word with no grid form at all", () => {
    // `123` off the end of a pasted list. It cannot be in the grid, so it is
    // named — and nothing here has to special-case it.
    expect(avoided(["123"], 1).omitted).toEqual(["123"]);
  });
});

describe("the grid itself", () => {
  it("is square, and has a letter in every square", () => {
    const puzzle = build(WORDS, 11);
    expect(puzzle.letters).toHaveLength(11);
    for (const row of puzzle.letters) {
      expect(row).toHaveLength(11);
      for (const letter of row) expect(letter).toMatch(/^[A-Z]$/);
    }
  });

  it("does not spell a listed word anywhere the key does not say it is", () => {
    // The other half of a right key. A word that turns up twice makes the
    // stroke through one of them look like a mistake — and the filler is what
    // would put it there, so the filler is what refuses to.
    for (const seed of [1, 2, 3, 99]) {
      const puzzle = build(WORDS, 12, every, true, seed);
      for (const word of WORDS) {
        const hits = [];
        for (let row = 0; row < puzzle.letters.length; row++)
          for (let column = 0; column < puzzle.letters[row].length; column++)
            for (const { dx, dy } of every)
              if (spell(puzzle.letters, { word, column, row, dx, dy }) === word)
                hits.push({ column, row });
        expect(hits).toHaveLength(1);
      }
    }
  });

  it("keeps words off each other when they may not cross", () => {
    const puzzle = build(WORDS, 14, usual, false);
    const used = new Set<string>();
    for (const found of puzzle.solution) {
      for (let i = 0; i < found.word.length; i++) {
        const key = `${found.column + found.dx * i},${found.row + found.dy * i}`;
        expect(used.has(key)).toBe(false);
        used.add(key);
      }
    }
  });

  it("is the same grid twice from the same seed", () => {
    // §7, and the reason a shared link and an answer key are the same sheet.
    for (const seed of [0, 1, 4242]) {
      expect(build(WORDS, 12, every, true, seed)).toEqual(
        build(WORDS, 12, every, true, seed),
      );
    }
  });

  it("is a different grid from a different seed", () => {
    expect(build(WORDS, 12, usual, true, 1).letters).not.toEqual(
      build(WORDS, 12, usual, true, 2).letters,
    );
  });

  it("survives being asked for nothing", () => {
    const puzzle = build([], 8);
    expect(puzzle.find).toEqual([]);
    expect(puzzle.solution).toEqual([]);
    expect(puzzle.letters).toHaveLength(8);
  });
});

describe("how big a square is", () => {
  it("never grows past what a child needs, and shrinks to fit", () => {
    // The renderer asks the same question of the same function, which is the
    // whole reason it is here rather than in the component (§4).
    expect(searchCell(10_000, 10)).toBe(SEARCH_CELL);
    expect(searchCell(1_000, 10)).toBe(100);
    expect(searchCell(1_000, 0)).toBe(0);
  });
});
