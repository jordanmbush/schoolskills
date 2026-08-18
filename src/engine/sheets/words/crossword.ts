/**
 * A crossword, grown outwards from the longest word.
 *
 * Same bargain as the word search next door and the same reason for it: the
 * squares are filled in by a placer that remembers nothing, and the numbered
 * clue list is then **read back out of the finished squares**. Nothing on the
 * sheet is taken on the placer's word.
 *
 * That buys the three properties a crossword can silently lose:
 *
 * **The crossings agree.** A square holds one letter. If 3 Across spells its
 * answer out of the grid and 1 Down spells its answer out of the same grid,
 * then wherever they meet they agree — there is only one letter there to read.
 * A generator that wrote both words into its own bookkeeping could have them
 * disagreeing about a square and never notice.
 *
 * **The numbering is the grid's.** Numbers are assigned by scanning the
 * finished squares in reading order, which is what a crossword's numbers mean.
 * They are not handed out as words are placed, which would number them in the
 * order the algorithm happened to work in.
 *
 * **It is one puzzle, not several.** Every word after the first is placed only
 * where it crosses a word already in the grid, so the finished thing is
 * connected by construction — the classic wrong answer here is a grid with two
 * unrelated islands in it, which is two half-crosswords on one page.
 *
 * And the work is bounded twice over. A word is offered the positions its own
 * letters allow, once per pass; there are at most `PASSES` passes and at most
 * `ATTEMPTS` layouts, and both stop early when they stop helping. Nothing in
 * here waits for a random draw to come good, so a list of twenty words that
 * share no letters produces a sheet naming nineteen of them rather than a tab
 * that never finishes.
 */
import { shuffled } from "@/engine/random";

import type { CrosswordCell, CrosswordEntry } from "../types";

/**
 * The shortest thing that can be an entry.
 *
 * Two, not three. Three is the convention in a newspaper, but this is a sheet
 * set on a child's spelling list, and half of the first Dolch list — go, in,
 * is, it, me, my, to, up, we — is two letters long. Refusing them would report
 * most of a sight-word list as unusable. One-letter words really are unusable:
 * there is no such thing as an entry with no direction.
 */
export const MIN_ENTRY = 2;

/** A word waiting for a home, and the clue that will be printed against it. */
export type Clued = { word: string; clue: string };

type Cells = Array<Array<string | null>>;
type Step = { dx: number; dy: number };

const ACROSS: Step = { dx: 1, dy: 0 };
const DOWN: Step = { dx: 0, dy: 1 };

const at = (cells: Cells, x: number, y: number): string | null =>
  y >= 0 && y < cells.length && x >= 0 && x < cells[y].length
    ? cells[y][x]
    : null;

/**
 * Whether a word may be written here, and how many letters it would share.
 *
 * The four rules are what keep the grid a crossword rather than a pile of
 * words:
 *
 * - The squares immediately before and after the word must be empty, or the
 *   entry would run on into its neighbour and the answer read off the grid
 *   would be longer than the answer in the clue list.
 * - A square that already holds a letter must hold *this* letter. That is a
 *   crossing, and it is the only way two words may touch.
 * - A square this word brings with it must have nothing either side of it,
 *   across the word's own direction. Two words lying side by side spell
 *   two-letter nonsense down every pair of columns they share, and a child
 *   reading the grid cannot tell that from an entry.
 * - **It may not swallow an entry already in the grid.** AS sits inside ASK
 *   letter for letter, so an ASK written over an AS that a previous pass put
 *   down costs a word: every letter is still on the paper, and AS has no
 *   squares of its own to be written in and no number to be clued by. Two
 *   letters or more running the word's own way inside its span *is* an existing
 *   entry, so that is what is refused — a lone occupied square is a crossing,
 *   which is the whole point. (The sheet would still tell the truth about it
 *   without this rule, because the missing list is read off the grid. This is
 *   about keeping the word, not about admitting to losing it.)
 *
 * `undefined` for "no", a crossing count for "yes" — one return rather than a
 * boolean and a second pass, because the count is what the placement is scored
 * on and counting it twice is how the two answers drift apart.
 */
function crossings(
  cells: Cells,
  word: string,
  x: number,
  y: number,
  step: Step,
): number | undefined {
  const size = cells.length;
  const endX = x + step.dx * (word.length - 1);
  const endY = y + step.dy * (word.length - 1);
  if (x < 0 || y < 0 || endX < 0 || endY < 0) return undefined;
  if (endX >= size || endY >= size) return undefined;
  if (at(cells, x - step.dx, y - step.dy) !== null) return undefined;
  if (at(cells, endX + step.dx, endY + step.dy) !== null) return undefined;

  // Across a word running across is up and down; across one running down is
  // left and right. One rotation, written once.
  const side: Step = { dx: step.dy, dy: step.dx };
  let shared = 0;
  let run = 0;
  for (let i = 0; i < word.length; i++) {
    const cx = x + step.dx * i;
    const cy = y + step.dy * i;
    const held = at(cells, cx, cy);
    if (held !== null) {
      if (held !== word[i]) return undefined;
      shared += 1;
      run += 1;
      if (run >= MIN_ENTRY) return undefined;
      continue;
    }
    run = 0;
    if (at(cells, cx - side.dx, cy - side.dy) !== null) return undefined;
    if (at(cells, cx + side.dx, cy + side.dy) !== null) return undefined;
  }
  return shared;
}

function write(cells: Cells, word: string, x: number, y: number, step: Step) {
  for (let i = 0; i < word.length; i++)
    cells[y + step.dy * i][x + step.dx * i] = word[i];
}

type Spot = { x: number; y: number; step: Step; shared: number; near: number };

/**
 * Every place this word could go, crossing something already placed.
 *
 * Enumerated from the letters in the grid rather than from every square: a word
 * has to cross, so its start is fixed by *which* of its letters is doing the
 * crossing and where that letter already is. That is at most
 * `letters in grid × length of word × 2` positions, each considered once, which
 * is what makes this terminate on a list it cannot fit.
 */
function spotsFor(cells: Cells, word: string): Spot[] {
  const size = cells.length;
  const middle = (size - 1) / 2;
  const seen = new Set<string>();
  const out: Spot[] = [];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const held = cells[y][x];
      if (held === null) continue;
      for (let i = 0; i < word.length; i++) {
        if (word[i] !== held) continue;
        for (const step of [ACROSS, DOWN]) {
          const sx = x - step.dx * i;
          const sy = y - step.dy * i;
          const key = `${sx},${sy},${step.dx}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const shared = crossings(cells, word, sx, sy, step);
          if (shared === undefined || shared === 0) continue;
          // How far the middle of the word sits from the middle of the grid.
          // A crossword that drifts into one corner wastes the paper it was
          // given and crops to a long thin thing nobody can write in.
          const near =
            Math.abs(sx + (step.dx * (word.length - 1)) / 2 - middle) +
            Math.abs(sy + (step.dy * (word.length - 1)) / 2 - middle);
          out.push({ x: sx, y: sy, step, shared, near });
        }
      }
    }
  }
  return out;
}

/** The best of them: most crossings, then closest to the middle. */
const bestSpot = (spots: Spot[]): Spot | undefined =>
  spots.reduce<Spot | undefined>(
    (best, spot) =>
      !best ||
      spot.shared > best.shared ||
      (spot.shared === best.shared && spot.near < best.near)
        ? spot
        : best,
    undefined,
  );

export type Crossword = {
  cells: Array<Array<CrosswordCell | null>>;
  across: CrosswordEntry[];
  down: CrosswordEntry[];
  /** Words that could not be crossed into the grid — named on the sheet. */
  omitted: string[];
};

/**
 * Reads the finished squares: which of them start an entry, what that entry
 * spells, and what number it gets.
 *
 * A square starts an entry across when there is nothing to its left and
 * something to its right, and down when there is nothing above and something
 * below — the rule every crossword in the world is numbered by. Numbers run in
 * reading order and a square that starts both directions takes one number for
 * the pair, which is why this is one pass and not two.
 */
function readEntries(
  cells: Cells,
  clues: Map<string, string>,
): Pick<Crossword, "cells" | "across" | "down"> {
  const height = cells.length;
  const width = height === 0 ? 0 : cells[0].length;
  const grid: Array<Array<CrosswordCell | null>> = cells.map((row) =>
    row.map((letter) => (letter === null ? null : { letter })),
  );
  const across: CrosswordEntry[] = [];
  const down: CrosswordEntry[] = [];
  let number = 0;

  const runFrom = (x: number, y: number, step: Step): string => {
    let word = "";
    for (let i = 0; ; i++) {
      const letter = at(cells, x + step.dx * i, y + step.dy * i);
      if (letter === null) return word;
      word += letter;
    }
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (cells[y][x] === null) continue;
      const startsAcross =
        at(cells, x - 1, y) === null && at(cells, x + 1, y) !== null;
      const startsDown =
        at(cells, x, y - 1) === null && at(cells, x, y + 1) !== null;
      if (!startsAcross && !startsDown) continue;

      number += 1;
      grid[y][x] = { letter: cells[y][x] as string, number };
      for (const [starts, step, list] of [
        [startsAcross, ACROSS, across],
        [startsDown, DOWN, down],
      ] as const) {
        if (!starts) continue;
        const answer = runFrom(x, y, step);
        list.push({
          number,
          // A run the clue list has never heard of cannot happen while the
          // adjacency rules above hold — every run *is* a placed word. Saying
          // so out loud rather than asserting it: an entry with no clue is
          // still an entry, and a sheet with a blank clue on it is a bug
          // somebody can see, which is better than one that throws at build.
          clue: clues.get(answer) ?? "",
          answer,
          column: x,
          row: y,
        });
      }
    }
  }
  return { cells: grid, across, down };
}

/** The grid trimmed to the words in it, so no page is spent on empty squares. */
function crop(cells: Cells): Cells {
  let top = cells.length;
  let bottom = -1;
  let left = cells.length;
  let right = -1;
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (cells[y][x] === null) continue;
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    }
  }
  if (bottom < 0) return [];
  return cells.slice(top, bottom + 1).map((row) => row.slice(left, right + 1));
}

/**
 * One go at laying the words out, inside a `size` by `size` grid.
 *
 * Longest first, which matters more here than it does in a word search: the
 * long words are the ones with the crossings in them, so a grid that starts
 * with three-letter words has nothing for the nine-letter one to hang on. The
 * seed shuffles first and the sort is stable, so equal-length words are ordered
 * by the seed.
 *
 * Then the words that found nowhere to go are offered the grid again, up to
 * `PASSES` times over. That is not the "shuffle and try again" this file is at
 * pains to avoid — nothing is re-randomised and nothing is undone. It is that
 * the question genuinely changes: a word needs a letter to cross, and every
 * word placed after it put more letters on the board. BECAUSE with no U to hang
 * on when its turn came may well have one by the time DOG and THE have landed.
 * The loop stops the moment a whole pass places nothing, so the work is bounded
 * by the words rather than by the constant.
 */
const PASSES = 3;

function attempt(
  entries: Clued[],
  size: number,
  clues: Map<string, string>,
  rand: () => number,
): Crossword {
  const cells: Cells = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );

  const order = shuffled(entries, rand)
    .map((entry, at) => ({ entry, at }))
    .sort((a, b) => b.entry.word.length - a.entry.word.length || a.at - b.at)
    .map(({ entry }) => entry.word);

  // Too short to be an entry, or too long for the grid: no pass will change
  // either, so they are out before the first one starts.
  let waiting = order.filter(
    (word) => word.length >= MIN_ENTRY && word.length <= size,
  );

  let anchored = false;
  for (let pass = 0; pass < PASSES && waiting.length > 0; pass++) {
    const stuck: string[] = [];
    for (const word of waiting) {
      if (!anchored) {
        // The first word has nothing to cross, so it is laid across the middle
        // and everything else grows off it.
        write(
          cells,
          word,
          Math.floor((size - word.length) / 2),
          Math.floor(size / 2),
          ACROSS,
        );
        anchored = true;
        continue;
      }
      const spot = bestSpot(spotsFor(cells, word));
      if (!spot) {
        stuck.push(word);
        continue;
      }
      write(cells, word, spot.x, spot.y, spot.step);
    }
    if (stuck.length === waiting.length) break;
    waiting = stuck;
  }

  // **The missing list is read off the finished grid, not off the placer.** A
  // word is on the sheet when it has squares of its own and a number to be
  // clued by, and that is a question about the grid rather than about whether
  // `write` was called — the two came apart the first time ASK was laid over an
  // AS that was already there. Asking the paper is the same discipline the
  // answer key is derived by, and it cannot make that mistake.
  //
  // In the order the parent typed them, because the list on the sheet is a list
  // of their words rather than of the placer's regrets.
  const grid = readEntries(crop(cells), clues);
  const present = new Set(
    [...grid.across, ...grid.down].map((entry) => entry.answer),
  );
  return {
    ...grid,
    omitted: entries
      .map((entry) => entry.word)
      .filter((word) => !present.has(word)),
  };
}

/**
 * How many layouts are tried before the best of them is kept.
 *
 * Which words land is decided almost entirely by which word is laid down first:
 * COULD shares not one letter with AFTER, AGAIN or EVERY, so a sight-word list
 * anchored on COULD places three of its twelve words and the same list anchored
 * on AFTER places nine. That is not a flaw in the placer, it is the shape of
 * English — and the fix is not a cleverer placer but a second opinion.
 *
 * Six goes, each off the same seeded stream, and the one with the most words in
 * it wins. Bounded work, still a pure function of `(config, seed)`, and it
 * stops early the moment a layout takes every word there is — there is nothing
 * left to beat.
 */
const ATTEMPTS = 6;

/**
 * A crossword over `entries`, laid out inside a `size` by `size` grid and
 * cropped to what landed.
 *
 * Ties are broken on the *smaller* grid, which is the right way round: two
 * layouts holding the same nine words are the same sheet's worth of work, and
 * the compact one leaves room on the page and is easier to write in. Then on
 * the earlier attempt, so the choice never depends on iteration order.
 */
export function buildCrossword(
  entries: Clued[],
  size: number,
  rand: () => number,
): Crossword {
  const clues = new Map(entries.map((entry) => [entry.word, entry.clue]));
  let best: Crossword | undefined;
  let most = -1;
  let smallest = Infinity;

  for (let go = 0; go < ATTEMPTS; go++) {
    const laid = attempt(entries, size, clues, rand);
    const placed = entries.length - laid.omitted.length;
    const area = laid.cells.length * (laid.cells[0]?.length ?? 0);
    if (placed > most || (placed === most && area < smallest)) {
      best = laid;
      most = placed;
      smallest = area;
    }
    if (most === entries.length) break;
  }

  return best ?? { cells: [], across: [], down: [], omitted: [] };
}
