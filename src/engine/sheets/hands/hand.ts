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
 * The data modules beside this file are generated from drawings by
 * `scripts/hand-ingest.mjs` and never edited by hand.
 */

export type Glyph = {
  /** How far the pen moves on for the next letter, in hand units. */
  advance: number;
  /**
   * Absolute path data in `M`, `L`, `C` and `Q` only, one entry per pen
   * stroke, in writing order. The first point of the first stroke is where
   * the pen goes down.
   */
  strokes: string[];
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
 * The glyph for one character, or nothing.
 *
 * A space is a glyph with no strokes and the hand's own advance. Anything
 * the hand has no drawing for is `undefined` rather than a fallback, so a
 * caller can decide between skipping it and refusing the text.
 */
export function glyphOf(hand: Hand, character: string): Glyph | undefined {
  if (character === " ") return { ...SPACE, advance: hand.space };
  return Object.hasOwn(hand.glyphs, character)
    ? hand.glyphs[character]
    : undefined;
}

/** Whether every character of `text` has a drawing in `hand`. */
export const drawable = (hand: Hand, text: string): boolean =>
  [...text].every((character) => glyphOf(hand, character) !== undefined);

/**
 * How wide `text` is set in `hand`, in hand units.
 *
 * A character with no drawing takes a space's width, so a row measured here
 * and drawn by the renderer agree about where the next letter goes even when
 * one is missing.
 */
export function measure(hand: Hand, text: string): number {
  let width = 0;
  for (const character of text) {
    width += glyphOf(hand, character)?.advance ?? hand.space;
  }
  return width;
}
