import { describe, expect, it } from "vitest";

import { drawable, formsOf, glyphOf, measure, type Drawing } from "./hand";
import { PRINT } from "./print";

/**
 * What the generated module is held to, whatever the drawings say: the
 * heights a row is sized by, and strokes the renderer can read.
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

/** Every drawing in the hand, the other forms of a letter beside its own. */
const DRAWINGS: Array<[string, Drawing]> = Object.entries(PRINT.glyphs).flatMap(
  ([character, glyph]): Array<[string, Drawing]> => [
    [character, glyph],
    ...Object.entries(glyph.forms?.alternates ?? {}).map(
      ([form, drawing]): [string, Drawing] => [`${character}.${form}`, drawing],
    ),
  ],
);

describe("the print hand", () => {
  it("is drawn to a ruling: the tallest letter on the top line, tails to the tail line", () => {
    expect(PRINT.ascent).toBe(1000);
    expect(PRINT.xHeight).toBe(500);
    expect(PRINT.descent).toBe(-500);
    expect(PRINT.space).toBeGreaterThan(0);
  });

  it("stores every stroke in the four-command absolute form", () => {
    for (const [character, glyph] of DRAWINGS) {
      expect(glyph.strokes.length, character).toBeGreaterThan(0);
      expect(glyph.advance, character).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) expect(stroke).toMatch(FOUR);
    }
  });

  it("keeps every letter between the tail line and the top line", () => {
    for (const [character, glyph] of DRAWINGS) {
      const ys = glyph.strokes
        .flatMap((stroke) => stroke.match(/-?\d+/g) ?? [])
        .map(Number)
        .filter((_, index) => index % 2 === 1);
      expect(Math.max(...ys), character).toBeLessThanOrEqual(PRINT.ascent + 40);
      expect(Math.min(...ys), character).toBeGreaterThanOrEqual(
        PRINT.descent - 40,
      );
    }
  });

  it("starts every stroke's ink one bearing in, and never past the advance", () => {
    for (const [character, glyph] of DRAWINGS) {
      const xs = glyph.strokes
        .flatMap((stroke) => stroke.match(/-?\d+/g) ?? [])
        .map(Number)
        .filter((_, index) => index % 2 === 0);
      expect(Math.min(...xs), character).toBeGreaterThan(0);
      expect(Math.max(...xs), character).toBeLessThan(glyph.advance);
    }
  });
});

describe("hand lookups", () => {
  it("draws a, g, t and q two ways each, and names the hand's own way first", () => {
    expect(formsOf(PRINT, "a")).toEqual(["single", "double"]);
    expect(formsOf(PRINT, "g")).toEqual(["single", "double"]);
    expect(formsOf(PRINT, "t")).toEqual(["curved", "straight"]);
    expect(formsOf(PRINT, "q")).toEqual(["curved", "straight"]);
    expect(formsOf(PRINT, "e")).toEqual([]);
    expect(formsOf(PRINT, "z")).toEqual([]);
  });

  it("gives the form asked for, and the letter as drawn for any other", () => {
    const own = PRINT.glyphs.a;
    const double = own.forms?.alternates.double;
    expect(glyphOf(PRINT, "a")).toBe(own);
    expect(glyphOf(PRINT, "a", { a: "single" })).toBe(own);
    expect(glyphOf(PRINT, "a", { a: "double" })).toBe(double);
    expect(glyphOf(PRINT, "a", { t: "straight" })).toBe(own);
    // A form the letter has no drawing of — nothing about an `a` is curved.
    expect(glyphOf(PRINT, "a", { a: "curved" })).toBe(own);
    expect(glyphOf(PRINT, "e", { e: "double" })).toBe(PRINT.glyphs.e);
    // A straight t is a plain stem: two commands where the hook took more.
    const straight = glyphOf(PRINT, "t", { t: "straight" });
    expect(straight?.strokes[0]).toMatch(/^M -?\d+ -?\d+ L -?\d+ -?\d+$/);
    expect(PRINT.glyphs.t.strokes[0]).toContain("C");
  });

  it("measures the form asked for", () => {
    const own = PRINT.glyphs.a.advance;
    const double = PRINT.glyphs.a.forms?.alternates.double?.advance ?? NaN;
    expect(double).not.toBe(own);
    expect(measure(PRINT, "aa", { a: "double" })).toBe(2 * double);
    expect(measure(PRINT, "aa", { g: "double" })).toBe(2 * own);
  });

  it("gives a space its own advance and nothing to draw", () => {
    expect(glyphOf(PRINT, " ")).toEqual({ advance: PRINT.space, strokes: [] });
  });

  it("says which text it can write, and measures what it cannot as spaces", () => {
    expect(drawable(PRINT, "gate")).toBe(true);
    expect(drawable(PRINT, "gaze")).toBe(false);
    expect(measure(PRINT, "a a")).toBe(
      2 * PRINT.glyphs.a.advance + PRINT.space,
    );
    expect(measure(PRINT, "z")).toBe(PRINT.space);
  });
});
