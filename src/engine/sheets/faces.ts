/**
 * The five faces a sheet can be set in, measured rather than guessed.
 *
 * Tracing is the one place on this site where a font's own proportions are
 * load-bearing arithmetic instead of taste. A ⅝ rule is ⅝ of an inch (§4), the
 * tallest letter has to stand on the baseline and reach the top line, and the
 * em that does that is different in every face: the looped cursive's tallest
 * ascender is 1.02 em, Andika's 0.79, OpenDyslexic's 0.85, and the two other
 * cursive models fall between at 0.96 and 0.89. One shared ratio therefore sets
 * exactly one of them correctly and the rest through the rule — which is the
 * difference between paper a child can write on and paper they can't.
 *
 * So each face is measured once, here. Every number below is a share of the em
 * read out of the font file itself with fontTools (the files are in
 * `public/fonts`; `LICENSE.md` beside them records where each came from). None
 * of it scales with the screen, because none of it is on a screen.
 *
 * ── Why the ink is here and not in units.ts ────────────────────────────────
 * The weights in `src/components/sheet/units.ts` are absolute: a hairline is
 * half a point whatever it is drawing. A traced letterform can't be, because
 * the same ⅝ rule holds a Playwrite em of 0.61in and an Andika em of 0.79in,
 * and the outline that reads as a pen line around one is a smudge around the
 * other. The weights below are shares of the em for that reason, and the dash
 * patterns are multiples of the weight so that a dotted letter keeps the same
 * dot-to-gap ratio at every rule size — which is the whole of "it still reads
 * as dots at ⅜ inch".
 */
import { own, points } from "./paper";
import type { Mil, SheetFont } from "./types";

export type Face = {
  id: SheetFont;
  /**
   * The family the numbers were measured from — a name, not a stack.
   * `sheet.css` owns the stack and the fallbacks; this is here so the two can
   * be checked against each other, and so nobody re-tunes these ratios for a
   * face that is no longer the one reaching the paper.
   */
  family: string;
  /**
   * Baseline up to the top of the tallest letter, as a share of the em.
   *
   * The number that sets the type: a writing space divided by this is the em
   * that puts the tallest of `bdfhklt` and `ABEHMT` on the top line. Measured
   * off the outlines rather than taken from the `OS/2` cap height, because a
   * real ascender overshoots a declared one in most faces and it is the ink
   * that has to fit between the rules.
   *
   * It is the *tallest ascender*, which in all three is a lower-case letter —
   * `f` in Andika, `b` in the other two. It is therefore the right number for
   * any row that has a lower-case letter on it, and the wrong one for a row
   * that has not: see `capHeight` and `figure` below, and `glyphHeight`, which
   * is what picks between the three.
   */
  ascent: number;
  /**
   * Baseline up to the top of a capital, as a share of the em.
   *
   * Measured off the flat-topped capitals (`E H I L T`), which is the height
   * the face draws a capital to; the round ones (`C G O Q S`) overshoot it by
   * the face's own optical overshoot, exactly as they overshoot the cap line
   * in any book — Andika by 0.012em, OpenDyslexic by 0.013em.
   *
   * The three cursive models do not do that, and one of them does something
   * else. In the unlooped and British hands every round capital is drawn to
   * exactly this height — no overshoot at all, which is what a face drawn to a
   * ruling rather than to a paragraph looks like. In the looped hand `C G O Q`
   * are likewise flush, and it is `S`, `V` and `W` that stand above: `S` by
   * 0.071 em and `V` and `W` by 0.034. Those are letterforms rather than
   * optical corrections — a looped cursive `S` is *drawn* through the cap line
   * — and on the ¾ rule the capitals sheet uses they print 0.036in and 0.017in
   * above the top rule. That is well past the 0.004in this file calls a
   * tolerance elsewhere, and it is still the right way round: sizing the em off
   * `S` instead would drop the other twenty-three capitals the same 0.036in
   * *below* the line the page says every capital starts on, which is the miss
   * this field exists to avoid. Nothing is clipped either way — `TracedRow`
   * gives its viewport an em of slack at each end.
   *
   * Here because a sheet of nothing but capitals is one of the seven the shop
   * prints, and on it the tallest thing written *is* a capital. Sized off
   * `ascent` a capital would stop short of the top line by the difference
   * between the two — a tenth of the writing space in Andika, which is a text
   * face rather than a manuscript model drawn to a ruling, and 0.039in on the
   * default ⅝ rule. The page says "every capital starts at the top line", so
   * it has to.
   *
   * A row that mixes the two cannot satisfy both, and `glyphHeight` resolves
   * that the only way round that is safe: the moment a lower-case letter is on
   * the row, the em goes back to `ascent` and the capital rides low. An `l`
   * through the top rule is a worse sheet than a capital a tenth under it.
   */
  capHeight: number;
  /**
   * Baseline up to the top of a numeral, as a share of the em.
   *
   * The same argument as `capHeight`, for the sheet of nothing but numerals.
   * Not the same *number*, which is why it is a second field: Andika and
   * Playwrite draw lining figures to their cap height, but OpenDyslexic's are
   * a tenth shorter than its capitals, so one shared value would print that
   * face's digits well under the top line.
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
   * so this is the number that says how close the printed model comes — and
   * with the em set by `ascent`, a body reaches the midline and then some.
   * Andika clears it by 0.13 of the writing space and OpenDyslexic by 0.16;
   * Playwrite, drawn to a ruling, by 0.01. Over rather than under is the right
   * side to miss on: a model that fell short of the midline would be teaching
   * the child to ignore the line they are being asked to write to.
   */
  xHeight: number;
  /**
   * Baseline down to the bottom of the deepest tail, as a share of the em —
   * `p` and `q` in Andika, `g` in the other two.
   *
   * Recorded rather than used, exactly as `xHeight` is, and read by
   * `faces.test.ts`. What it is checked against is the tail space of a
   * handwriting rule, which is a third of the repeat against a writing space of
   * two thirds (`DESCENDER_SHARE` in paper.ts) — so the room below the baseline
   * is half the writing space, and half the writing space is `ascent / 2` of
   * the em whatever the rule size. A tail deeper than that is drawn through the
   * next set's top line rather than into clean paper.
   *
   * Andika uses 0.239 of the 0.396 it is given and OpenDyslexic 0.261 of 0.425,
   * so both print sheets clear it comfortably, and the two unlooped cursive
   * models clear it as well (0.457 of 0.478, 0.394 of 0.447). The looped hand
   * is the one face that hangs over: 0.519 against 0.510, by 0.009 of the em,
   * four thousandths of an inch on a ⅝ rule. That is the stated tolerance and
   * the reason a traced row is not allowed to clip — a looped `g` with its loop
   * cut off is a worse model than one that crosses a line, and on a cursive
   * sheet that loop is also where the join to the next letter starts.
   */
  descent: number;
  /**
   * A *declared* mean advance across `a`–`z` and the space, as a share of the
   * em.
   *
   * The same bargain a problem cell strikes in `layout.ts` (§4): state what a
   * character will take rather than measure what it took, because there is no
   * DOM to ask at build time. It only ever shrinks type that would otherwise
   * run out of its cell — and it is per-face because OpenDyslexic is half as
   * wide again as Andika, so one shared guess would either waste a third of
   * the line or push a word off the end of it.
   *
   * It is the mean over the *small* letters, which is the honest statistic for
   * running text and the wrong one for a row with a capital on it. See
   * `capAdvance` below, and `glyphAdvance`, which picks between the two.
   */
  advance: number;
  /**
   * The same declared mean, for a row that has a capital on it.
   *
   * The width answer to what `capHeight` is the height answer to, and it
   * exists for the same sheet: `Aa`…`Zz` and a page of nothing but capitals
   * are two of the seven the shop prints, and on neither of them is a mean
   * over `a`–`z` a description of what is in the cell. A capital is wider than
   * a small letter in every face — and much wider in a joined one, where it is
   * drawn with an entry flourish and then a stroke out to the letter after it.
   *
   * Measured across the twenty-six `Aa`…`Zz` pairs **as they are actually
   * set** — shaped, so whatever alternates and joining strokes the face
   * inserts are in the number — and divided by the two characters. Two
   * departures from `advance`, both deliberate:
   *
   * - *A pair, not a capital.* On these sheets a capital never stands alone
   *   in a cell without a small letter's worth of company: it heads a pair, a
   *   word or a sentence. What has to fit is the pair.
   * - *Ink, not advance.* A cell is a box the letters have to sit inside, and
   *   the side bearings either side of that box cost nothing — the neighbour's
   *   bearing is there to meet them. What overflows a cell is ink.
   *
   * The three joined models are where the difference bites. Andika's is a
   * sixth over its small-letter mean and the character of air `handwriting.ts`
   * reserves absorbs that; the looped hand's is a third over, and it does not
   * — a row of `Aa` packed off `advance` puts `Mm` 0.1in into the cell beside
   * it, which on a sheet whose whole subject is where a join belongs prints
   * the model and the trace as one continuous joined string.
   *
   * It can come out *under* `advance`, and in OpenDyslexic it does: that face
   * sets every letter in a wide slot, so its ink mean is narrower than its
   * advance mean even with a capital on the row. `glyphAdvance` takes the
   * classes at their largest for that reason, exactly as `glyphHeight` does —
   * a capital is not a reason to pack a row tighter.
   */
  capAdvance: number;
  /**
   * The weight of an outlined letterform, as a share of the em.
   *
   * Tuned against the face's own stem — roughly a fifth to a quarter of it, so
   * the white core of a hollow letter stays open and a child can see the shape
   * they are tracing rather than a filled one. Stems scanlined at half the
   * x-height across `lnioe`: Andika 0.090em, the three cursive models 0.088,
   * 0.086 and 0.086, OpenDyslexic 0.099em — which makes these 24%, 18% and 26%
   * of their stem. Every stem here is within 15% of every other, so the ratios
   * are not: a joined script takes the lightest hand, for the reason in the
   * `cursive` entry below, and OpenDyslexic the heaviest because its counters
   * are wide enough to take it.
   */
  stroke: number;
  /**
   * Dotted: ink then gap, as multiples of the outline weight above.
   *
   * Zero ink with a round cap is a dot whose diameter is the weight — the same
   * trick the dot grid in `Ruling` uses. Keeping the gap a multiple of the
   * weight rather than a fixed number of points is what holds the dot-to-gap
   * ratio steady from a 1-inch rule down to a ⅜ one.
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
 * The heaviest an outline gets, however big the letter.
 *
 * Deliberately the same weight `units.ts` calls `RULE`: a letterform a child
 * traces is one of the lines they write on, and it should not out-shout the
 * rule it sits between. Without a ceiling a 1-inch capital would be outlined
 * at over two points, which reads as a marker rather than a pencil.
 */
export const MAX_OUTLINE: Mil = points(0.75);

/**
 * Andika for print, three Playwrite models for cursive, OpenDyslexic for the
 * accessibility option — chosen in that order for the reasons in §6 and
 * recorded in `public/fonts/LICENSE.md`. The ids are the user's choice; the
 * families are an implementation detail that a saved sheet deliberately does
 * not carry.
 *
 * Three cursives rather than one because there is no such thing as cursive:
 * Playwrite's regional families are the handwriting models actually taught, and
 * they disagree about the two things a cursive sheet is *for* — whether an
 * ascender loops, and which letters join to the next. Shipping one and calling
 * it correct would tell a British child their `b` joins wrongly. Which letters
 * join is the file's own `calt` table and never this repo's opinion; see
 * `writing/joins.ts`.
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
  /**
   * The looped hand: traditional American cursive, and the id every saved
   * cursive sheet already carries, so it stays unqualified (§7). Loops on the
   * ascenders and descenders, and a join out of every letter — its `calt`
   * table breaks after nothing at all.
   */
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
    // they share a stem: 0.088, 0.086 and 0.086 of the em.
    stroke: 0.016,
    dotted: [0, 3.5],
    dashed: [5, 3.5],
  },
  /**
   * The same letters unlooped, and the model that lifts the pencil: `b f g j
   * p q s y` do not join to what follows them. Shorter ascenders than the looped
   * hand by 0.06 em and a tail two thirds the depth, both of which follow from
   * dropping the loops — which is also why this is the one cursive model whose
   * descender fits inside the room a ⅝ rule gives it.
   */
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
   * The fully joined hand a British primary school teaches: unlooped like the
   * modern American model, joined out of every letter like the traditional
   * one, and with a lead-in stroke from the baseline into each letter — which
   * is what makes it "continuous cursive" rather than joined print.
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
    // The heaviest of the three, because the face is: weighted bottoms and
    // 0.099em stems can carry an outline that would fill Andika's counters.
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
 * The cursive models, in the order a picker offers them: the looped hand
 * first, because it is the default and the id a saved sheet already carries.
 *
 * A list rather than a flag on `Face`, because the order is the whole of what
 * a caller wants — a builder listing the models, a hub page naming them, and
 * `cursiveOf` picking one when a sheet has to be joined and isn't.
 */
export const CURSIVE_FACES: SheetFont[] = [
  "cursive",
  "cursive-modern",
  "cursive-uk",
];

/** Whether a face joins its letters. Three of the five do. */
export const isCursive = (font: SheetFont | undefined): boolean =>
  font !== undefined && CURSIVE_FACES.includes(font);

/**
 * The cursive model to set joined writing in — the one asked for, if it joins.
 *
 * A sheet of joins set in a print face is two letters standing next to each
 * other, which is precisely the thing the sheet exists to teach a child not to
 * write. So the one content style that is *only* a cursive exercise resolves
 * its own face rather than printing a contradiction, and a parent who has
 * chosen a model keeps it.
 */
export const cursiveOf = (font: SheetFont | undefined): SheetFont =>
  isCursive(font) ? (font as SheetFont) : "cursive";

/**
 * How tall the tallest thing in `text` is drawn, as a share of the em.
 *
 * The one judgement that decides whether a printed model reaches the top line:
 * a face states three heights and which of them applies is a fact about what
 * is written, not about the face. So it is read off the text itself rather
 * than off a config — the sheet of capitals and the word "ABC" typed into the
 * builder get the same answer, and a renderer that only has cells to look at
 * can still ask.
 *
 * The classes are taken at their largest, so a row of `Aa` is sized off the
 * ascender and not off the capital. `ascent` is also the answer for a row with
 * none of them on it: a line of punctuation is not a reason to resize the
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
 * `glyphHeight` read sideways, and the same judgement: a face states more than
 * one mean and which of them applies is a fact about what is written, not
 * about the face. A row of `Aa` is not a sample of `a`–`z` and must not be
 * packed as though it were — half of it is capitals, and in a joined hand a
 * capital is drawn with an entry flourish and a stroke out to the letter after
 * it.
 *
 * The classes are taken at their largest, for the reason they are in
 * `glyphHeight` and one more: `capAdvance` can measure narrower than `advance`
 * (OpenDyslexic), and a capital arriving on a row is never a reason to give the
 * row less room. Numerals count with the capitals — they are drawn to the cap
 * line and no face here draws one wider than its widest capital — and `advance`
 * is the answer for a row with none of them on it.
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
 * `text` is what will be written at that size, and it is what decides which of
 * the face's three heights has to reach the top line (`glyphHeight`). Left
 * out, the answer is the tallest letter there is — the safe end, and the right
 * one for a caller asking "how big is this ruling" rather than "how big is
 * this row".
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
 * What a passage is wrapped at, and what a row of cells is packed by. The em
 * is fixed by the ruling on a handwriting sheet, so the question is never "how
 * small must this be to fit" but "where does the line run out", and answering
 * it needs no DOM: it is the same declared mean advance, divided rather than
 * multiplied.
 *
 * `text` is what will be written across that width, and it picks the mean
 * (`glyphAdvance`) the way it picks the height in `glyphEm`. Left out, the
 * answer is the small-letter mean — which is the right one for running text,
 * where a capital is the first letter of a sentence rather than half of every
 * cell, and the wrong one for a row of `Aa`.
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
