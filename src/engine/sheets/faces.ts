/**
 * The five faces a sheet can be set in, measured rather than guessed (§6).
 *
 * A ⅝ rule is ⅝ of an inch (§4) and the tallest letter has to stand on the
 * baseline and reach the top line, so the em that does that is different in
 * every face: one shared ratio sets exactly one of the five correctly and
 * misses in the other four, which is the difference between paper a child can
 * write on and paper they can't. Every number below is a share of the em, read
 * out of the woff2 files in `public/fonts` with fontTools and pinned to those
 * bytes by digest in `faces.test.ts`.
 *
 * The weights are shares of the em too, unlike the absolute ones in
 * `src/components/sheet/units.ts`: the same ⅝ rule holds a Playwrite em of
 * 0.61in and an Andika em of 0.79in, and an outline that reads as a pen line
 * around one is a smudge around the other.
 */
import { own, points } from "./paper";
import type { Mil, SheetFont } from "./types";

export type Face = {
  id: SheetFont;
  /**
   * The family the numbers were measured from — a name, not a stack.
   * `sheet.css` owns the stack, and `faces.test.ts` checks the two against each
   * other so nobody re-tunes these ratios for a face that no longer reaches the
   * paper.
   */
  family: string;
  /**
   * Baseline up to the top of the tallest letter, as a share of the em.
   *
   * The number that sets the type: a writing space divided by this is the em
   * that puts the tallest letter on the top line. Measured off the outlines
   * rather than taken from the `OS/2` cap height, because a real ascender
   * overshoots a declared one in most faces and it is the ink that has to fit
   * between the rules.
   *
   * It is the tallest *ascender*, a lower-case letter in every face here, so it
   * is the right number for any row with a lower-case letter on it and the
   * wrong one for a row without: see `capHeight` and `figure` below, and
   * `glyphHeight`, which picks between the three.
   */
  ascent: number;
  /**
   * Baseline up to the top of a capital, as a share of the em.
   *
   * A sheet of nothing but capitals is one of the seven the shop prints, and on
   * it the tallest thing written *is* a capital — sized off `ascent` it would
   * stop short of the top line the page says it starts at (§6).
   *
   * Measured off the flat-topped capitals, which is the height a face draws a
   * capital to. Where a round one stands above that it is the face's own
   * optical overshoot, exactly as it overshoots the cap line in any book, and
   * in the looped hand `S`, `V` and `W` stand further above again because that
   * is how the letters are drawn. Nothing is clipped either way: `TracedRow`
   * gives its viewport an em of slack at each end.
   */
  capHeight: number;
  /**
   * Baseline up to the top of a numeral, as a share of the em.
   *
   * The same argument as `capHeight`, for the sheet of nothing but numerals,
   * and a second field rather than a second use of that one: OpenDyslexic's
   * figures are a tenth shorter than its capitals, so a shared value would
   * print that face's digits well under the top line.
   *
   * Measured off the flat-topped numerals (`1 4 5 7`), for the reason
   * `capHeight` is measured off the flat capitals.
   */
  figure: number;
  /**
   * Baseline up to the top of `x`, as a share of the em.
   *
   * Recorded rather than used: nothing sizes type from it, and `faces.test.ts`
   * is what reads it. A handwriting rule puts its midline at exactly half the
   * writing space and a child is told to write their letter bodies up to it,
   * so this is the number that says how close the printed model comes. The em
   * is set by `ascent`, so the midline can only follow from it, and what the
   * test holds every face to is the direction of the miss: over the line rather
   * than under it, because a model that fell short would be teaching the child
   * to ignore the line they are being asked to write to (§6).
   */
  xHeight: number;
  /**
   * Baseline down to the bottom of the deepest tail, as a share of the em.
   *
   * Recorded rather than used, exactly as `xHeight` is, and read by
   * `faces.test.ts`. What it is checked against is the tail space of a
   * handwriting rule, which is a third of the repeat against a writing space of
   * two thirds (`DESCENDER_SHARE` in paper.ts) — so the room below the baseline
   * is half the writing space, which is `ascent / 2` of the em at any rule size.
   * A tail deeper than that is drawn through the next set's top line rather than
   * into clean paper.
   *
   * The looped hand hangs over it by 0.009 of the em, four thousandths of an
   * inch on a ⅝ rule. That is the stated tolerance and the reason a traced row
   * is not allowed to clip: a looped `g` with its loop cut off is a worse model
   * than one that crosses a line, and on a cursive sheet that loop is where the
   * join to the next letter starts.
   */
  descent: number;
  /**
   * A *declared* mean advance across `a`–`z` and the space, as a share of the
   * em.
   *
   * The same bargain a problem cell strikes in `layout.ts` (§4): state what a
   * character will take rather than measure what it took, because there is no
   * DOM to ask at build time. Per-face because OpenDyslexic is half as wide
   * again as Andika, so one shared guess would either waste a third of the line
   * or push a word off the end of it. The mean over the *small* letters — see
   * `capAdvance` for a row with a capital on it.
   */
  advance: number;
  /**
   * The same declared mean, for a row that has a capital on it (§6).
   *
   * Measured across the twenty-six `Aa`…`Zz` pairs **as they are actually
   * set** — shaped, so whatever alternates and joining strokes the face inserts
   * are in the number — and as *ink* rather than advance, because what overflows
   * a cell is ink and a neighbour's side bearing is there to meet the one beside
   * it.
   *
   * It can come out *under* `advance`, and in OpenDyslexic it does: that face
   * sets every letter in a wide slot. `glyphAdvance` takes the two at their
   * largest for that reason — a capital is not a reason to pack a row tighter.
   */
  capAdvance: number;
  /**
   * The weight of an outlined letterform, as a share of the em.
   *
   * Tuned against the face's own stem — roughly a fifth to a quarter of it, so
   * the white core of a hollow letter stays open and a child can see the shape
   * they are tracing rather than a filled one. The five stems are within 15% of
   * each other and these three ratios deliberately are not: a joined script
   * takes the lightest hand (see `cursive` below) and OpenDyslexic the heaviest,
   * because its counters are wide enough to take it.
   */
  stroke: number;
  /**
   * Dotted: ink then gap, as multiples of the outline weight above.
   *
   * Zero ink with a round cap is a dot whose diameter is the weight — the same
   * trick the dot grid in `Ruling` uses. The gap is a multiple of that weight
   * rather than a fixed number of points, which is what holds the ratio steady
   * from a 1-inch rule down to a ⅜ one.
   */
  dotted: readonly [number, number];
  /** Dashed: the same pair, longer ink. A dash is a stroke, not a dot. */
  dashed: readonly [number, number];
};

/**
 * The finest line worth sending to a printer. A quarter point is two dots at
 * 600dpi — below that a hairline starts dropping out of the page altogether,
 * and a dotted letterform is nothing but hairlines.
 */
export const MIN_INK: Mil = points(0.25);

/**
 * The heaviest an outline gets, however big the letter. Deliberately the same
 * weight `units.ts` calls `RULE`: a letterform a child traces is one of the
 * lines they write on and should not out-shout the rule it sits between, and
 * without a ceiling a 1-inch capital would be outlined at over two points —
 * a marker rather than a pencil.
 */
export const MAX_OUTLINE: Mil = points(0.75);

/**
 * Andika for print, three Playwrite models for cursive, OpenDyslexic for the
 * accessibility option — chosen for the reasons in §6 and recorded in
 * `public/fonts/LICENSE.md`. The ids are the user's choice; the families are an
 * implementation detail that a saved sheet deliberately does not carry.
 *
 * Which letters join is the font file's own `calt` table and never this repo's
 * opinion; see `writing/joins.ts`.
 */
export const FACES: Record<SheetFont, Face> = {
  print: {
    id: "print",
    family: "Andika",
    ascent: 0.791,
    capHeight: 0.713,
    figure: 0.713,
    xHeight: 0.498,
    descent: 0.239,
    advance: 0.506,
    capAdvance: 0.537,
    stroke: 0.022,
    dotted: [0, 4.5],
    dashed: [6, 4],
  },
  /** The looped hand, and the id saved cursive sheets already carry (§6). */
  cursive: {
    id: "cursive",
    family: "Playwrite US Trad",
    ascent: 1.019,
    capHeight: 1.015,
    figure: 1.015,
    xHeight: 0.519,
    descent: 0.519,
    advance: 0.57,
    capAdvance: 0.739,
    // Finer than the print faces, and dotted tighter. A joined script is one
    // continuous stroke, so its outline doubles back on itself down every
    // stem; too heavy a line closes the pair into a solid bar and too loose a
    // dot pitch lands one dot on each side instead of a pair a child can see
    // is a stem. The three cursive models share these three numbers because
    // they share a stem.
    stroke: 0.016,
    dotted: [0, 3.5],
    dashed: [5, 3.5],
  },
  /** The same letters unlooped, and the model that lifts the pencil (§6). */
  "cursive-modern": {
    id: "cursive-modern",
    family: "Playwrite US Modern",
    ascent: 0.957,
    capHeight: 0.953,
    figure: 0.953,
    xHeight: 0.517,
    descent: 0.457,
    advance: 0.546,
    capAdvance: 0.622,
    stroke: 0.016,
    dotted: [0, 3.5],
    dashed: [5, 3.5],
  },
  /**
   * The fully joined British hand: unlooped like the modern American model,
   * joined out of every letter like the traditional one, and with a lead-in
   * stroke from the baseline into each letter — which is what makes it
   * "continuous cursive" rather than joined print.
   */
  "cursive-uk": {
    id: "cursive-uk",
    family: "Playwrite GB J",
    ascent: 0.894,
    capHeight: 0.89,
    figure: 0.89,
    xHeight: 0.517,
    descent: 0.394,
    advance: 0.548,
    capAdvance: 0.608,
    stroke: 0.016,
    dotted: [0, 3.5],
    dashed: [5, 3.5],
  },
  dyslexic: {
    id: "dyslexic",
    family: "OpenDyslexic",
    ascent: 0.85,
    capHeight: 0.847,
    figure: 0.729,
    xHeight: 0.56,
    descent: 0.261,
    advance: 0.795,
    capAdvance: 0.732,
    stroke: 0.026,
    dotted: [0, 5],
    dashed: [7, 4.5],
  },
};

/**
 * Resolves a face. Never throws, for the same reason `rulingOf` doesn't: a
 * sheet saved last term must still print after a face has been renamed or
 * dropped, and the print face is the honest answer to "I don't know that one"
 * — it is also what `SheetOptions.font` being absent means.
 */
export function faceOf(font: SheetFont | undefined): Face {
  return own(FACES, font ?? "print", FACES.print);
}

/**
 * The cursive models, in the order a picker offers them: the looped hand first,
 * because it is the default and the id a saved sheet already carries.
 *
 * A list rather than a flag on `Face`, because the order is the whole of what a
 * caller wants.
 */
export const CURSIVE_FACES: SheetFont[] = [
  "cursive",
  "cursive-modern",
  "cursive-uk",
];

export const isCursive = (font: SheetFont | undefined): boolean =>
  font !== undefined && CURSIVE_FACES.includes(font);

/**
 * The cursive model to set joined writing in — the one asked for, if it joins.
 *
 * The one content style that is *only* a cursive exercise resolves its own face
 * rather than printing a contradiction: two letters that don't touch are not a
 * join (§6). A parent who has chosen a model keeps it.
 */
export const cursiveOf = (font: SheetFont | undefined): SheetFont =>
  isCursive(font) ? (font as SheetFont) : "cursive";

/**
 * How tall the tallest thing in `text` is drawn, as a share of the em.
 *
 * A face states three heights and which of them applies is a fact about what is
 * written, not about the face. So it is read off the text itself rather than off
 * a config — the sheet of capitals and the word "ABC" typed into the builder get
 * the same answer, and a renderer that only has cells to look at can still ask.
 *
 * The classes are taken at their largest, so a row of `Aa` is sized off the
 * ascender and not off the capital: an `l` drawn through the top rule is a worse
 * sheet than a capital sitting under it. `ascent` is also the answer for a row
 * with none of them on it — a line of punctuation is not a reason to resize the
 * page, and an empty row has to agree with the row above it.
 */
export function glyphHeight(text: string, face: Face): number {
  let height = 0;
  if (/[a-z]/.test(text)) height = face.ascent;
  if (/[A-Z]/.test(text)) height = Math.max(height, face.capHeight);
  if (/[0-9]/.test(text)) height = Math.max(height, face.figure);
  return height > 0 ? height : face.ascent;
}

/**
 * How wide one character of `text` is reserved, as a share of the em.
 *
 * `glyphHeight` read sideways, and the same judgement (§6): a row of `Aa` is not
 * a sample of `a`–`z` and must not be packed as though it were.
 *
 * The classes are taken at their largest, for the reason they are in
 * `glyphHeight` and one more: `capAdvance` can measure narrower than `advance`,
 * and a capital arriving on a row is never a reason to give the row less room.
 * Numerals count with the capitals, because no face here draws one wider than
 * its widest capital.
 */
export function glyphAdvance(text: string, face: Face): number {
  return /[A-Z0-9]/.test(text)
    ? Math.max(face.advance, face.capAdvance)
    : face.advance;
}

/**
 * The type size that fills a writing space, in mil.
 *
 * `writing` is the distance from the top line down to the baseline — what
 * `ruleLines` calls `top` to `base`. A notebook rule has no top line, so its
 * caller passes the whole repeat and the letters fill it.
 *
 * `text` decides which of the face's three heights has to reach the top line
 * (`glyphHeight`). Left out, the answer is the tallest letter there is — the
 * safe end, and the right one for a caller asking "how big is this ruling"
 * rather than "how big is this row".
 */
export function glyphEm(writing: Mil, face: Face, text = ""): Mil {
  return Math.max(1, Math.round(writing / glyphHeight(text, face)));
}

/**
 * The largest em that keeps `characters` inside `width`, in mil.
 *
 * Never the first answer — a family that sized its row properly is never
 * clamped by this — but a row that asked for six repeats of a long word on a
 * ⅜ rule gets small letters rather than letters that run off the paper.
 */
export function fittedEm(width: Mil, characters: number, face: Face): Mil {
  if (characters <= 0) return Infinity;
  return Math.max(1, Math.floor(width / (characters * face.advance)));
}

/**
 * How many characters fit across `width` at one type size — `fittedEm` read
 * the other way round.
 *
 * What a passage is wrapped at, and what a row of cells is packed by. The em is
 * fixed by the ruling on a handwriting sheet, so the question is never "how
 * small must this be to fit" but "where does the line run out".
 *
 * `text` picks the mean (`glyphAdvance`) the way it picks the height in
 * `glyphEm`. Left out, the answer is the small-letter mean — right for running
 * text, where a capital is the first letter of a sentence rather than half of
 * every cell, and wrong for a row of `Aa`.
 */
export function fittedCharacters(
  width: Mil,
  em: Mil,
  face: Face,
  text = "",
): number {
  const advance = em * glyphAdvance(text, face);
  if (advance <= 0 || width <= 0) return 1;
  return Math.max(1, Math.floor(width / advance));
}

/** What a stroked letterform is drawn with, at one type size. */
export type TraceInk = {
  /** `stroke-width`, in mil. */
  width: Mil;
  /** `stroke-dasharray` for the dotted style, in mil. */
  dotted: string;
  /** `stroke-dasharray` for the dashed style, in mil. */
  dashed: string;
};

const pair = (width: Mil, [ink, gap]: readonly [number, number]): string =>
  `${Math.round(width * ink)} ${Math.round(width * gap)}`;

/**
 * The ink an outlined letterform is drawn with at a given em.
 *
 * Everything is derived from one clamped weight, so the three outlined styles
 * can't drift apart: hollow is the weight, dotted is the weight with gaps
 * between round caps, dashed is the weight in longer runs.
 */
export function traceInk(em: Mil, face: Face): TraceInk {
  const width = Math.min(
    MAX_OUTLINE,
    Math.max(MIN_INK, Math.round(em * face.stroke)),
  );
  return {
    width,
    dotted: pair(width, face.dotted),
    dashed: pair(width, face.dashed),
  };
}
