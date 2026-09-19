import { describe, expect, it } from "vitest";

import { CURSIVE } from "./cursive";
import { drawable, glyphOf, joinsIn, joinsOut } from "./hand";

/**
 * What the generated cursive module is held to: the same ruling and stroke
 * form as the print hand, and the joins — every small letter takes one and
 * gives one, since the looped model never lifts the pencil inside a word.
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

const LOWER = "abcdefghijklmnopqrstuvwxyz";

describe("the cursive hand", () => {
  it("is drawn to a ruling, like the print hand", () => {
    expect(CURSIVE.ascent).toBe(1000);
    expect(CURSIVE.xHeight).toBe(500);
    expect(CURSIVE.descent).toBe(-500);
  });

  it("has every small letter and the seven marks, and no capitals yet", () => {
    expect(drawable(CURSIVE, LOWER)).toBe(true);
    expect(drawable(CURSIVE, ".,?!'-·")).toBe(true);
    expect(drawable(CURSIVE, "A")).toBe(false);
    expect(drawable(CURSIVE, "5")).toBe(false);
  });

  it("stores every stroke in the four-command absolute form", () => {
    for (const [character, glyph] of Object.entries(CURSIVE.glyphs)) {
      expect(glyph.strokes.length, character).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) expect(stroke).toMatch(FOUR);
    }
  });

  it("joins every small letter in and out, and no mark", () => {
    for (const letter of LOWER) {
      const glyph = CURSIVE.glyphs[letter];
      expect(joinsIn(glyph), letter).toBe(true);
      expect(joinsOut(glyph), letter).toBe(true);
    }
    for (const mark of ".,?!'-·") {
      expect(joinsIn(CURSIVE.glyphs[mark]), mark).toBe(false);
    }
  });

  it("leads in from the baseline on the letters that start with a rise, and not on the round ones", () => {
    for (const letter of "bfhijklprstuy") {
      expect(CURSIVE.glyphs[letter].join?.lead, letter).toBeGreaterThan(0);
    }
    for (const letter of "acdgmnoqvwxz") {
      expect(CURSIVE.glyphs[letter].join?.lead, letter).toBe(0);
    }
  });

  it("lets a bridge from the midline run along the top of a round letter", () => {
    for (const letter of "acdegoq") {
      expect(CURSIVE.glyphs[letter].join?.top, letter).toBeGreaterThan(0);
    }
    for (const letter of "bfhijklmnprstuvwxyz") {
      expect(CURSIVE.glyphs[letter].join?.top, letter).toBeUndefined();
    }
  });

  it("keeps enough of every joining stroke for a join to land on", () => {
    for (const letter of LOWER) {
      const { strokes, join } = CURSIVE.glyphs[letter];
      const segments = (strokes[0].match(/ [LCQ] /g) ?? []).length;
      const kept =
        segments - (join?.lead ?? 0) - (join?.tail ?? 0) - (join?.top ?? 0);
      expect(kept, letter).toBeGreaterThanOrEqual(1);
    }
  });

  it("ends the letters that leave from the midline above half the x-height, and the rest on the baseline", () => {
    // The last point before the tail is where a join sets off from.
    const exitY = (letter: string) => {
      const { strokes, join } = CURSIVE.glyphs[letter];
      const numbers = strokes[0].match(/-?\d+/g)!.map(Number);
      const tailSegments = strokes[0]
        .split(/ (?=[LCQ] )/)
        .slice(-(join?.tail ?? 0));
      const tailNumbers = tailSegments.join(" ").match(/-?\d+/g)!.length;
      return numbers[numbers.length - tailNumbers - 1];
    };
    for (const letter of "bovw")
      expect(exitY(letter), letter).toBeGreaterThan(250);
    for (const letter of "acdeghijklmnpqrstuxyz") {
      expect(exitY(letter), letter).toBeLessThan(250);
    }
  });

  it("has no forms: one shape of every letter", () => {
    for (const letter of LOWER) {
      expect(glyphOf(CURSIVE, letter, { a: "double" })).toBe(
        CURSIVE.glyphs[letter],
      );
      expect(CURSIVE.glyphs[letter].forms).toBeUndefined();
    }
  });
});
