/**
 * Puzzles, over whatever list a parent already has.
 *
 * The third family on the words shelf, and the sibling of `words/spelling.ts`
 * rather than a replacement for it: the same box of words, set as a game
 * instead of as an exercise. Three of them — a letter grid to hunt in, a
 * crossword clued from the sentences the sight-word lists already carry, and
 * the letters of a word out of order.
 *
 * Everything the shelf promises holds here unchanged. The page comes out of
 * `(config, seed)` and nothing else; the answers are computed when the sheet is
 * built and the key only decides to print them; no row goes on the page that
 * the capacity arithmetic did not reserve room for.
 *
 * What is different is where the risk sits. A page of sums is checked by doing
 * the sums, and a page of spellings is checked by reading them. A word search
 * is checked by *finding twelve words in a grid*, which nobody does — so a word
 * that quietly failed to place looks exactly like a word that placed well, and
 * the sheet goes out asking a child to find something that is not there. That
 * is the failure this family is built around, and the two generators it leans
 * on (`search.ts`, `crossword.ts`) answer it the same way: the answer key is
 * read out of the finished puzzle, and a word the finished puzzle does not
 * contain is **named on the sheet** rather than dropped.
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
   failure is the usual one and it is silent on screen: a block an eighth of an
   inch taller than the space reserved for it prints its last row on a second
   sheet of paper.                                                           */

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
 * Sanitised by the spelling family's own `wordsOf`, because a puzzle config
 * comes through the same three doors a spelling one does — a parent's paste, a
 * saved sheet, a link somebody was sent — and two sanitisers would be two
 * answers to whether `Cat` and `cat` are one word.
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
 * The word's own letters, turned so they no longer spell it.
 *
 * The clue for a word this build has never met. A crossword needs a clue for
 * every entry and a parent's list of Tuesday's spellings comes with none, so
 * the honest fallback is the one clue that can be written for any word at all:
 * its letters, out of order. It is a real clue — the crossings and the square
 * count settle it — and it is the same question the scramble style asks, which
 * is the right kind of coincidence on a shelf where one list makes seven
 * sheets.
 *
 * A rotation rather than a shuffle, because the *layout* has to measure the
 * clue list before a seed has chosen anything, and a clue whose length depends
 * on the seed would be a page whose capacity does too. Half the word round,
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
 * The clue for one entry: the list's own sentence where there is one.
 *
 * Every shipped sight-word list gives each of its words a short sentence with
 * the word taken out of it — written for the race, where it is what makes a
 * homophone answerable at all — and a crossword clue is *exactly* that shape.
 * So the sheet and the game ask one question of one list, and a crossword set
 * on "First words" is clued in sentences somebody wrote for a five-year-old
 * rather than in dictionary definitions nobody would.
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

/**
 * The grid, and the words there is room to hunt for in it.
 *
 * Two passes, and they are in this order because they are not equally cheap to
 * be wrong about. A grid one row smaller is a puzzle nobody notices; a word
 * list one word shorter is a word the parent asked for and did not get. So the
 * grid gives way first, down to `MIN_GRID`, and only then are words dropped —
 * and the ones dropped are reported on the sheet with the ones the placer could
 * not fit, because "not in the grid" is true of both and is the only thing the
 * person marking it needs to know.
 */
export function searchLayout(config: PuzzleConfig): {
  box: Box;
  size: number;
  cell: Mil;
  words: PuzzleWord[];
  dropped: string[];
} {
  const head = headerOf(config);
  const box = sheetBlockBox(head, true);
  const { words, unusable } = puzzleWords(config);

  const heightOf = (size: number, some: PuzzleWord[]): Mil =>
    size * searchCell(box.width, size) +
    listHeight(
      some.map((word) => word.form),
      head,
      box.width,
    );

  let size = clamp(config.size ?? MIN_GRID, MIN_GRID, MAX_GRID);
  while (size > MIN_GRID && heightOf(size, words) > box.height) size -= 1;

  let fit = words;
  while (fit.length > 0 && heightOf(size, fit) > box.height)
    fit = fit.slice(0, -1);

  return {
    box,
    size,
    cell: searchCell(box.width, size),
    words: fit,
    dropped: [...words.slice(fit.length).map((word) => word.form), ...unusable],
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
 * what landed and cannot be known before it is built. That over-reserves — a
 * dozen short words in a thirteen-square bound crop to eight or nine — and
 * over-reserving costs a row of white space at the foot of the page, where
 * under-reserving costs a second sheet of paper. `chrome.ts` makes the same
 * trade for the same reason.
 *
 * The clue list is reserved as though every clue landed in one column, for the
 * same reason again: it prints in two, and which of them a clue falls in is a
 * question about how many across entries there turned out to be.
 *
 * And the square is reserved at `SEARCH_CELL` rather than at the size the bound
 * would come out at, which is the one piece of this that is not merely
 * cautious. A cropped grid has *fewer columns*, and fewer columns is a bigger
 * square — ten columns of a twenty-square bound get the full 0.34in where the
 * bound itself would have got 0.325in — so a reservation made at the bound's
 * own square would be a grid taller than the room made for it, which is exactly
 * the failure this arithmetic exists to prevent.
 */
export function crosswordLayout(config: PuzzleConfig): {
  box: Box;
  /** The largest grid the words may be laid out in, not the one they need. */
  size: number;
  entries: Clued[];
  dropped: string[];
} {
  const head = headerOf(config);
  const box = sheetBlockBox(head, true);
  const { words, unusable } = puzzleWords(config);
  const clued: Clued[] = words.map((word) => ({
    word: word.form,
    clue: crosswordClue(word),
  }));

  const heightOf = (size: number, some: Clued[]): Mil =>
    size * SEARCH_CELL +
    clueHeight(
      some.map((entry) => entry.clue),
      head,
      box.width,
    );

  let size = clamp(config.size ?? MIN_GRID, MIN_GRID, MAX_GRID);
  while (size > MIN_GRID && heightOf(size, clued) > box.height) size -= 1;

  let fit = clued;
  while (fit.length > 0 && heightOf(size, fit) > box.height)
    fit = fit.slice(0, -1);

  return {
    box,
    size,
    entries: fit,
    dropped: [
      ...clued.slice(fit.length).map((entry) => entry.word),
      ...unusable,
    ],
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
  const { size, words, dropped } = searchLayout(config);
  const puzzle = buildSearch(
    words.map((word) => word.form),
    size,
    {
      steps: searchSteps(
        config.directions ?? "across-down",
        Boolean(config.reverse),
      ),
      overlap: config.overlap !== false,
    },
    mulberry32(seed),
  );
  const omitted = [...puzzle.omitted, ...dropped];
  return {
    blocks: [
      {
        kind: "wordsearch",
        letters: puzzle.letters,
        find: puzzle.find,
        solution: puzzle.solution,
        ...(omitted.length > 0 ? { omitted } : {}),
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
  const { size, entries, dropped } = crosswordLayout(config);
  const puzzle = buildCrossword(entries, size, mulberry32(seed));
  const omitted = [...puzzle.omitted, ...dropped];
  return {
    blocks: [
      {
        kind: "crossword",
        cells: puzzle.cells,
        across: puzzle.across,
        down: puzzle.down,
        ...(omitted.length > 0 ? { omitted } : {}),
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
    // the same list the jungle races, and it is the one game a child holding
    // this page would recognise the words from (§16).
    footer: { credit: SHEET_CREDIT, url: gameUrl("jungle"), seed },
    answers: false,
  };
}

export const PUZZLE_SHEET: SheetSpec<PuzzleConfig> = {
  id: "puzzle",
  label: "Word puzzle",
  world: SHEET_WORLD,
  build: buildPuzzleSheet,
  // Every answer here was decided when the sheet was built — which is to say,
  // read out of the finished puzzle — so a key cannot disagree with the paper
  // it belongs to. `key` only turns the printing on.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describePuzzle,
};
