/**
 * Puzzles, over whatever list a parent already has: the same box of words as
 * `words/spelling.ts`, set as a game instead of as an exercise.
 *
 * A word search is checked by finding twelve words in a grid, which nobody
 * does, so this family is built around one rule and most of the arithmetic
 * below exists to keep it: **the answer key is read out of the finished puzzle,
 * and a word the finished puzzle does not contain is named on the sheet rather
 * than dropped** (§11).
 */
import { fillClue, shippedClue } from "@/engine/decks/words";
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Block,
  Mil,
  Problem,
  PuzzleConfig,
  Sheet,
  SheetOptions,
} from "../types";

import { declaredWidth, packRows, sheetBlockBox } from "../chrome";
import { PROBLEM_GAP, columnWidth, fitAcross, type Box } from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";
import { buildCrossword, type Clued } from "./crossword";
import {
  SEARCH_CELL,
  buildSearch,
  gridForm,
  searchCell,
  searchSteps,
} from "./search";
import { wordsOf } from "./spelling";

/* ── What a puzzle takes on the page ──────────────────────────────────────
   Declared, not measured (§4), and every number here trails sheet.css. The
   failure is silent on screen: a block an eighth of an inch taller than the
   space reserved for it prints its last row on a second sheet of paper.     */

/** A scrambled word and the rule it is written on: one line of body type. */
const ROW_EMS = 1.7;

/** `.sheet__words` and `.sheet__clues` are both set at nine tenths. */
const SMALL_EM = 0.9;
/** Which is a line box of `0.9 × 1.35` at the sheet's own line height. */
const SMALL_ROW_EMS = 1.22;

/** `.sheet__words`: the word list under a grid, and the air around it. */
const LIST_GAP = inches(0.28);
const LIST_ROW_GAP = inches(0.06);
const LIST_MARGIN = inches(0.12);

/** `.sheet__missing`: the italic line that admits a word did not fit. */
const MISSING_EM = 0.85;
/** Which is a line box of `0.85 × 1.35` at the sheet's own line height. */
const MISSING_ROW_EMS = 1.15;
const MISSING_MARGIN = inches(0.1);

/**
 * How much of the page the sheet may spend talking about itself.
 *
 * Three rows names thirty words at body size, which is the whole list a puzzle
 * may carry — so on an ordinary sheet the cap is not reached and every missing
 * word is named. It bites where the type is large and the list is long: at 36pt
 * a single row is a fifth of the writing space, and a page that gave nine of
 * them to a paragraph about what is *not* on it would be a page with no puzzle
 * on it. Past this the line says "… and 22 more".
 */
const MISSING_ROWS = 3;

/** `.sheet__clues`: two columns of clues, and the heading over each. */
const CLUE_GAP = inches(0.3);
const CLUE_ROW_GAP = inches(0.05);
const CLUE_MARGIN = inches(0.12);
const CLUE_HEAD_EMS = 1.4;
/** Room for the number in front of a clue, which is not known until it is one. */
const CLUE_NUMBER = "88. ";

/** More than three columns of scrambled words is a page nobody can write on. */
const MAX_COLUMNS = 3;

/**
 * How big a grid may be asked for.
 *
 * Eight is the smallest square that holds a word a child of this age is likely
 * to be given; twenty is where a cell stops being a square somebody can write a
 * letter in on Letter paper. A config outside that is clamped rather than
 * refused, and a grid that still would not fit *with its word list under it* is
 * shrunk again by `searchLayout` — the paper has the last word.
 */
export const MIN_GRID = 8;
export const MAX_GRID = 20;

/**
 * How many words one puzzle may carry.
 *
 * Well under the two hundred a list may hold, and the cap is about the child
 * rather than the paper: thirty words in one grid is not a harder puzzle, it is
 * an afternoon. What the page holds caps it again below this.
 */
export const MAX_PUZZLE_WORDS = 30;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** A height quoted in ems of the body size, in the unit the page is in. */
const em = (fontPt: number, rows: number): Mil => points(fontPt * rows);

/** Letters with air between them, which is how a jumble is always printed. */
const spaced = (text: string): string => [...text].join(" ");

/* ── The list ──────────────────────────────────────────────────────────── */

export type PuzzleWord = {
  /** As the parent typed it — what a scramble's answer is, and its key. */
  given: string;
  /** As a grid can hold it: upper case, letters only (`gridForm`). */
  form: string;
};

/**
 * The words this family works in, and the ones it cannot use at all.
 *
 * Sanitised by the spelling family's own `wordsOf`, because two sanitisers
 * would be two answers to whether `Cat` and `cat` are one word.
 *
 * Then de-duplicated a second time, on the *grid* form. "its" and "it's" are
 * two words to a marker and one word to a letter grid, and a puzzle that
 * printed ITS twice on its word list would be asking a child to find the same
 * squares again. The first of the pair keeps the place.
 *
 * A "word" with no letters in it — a stray `123` off the end of a pasted list —
 * has no grid form at all, and is reported rather than swallowed.
 */
export function puzzleWords(config: PuzzleConfig): {
  words: PuzzleWord[];
  unusable: string[];
} {
  const seen = new Set<string>();
  const words: PuzzleWord[] = [];
  const unusable: string[] = [];
  for (const given of wordsOf(config)) {
    const form = gridForm(given);
    if (form.length === 0) {
      unusable.push(given);
      continue;
    }
    if (seen.has(form)) continue;
    seen.add(form);
    words.push({ given, form });
  }
  const wanted = clamp(config.count ?? words.length, 0, MAX_PUZZLE_WORDS);
  return { words: words.slice(0, wanted), unusable };
}

/* ── Clues ─────────────────────────────────────────────────────────────── */

/** What a crossword prints where the answer goes in its own clue. */
const CLUE_BLANK = "___";

/**
 * The word's own letters, turned so they no longer spell it — the clue for a
 * word this build has never met (§11).
 *
 * A rotation rather than a shuffle, because the *layout* has to measure the
 * clue list before a seed has chosen anything, and a clue whose length depended
 * on the seed would be a page whose capacity did too. Half the word round,
 * falling back to reversing it in the one case where that lands where it
 * started ("abab"). A word of one repeated letter cannot be disguised, and is
 * printed as it is.
 */
export function letterHint(word: string): string {
  const letters = [...word];
  const shift = Math.max(1, Math.floor(letters.length / 2));
  const turned = [...letters.slice(shift), ...letters.slice(0, shift)].join("");
  return turned === word ? letters.reverse().join("") : turned;
}

/**
 * The clue for one entry: the list's own sentence where there is one, so the
 * sheet and the race ask one question of one list (§11).
 *
 * Looked up on the word as typed first and on the grid form second, so a list
 * written in capitals still finds its sentences and `DONT` still finds the one
 * written for `don't`.
 */
export function crosswordClue({ given, form }: PuzzleWord): string {
  const sentence = shippedClue(given) ?? shippedClue(form);
  if (sentence) return fillClue(sentence, CLUE_BLANK);
  return `Jumbled: ${spaced(letterHint(form))}`;
}

/* ── Scrambling ────────────────────────────────────────────────────────── */

/** How many draws before a word that keeps coming back as itself is fixed. */
const SCRAMBLE_TRIES = 8;

/**
 * The word's characters in another order — never the same order.
 *
 * A permutation of the whole string rather than of its letters, so what is
 * printed is a genuine anagram of what the key says: the answer to `n ' t d o`
 * is `don't`, apostrophe included, and a child rearranging the characters they
 * can see arrives at exactly the word on the key.
 *
 * Bounded, and this is the one place in the family where an unbounded loop
 * would be the obvious way to write it. "Shuffle until it differs" is a
 * one-in-two coin toss on a two-letter word and never terminates on `aa`, so
 * after eight goes the letters are simply swapped into a position they cannot
 * have started in. A word of one repeated letter is returned as it is, because
 * there is nothing else it can be.
 */
export function scramble(word: string, rand: () => number): string {
  const letters = [...word];
  if (new Set(letters).size < 2) return word;
  for (let tries = 0; tries < SCRAMBLE_TRIES; tries++) {
    const out = shuffled(letters, rand).join("");
    if (out !== word) return out;
  }
  const different = letters.findIndex((letter) => letter !== letters[0]);
  const swapped = [...letters];
  [swapped[0], swapped[different]] = [swapped[different], swapped[0]];
  return swapped.join("");
}

/* ── What fits ─────────────────────────────────────────────────────────── */

/** The wrapping word list under a grid, at the height it will actually take. */
function listHeight(words: string[], head: SheetOptions, width: Mil): Mil {
  if (words.length === 0) return 0;
  const rows = packRows(
    words.map((word) => declaredWidth(word, head, SMALL_EM)),
    width,
    LIST_GAP,
  );
  return (
    LIST_MARGIN +
    em(head.fontPt, SMALL_ROW_EMS * rows) +
    LIST_ROW_GAP * Math.max(0, rows - 1)
  );
}

/* ── The line that admits a word did not fit ──────────────────────────────
   The one row on a sheet where an unreserved line could not come out in the
   wash: `<Omitted>` renders it *under* a block the trim loops below have just
   shrunk to exactly the room available, and the trimming is what creates the
   list it prints — so it is guaranteed to be there precisely when there is
   nothing left to put it in. What the arithmetic measures and what the renderer
   sets are therefore the same tokens, out of the same function.              */

/** What `<Omitted>` puts in front of the list. */
const MISSING_HEAD = "Not in the grid:";

/** As much of the list as the page can hold, and a count of the rest. */
type Missing = { words: string[]; more: number };

/**
 * The missing line, as the words it is set from.
 *
 * Tokens rather than a sentence because both halves need it in this shape: the
 * renderer joins them with a space, and the reservation packs them by whole
 * words, greedily, exactly as `packRows` does for the wrapping rows in the
 * chrome. A copy of the sentence in `Omitted.tsx` would be a paragraph measured
 * at one length and printed at another.
 */
export function missingTokens(words: string[], more: number): string[] {
  return [
    MISSING_HEAD,
    // The last word takes no comma, the tail included: "CAT, DOG … and 3 more"
    // is a list that ran out, and "DOG, … and 3 more" is a typo.
    ...words.map((word, at) => (at === words.length - 1 ? word : `${word},`)),
    ...(more > 0 ? [`… and ${more} more`] : []),
  ];
}

/** How many rows those tokens wrap onto, in the room they are given. */
function missingRowsOf(
  words: string[],
  more: number,
  head: SheetOptions,
  width: Mil,
): number {
  return packRows(
    missingTokens(words, more).map((token) =>
      declaredWidth(`${token} `, head, MISSING_EM),
    ),
    width,
    0,
  );
}

/** What a line of `rows` rows takes, and nothing at all for none of them. */
function missingHeight(rows: number, fontPt: number): Mil {
  return rows === 0 ? 0 : MISSING_MARGIN + em(fontPt, MISSING_ROW_EMS * rows);
}

/**
 * How many rows to hold back, before it is known there will be a line at all.
 *
 * The two things that put a word on this line are decided at different times,
 * so the reservation answers them differently. The page's own drops are known
 * right here — the trim loops below are what create them — and are measured.
 * The placer's are not known until the grid has been built, by which point the
 * room is spent, and they get **one row, always**: a sheet where everything
 * fits gives up a row it will not use, and the other side of that trade is a
 * paragraph on a second sheet of paper.
 *
 * `anyWords` is what distinguishes "nothing could go wrong" from "nothing has
 * yet": a puzzle with no words at all reserves nothing.
 */
function missingReserve(
  known: string[],
  anyWords: boolean,
  head: SheetOptions,
  width: Mil,
): number {
  if (known.length === 0) return anyWords ? 1 : 0;
  return Math.min(MISSING_ROWS, missingRowsOf(known, 0, head, width));
}

/**
 * The rows the line actually gets: what was reserved, or what is left over.
 *
 * The reservation is made against `MISSING_ROWS`, and a page can be too small
 * to honour it even with the grid at `MIN_GRID` and no word list at all. Then
 * the line takes what remains — never none of it, because the one thing worse
 * than a line below the bottom margin is a word that vanished without one.
 */
function missingRoom(reserve: number, left: Mil, fontPt: number): number {
  if (reserve === 0) return 0;
  const room = Math.floor(
    Math.max(0, left - MISSING_MARGIN) /
      Math.max(1, em(fontPt, MISSING_ROW_EMS)),
  );
  return Math.max(1, Math.min(reserve, room));
}

/**
 * As much of the list as `rows` rows will hold, and a count of the rest.
 *
 * Searched downwards from "all of them" rather than solved, because the tail is
 * part of what has to fit and its own width moves with the number in it — a
 * word gained is sometimes a digit lost. Naming one fewer word can only ever
 * help, so the first count that fits is the largest one that does.
 */
function packMissing(
  words: string[],
  head: SheetOptions,
  width: Mil,
  rows: number,
): Missing {
  if (words.length === 0 || rows <= 0) return { words: [], more: 0 };
  if (missingRowsOf(words, 0, head, width) <= rows) return { words, more: 0 };
  for (let named = words.length - 1; named > 0; named--)
    if (
      missingRowsOf(words.slice(0, named), words.length - named, head, width) <=
      rows
    )
      return { words: words.slice(0, named), more: words.length - named };
  return { words: [], more: words.length };
}

/** What a block records about the words it could not hold. */
function omittedOf({ words, more }: Missing): {
  omitted?: string[];
  omittedMore?: number;
} {
  return {
    ...(words.length > 0 ? { omitted: words } : {}),
    ...(more > 0 ? { omittedMore: more } : {}),
  };
}

/**
 * The grid, and the words there is room to hunt for in it.
 *
 * Two passes, in this order because they are not equally cheap to be wrong
 * about: a grid one row smaller is a puzzle nobody notices, and a word list one
 * word shorter is a word the parent asked for and did not get. So the grid
 * gives way first, down to `MIN_GRID`, and only then are words dropped — and
 * those are reported on the sheet alongside the ones the placer could not fit,
 * because "not in the grid" is true of both.
 */
export function searchLayout(config: PuzzleConfig): {
  box: Box;
  size: number;
  cell: Mil;
  words: PuzzleWord[];
  dropped: string[];
  /** Rows held back for the "not in the grid" line, whether or not there is one. */
  missingRows: number;
  /**
   * Everything the block will take: the grid, the word list, and the line that
   * admits what is not in either. Inside `box.height` unless the grid alone is
   * not — the one thing `MIN_GRID` will not give way on.
   */
  height: Mil;
} {
  const head = headerOf(config);
  const box = sheetBlockBox(head, true);
  const { words, unusable } = puzzleWords(config);

  // Measured against the drops *this* step would make, so a page that keeps
  // every word gives up one row rather than three.
  const reserveOf = (some: PuzzleWord[]): number =>
    missingReserve(
      [...words.slice(some.length).map((word) => word.form), ...unusable],
      words.length > 0,
      head,
      box.width,
    );
  const listOf = (some: PuzzleWord[]): Mil =>
    listHeight(
      some.map((word) => word.form),
      head,
      box.width,
    );
  const heightOf = (size: number, some: PuzzleWord[]): Mil =>
    size * searchCell(box.width, size) +
    listOf(some) +
    missingHeight(reserveOf(some), head.fontPt);

  let size = clamp(config.size ?? MIN_GRID, MIN_GRID, MAX_GRID);
  while (size > MIN_GRID && heightOf(size, words) > box.height) size -= 1;

  let fit = words;
  while (fit.length > 0 && heightOf(size, fit) > box.height)
    fit = fit.slice(0, -1);

  const cell = searchCell(box.width, size);
  const above = size * cell + listOf(fit);
  const missingRows = missingRoom(
    reserveOf(fit),
    box.height - above,
    head.fontPt,
  );
  return {
    box,
    size,
    cell,
    words: fit,
    dropped: [...words.slice(fit.length).map((word) => word.form), ...unusable],
    missingRows,
    height: above + missingHeight(missingRows, head.fontPt),
  };
}

/** The reserved height of a crossword's clue list, both columns in one. */
function clueHeight(clues: string[], head: SheetOptions, width: Mil): Mil {
  if (clues.length === 0) return 0;
  const column = columnWidth({ x: 0, y: 0, width, height: 0 }, 2, CLUE_GAP);
  const rows = clues.reduce(
    (total, clue) =>
      total +
      Math.max(
        1,
        Math.ceil(
          declaredWidth(`${CLUE_NUMBER}${clue}`, head, SMALL_EM) /
            Math.max(1, column),
        ),
      ),
    0,
  );
  return (
    CLUE_MARGIN +
    em(head.fontPt, CLUE_HEAD_EMS * 2 + SMALL_ROW_EMS * rows) +
    CLUE_ROW_GAP * Math.max(0, clues.length - 1)
  );
}

/**
 * The crossword's bound, and the clues there is room to print under it.
 *
 * Reserved against the **largest** grid the config allows rather than against
 * the one the words turn out to need, because the finished grid is cropped to
 * what landed and cannot be known before it is built. Over-reserving costs a
 * row of white space at the foot of the page, where under-reserving costs a
 * second sheet of paper. `chrome.ts` makes the same trade. The clue list is
 * reserved as though every clue landed in one column for the same reason: it
 * prints in two, and which of them a clue falls in is a question about how many
 * across entries there turned out to be.
 *
 * And the square is reserved at `SEARCH_CELL` rather than at the size the bound
 * would come out at, which is the one piece of this that is not merely
 * cautious. A cropped grid has *fewer columns*, and fewer columns is a bigger
 * square — ten columns of a twenty-square bound get the full 0.34in where the
 * bound itself would have got 0.325in — so a reservation made at the bound's
 * own square would be a grid taller than the room made for it.
 */
export function crosswordLayout(config: PuzzleConfig): {
  box: Box;
  /** The largest grid the words may be laid out in, not the one they need. */
  size: number;
  entries: Clued[];
  dropped: string[];
  /** Rows held back for the "not in the grid" line, whether or not there is one. */
  missingRows: number;
  /** The bound, the clues and the missing line — see `searchLayout.height`. */
  height: Mil;
} {
  const head = headerOf(config);
  const box = sheetBlockBox(head, true);
  const { words, unusable } = puzzleWords(config);
  const clued: Clued[] = words.map((word) => ({
    word: word.form,
    clue: crosswordClue(word),
  }));

  const reserveOf = (some: Clued[]): number =>
    missingReserve(
      [...clued.slice(some.length).map((entry) => entry.word), ...unusable],
      clued.length > 0,
      head,
      box.width,
    );
  const cluesOf = (some: Clued[]): Mil =>
    clueHeight(
      some.map((entry) => entry.clue),
      head,
      box.width,
    );
  const heightOf = (size: number, some: Clued[]): Mil =>
    size * SEARCH_CELL +
    cluesOf(some) +
    missingHeight(reserveOf(some), head.fontPt);

  let size = clamp(config.size ?? MIN_GRID, MIN_GRID, MAX_GRID);
  while (size > MIN_GRID && heightOf(size, clued) > box.height) size -= 1;

  let fit = clued;
  while (fit.length > 0 && heightOf(size, fit) > box.height)
    fit = fit.slice(0, -1);

  const above = size * SEARCH_CELL + cluesOf(fit);
  const missingRows = missingRoom(
    reserveOf(fit),
    box.height - above,
    head.fontPt,
  );
  return {
    box,
    size,
    entries: fit,
    dropped: [
      ...clued.slice(fit.length).map((entry) => entry.word),
      ...unusable,
    ],
    missingRows,
    height: above + missingHeight(missingRows, head.fontPt),
  };
}

/** How many scrambles the paper holds, and how wide a column of them is. */
export function scrambleLayout(config: PuzzleConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  const box = sheetBlockBox(headerOf(config), true);
  const columns = clamp(config.columns ?? 1, 1, MAX_COLUMNS);
  const row = em(config.fontPt, ROW_EMS);
  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(box.height, row, PROBLEM_GAP.y),
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

function searchBlocks(
  config: PuzzleConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const head = headerOf(config);
  const { box, size, words, dropped, missingRows } = searchLayout(config);
  const puzzle = buildSearch(
    words.map((word) => word.form),
    size,
    {
      steps: searchSteps(
        config.directions ?? "across-down",
        Boolean(config.reverse),
      ),
      overlap: config.overlap !== false,
      // The words the *page* had no room for. `buildSearch` keeps the filler
      // off them and then reads the grid to see which are genuinely absent, so
      // `omitted` comes back holding both kinds of missing and no lies.
      avoid: dropped,
    },
    mulberry32(seed),
  );
  return {
    blocks: [
      {
        kind: "wordsearch",
        letters: puzzle.letters,
        find: puzzle.find,
        solution: puzzle.solution,
        ...omittedOf(packMissing(puzzle.omitted, head, box.width, missingRows)),
      },
    ],
    // Out of what is findable, never out of what was asked for: a sheet marked
    // "/ 12" over eleven hidden words is wrong twice over.
    outOf: puzzle.find.length,
  };
}

function crosswordBlocks(
  config: PuzzleConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const head = headerOf(config);
  const { box, size, entries, dropped, missingRows } = crosswordLayout(config);
  const puzzle = buildCrossword(entries, size, mulberry32(seed));
  const omitted = [...puzzle.omitted, ...dropped];
  return {
    blocks: [
      {
        kind: "crossword",
        cells: puzzle.cells,
        across: puzzle.across,
        down: puzzle.down,
        ...omittedOf(packMissing(omitted, head, box.width, missingRows)),
      },
    ],
    outOf: puzzle.across.length + puzzle.down.length,
  };
}

function scrambleBlocks(
  config: PuzzleConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const rand = mulberry32(seed);
  const { columns, perPage } = scrambleLayout(config);
  const { words } = puzzleWords(config);
  const items: Problem[] = words.slice(0, perPage).map(({ given }) => ({
    prompt: spaced(scramble(given, rand)),
    answer: given,
  }));
  return {
    blocks: [{ kind: "problems", columns, items }],
    outOf: items.length,
  };
}

function bodyOf(
  config: PuzzleConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  switch (config.style) {
    case "crossword":
      return crosswordBlocks(config, seed);
    case "scramble":
      return scrambleBlocks(config, seed);
    default:
      return searchBlocks(config, seed);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<PuzzleConfig["style"], string> = {
  search: "Word search",
  crossword: "Crossword",
  scramble: "Word scramble",
};

/** How the grid's directions read in a sentence a child is given. */
const WHICH_WAY: Record<string, string> = {
  across: "across",
  "across-down": "across and down",
  all: "across, down and diagonally",
};

function instructionOf(config: PuzzleConfig): string {
  switch (config.style) {
    case "crossword":
      return "Write one letter in each square. The number in the corner is where the answer starts.";
    case "scramble":
      return "Put the letters back in order and write the word.";
    default: {
      const way = WHICH_WAY[config.directions] ?? WHICH_WAY["across-down"];
      const back = config.reverse ? ", and some are backwards" : "";
      return `Find and circle each word. Words run ${way}${back}.`;
    }
  }
}

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page — the instruction line wraps,
 * and a line the layout did not know about is the last row of the puzzle below
 * the bottom margin.
 */
function headerOf(config: PuzzleConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? TITLE[config.style] ?? TITLE.search,
    instructions: config.instructions ?? instructionOf(config),
  };
}

/** One line naming what the sheet holds, in the terms it was chosen by. */
export function describePuzzle(config: PuzzleConfig): string {
  const { words } = puzzleWords(config);
  const size = clamp(config.size ?? MIN_GRID, MIN_GRID, MAX_GRID);
  return [
    TITLE[config.style] ?? TITLE.search,
    `${words.length} ${words.length === 1 ? "word" : "words"}`,
    config.style === "search" ? `${size} × ${size}` : null,
    config.style === "search" && config.reverse ? "some backwards" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildPuzzleSheet(config: PuzzleConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = bodyOf(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      score: { outOf },
    },
    blocks,
    // The jungle, as the spelling sheet's is: a puzzle made of a word list is
    // the same list the jungle races (§16).
    footer: { credit: SHEET_CREDIT, url: gameUrl("jungle"), seed },
    answers: false,
  };
}

export const PUZZLE_SHEET: SheetSpec<PuzzleConfig> = {
  world: SHEET_WORLD,
  build: buildPuzzleSheet,
  // Every answer here was decided when the sheet was built — which is to say,
  // read out of the finished puzzle — so a key cannot disagree with its paper.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePuzzle,
};
