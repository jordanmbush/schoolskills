import { describe, expect, it } from "vitest";

import { CURSIVE_UK } from "./cursive-uk";
import { drawable, glyphOf, joinsIn, joinsOut } from "./hand";

/**
 * What the generated fully joined British module is held to: the same
 * ruling and stroke form as the other hands, print capitals that never
 * join, and a small alphabet that joins in and out of every letter with no
 * lead-in drawn on any — the entry stroke a child sees on every letter of a
 * word in this model is the join arriving (§25).
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

describe("the fully joined cursive hand", () => {
  it("is drawn to a ruling, like the other hands", () => {
    expect(CURSIVE_UK.ascent).toBe(1000);
    expect(CURSIVE_UK.xHeight).toBe(500);
    expect(CURSIVE_UK.descent).toBe(-500);
  });

  it("has both alphabets and the seven marks, and no numerals yet", () => {
    expect(drawable(CURSIVE_UK, LOWER)).toBe(true);
    expect(drawable(CURSIVE_UK, UPPER)).toBe(true);
    expect(drawable(CURSIVE_UK, ".,?!'-·")).toBe(true);
    expect(drawable(CURSIVE_UK, "5")).toBe(false);
  });

  it("stores every stroke in the four-command absolute form", () => {
    for (const [character, glyph] of Object.entries(CURSIVE_UK.glyphs)) {
      expect(glyph.strokes.length, character).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) expect(stroke).toMatch(FOUR);
    }
  });

  it("joins every small letter in and out, and no mark", () => {
    for (const letter of LOWER) {
      const glyph = CURSIVE_UK.glyphs[letter];
      expect(joinsIn(glyph), letter).toBe(true);
      expect(joinsOut(glyph), letter).toBe(true);
    }
    for (const mark of ".,?!'-·") {
      expect(joinsIn(CURSIVE_UK.glyphs[mark]), mark).toBe(false);
    }
  });

  it("draws print capitals, and none of them joins", () => {
    for (const letter of UPPER) {
      const glyph = CURSIVE_UK.glyphs[letter];
      expect(glyph.join, letter).toBeUndefined();
      expect(joinsIn(glyph), letter).toBe(false);
      expect(joinsOut(glyph), letter).toBe(false);
    }
  });

  it("draws no lead-in on any letter: the join is the entry stroke", () => {
    for (const letter of LOWER) {
      expect(CURSIVE_UK.glyphs[letter].join?.lead, letter).toBe(0);
    }
  });

  it("lets a bridge from the midline run along the top of a round letter", () => {
    for (const letter of "acdgoq") {
      expect(CURSIVE_UK.glyphs[letter].join?.top, letter).toBeGreaterThan(0);
    }
    for (const letter of "befhijklmnprstuvwxyz") {
      expect(CURSIVE_UK.glyphs[letter].join?.top, letter).toBeUndefined();
    }
  });

  it("keeps enough of every joining stroke for a join to land on", () => {
    for (const letter of LOWER) {
      const { strokes, join } = CURSIVE_UK.glyphs[letter];
      const segments = (strokes[0].match(/ [LCQ] /g) ?? []).length;
      const kept =
        segments - (join?.lead ?? 0) - (join?.tail ?? 0) - (join?.top ?? 0);
      expect(kept, letter).toBeGreaterThanOrEqual(1);
    }
  });

  it("ends the letters that leave from the midline above half the x-height, and the rest on the baseline", () => {
    // The last point before the tail is where a join sets off from.
    const exitY = (letter: string) => {
      const { strokes, join } = CURSIVE_UK.glyphs[letter];
      const numbers = strokes[0].match(/-?\d+/g)!.map(Number);
      const tailSegments = strokes[0]
        .split(/ (?=[LCQ] )/)
        .slice(-(join?.tail ?? 0));
      const tailNumbers = tailSegments.join(" ").match(/-?\d+/g)!.length;
      return numbers[numbers.length - tailNumbers - 1];
    };
    for (const letter of "borvw")
      expect(exitY(letter), letter).toBeGreaterThan(250);
    for (const letter of "acdefghijklmnpqstuxyz") {
      expect(exitY(letter), letter).toBeLessThan(250);
    }
  });

  it("has no forms: one shape of every letter", () => {
    for (const letter of LOWER) {
      expect(glyphOf(CURSIVE_UK, letter, { a: "double" })).toBe(
        CURSIVE_UK.glyphs[letter],
      );
      expect(CURSIVE_UK.glyphs[letter].forms).toBeUndefined();
    }
  });
});
