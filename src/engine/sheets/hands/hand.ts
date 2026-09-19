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
 * A cursive hand joins its letters, and a join is drawn by the renderer as
 * one line from the way one letter leaves to the way the next arrives
 * (`src/components/sheet/joined.ts`). What the hand stores is which ends of
 * a letter a join replaces: see `Join`.
 *
 * The data modules beside this file are generated from drawings by
 * `scripts/hand-ingest.mjs` and never edited by hand.
 */

/**
 * The shapes a letter is taught in, one word each so a choice means the
 * same thing in every hand: the storeys of `a`, the foot or tail of `t`,
 * `q`, `l`, `i` and `y`. The same list as `FORMS` in
 * `scripts/hand/names.mjs`; a generated module is typed against this one,
 * and a form arriving from a URL is checked against it.
 */
export const FORMS = ["single", "double", "curved", "straight"] as const;

export type Form = (typeof FORMS)[number];

/** Which form of each letter a sheet asks for: `{ a: "double", t: "straight" }`. */
export type Forms = Partial<Record<string, Form>>;

/**
 * How a letter takes and gives a join, counted in segments of its joining
 * stroke — the one the pen is still on when it reaches the next letter,
 * which is the first unless `stroke` says otherwise.
 *
 * The letter as drawn is the letter written alone, and a join replaces its
 * ends rather than needing a second drawing of it. The `lead` segments at
 * the start are the lead-in that a join from the letter before replaces;
 * the `tail` segments at the end are the exit stroke that a join into the
 * letter after replaces, and a letter with no tail does not join out — the
 * unlooped American model lifts the pencil after eight letters, and that is
 * how it says so. A letter with no lead-in is entered where it starts, and
 * the renderer decides how the join arrives there from which way the
 * letter sets off. `top` follows the lead-in: the further segments a join arriving at
 * the midline covers, which is the top of a round letter's bowl. A bridge
 * from an `o` runs along the top of an `a` and drops into its left side,
 * where a join rising from the baseline climbs to the bowl's right and goes
 * over the top itself.
 *
 * A capital begins its word, so nothing joins into one: its join is
 * `initial`, and the letter before it keeps its tail. A capital that ends
 * on the baseline joins out with a tail like any small letter's; one that
 * ends in a loop or at the top has no join at all.
 */
export type Join = {
  lead: number;
  tail: number;
  top?: number;
  /** Which stroke joins, when not the first: a `K` writes its stem before the arm that does. */
  stroke?: number;
  /** On a letter nothing joins into, whatever the letter before it does. */
  initial?: boolean;
};

export type Drawing = {
  /** How far the pen moves on for the next letter, in hand units. */
  advance: number;
  /**
   * Absolute path data in `M`, `L`, `C` and `Q` only, one entry per pen
   * stroke, in writing order. The first point of the first stroke is where
   * the pen goes down.
   */
  strokes: string[];
  /** Only on a letter of a hand that joins: which of its ends a join replaces. */
  join?: Join;
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

/** Whether the letter takes a join from the letter before it. */
export const joinsIn = (drawing: Drawing): boolean =>
  drawing.join !== undefined && drawing.join.initial !== true;

/** Whether the letter joins out to the letter after it. */
export const joinsOut = (drawing: Drawing): boolean =>
  (drawing.join?.tail ?? 0) > 0;

/**
 * How wide `text` is set in `hand`, in hand units, in the forms asked for.
 *
 * A character with no drawing takes a space's width, so a row measured here
 * and drawn by the renderer agree about where the next letter goes even when
 * one is missing.
 */
export function measure(
  hand: Hand,
  text: string,
  forms: Forms = {},
  space = hand.space,
): number {
  let width = 0;
  for (const character of text) {
    width +=
      character === " "
        ? space
        : (glyphOf(hand, character, forms)?.advance ?? hand.space);
  }
  return width;
}

/**
 * The width of a finger laid on the line after a word, in hand units: two
 * and a half word spaces, about a letter and a half. The gap a child is
 * taught to leave between words, and the one the spacing family's rows set
 * (§24).
 */
export const fingerSpace = (hand: Hand): number => hand.space * 2.5;
