import { describe, expect, it } from "vitest";

import { CURSIVE } from "./cursive";
import { drawable, glyphOf, joinsIn, joinsOut } from "./hand";

/**
 * What the generated cursive module is held to: the same ruling and stroke
 * form as the print hand, and the joins — every small letter takes one and
 * gives one, since the looped model never lifts the pencil inside a word;
 * a capital takes none, and gives one only if it ends on the baseline.
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** The capitals that finish on the baseline and connect to the next letter. */
const JOINING = "ACEIJKLMNQRUXYZ";
/** The capitals that finish in a loop or at the top, after which the pencil lifts. */
const LIFTING = "BDFGHOPSTVW";

const joiningStroke = (letter: string) => {
  const { strokes, join } = CURSIVE.glyphs[letter];
  return strokes[join?.stroke ?? 0];
};

describe("the cursive hand", () => {
  it("is drawn to a ruling, like the print hand", () => {
    expect(CURSIVE.ascent).toBe(1000);
    expect(CURSIVE.xHeight).toBe(500);
    expect(CURSIVE.descent).toBe(-500);
  });

  it("has both alphabets and the seven marks, and no numerals yet", () => {
    expect(drawable(CURSIVE, LOWER)).toBe(true);
    expect(drawable(CURSIVE, UPPER)).toBe(true);
    expect(drawable(CURSIVE, ".,?!'-·")).toBe(true);
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

  it("joins out of the capitals that end on the baseline, into none, and lifts after the rest", () => {
    expect(JOINING.length + LIFTING.length).toBe(26);
    for (const letter of JOINING) {
      const glyph = CURSIVE.glyphs[letter];
      expect(joinsOut(glyph), letter).toBe(true);
      expect(joinsIn(glyph), letter).toBe(false);
      expect(glyph.join?.initial, letter).toBe(true);
      expect(glyph.join?.lead, letter).toBe(0);
      expect(glyph.join?.top, letter).toBeUndefined();
    }
    for (const letter of LIFTING) {
      const glyph = CURSIVE.glyphs[letter];
      expect(glyph.join, letter).toBeUndefined();
      expect(joinsOut(glyph), letter).toBe(false);
    }
  });

  it("joins on the K's arm, written after its stem, and on the first stroke of every other letter", () => {
    expect(CURSIVE.glyphs.K.join?.stroke).toBe(1);
    expect(CURSIVE.glyphs.K.strokes).toHaveLength(2);
    for (const letter of LOWER + JOINING.replace("K", "")) {
      expect(CURSIVE.glyphs[letter].join?.stroke, letter).toBeUndefined();
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
    for (const letter of LOWER + JOINING) {
      const { join } = CURSIVE.glyphs[letter];
      const segments = (joiningStroke(letter).match(/ [LCQ] /g) ?? []).length;
      const kept =
        segments - (join?.lead ?? 0) - (join?.tail ?? 0) - (join?.top ?? 0);
      expect(kept, letter).toBeGreaterThanOrEqual(1);
    }
  });

  it("ends the letters that leave from the midline above half the x-height, and the rest on the baseline", () => {
    // The last point before the tail is where a join sets off from.
    const exitY = (letter: string) => {
      const { join } = CURSIVE.glyphs[letter];
      const stroke = joiningStroke(letter);
      const numbers = stroke.match(/-?\d+/g)!.map(Number);
      const tailSegments = stroke
        .split(/ (?=[LCQ] )/)
        .slice(-(join?.tail ?? 0));
      const tailNumbers = tailSegments.join(" ").match(/-?\d+/g)!.length;
      return numbers[numbers.length - tailNumbers - 1];
    };
    for (const letter of "bovw")
      expect(exitY(letter), letter).toBeGreaterThan(250);
    for (const letter of "acdeghijklmnpqrstuxyz" + JOINING) {
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
