/**
 * A hand: letters as the strokes that draw them, rather than as outlines
 * (§25).
 *
 * A font glyph is a filled shape, and a dash pattern on one runs around its
 * edge — two dotted lines a stem apart, never the one thin line a child
 * traces down the middle. So a hand stores what a pen does instead: each
 * letter is a list of open paths in the order they are written, and the
 * renderer strokes them with whatever weight and dash the sheet wants. The
 * same drawing is the solid model, the dotted trace and the start-here dot.
 *
 * Units are the hand's own, y up from the baseline, and the three heights
 * are drawn to a ruling rather than measured off a paragraph face: the tallest
 * letter reaches `ascent`, a small one `xHeight`, a tail `descent`. A row
 * sizes itself by setting `ascent` on the top line, and the midline then
 * lands exactly, which no outline face here manages (§6).
 *
 * Some letters are taught in more than one shape — an `a` with one storey
 * or two, a `t` with a curved foot or a straight one — and a scheme picks
 * one of each. So a glyph is the hand's own drawing of the letter plus,
 * where the hand draws it another way, the others by form, and a sheet
 * says which it wants with a `Forms` choice. A form the hand lacks, or a
 * name it has never heard of, falls back to the letter as drawn: a sheet
 * saved with a choice must still print after the choice is renamed.
 *
 * The data modules beside this file are generated from drawings by
 * `scripts/hand-ingest.mjs` and never edited by hand.
 */

/**
 * The shapes a letter is taught in, one word each so a choice means the
 * same thing in every hand: the storeys of `a`, the foot or tail of `t`,
 * `q`, `l`, `i` and `y`. The same list as `FORMS` in
 * `scripts/hand/names.mjs`; a generated module is typed against this one.
 */
export type Form = "single" | "double" | "curved" | "straight";

/** Which form of each letter a sheet asks for: `{ a: "double", t: "straight" }`. */
export type Forms = Partial<Record<string, Form>>;

export type Drawing = {
  /** How far the pen moves on for the next letter, in hand units. */
  advance: number;
  /**
   * Absolute path data in `M`, `L`, `C` and `Q` only, one entry per pen
   * stroke, in writing order. The first point of the first stroke is where
   * the pen goes down.
   */
  strokes: string[];
};

export type Glyph = Drawing & {
  /**
   * Only on a letter the hand draws more than one way: which form the
   * drawing above is, and the other forms, each a drawing of its own.
   */
  forms?: { own: Form; alternates: Partial<Record<Form, Drawing>> };
};

export type Hand = {
  id: string;
  name: string;
  /** Hand units to the em — what the three heights and every path are in. */
  units: number;
  ascent: number;
  xHeight: number;
  /** Negative: how far below the baseline a tail reaches. */
  descent: number;
  /** The advance of a space, which has no drawing to take one from. */
  space: number;
  glyphs: Record<string, Glyph>;
};

const SPACE: Glyph = { advance: 0, strokes: [] };

/**
 * The drawing of one character in the form asked for, or nothing.
 *
 * A space is a drawing with no strokes and the hand's own advance. Anything
 * the hand has no drawing for is `undefined` rather than a fallback, so a
 * caller can decide between skipping it and refusing the text. A form it
 * has no drawing for is the letter as drawn.
 */
export function glyphOf(
  hand: Hand,
  character: string,
  forms: Forms = {},
): Drawing | undefined {
  if (character === " ") return { ...SPACE, advance: hand.space };
  if (!Object.hasOwn(hand.glyphs, character)) return undefined;
  const glyph = hand.glyphs[character];
  const wanted = forms[character];
  if (wanted === undefined || glyph.forms === undefined) return glyph;
  return glyph.forms.alternates[wanted] ?? glyph;
}

/** The forms a hand draws a character in, its own first; none for a letter drawn one way. */
export function formsOf(hand: Hand, character: string): Form[] {
  const forms = hand.glyphs[character]?.forms;
  if (forms === undefined) return [];
  return [forms.own, ...(Object.keys(forms.alternates) as Form[])];
}

/** Whether every character of `text` has a drawing in `hand`. */
export const drawable = (hand: Hand, text: string): boolean =>
  [...text].every((character) => glyphOf(hand, character) !== undefined);

/**
 * How wide `text` is set in `hand`, in hand units, in the forms asked for.
 *
 * A character with no drawing takes a space's width, so a row measured here
 * and drawn by the renderer agree about where the next letter goes even when
 * one is missing.
 */
export function measure(hand: Hand, text: string, forms: Forms = {}): number {
  let width = 0;
  for (const character of text) {
    width += glyphOf(hand, character, forms)?.advance ?? hand.space;
  }
  return width;
}
