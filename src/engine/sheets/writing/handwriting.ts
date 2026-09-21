/**
 * Handwriting: trace it, copy it, then write it alone.
 *
 * The family where the ruling is the exercise rather than the paper, so
 * everything here is geometry: a row is one repeat of the ruling, and the model
 * that sits on it is sized off the face's own measured proportions rather than
 * off the body type (§6).
 *
 * **One progression, two directions.** A row is `["solid", "dotted", "none"]` —
 * a model to trace, a trace, and the place where the child is on their own.
 * Something short enough to write several times on one line runs *across* the
 * row; a line of a passage fills the row on its own, so the same sequence runs
 * *down* the page instead. Nothing else differs between the five styles.
 *
 * Copywork is the passage style, and its words come from the library or from a
 * paste — `copyworkSource` is the only place either is read (§12). Cursive is
 * not a sixth style either: it is these same sheets set in a joining face, and
 * what joined writing adds is `joins`, the one style that is only a cursive
 * exercise and the one that resolves its own face.
 */
import {
  cursiveOf,
  faceOf,
  fittedCharacters,
  glyphEm,
  isCursive,
  type Face,
} from "../faces";

import type {
  Block,
  HandwritingConfig,
  HandwritingStyle,
  Mil,
  Rule,
  Sheet,
  SheetFont,
  SheetOptions,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { ruleCapacity, type Box } from "../layout";
import { own, rulingOf, steppedSize, writingSpace } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { copyworkSource, type CopyworkSource } from "./copywork";
import { joinFamily, joinPairs } from "./joins";
import {
  ALPHABETS,
  MODELLED,
  NUMERALS,
  groupsAcross,
  rowsAcross,
  rowsDown,
  ruleOf,
  tracePages,
  traceStyles,
  wrapPassage,
  writtenWords,
} from "./rows";

/* ── What is written ───────────────────────────────────────────────────── */

/** The word list, made safe to print from whatever a saved config says. */
export const handwritingWords = (config: HandwritingConfig): string[] =>
  writtenWords(config.words);

/* ── The page ──────────────────────────────────────────────────────────── */

export type HandwritingLayout = {
  rule: Rule;
  box: Box;
  face: Face;
  /** The type size the ruling asks for, in mil. */
  em: Mil;
  /** How many repeats of the ruling the page holds. */
  rows: number;
  /** How many things go on one row — one, for a passage. */
  perRow: number;
  /** How many things the page holds altogether. */
  perPage: number;
};

/**
 * How much of the sheet fits, and how it is packed.
 *
 * Arithmetic rather than measurement, so the answer is the same in a unit test,
 * in the build of a catalog page and in the builder's live preview (§4).
 *
 * `longest` is the longest thing that will be written, in characters, and how
 * many groups of it a row holds is `groupsAcross`'s arithmetic.
 *
 * The em is worked out against everything the sheet writes rather than against
 * one row, which is the conservative direction: a page of capitals is set
 * larger than a page of `Aa` on the same ruling, so measuring the packing off
 * the whole page can only reserve more room per group than any one row needs.
 */
export function handwritingLayout(
  config: HandwritingConfig,
  longest: number,
): HandwritingLayout {
  const rule = ruleOf(config);
  // Against the header and the footer the sheet will print rather than the ones
  // the config holds, and with no score box: there is nothing on a handwriting
  // sheet to mark out of anything. No `note` either — this family's key is the
  // sheet itself, so nothing is added to the foot after the layout.
  const credit = sourceOf(config)?.credit;
  const box = sheetBlockBox(
    headerOf(config),
    false,
    credit ? { source: credit } : {},
  );
  const face = faceOf(fontOf(config));
  const em = glyphEm(writingSpace(rule), face, writtenOf(config));
  const rows = ruleCapacity(box.height, rule);
  const times = traceStyles(config).length;

  if (config.style === "passage") {
    // A line fills the row, so the repeats go down the page: one line takes as
    // many rows as it is written times.
    return {
      rule,
      box,
      face,
      em,
      rows,
      perRow: 1,
      perPage: Math.floor(rows / Math.max(1, times)),
    };
  }

  const perRow = groupsAcross(
    box.width,
    em,
    face,
    writtenOf(config),
    longest,
    times,
  );
  return { rule, box, face, em, rows, perRow, perPage: perRow * rows };
}

/** Everything the sheet writes, before the page has had its say. */
function contentOf(config: HandwritingConfig): string[] {
  switch (config.style) {
    case "numbers":
      return [...NUMERALS];
    case "joins":
      return joinPairs(config.joins);
    case "words":
      return handwritingWords(config);
    case "passage":
      return [];
    default:
      return own(ALPHABETS, config.letters ?? "both", ALPHABETS.both);
  }
}

/**
 * The face the sheet is actually set in, which is the config's own unless the
 * config asked for something that cannot be drawn.
 *
 * The one case is a joins sheet: a print face has no joining stroke, so it
 * would print `in` as an `i` and an `n` with a gap, under an instruction
 * telling a child to join them (§6). Read by the layout *and* returned on the
 * sheet, so the em the page reserved room for and the face the renderer sets
 * cannot disagree.
 */
export const fontOf = (config: HandwritingConfig): SheetFont | undefined =>
  config.style === "joins" ? cursiveOf(config.font) : config.font;

/**
 * Every character the sheet will print, as one string. Read by `glyphHeight`
 * and by `glyphAdvance`, which want to know whether there is a lower-case
 * letter, a capital or a numeral anywhere on the page — so the order it is
 * joined in and the spaces between are beside the point.
 */
const writtenOf = (config: HandwritingConfig): string =>
  config.style === "passage"
    ? copyworkSource(config).text
    : contentOf(config).join("");

/** The longest thing on the page, in characters. Never less than one. */
const longestOf = (things: string[]): number =>
  things.reduce((most, thing) => Math.max(most, thing.length), 1);

function bodyOf(config: HandwritingConfig): Block[] {
  const styles = traceStyles(config);

  if (config.style === "passage") {
    const { box, em, face, perPage, rule } = handwritingLayout(config, 1);
    const { text } = copyworkSource(config);
    const lines = wrapPassage(text, fittedCharacters(box.width, em, face));
    return tracePages(
      rule,
      rowsDown(lines, styles),
      perPage * styles.length,
      config.guides,
    );
  }

  const things = contentOf(config);
  const { rows, perRow, rule } = handwritingLayout(config, longestOf(things));
  return tracePages(
    rule,
    rowsAcross(things, styles, perRow),
    rows,
    config.guides,
  );
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<HandwritingStyle, string> = {
  letters: "Letter practice",
  numbers: "Number formation",
  joins: "Joining letters",
  words: "Handwriting practice",
  passage: "Copywork",
};

/**
 * What the same sheet is called when the letters join.
 *
 * Only the three that change: a numeral is a numeral in any hand, and a joins
 * sheet is never anything but cursive. Titles rather than a "(cursive)" suffix,
 * because the title is what somebody reads off the paper on the fridge a week
 * later.
 */
const CURSIVE_TITLE: Record<string, string> = {
  letters: "Cursive letters",
  words: "Cursive practice",
  passage: "Cursive copywork",
};

/** What one thing on the page is called, in the instruction line. */
const NOUN: Record<HandwritingStyle, string> = {
  letters: "letter",
  numbers: "number",
  joins: "join",
  words: "word",
  passage: "line",
};

/**
 * What the child is being asked to do, read off the row rather than off the
 * config — so a sheet with nothing dotted on it never says "trace", and a sheet
 * with no empty place never promises one.
 *
 * "Copy" needs a model as well as an empty place, which is the one that is easy
 * to get wrong: `trace: "none"` with the progression off draws nothing at all,
 * and a page of blank ruled lines headed "Copy each letter on your own" is
 * asking a child to copy something that is not there.
 */
export function instructionOf(config: HandwritingConfig): string {
  const noun = own(NOUN, config.style, NOUN.letters);
  const styles = traceStyles(config);
  const traced = styles.some((style) => MODELLED.has(style));
  const model = traced || styles.includes("solid");
  const alone = styles.includes("none");
  const where =
    config.style === "passage" ? "on the line below" : "on your own";

  if (traced && alone) return `Trace each ${noun}, then write it ${where}.`;
  if (traced) return `Trace each ${noun}.`;
  if (model && alone) return `Copy each ${noun} ${where}.`;
  return `Write each ${noun}.`;
}

/**
 * The words a copywork sheet is set on, and nothing for the sheets set on an
 * alphabet. One function, so the four places that ask — the layout, the header,
 * the page and the one-line description — cannot disagree about which passage
 * is on the paper.
 */
const sourceOf = (config: HandwritingConfig): CopyworkSource | undefined =>
  config.style === "passage" ? copyworkSource(config) : undefined;

/**
 * What the sheet is called, which depends on the hand it is written in and on
 * what is being copied.
 *
 * Read off the face the sheet will actually be set in rather than off the one
 * the config asked for, so a joins sheet whose config says `print` still prints
 * joined and still says so. A passage out of the library names itself in the
 * title; a pasted one keeps the plain title, because the only name we would
 * have for it is one we invented.
 */
function titleOf(config: HandwritingConfig): string {
  const plain = own(TITLE, config.style, TITLE.letters);
  const title = isCursive(fontOf(config))
    ? own(CURSIVE_TITLE, config.style, plain)
    : plain;
  const named = sourceOf(config)?.title;
  return named ? `${title} — ${named}` : title;
}

/** How the content is described in one phrase, in the terms it was chosen by. */
function contentLabel(config: HandwritingConfig): string {
  switch (config.style) {
    case "numbers":
      return "0 to 9";
    case "joins":
      return config.joins === undefined
        ? "the common joins"
        : joinFamily(config.joins).label.toLowerCase();
    case "words": {
      const words = handwritingWords(config).length;
      return `${words} ${words === 1 ? "word" : "words"}`;
    }
    case "passage":
      // The title already names a passage out of the library, so what is left
      // worth saying is who wrote it — and, for a paste, that nobody knows.
      return sourceOf(config)?.attribution ?? "a passage";
    default:
      switch (config.letters ?? "both") {
        case "upper":
          return "capitals";
        case "lower":
          return "small letters";
        default:
          return "capitals and small letters";
      }
  }
}

/**
 * The header this sheet will actually print — written once and read by both the
 * layout and the build, because a header the layout under-reserved for is a row
 * of writing below the bottom margin.
 */
function headerOf(config: HandwritingConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions: config.instructions ?? instructionOf(config),
  };
}

/** One line naming what the sheet holds, for the catalog and the record. */
function describeHandwriting(config: HandwritingConfig): string {
  const styles = traceStyles(config);
  const rule = ruleOf(config);
  const stepped = steppedSize(rule);
  return [
    titleOf(config),
    contentLabel(config),
    rulingOf(rule).label.toLowerCase(),
    ...(stepped ? [`${stepped} letters`] : []),
    `written ${styles.length} ${styles.length === 1 ? "time" : "times"}`,
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

function buildHandwritingSheet(config: HandwritingConfig, seed: number): Sheet {
  const head = headerOf(config);
  const credit = sourceOf(config)?.credit;

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    // The one presentation field a family sets for itself: `present()` in
    // index.ts leaves a family's own answer alone, so a joins sheet keeps the
    // joining face it has to be drawn in and every other sheet gets the
    // parent's choice untouched.
    font: fontOf(config),
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
    },
    blocks: bodyOf(config),
    // No game to point at: the words on a handwriting sheet may come from the
    // jungle, but what is being practiced is the shape of the letters and not
    // the spelling (§16).
    //
    // `source` is where the words came from, printed on every page that carries
    // a passage the library asks credit for — which for Scripture is a
    // condition rather than a courtesy (§12).
    footer: {
      credit: SHEET_CREDIT,
      url: SHEET_URL,
      seed,
      ...(credit ? { source: credit } : {}),
    },
    answers: false,
  };
}

export const HANDWRITING_SHEET: SheetSpec<HandwritingConfig> = {
  world: SHEET_WORLD,
  build: buildHandwritingSheet,
  // Returned as-is rather than with `answers: true`, for the same reason blank
  // paper is: there is nothing on a handwriting sheet that has a right answer,
  // and a key indistinguishable from its sheet should also be identical to it.
  key: (sheet) => sheet,
  describe: describeHandwriting,
};
