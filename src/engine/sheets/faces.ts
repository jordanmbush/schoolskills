/**
 * The three faces a sheet can be set in, measured rather than guessed.
 *
 * Tracing is the one place on this site where a font's own proportions are
 * load-bearing arithmetic instead of taste. A ⅝ rule is ⅝ of an inch (§4), a
 * capital has to stand on the baseline and reach the top line, and the em that
 * does that is different in every face: Playwrite draws its capitals a whole em
 * tall, Andika 0.79 of one, OpenDyslexic 0.85. One shared ratio therefore sets
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
   * that puts `l`, `k` and `T` on the top line. Measured across `bdfhklt` and
   * `ABEHMT` rather than taken from the `OS/2` cap height, because a real
   * ascender overshoots a declared one in most faces and it is the ink that
   * has to fit between the rules.
   */
  ascent: number;
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
   * Tuned against the face's own stem: roughly a third of it, so the white
   * core of a hollow letter stays open and a child can see the shape they are
   * tracing rather than a filled one. Andika's stems are 0.073em, Playwrite's
   * monoline is finer than either, OpenDyslexic's are 0.096em.
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
    advance: 0.506,
    stroke: 0.022,
    dotted: [0, 4.5],
    dashed: [6, 4],
  },
  cursive: {
    id: "cursive",
    family: "Playwrite US Trad",
    ascent: 1.019,
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
    advance: 0.795,
    // The heaviest of the three, because the face is: weighted bottoms and
    // 0.096em stems can carry an outline that would fill Andika's counters.
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
