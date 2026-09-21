/**
 * What a row on a ruling is made of, for the two families that write on one:
 * handwriting, where the ruling teaches a letter, and penmanship, where it
 * works on a page of them (§24).
 *
 * Its own module rather than a corner of handwriting.ts because that file
 * reaches the passage library through copywork, and a family that imported it
 * to draw a row of loops would fetch Psalm 23 to do so — every family is its
 * own chunk (`families.ts`).
 */
import { fittedCharacters, type Face } from "../faces";
import { paged } from "../layout";
import { rulePitch } from "../paper";
import type {
  Block,
  LetterCase,
  Mil,
  ModelGuides,
  Rule,
  TraceCell,
  TraceRow,
  TraceStyle,
} from "../types";

export const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/**
 * Eight is already a row of eight letters and a page of nothing else; past that
 * the cells are narrower than the letters in them.
 */
export const MAX_REPEATS = 8;

/** ⅝ dashed, with room for a tail: the commonest primary size (§5). */
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
 * exercise. Blank is the one that cannot work: a sheet of rows is rows of a
 * repeating ruling, and blank has no pitch, so it resolves to the ⅝ rule
 * rather than printing a title over an empty page.
 */
export function ruleOf(config: { rule?: Rule }): Rule {
  const rule = config.rule ?? DEFAULT_HAND_RULE;
  return rulePitch(rule) > 0 ? rule : DEFAULT_HAND_RULE;
}

export const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const LOWER = "abcdefghijklmnopqrstuvwxyz";
export const NUMERALS = "0123456789";

/**
 * The alphabets, in the order they are taught.
 *
 * `both` is the pair written as one thing — `Aa`, then `Bb` — because that is
 * how a letter is introduced, and because it is the only shape in which
 * twenty-six of them fit on one page: fifty-two rows of one letter each is four
 * sheets of ⅝ paper.
 */
export const ALPHABETS: Record<LetterCase, string[]> = {
  upper: [...UPPER],
  lower: [...LOWER],
  both: [...UPPER].map((letter, at) => `${letter}${LOWER[at]}`),
};

/** As many words as a parent may type into a deck — see `services/decks.ts`. */
const MAX_WORDS = 200;

/** Long enough for "onomatopoeia" twice over; short enough not to wrap. */
const MAX_LETTERS = 24;

/**
 * A word list, made safe to print from whatever a saved config says.
 *
 * Trimmed, capped and de-duplicated the way `wordsOf` holds a spelling list,
 * but **case-sensitively**, which is the whole reason this is not that
 * function: a sheet of writing is about the shape of the letters, and a
 * capital B is a different shape from a small one.
 */
export function writtenWords(words: unknown[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of words ?? []) {
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
 * measure in (§4): `TracedRow` draws the line it is handed and never rewraps
 * it, so where a verse breaks has to be decided here or not at all. A newline
 * in the source is a break the author asked for and is kept. A word longer than
 * a whole line gets one of its own, and `fittedEm` sets it small enough to
 * reach the margin — the only place on a handwriting sheet where the type is
 * not the ruling's size, and better than a word running off the page.
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

/** The three fields that decide how each repeat of a thing is drawn. */
export type Progression = {
  repeats?: number;
  trace?: TraceStyle;
  progression?: boolean;
};

/**
 * The four styles that are a model to follow rather than the child's own.
 *
 * Exported because several suites check a sheet against it. Named for what it
 * means here rather than for how it is drawn: `Traced.tsx` has its own
 * `STROKED`, which is a *different* set — `dim` is a model, but it is a filled
 * shape rather than an outline.
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
 * Turning the progression off draws every repeat the same way, which is the
 * sheet for a child who is still tracing. Asking for one repeat gives the model
 * on its own, because a progression needs somewhere to progress to.
 */
export function traceStyles(config: Progression): TraceStyle[] {
  const times = clamp(config.repeats ?? 3, 1, MAX_REPEATS);
  const trace = config.trace ?? "dotted";
  if (config.progression === false) {
    return Array.from({ length: times }, () => trace);
  }
  if (times === 1) return ["solid"];
  return ["solid", ...Array.from({ length: times - 2 }, () => trace), "none"];
}

/**
 * An empty place carries no text, so a row of nothing but empty places
 * announces itself as a line to write on rather than as the word the child was
 * supposed to have thought of.
 */
export const cellOf = (text: string, style: TraceStyle): TraceCell => ({
  text: style === "none" ? "" : text,
  style,
});

/**
 * How many things go on one row when each is written `times` times across it.
 *
 * `longest` is the longest thing that will be written, in characters, and a
 * group takes its own width plus one character of air — so three letters
 * written four times each is a row of twelve cells. It is counted in the face's
 * own mean advance, and in that face's mean *for what this sheet writes*,
 * because a row of `Aa` is not a sample of `a`–`z` (§6).
 */
export function groupsAcross(
  width: Mil,
  em: Mil,
  face: Face,
  written: string,
  longest: number,
  times: number,
): number {
  const across = fittedCharacters(width, em, face, written);
  return Math.max(1, Math.floor(across / (times * (longest + 1))));
}

/**
 * Every row carries the same number of cells, the last one included: a short
 * final row left to divide the width between four cells instead of twelve would
 * set its letters three times as far apart as the row above it.
 */
export function rowsAcross(
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
export const rowsDown = (lines: string[], styles: TraceStyle[]): TraceRow[] =>
  lines.flatMap((line) =>
    styles.map((style) => ({ cells: [cellOf(line, style)] })),
  );

/**
 * The rows, a page at a time.
 *
 * One block per page and not one per row, so there is no `BLOCK_GAP` to pay
 * for and no way for the rules under a passage to drift out of step with the
 * rules it is written on: the blank places are rows of the same block.
 *
 * Nothing is trimmed to fit. A passage that runs past the page runs on to the
 * next, because a child set the whole of a psalm should get the whole of it —
 * and a parent who wanted one page can print page one. `perPage` is in rows
 * here, so a line's repeats never straddle a break.
 */
export const tracePages = (
  rule: Rule,
  rows: TraceRow[],
  perPage: number,
  guides?: ModelGuides,
): Block[] =>
  paged(rows, perPage, (page) => ({
    kind: "trace",
    rule,
    rows: page,
    ...(guides ? { guides } : {}),
  }));
