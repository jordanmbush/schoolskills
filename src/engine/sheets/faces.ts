/**
 * The three faces a sheet can be set in, measured rather than guessed.
 *
 * Tracing is the one place on this site where a font's own proportions are
 * load-bearing arithmetic instead of taste. A ⅝ rule is ⅝ of an inch (§4), the
 * tallest letter has to stand on the baseline and reach the top line, and the
 * em that does that is different in every face: Playwrite's tallest ascender is
 * 1.02 em, Andika's 0.79, OpenDyslexic's 0.85. One shared ratio therefore sets
 * exactly one of them correctly and the other two through the rule — which is
 * the difference between paper a child can write on and paper they can't.
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
   * It is the *tallest ascender*, which in two of the three is a lower-case
   * letter rather than a capital. Playwrite and OpenDyslexic draw both to the
   * same height (caps 1.015 and 0.849 against these), so a capital lands on
   * the top line in those. Andika's caps are 0.713 — it is a text face, not a
   * manuscript model drawn to a ruling — so an Andika capital stops about a
   * tenth of the writing space short of the top line: 0.039in on the default
   * ⅝ rule with tails, 0.093in on a 1-inch one. That is the accepted
   * tolerance, not an oversight. Sizing capitals off a per-face cap height
   * instead would leave a row's `l` and `h` overshooting the rule by the same
   * tenth, and a row mixing the two cannot satisfy both.
   */
  ascent: number;
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
   * A *declared* mean advance across `a`–`z` and the space, as a share of the
   * em.
   *
   * The same bargain a problem cell strikes in `layout.ts` (§4): state what a
   * character will take rather than measure what it took, because there is no
   * DOM to ask at build time. It only ever shrinks type that would otherwise
   * run out of its cell — and it is per-face because OpenDyslexic is half as
   * wide again as Andika, so one shared guess would either waste a third of
   * the line or push a word off the end of it.
   */
  advance: number;
  /**
   * The weight of an outlined letterform, as a share of the em.
   *
   * Tuned against the face's own stem — roughly a fifth to a quarter of it, so
   * the white core of a hollow letter stays open and a child can see the shape
   * they are tracing rather than a filled one. Stems scanlined at half the
   * x-height across `lnioe`: Andika 0.090em, Playwrite 0.088em, OpenDyslexic
   * 0.099em, which makes these three 24%, 18% and 26% of their stem. The three
   * stems are within 12% of each other, so the ratios are not: Playwrite takes
   * the lightest hand, for the reason in its entry below, and OpenDyslexic the
   * heaviest because its counters are wide enough to take it.
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
 * Andika for print, Playwrite for cursive, OpenDyslexic for the accessibility
 * option — chosen in that order for the reasons in §6 and recorded in
 * `public/fonts/LICENSE.md`. The ids are the user's choice; the families are
 * an implementation detail that a saved sheet deliberately does not carry.
 */
export const FACES: Record<SheetFont, Face> = {
  print: {
    id: "print",
    family: "Andika",
    ascent: 0.791,
    xHeight: 0.498,
    advance: 0.506,
    stroke: 0.022,
    dotted: [0, 4.5],
    dashed: [6, 4],
  },
  cursive: {
    id: "cursive",
    family: "Playwrite US Trad",
    ascent: 1.019,
    xHeight: 0.519,
    advance: 0.57,
    // Finer than the other two, and dotted tighter. A joined script is one
    // continuous stroke, so its outline doubles back on itself down every
    // stem; too heavy a line closes the pair into a solid bar and too loose a
    // dot pitch lands one dot on each side instead of a pair a child can see
    // is a stem.
    stroke: 0.016,
    dotted: [0, 3.5],
    dashed: [5, 3.5],
  },
  dyslexic: {
    id: "dyslexic",
    family: "OpenDyslexic",
    ascent: 0.85,
    xHeight: 0.56,
    advance: 0.795,
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
 * The type size that fills a writing space, in mil.
 *
 * `writing` is the distance from the top line down to the baseline — what
 * `ruleLines` calls `top` to `base`. A notebook rule has no top line, so its
 * caller passes the whole repeat and the letters fill it.
 */
export function glyphEm(writing: Mil, face: Face): Mil {
  return Math.max(1, Math.round(writing / face.ascent));
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
