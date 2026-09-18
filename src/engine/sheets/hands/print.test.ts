import { describe, expect, it } from "vitest";

import { drawable, glyphOf, measure } from "./hand";
import { PRINT } from "./print";

/**
 * What the generated module is held to, whatever the drawings say: the
 * heights a row is sized by, and strokes the renderer can read.
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

describe("the print hand", () => {
  it("is drawn to a ruling: the tallest letter on the top line, tails to the tail line", () => {
    expect(PRINT.ascent).toBe(1000);
    expect(PRINT.xHeight).toBe(500);
    expect(PRINT.descent).toBe(-500);
    expect(PRINT.space).toBeGreaterThan(0);
  });

  it("stores every stroke in the four-command absolute form", () => {
    for (const [character, glyph] of Object.entries(PRINT.glyphs)) {
      expect(glyph.strokes.length, character).toBeGreaterThan(0);
      expect(glyph.advance, character).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) expect(stroke).toMatch(FOUR);
    }
  });

  it("keeps every letter between the tail line and the top line", () => {
    for (const [character, glyph] of Object.entries(PRINT.glyphs)) {
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
    for (const [character, glyph] of Object.entries(PRINT.glyphs)) {
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
