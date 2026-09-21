import { describe, expect, it } from "vitest";

import { assemble, splitId } from "./forms.mjs";

const HAND = { forms: { a: ["single", "double"], t: ["curved", "straight"] } };
const drawing = (advance) => ({ advance, strokes: ["M 60 0 L 60 500"] });

describe("splitId", () => {
  it("splits a form off after the dot and leaves a plain stem alone", () => {
    expect(splitId("a.double")).toEqual({ stem: "a", form: "double" });
    expect(splitId("period")).toEqual({ stem: "period", form: undefined });
    expect(splitId("A_.single")).toEqual({ stem: "A_", form: "single" });
  });
});

describe("assemble", () => {
  it("folds the forms of a letter into one glyph, the hand's own on top", () => {
    const warnings = [];
    const glyphs = assemble(
      HAND,
      [
        { character: "a", form: "double", glyph: drawing(400) },
        { character: "a", form: "single", glyph: drawing(600) },
        { character: "e", form: undefined, glyph: drawing(500) },
      ],
      warnings,
    );
    expect(glyphs.a).toEqual({
      ...drawing(600),
      forms: { own: "single", alternates: { double: drawing(400) } },
    });
    expect(glyphs.e).toEqual(drawing(500));
    expect(warnings).toEqual([]);
  });

  it("warns of a listed form not drawn yet, and refuses a missing own form", () => {
    const warnings = [];
    const glyphs = assemble(
      HAND,
      [{ character: "t", form: "curved", glyph: drawing(500) }],
      warnings,
    );
    expect(glyphs.t.forms).toEqual({ own: "curved", alternates: {} });
    expect(warnings).toEqual(['t: no "straight" form drawn yet']);
    expect(() =>
      assemble(HAND, [
        { character: "t", form: "straight", glyph: drawing(500) },
      ]),
    ).toThrow(/t: the hand's own "curved" form is not drawn/);
  });
});
