import { describe, expect, it } from "vitest";

import { mulberry32 } from "@/engine/random";

import type { CrosswordCell, CrosswordEntry } from "../types";

import { MIN_ENTRY, buildCrossword, type Clued } from "./crossword";

/**
 * A crossword, checked against its own squares.
 *
 * The same discipline as `search.test.ts` and the same reason for it: the clue
 * list is derived from the finished grid, so a test that trusted the generator
 * to say where its words went would be agreeing with the thing it is meant to
 * catch. Everything below reads the cells.
 *
 * Four claims, and each of them is a real way a crossword ships broken:
 *
 * - **Every entry spells its answer** where its number says it starts.
 * - **The numbering is the grid's** — recomputed here from the squares alone,
 *   by the rule every crossword in the world is numbered by, and compared.
 * - **The crossings agree.** Two entries that meet share a square, and both
 *   read their own answer out of it.
 * - **It is one puzzle.** Flood fill from any letter reaches every letter; two
 *   unconnected islands is two half-crosswords on one page.
 */

const clued = (...words: string[]): Clued[] =>
  words.map((word) => ({ word, clue: `clue for ${word}` }));

const WORDS = clued("BECAUSE", "THOUGHT", "FRIEND", "PEOPLE", "THROUGH", "CAT");

const build = (entries: Clued[], size = 13, seed = 1) =>
  buildCrossword(entries, size, mulberry32(seed));

const letterAt = (
  cells: Array<Array<CrosswordCell | null>>,
  x: number,
  y: number,
): string | null => cells[y]?.[x]?.letter ?? null;

/** Reads an entry out of the squares, the long way. */
function spell(
  cells: Array<Array<CrosswordCell | null>>,
  entry: CrosswordEntry,
  down: boolean,
): string {
  let out = "";
  for (let i = 0; i < entry.answer.length; i++) {
    out +=
      letterAt(
        cells,
        entry.column + (down ? 0 : i),
        entry.row + (down ? i : 0),
      ) ?? "";
  }
  return out;
}

/**
 * Every run of two letters or more in the grid, both ways — an independent
 * walk of the squares, so it can be held against what the block claims.
 */
function maximalRuns(cells: Array<Array<CrosswordCell | null>>): string[] {
  const out: string[] = [];
  const height = cells.length;
  const width = cells[0]?.length ?? 0;
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (letterAt(cells, x, y) === null) continue;
        if (letterAt(cells, x - dx, y - dy) !== null) continue;
        let word = "";
        for (let i = 0; letterAt(cells, x + dx * i, y + dy * i) !== null; i++)
          word += letterAt(cells, x + dx * i, y + dy * i);
        if (word.length >= MIN_ENTRY) out.push(word);
      }
    }
  }
  return out;
}

/** Every square that holds a letter, as `"x,y"`. */
function filled(cells: Array<Array<CrosswordCell | null>>): string[] {
  const out: string[] = [];
  cells.forEach((row, y) =>
    row.forEach((square, x) => {
      if (square !== null) out.push(`${x},${y}`);
    }),
  );
  return out;
}

describe("every entry", () => {
  it("spells its answer where its clue says it starts", () => {
    const puzzle = build(WORDS);
    expect(puzzle.across.length + puzzle.down.length).toBeGreaterThan(1);
    for (const entry of puzzle.across)
      expect(spell(puzzle.cells, entry, false)).toBe(entry.answer);
    for (const entry of puzzle.down)
      expect(spell(puzzle.cells, entry, true)).toBe(entry.answer);
  });

  it("carries the clue its word was given", () => {
    const puzzle = build(WORDS);
    for (const entry of [...puzzle.across, ...puzzle.down])
      expect(entry.clue).toBe(`clue for ${entry.answer}`);
  });

  it("is a word somebody asked for", () => {
    // The other half of "no unintended words": a run of letters in the grid
    // that is not one of the answers is a question with no answer on the key.
    const asked = new Set(WORDS.map((entry) => entry.word));
    const puzzle = build(WORDS);
    for (const entry of [...puzzle.across, ...puzzle.down])
      expect(asked.has(entry.answer)).toBe(true);
  });

  it("holds over a run of seeds and grid sizes", () => {
    for (const seed of [0, 1, 2, 3, 7, 99]) {
      for (const size of [9, 13, 18]) {
        const puzzle = build(WORDS, size, seed);
        for (const entry of puzzle.across)
          expect(spell(puzzle.cells, entry, false)).toBe(entry.answer);
        for (const entry of puzzle.down)
          expect(spell(puzzle.cells, entry, true)).toBe(entry.answer);
      }
    }
  });
});

describe("the numbering", () => {
  it("is the one the squares themselves imply", () => {
    // Recomputed from the cells by the standard rule — a square starts an entry
    // across when there is nothing to its left and something to its right, and
    // down when there is nothing above and something below — then compared with
    // what the block carries. Two independent walks of the same grid.
    const puzzle = build(WORDS);
    const expected = new Map<string, number>();
    let number = 0;
    for (let y = 0; y < puzzle.cells.length; y++) {
      for (let x = 0; x < puzzle.cells[y].length; x++) {
        if (letterAt(puzzle.cells, x, y) === null) continue;
        const startsAcross =
          letterAt(puzzle.cells, x - 1, y) === null &&
          letterAt(puzzle.cells, x + 1, y) !== null;
        const startsDown =
          letterAt(puzzle.cells, x, y - 1) === null &&
          letterAt(puzzle.cells, x, y + 1) !== null;
        if (!startsAcross && !startsDown) continue;
        number += 1;
        expected.set(`${x},${y}`, number);
        expect(puzzle.cells[y][x]?.number).toBe(number);
      }
    }

    for (const [entries, list] of [
      [puzzle.across, "across"],
      [puzzle.down, "down"],
    ] as const) {
      for (const entry of entries)
        expect({
          list,
          number: entry.number,
        }).toEqual({
          list,
          number: expected.get(`${entry.column},${entry.row}`),
        });
    }
  });

  it("puts a number only where an entry starts", () => {
    const puzzle = build(WORDS);
    const starts = new Set(
      [...puzzle.across, ...puzzle.down].map(
        (entry) => `${entry.column},${entry.row}`,
      ),
    );
    puzzle.cells.forEach((row, y) =>
      row.forEach((square, x) => {
        if (square?.number === undefined) return;
        expect(starts.has(`${x},${y}`)).toBe(true);
      }),
    );
  });

  it("runs in reading order, one number to a square", () => {
    const puzzle = build(WORDS);
    const seen = [...puzzle.across, ...puzzle.down]
      .slice()
      .sort((a, b) => a.row - b.row || a.column - b.column)
      .map((entry) => entry.number);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });
});

describe("the crossings", () => {
  it("agree letter for letter", () => {
    const puzzle = build(WORDS);
    let met = 0;
    for (const one of puzzle.across) {
      for (const other of puzzle.down) {
        // Where the two would meet: `one`'s row, `other`'s column.
        const alongAcross = other.column - one.column;
        const alongDown = one.row - other.row;
        if (alongAcross < 0 || alongAcross >= one.answer.length) continue;
        if (alongDown < 0 || alongDown >= other.answer.length) continue;
        met += 1;
        expect(one.answer[alongAcross]).toBe(other.answer[alongDown]);
        // And both of them agree with the square, which is the only letter
        // there is: one square, one letter, no third opinion.
        expect(letterAt(puzzle.cells, other.column, one.row)).toBe(
          one.answer[alongAcross],
        );
      }
    }
    // A crossword with no crossings in it is a word list in boxes.
    expect(met).toBeGreaterThan(0);
  });
});

describe("the shape of it", () => {
  it("is one connected puzzle, not two islands", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const puzzle = build(WORDS, 13, seed);
      const squares = new Set(filled(puzzle.cells));
      const [first] = squares;
      const reached = new Set<string>();
      const queue = [first];
      while (queue.length > 0) {
        const key = queue.pop() as string;
        if (reached.has(key) || !squares.has(key)) continue;
        reached.add(key);
        const [x, y] = key.split(",").map(Number);
        queue.push(
          `${x + 1},${y}`,
          `${x - 1},${y}`,
          `${x},${y + 1}`,
          `${x},${y - 1}`,
        );
      }
      expect(reached.size).toBe(squares.size);
    }
  });

  it("is cropped to the words in it", () => {
    // No blank row or column round the edge: the reservation is made against
    // the bound, and the paper is spent on squares rather than on nothing.
    const puzzle = build(WORDS, 18);
    expect(puzzle.cells[0].some((square) => square !== null)).toBe(true);
    expect(
      puzzle.cells[puzzle.cells.length - 1].some((square) => square !== null),
    ).toBe(true);
    expect(puzzle.cells.some((row) => row[0] !== null)).toBe(true);
    expect(puzzle.cells.some((row) => row[row.length - 1] !== null)).toBe(true);
  });

  it("is the same puzzle twice from the same seed", () => {
    for (const seed of [0, 1, 4242])
      expect(build(WORDS, 13, seed)).toEqual(build(WORDS, 13, seed));
  });
});

describe("a word that cannot be crossed in", () => {
  it("is reported rather than dropped", () => {
    // Nothing shares a letter with anything, so only the first can be placed
    // and the rest have nowhere to cross.
    const puzzle = build(clued("ABC", "DEF", "GHI"));
    expect(puzzle.omitted).toHaveLength(2);
    expect(puzzle.across.length + puzzle.down.length).toBe(1);
  });

  it("counts a word too short to be an entry", () => {
    const puzzle = build(clued("BECAUSE", "I"));
    expect(puzzle.omitted).toContain("I");
    expect("I".length).toBeLessThan(MIN_ENTRY);
  });

  it("counts a word longer than the grid", () => {
    const puzzle = build(clued("CAT", "EXTRAORDINARILY"), 9);
    expect(puzzle.omitted).toEqual(["EXTRAORDINARILY"]);
  });

  it("reports them in the order the parent typed them", () => {
    const puzzle = build(clued("ABC", "DEF", "GHI", "JKL"));
    expect(puzzle.omitted).toEqual(
      ["ABC", "DEF", "GHI", "JKL"].filter((word) =>
        puzzle.omitted.includes(word),
      ),
    );
  });

  it("tells the truth about it, checked against the squares", () => {
    // The bug this is here for: AS sits inside ASK letter for letter, so ASK
    // written over an AS that is already in the grid leaves every letter on the
    // paper and AS with no squares of its own — a word that is neither clued
    // nor reported. The placer refuses to swallow an entry, and the missing
    // list is read back off the grid rather than off the placer's notes, so
    // this holds either way round.
    const nested = clued("ASK", "AS", "SKY", "MASK", "SO");
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const puzzle = build(nested, 9, seed);
      const runs = maximalRuns(puzzle.cells);
      // Nothing on the paper twice, and nothing on it that nobody asked for.
      expect(new Set(runs).size).toBe(runs.length);
      for (const run of runs)
        expect(nested.map((entry) => entry.word)).toContain(run);
      // What the sheet says is missing is missing, and what it clues is there.
      for (const word of puzzle.omitted) expect(runs).not.toContain(word);
      for (const entry of [...puzzle.across, ...puzzle.down])
        expect(runs).toContain(entry.answer);
    }
  });

  it("never leaves a word both in the grid and on the missing list", () => {
    for (const seed of [1, 2, 3]) {
      const puzzle = build(WORDS, 9, seed);
      const placed = new Set(
        [...puzzle.across, ...puzzle.down].map((entry) => entry.answer),
      );
      for (const word of puzzle.omitted) expect(placed.has(word)).toBe(false);
      expect(placed.size + puzzle.omitted.length).toBe(WORDS.length);
    }
  });

  it("returns on a list where nothing can be placed at all", () => {
    // Every word is longer than the grid. The passes end because a pass that
    // places nothing is the last one.
    const puzzle = build(clued("ELEPHANTS", "BUTTERFLY", "ORCHESTRA"), 4);
    expect(puzzle.omitted).toHaveLength(3);
    expect(puzzle.cells).toEqual([]);
    expect(puzzle.across).toEqual([]);
  });

  it("survives being asked for nothing", () => {
    const puzzle = build([]);
    expect(puzzle.cells).toEqual([]);
    expect(puzzle.omitted).toEqual([]);
  });
});
