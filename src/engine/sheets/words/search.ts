/**
 * A word search, and — separately — the answer key to one.
 *
 * The two halves of this file barely speak to each other, and that is the whole
 * point of it. `place` writes words into a grid and remembers nothing;
 * `findWord` reads a finished grid and reports what is in it. The key is the
 * second of those, never the first.
 *
 * That separation is not fussiness. The classic word-search bug is a key that
 * agrees with the generator instead of with the paper: a word that failed to
 * place is still in the list of "placements" the code made a note of, or a
 * later word overwrote a letter of an earlier one and the note was never
 * corrected, and the sheet goes out claiming ROBIN is at row 4 when row 4 says
 * ROBIM. Deriving the key by searching the grid cannot make that mistake —
 * whatever the placer meant, the key says what the letters say. Which is also
 * why a word that cannot be found is *reported* rather than dropped: the search
 * is the only thing that decides which words are on the sheet's list, so a word
 * that isn't in the grid can't get onto it.
 *
 * Nothing here retries. A word is offered every position it could occupy, in a
 * seeded order, and takes the first that is legal; if none is, it is omitted.
 * There is no outer loop that shuffles and starts again, so a pathological list
 * — twelve nine-letter words in an eight-by-eight grid — produces a sheet that
 * says so instead of a tab that never finishes.
 */
import { shuffled } from "@/engine/random";

import type { Found, Mil, SearchDirections } from "../types";

import { inches } from "../paper";

/** One step along a word, per letter. `(1, 0)` reads left to right. */
export type Step = { dx: number; dy: number };

/**
 * A letter big enough for a five-year-old to find, and small enough that a
 * ten-by-ten puzzle doesn't take the whole page.
 *
 * Here rather than in `WordSearch.tsx` because both halves need it and they
 * have to agree: the family reserves the page against the height the grid will
 * take, and the renderer draws it. A copy in each would be a grid an eighth of
 * an inch taller than the space reserved for it — invisible on screen, and the
 * word list on a second sheet of paper.
 */
export const SEARCH_CELL: Mil = inches(0.34);

/** How wide one cell comes out at, given the room and the number of them. */
export const searchCell = (width: Mil, size: number): Mil =>
  size <= 0 ? 0 : Math.min(SEARCH_CELL, Math.floor(width / size));

/**
 * The directions a word may run, before `reverse` is applied.
 *
 * Down-and-right and up-and-right are the two diagonals; their opposites are
 * the same two read backwards, which is what `reverse` adds. So `all` without
 * `reverse` is four directions and `all` with it is the full eight.
 */
const FORWARD: Record<SearchDirections, Step[]> = {
  across: [{ dx: 1, dy: 0 }],
  "across-down": [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
  ],
  all: [
    { dx: 1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
  ],
};

/** Every step a word may take on this puzzle, in a fixed order. */
export function searchSteps(
  directions: SearchDirections,
  reverse: boolean,
): Step[] {
  const forward = FORWARD[directions] ?? FORWARD["across-down"];
  if (!reverse) return forward;
  return [...forward, ...forward.map(({ dx, dy }) => ({ dx: -dx, dy: -dy }))];
}

/**
 * All eight, for the filler to avoid spelling into.
 *
 * Wider than the puzzle's own set on purpose. A word the grid was not supposed
 * to contain is a distraction whichever way round it reads, and a child who
 * spots CAT running up a diagonal on an across-only sheet has found something
 * the answer key will not admit exists.
 */
const EVERY_STEP: Step[] = searchSteps("all", true);

/**
 * The word as a grid can hold it: upper case, and nothing that is not a letter.
 *
 * A square holds one letter, so there is nowhere to put the apostrophe in
 * "don't" or the space in "ice cream" — and a puzzle that quietly searched for
 * DON'T while printing "don't" under it would be asking for something that
 * cannot be there. So the transformation is done once, here, and the *grid
 * form* is what goes in the grid, on the word list and in the answer key alike:
 * what is printed under the puzzle is exactly what is findable in it.
 *
 * Upper case for the same reason every word search ever printed is: a grid is
 * read letter by letter rather than word by word, and a lower-case `l` beside
 * an upper-case `I` is a square a child cannot mark with confidence.
 */
export const gridForm = (word: string): string =>
  word.toUpperCase().replace(/\P{L}/gu, "");

/** The letters a blank square may be filled with. */
const ALPHABET = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

type Cells = Array<Array<string | null>>;

const inside = (cells: Cells, x: number, y: number): boolean =>
  y >= 0 && y < cells.length && x >= 0 && x < cells[y].length;

/** Reads whatever is at a square, or `null` for "off the grid or empty". */
const at = (cells: Cells, x: number, y: number): string | null =>
  inside(cells, x, y) ? cells[y][x] : null;

/**
 * Every position a word of this length could occupy, in a seeded order.
 *
 * Enumerated rather than guessed at, which is what makes this terminate: there
 * are `steps × size²` places a word can start and each is offered exactly once,
 * so the worst case is a word that is tried everywhere and placed nowhere. A
 * generator that instead picked a random spot and tried again on a clash is the
 * one that hangs on a list it cannot fit.
 */
function positions(
  size: number,
  length: number,
  steps: Step[],
  rand: () => number,
): Array<{ x: number; y: number; step: Step }> {
  const out: Array<{ x: number; y: number; step: Step }> = [];
  for (const step of steps) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const endX = x + step.dx * (length - 1);
        const endY = y + step.dy * (length - 1);
        if (endX < 0 || endX >= size || endY < 0 || endY >= size) continue;
        out.push({ x, y, step });
      }
    }
  }
  return shuffled(out, rand);
}

/** Whether a word can be written here: empty squares, or letters that agree. */
function legal(
  cells: Cells,
  word: string,
  x: number,
  y: number,
  step: Step,
  overlap: boolean,
): boolean {
  for (let i = 0; i < word.length; i++) {
    const held = cells[y + step.dy * i][x + step.dx * i];
    if (held === null) continue;
    // A square already written in is a crossing, which is the thing `overlap`
    // is about: off, no word may share a square with another at all; on, it may
    // share one only where both want the same letter there.
    if (!overlap || held !== word[i]) return false;
  }
  return true;
}

function write(cells: Cells, word: string, x: number, y: number, step: Step) {
  for (let i = 0; i < word.length; i++)
    cells[y + step.dy * i][x + step.dx * i] = word[i];
}

/**
 * Whether writing `letter` here would spell one of the words through this
 * square.
 *
 * Only runs that pass through `(x, y)` are checked, which is what makes it
 * cheap and what makes it complete: every occurrence a filler could create has
 * a last square to be filled in, and that square's own check is where it is
 * caught. Squares that are still empty read as `null` and match nothing, so a
 * half-filled run is never mistaken for a word.
 */
function spells(
  cells: Cells,
  x: number,
  y: number,
  letter: string,
  words: string[],
): boolean {
  for (const step of EVERY_STEP) {
    for (const word of words) {
      for (let k = 0; k < word.length; k++) {
        if (word[k] !== letter) continue;
        const startX = x - step.dx * k;
        const startY = y - step.dy * k;
        let all = true;
        for (let i = 0; i < word.length && all; i++) {
          if (i === k) continue;
          all =
            at(cells, startX + step.dx * i, startY + step.dy * i) === word[i];
        }
        if (all) return true;
      }
    }
  }
  return false;
}

/**
 * Fills the empty squares without spelling anything.
 *
 * An even draw from the alphabet rather than from the letters the words happen
 * to use. Reusing the words' own letters makes a harder puzzle — a lone Q gives
 * QUEEN away — but it also makes an accidental word far likelier, and this is
 * the one file where "looks fine" and "is right" come apart. An even draw is
 * the one that can be reasoned about, and the check below is what keeps it
 * honest.
 *
 * Every letter is tried at most once per square, so a square hemmed in on all
 * sides settles for the first of them rather than looping. That square is then
 * a genuine second occurrence of some word, and it will show up in the key,
 * because the key reads the grid — which is the entire reason the key reads the
 * grid.
 */
function fill(cells: Cells, words: string[], rand: () => number) {
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (cells[y][x] !== null) continue;
      const draw = shuffled(ALPHABET, rand);
      cells[y][x] =
        draw.find((letter) => !spells(cells, x, y, letter, words)) ?? draw[0];
    }
  }
}

/**
 * Where a word is in a finished grid, or `undefined` if it is not in it.
 *
 * The answer key, and the only thing that decides what goes on the word list.
 * Top-left first, then along the row, then by direction, so the same grid always
 * reports the same occurrence — a word that turns up twice (see `fill`) gets one
 * stroke through it rather than a key that changes its mind between builds.
 */
export function findWord(
  letters: string[][],
  word: string,
  steps: Step[],
): Found | undefined {
  if (word.length === 0) return undefined;
  for (let row = 0; row < letters.length; row++) {
    for (let column = 0; column < letters[row].length; column++) {
      for (const { dx, dy } of steps) {
        let all = true;
        for (let i = 0; i < word.length && all; i++)
          all = at(letters, column + dx * i, row + dy * i) === word[i];
        if (all) return { word, column, row, dx, dy };
      }
    }
  }
  return undefined;
}

export type WordSearch = {
  letters: string[][];
  /** The words the finished grid actually holds, in the order they were given. */
  find: string[];
  /** Where each of them is, found by reading the grid. */
  solution: Found[];
  /** The rest, named on the sheet rather than dropped. */
  omitted: string[];
};

/**
 * A word search over `words`, in a `size` by `size` grid.
 *
 * The words arrive as grid forms (`gridForm`), de-duplicated, and in the order
 * they should be printed. They are *placed* longest first, which is the one
 * ordering that matters: a nine-letter word has a handful of legal positions
 * and a three-letter word has hundreds, so placing the short ones first is how
 * a generator paints itself into a corner and drops the long ones.
 */
export function buildSearch(
  words: string[],
  size: number,
  options: { steps: Step[]; overlap: boolean },
  rand: () => number,
): WordSearch {
  const cells: Cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  const byLength = words
    .map((word, given) => ({ word, given }))
    .sort((a, b) => b.word.length - a.word.length || a.given - b.given);

  for (const { word } of byLength) {
    if (word.length === 0 || word.length > size) continue;
    const spot = positions(size, word.length, options.steps, rand).find(
      (position) =>
        legal(
          cells,
          word,
          position.x,
          position.y,
          position.step,
          options.overlap,
        ),
    );
    if (spot) write(cells, word, spot.x, spot.y, spot.step);
  }

  // Every word, not only the ones that were placed: a word the grid has no room
  // for must not be spelled out by the filler either, or the sheet would name it
  // as missing while a child stares straight at it.
  fill(cells, words, rand);
  const letters = cells.map((row) => row.map((letter) => letter ?? "A"));

  const find: string[] = [];
  const solution: Found[] = [];
  const omitted: string[] = [];
  for (const word of words) {
    const found = findWord(letters, word, options.steps);
    if (!found) {
      omitted.push(word);
      continue;
    }
    find.push(word);
    solution.push(found);
  }

  return { letters, find, solution, omitted };
}
