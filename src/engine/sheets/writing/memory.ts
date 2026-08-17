/**
 * Memory work: the same passage, with more of it missing each time.
 *
 * The exercise every family that learns verses by heart already does on a
 * whiteboard — write it out, rub a few words off, say it again, rub off a few
 * more — and the one sheet in the shop whose content is what is *not* printed.
 *
 * **The progression is the whole family.** Round one is the passage entire,
 * which is what a child reads; the last round has every word gone, which is
 * saying it from memory with somewhere to write it down; the rounds between
 * take out a share that grows evenly. Which words go is decided by the seed and
 * nothing else, and the sets nest — a word missing in round two is missing in
 * round three — because a word handed back would read as a misprint rather than
 * as a lesson.
 *
 * **It says that it is an exercise, and that is not decoration.** eBible.org
 * attaches one condition to the World English Bible: a modified text must not
 * carry the name (§12). A sheet that quietly dropped a third of a verse and
 * printed the translation's name underneath would be exactly that, so the
 * instruction line says the words are left out on purpose and the answer key
 * prints the passage whole. Both halves are the promise; neither is optional,
 * which is why the instruction is written here rather than left to a parent.
 *
 * **A verse, not a poem.** A round is one paragraph, so the passage's own line
 * breaks are set as spaces — fine for prose and for Scripture, and an edit to a
 * poem, whose lines are the poet's. A poem belongs on the copywork sheet, which
 * keeps them.
 *
 * Everything the other families promise holds unchanged: the page comes out of
 * `(config, seed)` and nothing else, and no round is put on the page that the
 * capacity arithmetic did not reserve room for.
 */
import { mulberry32, shuffled } from "@/engine/random";

import type {
  Blank,
  Block,
  MemoryConfig,
  Mil,
  Sheet,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { faceOf } from "../faces";
import { type Box } from "../layout";
import { inches, points } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { copyworkSource } from "./copywork";

/* ── What a round takes on the page ───────────────────────────────────────
   Declared, not measured (§4), and trailing sheet.css exactly as `chrome.ts`
   does: a round is a paragraph of body type with ruled gaps in it, and how
   many lines it wraps onto has to be answerable in plain Node.            */

/** One line of the paragraph: the body type, and a hair of air under it. */
const LINE_EMS = 1.35;

/** `.sheet__blanks` sets this between one round and the next. */
const ROUND_GAP: Mil = inches(0.16);

/** `.sheet__slot` is at least this wide, whatever word is written in it. */
const SLOT: Mil = inches(0.8);

/** `.sheet__number` and its margin — the "1." at the head of a round. */
const NUMBER: Mil = inches(0.3);

/**
 * How many times a passage may be written out.
 *
 * Six rounds of a memory verse is already a full page and the last two are
 * mostly blank; past that the sheet is asking for the same recitation more
 * times than anyone does it in one sitting.
 */
export const MAX_ROUNDS = 6;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/* ── Taking the words out ──────────────────────────────────────────────── */

/**
 * The passage as the words it is made of, line breaks set as spaces.
 *
 * Split on whitespace and nothing cleverer: punctuation stays attached to the
 * word it belongs to, so the answer key puts back "shepherd:" rather than
 * "shepherd" — which is what keeps the finished key the passage verbatim
 * rather than a paraphrase of it with the commas guessed at.
 */
export const memoryWords = (text: string): string[] =>
  text.split(/\s+/).filter((word) => word !== "");

/**
 * How many words are gone in each round, first to last.
 *
 * None in the first and all of them in the last, with the rounds between
 * spread evenly — so three rounds of a twelve-word verse lose nought, six and
 * twelve. Rounded rather than floored, because the middle of the progression
 * should sit in the middle rather than lag behind it.
 */
export function removalCounts(rounds: number, words: number): number[] {
  const times = clamp(rounds, 1, MAX_ROUNDS);
  if (times === 1) return [0];
  return Array.from({ length: times }, (_, round) =>
    Math.round((round * words) / (times - 1)),
  );
}

/**
 * One round: the passage with `gone` of its words replaced by a gap.
 *
 * The order words are taken in comes from the seed, and it is one order for the
 * whole sheet — every round takes the first `gone` of it — which is what makes
 * the rounds nest. `Blanks` reads a run of underscores as one gap, and the
 * words are joined with spaces, so two missing words in a row are two gaps
 * rather than one blank a child cannot tell the length of.
 */
export function roundOf(words: string[], order: number[], gone: number): Blank {
  const missing = new Set(order.slice(0, gone));
  return {
    text: words.map((word, at) => (missing.has(at) ? "_" : word)).join(" "),
    answers: words.filter((_, at) => missing.has(at)),
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

/**
 * How tall a round stands, once the paragraph has wrapped.
 *
 * A gap is wider than the word it replaces — `.sheet__slot` has a minimum, so
 * that a child has room to write in it — which means a round gets *taller* as
 * the exercise goes on. A family that sized every round like the first would
 * put the last one off the bottom of the page, and print is the whole of the
 * output path (§10).
 */
export function roundHeight(round: Blank, config: MemoryConfig, box: Box): Mil {
  const em = points(config.fontPt);
  const advance = em * faceOf(config.font).advance;
  const written = round.text.replaceAll("_", "").length;
  const width = NUMBER + written * advance + round.answers.length * SLOT;
  // Against the width less one slot, not the whole width. A browser wraps
  // greedily and cannot break a gap in half, so a line can end up to a slot
  // short of the margin — and the two errors are not symmetrical (`chrome.ts`):
  // reserving a line too many costs a line at the bottom of the page, and
  // reserving one too few costs a second sheet of paper.
  const usable = Math.max(1, box.width - SLOT);
  const lines = Math.max(1, Math.ceil(width / usable));
  return lines * points(config.fontPt * LINE_EMS);
}

export type MemoryLayout = {
  box: Box;
  /** The rounds that fit, in order, gaps and all. */
  rounds: Blank[];
};

/**
 * The rounds this sheet actually prints.
 *
 * A count asked for is a request capped at what the page holds, as everywhere
 * else in the shop — but a memory sheet cannot be capped by dropping the last
 * round off the bottom, because the last round is the one with everything
 * missing and the whole progression aims at it. A sheet that stopped two thirds
 * of the way along would ask a child to fill in six words and then stop, which
 * is a different exercise from the one the instruction line promised.
 *
 * So the *number of rounds* is what gets capped, and the progression is worked
 * out again for the number that fit: four rounds that don't fit become three
 * that do, spread nought, half, all. Trying the longest first and stepping down
 * is the only honest way round — the rounds are not the same height, since a
 * gap is wider than the word it replaces, so how tall a sheet is depends on how
 * many rounds it has.
 */
export function memoryLayout(config: MemoryConfig, seed: number): MemoryLayout {
  const box = sheetBlockBox(headerOf(config));
  const words = memoryWords(copyworkSource(config).text);
  if (words.length === 0) return { box, rounds: [] };

  // One order for the whole sheet, so round three takes the words round two
  // took and two more of them — and the same order however many rounds fit.
  const order = shuffled(
    words.map((_, at) => at),
    mulberry32(seed),
  );

  for (let times = clamp(config.rounds, 1, MAX_ROUNDS); times >= 1; times--) {
    const rounds = removalCounts(times, words.length).map((gone) =>
      roundOf(words, order, gone),
    );
    const height = rounds.reduce(
      (total, round) => total + roundHeight(round, config, box),
      ROUND_GAP * (rounds.length - 1),
    );
    if (height <= box.height) return { box, rounds };
  }
  // Not even the passage on its own fits, which takes an over-long paste in
  // the largest type. A header over nothing is the honest page for it, and the
  // same answer `UNKNOWN_SHEET` gives: print, and print nothing that isn't so.
  return { box, rounds: [] };
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE = "Memory work";

/**
 * What the child is being asked to do — and the notice §12 requires, in the
 * one place on the sheet nobody skips.
 *
 * A sheet with a single round has nothing missing from it and says nothing
 * about anything being left out, which is the honest version of the same
 * sentence: it is the passage, printed.
 */
export function instructionOf(rounds: number): string {
  if (rounds <= 1) return "Read it, and say it from memory.";
  return "Read it, then fill in the missing words from memory — more of them go each time. Words are left out for the exercise; the whole passage is on the answer key.";
}

/**
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page — a header the layout
 * under-reserved for is a round below the bottom margin.
 *
 * The instruction is worked out against the rounds the config *asked* for
 * rather than the rounds that fit, which is the only way round that terminates:
 * how many fit is decided against this header, so reading it back would be a
 * circle. The two only differ on a sheet asking for more rounds than the paper
 * holds, and the sentence is the same length either way.
 */
function headerOf(config: MemoryConfig): SheetOptions {
  const source = copyworkSource(config);
  const named = source.title ? `${TITLE} — ${source.title}` : TITLE;
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? named,
    instructions:
      config.instructions ?? instructionOf(clamp(config.rounds, 1, MAX_ROUNDS)),
  };
}

/** One line naming what the sheet holds, for the catalog and the record. */
export function describeMemory(config: MemoryConfig): string {
  const source = copyworkSource(config);
  const words = memoryWords(source.text).length;
  const rounds = clamp(config.rounds, 1, MAX_ROUNDS);
  return [
    TITLE,
    source.title ?? `${words} ${words === 1 ? "word" : "words"}`,
    `${rounds} ${rounds === 1 ? "time" : "times"} over`,
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildMemorySheet(config: MemoryConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { credit } = copyworkSource(config);
  const { rounds } = memoryLayout(config, seed);
  const blocks: Block[] = rounds.length
    ? [{ kind: "blanks", sentences: rounds }]
    : [];

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // No score box. A verse said from memory is marked by the person
      // listening, and a number out of the rounds would be marking the paper.
    },
    blocks,
    footer: {
      credit: SHEET_CREDIT,
      url: SHEET_URL,
      seed,
      ...(credit ? { source: credit } : {}),
    },
    answers: false,
  };
}

export const MEMORY_SHEET: SheetSpec<MemoryConfig> = {
  id: "memory",
  label: "Memory verse",
  world: SHEET_WORLD,
  build: buildMemorySheet,
  // The answer key is the passage whole — every gap filled from the words that
  // were taken out when the sheet was built, so the key cannot disagree with
  // the sheet and cannot disagree with the source either. That is the second
  // half of what §12 asks a progressive-blank sheet to do.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeMemory,
};
