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
 * Three styles, and each one is an exercise somebody actually sets: write it
 * three times, fill in the letters that are missing, or write it down as it is
 * read out. The wider spelling set — ABC order, word shapes, use it in a
 * sentence — is PRINT20's, and lands here as more of `WordSheetStyle` rather
 * than as a second family.
 *
 * Everything the other families promise holds unchanged: the page comes out of
 * `(config, seed)` and nothing else, the answers are computed when the sheet is
 * built and the key only decides to print them, and no row is put on the page
 * that the capacity arithmetic did not reserve room for.
 */
import { normaliseWord } from "@/engine/decks/words";
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Blank,
  Block,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  WordsConfig,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_WORLD, gameUrl, type SheetSpec } from "../spec";

/* ── What a word takes on the page ────────────────────────────────────────
   Declared, not measured (§4). A word on a line is one line of the body type;
   a word to be written out is that line plus the rules it is written on, which
   wrap onto their own line inside the cell and pay the wrap gap for it.      */

const ROW_EMS = 1.7;

/** `.sheet__blanks` in sheet.css sets this between one sentence and the next. */
const BLANK_GAP: Mil = inches(0.16);

/** A gapped word is a line of body type, and a hair of air under it. */
const BLANK_EMS = 1.35;

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
 */
export function wordsOf(config: WordsConfig): string[] {
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

/** How tall one word stands, the lines it is written on included. */
function rowHeight(config: WordsConfig): Mil {
  if (config.style === "missing") return points(config.fontPt * BLANK_EMS);
  const body = points(config.fontPt * ROW_EMS);
  if (config.style === "test") return body;
  // The rules a word is copied onto wrap under it, inside the same cell, so
  // the gap the browser puts between the two lines is reserved for here — see
  // `WRAP_GAP`, which is that gap in the unit the arithmetic works in.
  return body + WRAP_GAP + timesOf(config) * answerLine(config.fontPt);
}

/**
 * How many words the paper holds, and how wide a column of them is.
 *
 * Arithmetic rather than measurement, so the answer is the same in a unit test,
 * in the build of a catalog page and in the builder's live preview (§4).
 *
 * A gapped word is always one column: the `blanks` block is a list of
 * sentences down the page, and a family that asked it for two would be
 * declaring a layout the renderer does not have.
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
  const columns =
    config.style === "missing" ? 1 : clamp(config.columns, 1, MAX_COLUMNS);
  const row = rowHeight(config);
  const gap = config.style === "missing" ? BLANK_GAP : PROBLEM_GAP.y;
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
 * ranked worst-first, so neither is shuffled. The count is a request rather
 * than a promise, the same as everywhere else: what does not fit is not
 * printed, because print is the whole of the output path (§10).
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
  return {
    prompt: word,
    answer: word,
    // One rule per writing, and `workspace` is the height they share rather
    // than blank paper under them — see `Problem.answers`.
    answers: Array.from({ length: times }, () => word),
    workspace: times * answerLine(config.fontPt),
  };
}

function bodyOf(
  config: WordsConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const words = sheetWords(config);
  if (config.style === "missing") {
    const rand = mulberry32(seed);
    const sentences = words.map((word) => gapped(word, config.gaps, rand));
    return { blocks: [{ kind: "blanks", sentences }], outOf: sentences.length };
  }

  const { columns } = wordsLayout(config);
  return {
    blocks: [
      {
        kind: "problems",
        columns,
        items: words.map((w) => problemOf(w, config)),
      },
    ],
    outOf: words.length,
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<WordsConfig["style"], string> = {
  copy: "Spelling practice",
  missing: "Missing letters",
  test: "Spelling test",
};

function instructionOf(config: WordsConfig): string {
  switch (config.style) {
    case "missing":
      return "Fill in the missing letters.";
    case "test":
      return "Write each word as it is read out.";
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
