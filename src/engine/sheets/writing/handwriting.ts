/**
 * Handwriting: trace it, copy it, then write it alone.
 *
 * The first family where the ruling is the exercise rather than the paper. A
 * maths sheet printed a thousandth of an inch out is a maths sheet; a ⅝ rule
 * that is not ⅝ of an inch is teaching a child the wrong size of letter, and
 * they were taught to write between two lines by somebody who will notice. So
 * everything here is geometry: the rows are one repeat of the ruling apart
 * because that is what the ruling says, and the model that sits on them is
 * sized off the face's own measured proportions (`faces.ts`) rather than off
 * the body type — off whichever of them the tallest thing on the sheet is
 * drawn to, so a page of capitals reaches the top line as surely as a page of
 * `Aa` does.
 *
 * **One progression, two directions.** A row is `["solid", "dotted", "none"]` —
 * a model to trace, a trace, and the place where the child is on their own —
 * and that sequence is the whole of what a handwriting sheet does. Something
 * short enough to write several times on one line runs *across* the row, and as
 * many of them fit as the paper is wide enough for, which is what puts a whole
 * alphabet on one page. A line of a passage fills the row on its own, so the
 * same sequence runs *down* the page instead. Nothing else differs between the
 * five styles.
 *
 * **Cursive is not a sixth style.** A cursive sheet is these same sheets set in
 * a joining face (`SheetOptions.font`), because a letter, a word and a passage
 * are the same exercises whether or not the letters touch — and a cell is one
 * `<text>` element, so the face's own `calt` table sees the pair either side of
 * every join and draws the form that belongs there. What joined writing does
 * add is a set to practise that print has no use for, and that is `joins`: the
 * one style that is only a cursive exercise, and the one that resolves its own
 * face rather than printing two letters standing apart under the word "join".
 *
 * Everything the other families promise holds unchanged: the page comes out of
 * `(config, seed)` and nothing else, and no row is put on the page that the
 * capacity arithmetic did not reserve room for.
 *
 * There are no answers. A key is the same page — see the note on `key` below,
 * which is the same one blank paper makes.
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
  LetterCase,
  Mil,
  Rule,
  Sheet,
  SheetFont,
  SheetOptions,
  TraceCell,
  TraceRow,
  TraceStyle,
} from "../types";

import { sheetBlockBox } from "../chrome";
import { ruleCapacity, type Box } from "../layout";
import { own, rulePitch, rulingOf, writingSpace } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { joinFamily, joinPairs } from "./joins";

/* ── What the family will and won't do ─────────────────────────────────── */

/**
 * The most times one thing is written.
 *
 * Eight is already a row of eight letters and a page of nothing else; past that
 * the cells are narrower than the letters in them and the sheet stops being
 * legible before it stops being generatable.
 */
export const MAX_REPEATS = 8;

/** As many words as a parent may type into a deck — see `services/decks.ts`. */
const MAX_WORDS = 200;

/** Long enough for "onomatopoeia" twice over; short enough not to wrap. */
const MAX_LETTERS = 24;

/**
 * The longest passage worth setting.
 *
 * The smallest ruling here holds about twenty-two lines to a page and about
 * forty-six characters to a line, so a thousand characters is already more than
 * any sheet can print — this is twice that, and still short enough that a config
 * fits in a URL (§14), which is not the place for an essay.
 */
const MAX_TEXT = 2000;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * ⅝ with a dashed midline and room for a tail: the commonest primary size, and
 * what the shop's own handwriting paper defaults to.
 */
export const DEFAULT_HAND_RULE: Rule = {
  style: "hand-5-8",
  midline: "dashed",
  descender: true,
};

/**
 * The paper the sheet is written on.
 *
 * Every ruling in §5 is legal here, notebook rules and squares included — a
 * child asked to write a sentence on college-ruled paper is being set a real
 * exercise. Blank paper is the only one that cannot work: a handwriting sheet
 * is rows of a repeating ruling, and a ruling with no pitch has no rows, so a
 * sheet on it would be a page with a title and nothing under it. It resolves to
 * the ⅝ rule instead, which is the same promise `rulingOf` makes — answer with
 * something that prints rather than with nothing.
 */
export function ruleOf(config: HandwritingConfig): Rule {
  const rule = config.rule ?? DEFAULT_HAND_RULE;
  return rulePitch(rule) > 0 ? rule : DEFAULT_HAND_RULE;
}

/* ── What is written ───────────────────────────────────────────────────── */

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWER = "abcdefghijklmnopqrstuvwxyz";
const NUMERALS = "0123456789";

/**
 * The alphabets, in the order they are taught.
 *
 * `both` is the pair written as one thing — `Aa`, then `Bb` — rather than the
 * capitals and then the small letters. That is how a letter is introduced, and
 * it is also the only shape in which twenty-six of them fit on one page: fifty-
 * two rows of one letter each is four sheets of ⅝ paper.
 */
const ALPHABETS: Record<LetterCase, string[]> = {
  upper: [...UPPER],
  lower: [...LOWER],
  both: [...UPPER].map((letter, at) => `${letter}${LOWER[at]}`),
};

/**
 * The word list, made safe to print from whatever a saved config says.
 *
 * Trimmed, capped and de-duplicated, the way `wordsOf` holds a spelling list —
 * but **case-sensitively**, which is the one difference and the reason this is
 * not that function. A spelling marker sees "Because" and "because" as one
 * word; a handwriting sheet is about the shape of the letters, and a capital B
 * is a different shape from a small one.
 */
export function handwritingWords(config: HandwritingConfig): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of config.words ?? []) {
    if (typeof raw !== "string") continue;
    const word = raw.trim().replace(/\s+/g, " ").slice(0, MAX_LETTERS);
    if (word === "" || seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length === MAX_WORDS) break;
  }
  return out;
}

/**
 * A passage broken into lines that fit the ruling.
 *
 * The family's job rather than the renderer's, because there is nothing to
 * measure in (§4): a row is one repeat of the ruling and holds one line of a
 * passage — `TracedRow` draws what it is handed and never rewraps it — so
 * where a verse breaks has to be decided here or not at all. A
 * newline in the source is a break the author asked for and is kept; everything
 * else breaks at the last space before the paper runs out. A word longer than a
 * whole line gets one of its own, and `fittedEm` sets it small enough to reach
 * the margin — the only place on a handwriting sheet where the type is not the
 * ruling's size, and better than a word running off the page.
 */
export function wrapPassage(text: string, characters: number): string[] {
  const width = Math.max(1, characters);
  return text.split("\n").flatMap((source) => {
    const words = source.split(/\s+/).filter((word) => word !== "");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line === "" ? word : `${line} ${word}`;
      if (next.length > width && line !== "") {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line !== "") lines.push(line);
    return lines;
  });
}

/* ── The progression ───────────────────────────────────────────────────── */

/**
 * The four styles that are a model to follow rather than the child's own.
 *
 * Exported because two suites check a sheet against it and a third list would
 * be a third chance to disagree. Named for what it means here rather than for
 * how it is drawn: `Traced.tsx` has its own `STROKED`, which is a *different*
 * set — `dim` is a model but it is a filled shape, not an outline.
 */
export const MODELLED = new Set<TraceStyle>([
  "dim",
  "hollow",
  "dotted",
  "dashed",
]);

/**
 * How each repeat of one thing is drawn: trace → copy → write.
 *
 * The first is a solid model, the last is left empty, and everything between is
 * the style the sheet was set in. Turning the progression off draws every
 * repeat the same way, which is the sheet for a child who is still tracing —
 * and asking for one repeat gives the model on its own, because a progression
 * needs somewhere to progress to.
 */
export function traceStyles(config: HandwritingConfig): TraceStyle[] {
  const times = clamp(config.repeats ?? 3, 1, MAX_REPEATS);
  const trace = config.trace ?? "dotted";
  if (config.progression === false) {
    return Array.from({ length: times }, () => trace);
  }
  if (times === 1) return ["solid"];
  return ["solid", ...Array.from({ length: times - 2 }, () => trace), "none"];
}

/**
 * One cell. An empty place carries no text, so a row of nothing but empty
 * places announces itself as a line to write on rather than as the word the
 * child is supposed to have thought of.
 */
const cellOf = (text: string, style: TraceStyle): TraceCell => ({
  text: style === "none" ? "" : text,
  style,
});

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
 * `longest` is the longest thing that will be written, in characters, and it is
 * what decides how many fit beside each other: a group takes its own width plus
 * one character of air, so three letters written four times each is a row of
 * twelve cells and two words written three times each is a row of six. The
 * mean advance it is counted in is the face's own (`faces.ts`), because
 * OpenDyslexic is half as wide again as Andika and one shared guess would push
 * a word off the end of the line in one of them.
 *
 * The em is worked out against everything the sheet writes rather than against
 * one row, and that is the conservative direction: a page of capitals is set
 * larger than a page of `Aa` on the same ruling (`glyphHeight`), so measuring
 * the packing off the whole page can only reserve more room per group than any
 * one row goes on to need.
 */
export function handwritingLayout(
  config: HandwritingConfig,
  longest: number,
): HandwritingLayout {
  const rule = ruleOf(config);
  // Against the header the sheet will print rather than the one the config
  // holds, and with no score box: there is nothing on a handwriting sheet to
  // mark out of anything.
  const box = sheetBlockBox(headerOf(config));
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

  const across = fittedCharacters(box.width, em, face);
  const perRow = Math.max(1, Math.floor(across / (times * (longest + 1))));
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
 * The one case is a joins sheet: a join is a stroke between two letters, and a
 * print face has no such stroke — it would print `in` as an `i` and an `n` with
 * a gap, under an instruction telling a child to join them. So joined content
 * resolves to a joining face, keeping whichever cursive model was chosen
 * (`cursiveOf`). Read by the layout *and* returned on the sheet, so the em the
 * page reserved room for and the face the renderer sets cannot disagree.
 */
export const fontOf = (config: HandwritingConfig): SheetFont | undefined =>
  config.style === "joins" ? cursiveOf(config.font) : config.font;

/**
 * Every character the sheet will print, as one string.
 *
 * Only ever read by `glyphHeight`, which wants to know whether there is a
 * lower-case letter, a capital or a numeral anywhere on the page — so the
 * order it is joined in and the spaces between are beside the point.
 */
const writtenOf = (config: HandwritingConfig): string =>
  config.style === "passage" ? (config.text ?? "") : contentOf(config).join("");

/** The longest thing on the page, in characters. Never less than one. */
const longestOf = (things: string[]): number =>
  things.reduce((most, thing) => Math.max(most, thing.length), 1);

/**
 * The rows of a sheet whose things are written across the line.
 *
 * Every row carries the same number of cells, the last one included: a short
 * final row left to divide the width between four cells instead of twelve
 * would set its letters three times as far apart as the row above it, which
 * looks like a mistake and is one.
 */
function rowsAcross(
  things: string[],
  styles: TraceStyle[],
  perRow: number,
): TraceRow[] {
  const cells = perRow * styles.length;
  const rows: TraceRow[] = [];
  for (let at = 0; at < things.length; at += perRow) {
    const group = things
      .slice(at, at + perRow)
      .flatMap((text) => styles.map((style) => cellOf(text, style)));
    rows.push({
      cells: [
        ...group,
        ...Array.from({ length: cells - group.length }, () =>
          cellOf("", "none"),
        ),
      ],
    });
  }
  return rows;
}

/** The rows of a passage: each line written down the page, once per style. */
const rowsDown = (lines: string[], styles: TraceStyle[]): TraceRow[] =>
  lines.flatMap((line) =>
    styles.map((style) => ({ cells: [cellOf(line, style)] })),
  );

/**
 * The one block a handwriting sheet is.
 *
 * One block and not two, so there is no `BLOCK_GAP` to pay for and no way for
 * the rules under a passage to drift out of step with the rules it is written
 * on — the blank places are rows of the same block, drawn by the same renderer
 * off the same ruling.
 */
function bodyOf(config: HandwritingConfig): Block[] {
  const styles = traceStyles(config);

  if (config.style === "passage") {
    const { box, em, face, perPage, rule } = handwritingLayout(config, 1);
    const text = (config.text ?? "").slice(0, MAX_TEXT);
    const lines = wrapPassage(text, fittedCharacters(box.width, em, face));
    return [
      { kind: "trace", rule, rows: rowsDown(lines.slice(0, perPage), styles) },
    ];
  }

  const things = contentOf(config);
  const { perPage, perRow, rule } = handwritingLayout(
    config,
    longestOf(things),
  );
  return [
    {
      kind: "trace",
      rule,
      rows: rowsAcross(things.slice(0, perPage), styles, perRow),
    },
  ];
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
 * sheet is never anything but cursive. Titles rather than a "(cursive)" suffix
 * because the title is what somebody reads off the paper on the fridge a week
 * later, and "Letter practice" on a page of joined letters is a sheet that
 * doesn't say what it taught.
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
 * config.
 *
 * The four sentences follow from what `traceStyles` actually produced, so a
 * sheet with nothing dotted on it never says "trace", and a sheet with no empty
 * place never promises one. The same rule the integers sheet follows when it
 * decides whether to mention powers.
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
 * What the sheet is called, which depends on the hand it is written in.
 *
 * Read off the face the sheet will actually be set in rather than off the one
 * the config asked for, so the title and the letterforms can't disagree — a
 * joins sheet whose config says `print` still prints joined, and still says so.
 */
function titleOf(config: HandwritingConfig): string {
  const title = own(TITLE, config.style, TITLE.letters);
  return isCursive(fontOf(config))
    ? own(CURSIVE_TITLE, config.style, title)
    : title;
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
      return "a passage";
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
 * The header this sheet will actually print.
 *
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page — a header the layout under-
 * reserved for is a row of writing below the bottom margin, which on ⅝ paper
 * is a second sheet out of the printer.
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
export function describeHandwriting(config: HandwritingConfig): string {
  const styles = traceStyles(config);
  return [
    titleOf(config),
    contentLabel(config),
    rulingOf(ruleOf(config)).label.toLowerCase(),
    `written ${styles.length} ${styles.length === 1 ? "time" : "times"}`,
  ].join(" — ");
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

export function buildHandwritingSheet(
  config: HandwritingConfig,
  seed: number,
): Sheet {
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    // The one presentation field a family sets for itself, and the only one it
    // has a reason to: `present()` in index.ts leaves a family's own answer
    // alone, so a joins sheet keeps the joining face it has to be drawn in and
    // every other sheet gets the parent's choice untouched.
    font: fontOf(config),
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
    },
    blocks: bodyOf(config),
    // No game to point at. A handwriting sheet has no race behind it — the
    // words on one may come from the jungle, but what is being practised is the
    // shape of the letters and not the spelling (§16).
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const HANDWRITING_SHEET: SheetSpec<HandwritingConfig> = {
  id: "handwriting",
  label: "Handwriting practice",
  world: SHEET_WORLD,
  build: buildHandwritingSheet,
  // Returned as-is rather than with `answers: true`, for the same reason blank
  // paper is: there is nothing on a handwriting sheet that has a right answer,
  // and a key indistinguishable from its sheet should also be identical to it.
  key: (sheet) => sheet,
  describe: describeHandwriting,
};
