/**
 * Spelling, from whatever list a parent already has.
 *
 * The first family whose content the engine does not generate. Every maths
 * family draws from a range or a pool it owns; this one is handed a list —
 * this week's words off a school letter, a deck typed into Word Jungle, or the
 * words a child kept missing in the record book — and the only judgements left
 * are how they are set on the page. Which makes it the family the three
 * bootstraps in §14 land on: two of the three are "here is a list", and the
 * third is the same thing with the list chosen for you.
 *
 * Seven styles, and each one is an exercise somebody actually sets: write it
 * three times, fill in the letters that are missing, write it down as it is read
 * out, put the list in ABC order, write it into the shape its letters make, use
 * it in a sentence, or pick it out from the words it is most easily confused
 * with. All seven over one list, which is the whole reason they are a union
 * rather than seven families — a parent who has typed in this week's words gets
 * every one of them from the control beside the box.
 *
 * Everything the other families promise holds unchanged: the page comes out of
 * `(config, seed)` and nothing else, the answers are computed when the sheet is
 * built and the key only decides to print them, and no row is put on the page
 * that the capacity arithmetic did not reserve room for.
 */
import { normaliseWord, wordDistractors } from "@/engine/decks/words";
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Blank,
  Block,
  Choice,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  WordShape,
  WordsConfig,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  LIST_GAP,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";
import { SHAPE_ROW_EMS, wordShape } from "./shapes";

/* ── What a word takes on the page ────────────────────────────────────────
   Declared, not measured (§4). A word on a line is one line of the body type;
   a word to be written out is that line plus the rules it is written on, which
   wrap onto their own line inside the cell and pay the wrap gap for it.      */

const ROW_EMS = 1.7;

/** A gapped word is a line of body type, and a hair of air under it. */
const BLANK_EMS = 1.35;

/**
 * A multiple choice is two rows: the word being looked for, and the row of
 * candidates under it.
 *
 * Trailing `.sheet__questions` in sheet.css, which sets the options list 0.06in
 * under the question it belongs to — 1.35 for each line of type and the gap
 * between them, rounded up, because a row under-reserved is the last question
 * of the page on a second sheet of paper.
 */
const CHOICE_EMS = 3.1;

/** More than three columns of words is a page nobody can write on. */
const MAX_COLUMNS = 3;

/** As many words as a parent may type into a deck — see `services/decks.ts`. */
const MAX_WORDS = 200;

/** Long enough for "onomatopoeia" twice over; short enough not to wrap. */
const MAX_LETTERS = 24;

/** How many times a word may be written out, and how many letters may go. */
export const MAX_TIMES = 5;
export const MAX_GAPS = 4;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/* ── The list ──────────────────────────────────────────────────────────── */

/**
 * The words, made safe to print from whatever a saved config says.
 *
 * Held to the same shape `services/decks.ts` holds a typed-in list to, because
 * this config comes through the same three doors a deck does — a parent's
 * paste, a saved sheet, and a link somebody was sent — and only one of those
 * has ever been near a validator. Duplicates go the way the marker sees them,
 * so "Because" and "because" are one word on the page rather than two.
 *
 * Takes a list-carrying config rather than a `WordsConfig`, because the puzzle
 * family is handed a list through the same three doors and must hold it to the
 * same shape. A second sanitiser would be a second answer to "is `Cat` the same
 * word as `cat`", and the two sheets would disagree about a list they were both
 * given.
 */
export function wordsOf(config: { words?: string[] }): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of config.words ?? []) {
    if (typeof raw !== "string") continue;
    const word = raw.trim().replace(/\s+/g, " ").slice(0, MAX_LETTERS);
    if (!word) continue;
    const key = normaliseWord(word);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length === MAX_WORDS) break;
  }
  return out;
}

/* ── Taking letters out ────────────────────────────────────────────────── */

/**
 * One word with some of its letters missing, and the letters that are.
 *
 * Never the first one. A child reading "_at" has a word to work from and a
 * child reading "_ _ t" has a guessing game, and the point of the exercise is
 * the letters inside a word they can already see the shape of.
 *
 * **And never two in a row**, which is a rendering constraint as much as a
 * teaching one: `Blanks` reads a run of underscores of any length as *one*
 * gap, so "bec__se" is a single rule with two letters expected in it and an
 * answer key that prints only the first of them. Spacing them out is what
 * keeps one gap meaning one letter.
 *
 * A word with no interior letters to take — a single letter, an initial — is
 * printed whole rather than blanked to nothing, which is the honest answer:
 * there is nothing in it to leave out. A short word that cannot spare as many
 * as were asked for gives up the ones it can, for the same reason.
 */
export function gapped(word: string, gaps: number, rand: () => number): Blank {
  const inside = [...word]
    .map((letter, at) => ({ letter, at }))
    .filter(({ letter, at }) => at > 0 && /\p{L}/u.test(letter));

  const wanted = clamp(gaps, 1, MAX_GAPS);
  const at = new Set<number>();
  const taken: Array<{ letter: string; at: number }> = [];
  for (const letter of shuffled(inside, rand)) {
    if (taken.length === wanted) break;
    if (at.has(letter.at - 1) || at.has(letter.at + 1)) continue;
    at.add(letter.at);
    taken.push(letter);
  }
  if (taken.length === 0) return { text: word, answers: [] };

  taken.sort((a, b) => a.at - b.at);
  return {
    text: [...word].map((letter, i) => (at.has(i) ? "_" : letter)).join(""),
    answers: taken.map(({ letter }) => letter),
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const timesOf = (config: WordsConfig): number =>
  clamp(config.times ?? 3, 1, MAX_TIMES);

/** How many letters come out, said the way it reads in a sentence. */
const gapsOf = (config: WordsConfig): string => {
  const gaps = clamp(config.gaps ?? 2, 1, MAX_GAPS);
  return `${gaps} ${gaps === 1 ? "letter" : "letters"}`;
};

/**
 * The styles that are a list down the page rather than a grid across it.
 *
 * One column whatever the config says, and the list gap rather than the problem
 * one: the `blanks` and `choice` blocks are both flex columns of full-width
 * items, and a family that asked either of them for two columns would be
 * declaring a layout the renderer does not have.
 */
const DOWN_THE_PAGE = new Set<WordsConfig["style"]>(["missing", "find"]);

/** How tall one word stands, the lines it is written on included. */
function rowHeight(config: WordsConfig): Mil {
  const em = (rows: number): Mil => points(config.fontPt * rows);
  switch (config.style) {
    case "missing":
      return em(BLANK_EMS);
    case "find":
      return em(CHOICE_EMS);
    case "shapes":
      return em(SHAPE_ROW_EMS);
    case "test":
    case "abc":
      return em(ROW_EMS);
    default:
      // The rules a word is copied onto — or writes a sentence on — wrap under
      // it inside the same cell, so the gap the browser puts between the two
      // lines is reserved for here. See `WRAP_GAP`, which is that gap in the
      // unit the arithmetic works in.
      return (
        em(ROW_EMS) + WRAP_GAP + timesOf(config) * answerLine(config.fontPt)
      );
  }
}

/**
 * How many words the paper holds, and how wide a column of them is.
 *
 * Arithmetic rather than measurement, so the answer is the same in a unit test,
 * in the build of a catalog page and in the builder's live preview (§4).
 */
export function wordsLayout(config: WordsConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
} {
  // Against the header the sheet will print rather than the one the config
  // holds, and with the score box, because a spelling sheet is marked out of
  // its words. Reserving for the wrong header is a last row below the bottom
  // margin — invisible on screen, and a second sheet out of the printer.
  const box = sheetBlockBox(headerOf(config), true);
  const down = DOWN_THE_PAGE.has(config.style);
  const columns = down ? 1 : clamp(config.columns, 1, MAX_COLUMNS);
  const row = rowHeight(config);
  const gap = down ? LIST_GAP : PROBLEM_GAP.y;
  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(box.height, row, gap),
  };
}

/**
 * The words this sheet actually prints, in the order they were given.
 *
 * A spelling list is often taught in order and a list of missed words arrives
 * ranked worst-first, so *which* words are printed is the first `count` of them
 * rather than a draw. The count is a request rather than a promise, the same as
 * everywhere else: what does not fit is not printed, because print is the whole
 * of the output path (§10).
 *
 * How they are then laid out is the style's business, and one of the seven does
 * shuffle — see `abcItems`, where the order is the exercise.
 */
export function sheetWords(config: WordsConfig): string[] {
  const { perPage } = wordsLayout(config);
  const words = wordsOf(config);
  return words.slice(0, clamp(config.count ?? words.length, 0, perPage));
}

/** One word, as the style asks for it. */
function problemOf(word: string, config: WordsConfig): Problem {
  if (config.style === "test") {
    // Nothing to read: the word is said aloud and written on the rule, which
    // is what a spelling test is. The key is the list, which is what makes it
    // markable by somebody who was not the one reading it out.
    return { prompt: "", answer: word };
  }
  const times = timesOf(config);
  if (config.style === "sentence") {
    // The same rules as a copying sheet and nothing written on them, on either
    // half of the build: what a child puts there is their own sentence, so
    // there is no answer for a key to print. The word still sits above them —
    // it is the question — and the lines are the answer place, which is why it
    // gets no ruled slot as well (see `Problem.answers`).
    return {
      prompt: word,
      answer: "",
      answers: Array.from({ length: times }, () => ""),
      workspace: times * answerLine(config.fontPt),
    };
  }
  return {
    prompt: word,
    answer: word,
    // One rule per writing, and `workspace` is the height they share rather
    // than blank paper under them — see `Problem.answers`.
    answers: Array.from({ length: times }, () => word),
    workspace: times * answerLine(config.fontPt),
  };
}

/**
 * The list in alphabetical order.
 *
 * Compared on the normalised word so that "Because" files where a child would
 * look for it, and compared with `<` rather than with `localeCompare`, which
 * consults whatever collation the platform happens to ship: a sheet built in CI
 * and the same sheet built in a browser have to be the same sheet (§7), and this
 * is a list of English words rather than a general-purpose sort.
 */
export const alphabetical = (words: string[]): string[] =>
  [...words].sort((a, b) => {
    const [left, right] = [normaliseWord(a), normaliseWord(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  });

/**
 * The list scrambled, each word paired with the one that belongs on that line.
 *
 * Two columns of one exercise: the words down the left are the bank and the
 * ruled slots beside them are where the same words go in alphabetical order.
 * Line four's answer is the fourth word alphabetically and has nothing to do
 * with the word printed next to it, which is what the instruction says and what
 * makes the key read as a list.
 *
 * The bank is shuffled, and it is the one style where that is right. Everywhere
 * else the list is printed in the order it was given, because a spelling list is
 * taught in order — but here the order *is* the exercise, and every list this
 * sheet is likely to be set on arrives alphabetical already: the shipped Dolch
 * lists are, and so is anything typed out of a dictionary. A sheet whose answer
 * column is its own question column is not a sheet. Which scramble is the
 * seed's, so "another one like this" is another order (§7).
 */
const abcItems = (words: string[], rand: () => number): Problem[] => {
  const ordered = alphabetical(words);
  return shuffled(words, rand).map((word, at) => ({
    prompt: word,
    answer: ordered[at],
  }));
};

/**
 * One word among the words it is most easily mistaken for.
 *
 * The near misses are the deck's own — `wordDistractors` is what the race's
 * "spot it" round has always used — so a printed sheet and a played round ask
 * the same question of the same list. "there" against "their", never against
 * "squirrel": four unrelated words would make this a spotting exercise rather
 * than a reading one.
 */
const findQuestion = (
  word: string,
  pool: string[],
  rand: () => number,
): Choice => {
  const options = shuffled([word, ...wordDistractors(word, pool, rand)], rand);
  return { prompt: word, options, answer: options.indexOf(word) };
};

function bodyOf(
  config: WordsConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const words = sheetWords(config);
  const { columns } = wordsLayout(config);
  const outOf = words.length;

  if (config.style === "missing") {
    const rand = mulberry32(seed);
    const sentences = words.map((word) => gapped(word, config.gaps, rand));
    return { blocks: [{ kind: "blanks", sentences }], outOf: sentences.length };
  }

  if (config.style === "find") {
    // The pool is the words on the page rather than the whole list, so every
    // near miss printed is a word the child is being taught this week — and a
    // list too short to have three of them says so by offering fewer options
    // rather than by borrowing from somewhere else.
    const rand = mulberry32(seed);
    const questions = words.map((word) => findQuestion(word, words, rand));
    return { blocks: [{ kind: "choice", questions }], outOf };
  }

  if (config.style === "shapes") {
    const shapes: WordShape[] = words.map(wordShape);
    return { blocks: [{ kind: "wordshapes", columns, words: shapes }], outOf };
  }

  const items =
    config.style === "abc"
      ? abcItems(words, mulberry32(seed))
      : words.map((word) => problemOf(word, config));
  return { blocks: [{ kind: "problems", columns, items }], outOf };
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<WordsConfig["style"], string> = {
  copy: "Spelling practice",
  missing: "Missing letters",
  test: "Spelling test",
  abc: "ABC order",
  shapes: "Word shapes",
  sentence: "Words in sentences",
  find: "Find the word",
};

function instructionOf(config: WordsConfig): string {
  switch (config.style) {
    case "missing":
      return "Fill in the missing letters.";
    case "test":
      return "Write each word as it is read out.";
    case "abc":
      return "Write the words in ABC order on the lines.";
    case "shapes":
      return "Write each word in the boxes. Tall letters fill the top of the box, and letters with a tail hang below the line.";
    case "sentence":
      return "Use each word in a sentence of your own.";
    case "find":
      return "Circle the word that matches the one at the start of the line.";
    default:
      return `Write each word ${timesOf(config)} times.`;
  }
}

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page. `config.title` is an override
 * and is usually absent — a family names its own sheet.
 */
function headerOf(config: WordsConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? TITLE[config.style] ?? TITLE.copy,
    instructions: config.instructions ?? instructionOf(config),
  };
}

/** One line naming what the sheet holds, in the terms it was chosen by. */
export function describeWords(config: WordsConfig): string {
  const words = wordsOf(config);
  return [
    TITLE[config.style] ?? TITLE.copy,
    `${words.length} ${words.length === 1 ? "word" : "words"}`,
    config.style === "copy" ? `written ${timesOf(config)} times` : null,
    config.style === "missing" ? `${gapsOf(config)} out` : null,
    config.style === "sentence" ? "a sentence each" : null,
  ]
    .filter((part): part is string => part !== null)
    .join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildWordsSheet(config: WordsConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = bodyOf(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Out of what is on the page rather than what was asked for: a sheet
      // that says "/ 20" over eighteen words is wrong twice.
      score: { outOf },
    },
    blocks,
    // The jungle rather than the grid: a printed spelling list is the one sheet
    // whose matching game is the one that reads the words aloud (§16).
    footer: { credit: SHEET_CREDIT, url: gameUrl("jungle"), seed },
    answers: false,
  };
}

export const WORDS_SHEET: SheetSpec<WordsConfig> = {
  id: "words",
  label: "Spelling list",
  world: SHEET_WORLD,
  build: buildWordsSheet,
  // The whole of the answer-key mechanism: every answer was decided when the
  // sheet was built — which letters came out, and what goes back in — so a key
  // cannot disagree with the sheet it belongs to.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeWords,
};
