import { describe, expect, it } from "vitest";

import { CURSIVE_MODERN } from "./cursive-modern";
import { drawable, glyphOf, joinsIn, joinsOut } from "./hand";

/**
 * What the generated unlooped American module is held to: the same ruling
 * and stroke form as the other hands, print capitals that never join, and
 * the model's own answer to which letters the pencil lifts after (§6) —
 * those are drawn with no tail, and every small letter joins in.
 */
const FOUR = /^M -?\d+ -?\d+( (L -?\d+ -?\d+|C( -?\d+){6}|Q( -?\d+){4}))*$/;

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
/** The letters the model lifts the pencil after. */
const BREAKS = "bfgjpqsy";
/** The letters that, written alone, start with a short rise from the left. */
const RISING = "mnr";

describe("the unlooped cursive hand", () => {
  it("is drawn to a ruling, like the other hands", () => {
    expect(CURSIVE_MODERN.ascent).toBe(1000);
    expect(CURSIVE_MODERN.xHeight).toBe(500);
    expect(CURSIVE_MODERN.descent).toBe(-500);
  });

  it("has both alphabets and the seven marks, and no numerals yet", () => {
    expect(drawable(CURSIVE_MODERN, LOWER)).toBe(true);
    expect(drawable(CURSIVE_MODERN, UPPER)).toBe(true);
    expect(drawable(CURSIVE_MODERN, ".,?!'-·")).toBe(true);
    expect(drawable(CURSIVE_MODERN, "5")).toBe(false);
  });

  it("stores every stroke in the four-command absolute form", () => {
    for (const [character, glyph] of Object.entries(CURSIVE_MODERN.glyphs)) {
      expect(glyph.strokes.length, character).toBeGreaterThan(0);
      for (const stroke of glyph.strokes) expect(stroke).toMatch(FOUR);
    }
  });

  it("joins into every small letter, and out of all but the eight the pencil lifts after", () => {
    for (const letter of LOWER) {
      const glyph = CURSIVE_MODERN.glyphs[letter];
      expect(joinsIn(glyph), letter).toBe(true);
      expect(joinsOut(glyph), letter).toBe(!BREAKS.includes(letter));
    }
    for (const letter of BREAKS) {
      expect(CURSIVE_MODERN.glyphs[letter].join?.tail, letter).toBe(0);
    }
    for (const mark of ".,?!'-·") {
      expect(joinsIn(CURSIVE_MODERN.glyphs[mark]), mark).toBe(false);
    }
  });

  it("draws print capitals, and none of them joins", () => {
    for (const letter of UPPER) {
      const glyph = CURSIVE_MODERN.glyphs[letter];
      expect(glyph.join, letter).toBeUndefined();
      expect(joinsIn(glyph), letter).toBe(false);
      expect(joinsOut(glyph), letter).toBe(false);
    }
  });

  it("leads in only on the three letters that start with a rise, and on none from the baseline", () => {
    for (const letter of LOWER) {
      const lead = CURSIVE_MODERN.glyphs[letter].join?.lead;
      if (RISING.includes(letter)) expect(lead, letter).toBeGreaterThan(0);
      else expect(lead, letter).toBe(0);
    }
  });

  it("lets a bridge from the midline run along the top of a round letter", () => {
    for (const letter of "acdgoq") {
      expect(CURSIVE_MODERN.glyphs[letter].join?.top, letter).toBeGreaterThan(
        0,
      );
    }
    for (const letter of "befhijklmnprstuvwxyz") {
      expect(CURSIVE_MODERN.glyphs[letter].join?.top, letter).toBeUndefined();
    }
  });

  it("keeps enough of every joining stroke for a join to land on", () => {
    for (const letter of LOWER) {
      const { strokes, join } = CURSIVE_MODERN.glyphs[letter];
      const segments = (strokes[0].match(/ [LCQ] /g) ?? []).length;
      const kept =
        segments - (join?.lead ?? 0) - (join?.tail ?? 0) - (join?.top ?? 0);
      expect(kept, letter).toBeGreaterThanOrEqual(1);
    }
  });

  it("ends the letters that leave from the midline above half the x-height, and the rest on the baseline", () => {
    // The last point before the tail is where a join sets off from.
    const exitY = (letter: string) => {
      const { strokes, join } = CURSIVE_MODERN.glyphs[letter];
      const numbers = strokes[0].match(/-?\d+/g)!.map(Number);
      const tailSegments = strokes[0]
        .split(/ (?=[LCQ] )/)
        .slice(-(join?.tail ?? 0));
      const tailNumbers = tailSegments.join(" ").match(/-?\d+/g)!.length;
      return numbers[numbers.length - tailNumbers - 1];
    };
    for (const letter of "orvw")
      expect(exitY(letter), letter).toBeGreaterThan(250);
    for (const letter of "acdehiklmntuxz") {
      expect(exitY(letter), letter).toBeLessThan(250);
    }
  });

  it("has no forms: one shape of every letter", () => {
    for (const letter of LOWER) {
      expect(glyphOf(CURSIVE_MODERN, letter, { a: "double" })).toBe(
        CURSIVE_MODERN.glyphs[letter],
      );
      expect(CURSIVE_MODERN.glyphs[letter].forms).toBeUndefined();
    }
  });
});
