import { describe, expect, it } from "vitest";

import {
  GRID_PITCHES,
  MARGINS,
  PAPERS,
  RULINGS,
  gridPitch,
  inches,
  marginOf,
  mm,
  pageSize,
  points,
  ruleLines,
  rulePitch,
  rulingOf,
  toInches,
  toMm,
  toPoints,
} from "./paper";
import type { MarginSize, Paper, PaperSize, Rule, RuleStyle } from "./types";

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

describe("units", () => {
  it("counts a thousandth of an inch, whichever unit the size was quoted in", () => {
    expect(inches(1)).toBe(1000);
    expect(mm(25.4)).toBe(1000);
    expect(points(72)).toBe(1000);
  });

  it("converts back for the renderer, which has to write CSS in real units", () => {
    expect(toInches(625)).toBeCloseTo(0.625, 6);
    expect(toMm(500)).toBeCloseTo(12.7, 6);
    expect(toPoints(1000)).toBeCloseTo(72, 6);
  });

  it("stays a whole number, so a pitch can't drift", () => {
    for (const value of [0.625, 0.34375, 1 / 3, 11 / 32]) {
      expect(Number.isInteger(inches(value))).toBe(true);
    }
  });
});

describe("stock", () => {
  it("is the size the standard says it is", () => {
    expect(PAPERS.letter).toMatchObject({ width: 8500, height: 11000 });
    expect(PAPERS.legal).toMatchObject({ width: 8500, height: 14000 });
    // A4 is metric, so it lands on a whole thousandth only approximately —
    // within eight microns, which no printer and no child can find.
    expect(toMm(PAPERS.a4.width)).toBeCloseTo(210, 1);
    expect(toMm(PAPERS.a4.height)).toBeCloseTo(297, 1);
  });

  it("defaults every stock to the same half inch of margin", () => {
    // Which is why §4 quotes A4's default as 12.7mm: it is the same number.
    expect(MARGINS.normal).toBe(inches(0.5));
    expect(toMm(MARGINS.normal)).toBeCloseTo(12.7, 6);
  });

  it("turns the page over for landscape", () => {
    expect(pageSize(paper())).toEqual({ width: 8500, height: 11000 });
    expect(pageSize(paper({ orientation: "landscape" }))).toEqual({
      width: 11000,
      height: 8500,
    });
  });
});

describe("the rulings of §5", () => {
  it("gives every handwriting size the pitch it is named after", () => {
    expect(RULINGS["hand-1"].pitch).toBe(inches(1));
    expect(RULINGS["hand-3-4"].pitch).toBe(inches(0.75));
    expect(RULINGS["hand-5-8"].pitch).toBe(inches(0.625));
    expect(RULINGS["hand-1-2"].pitch).toBe(inches(0.5));
    expect(RULINGS["hand-3-8"].pitch).toBe(inches(0.375));
  });

  it("rules a notebook at 11/32 and 9/32, to the nearest thousandth", () => {
    expect(toInches(RULINGS.wide.pitch)).toBeCloseTo(11 / 32, 3);
    expect(toInches(RULINGS.college.pitch)).toBeCloseTo(9 / 32, 3);
    expect(RULINGS.narrow.pitch).toBe(inches(0.25));
  });

  it("puts the margin line on the two rulings that have one", () => {
    expect(RULINGS.wide.marginLine).toBe(inches(1.25));
    expect(RULINGS.college.marginLine).toBe(inches(1.25));
    expect(RULINGS.narrow.marginLine).toBeUndefined();
    expect(RULINGS["hand-5-8"].marginLine).toBeUndefined();
  });

  it("offers the four squares a grid can be drawn at", () => {
    expect(GRID_PITCHES["quarter-inch"]).toBe(inches(0.25));
    expect(GRID_PITCHES["fifth-inch"]).toBe(inches(0.2));
    expect(toMm(GRID_PITCHES.centimetre)).toBeCloseTo(10, 1);
    expect(toMm(GRID_PITCHES["half-centimetre"])).toBeCloseTo(5, 1);
  });

  it("answers for a ruling this build has never heard of", () => {
    // Same promise as `deckSpec`: a sheet saved last term must still print
    // after its ruling was renamed. Blank paper is the honest fallback.
    const retired = { style: "hand-9-16" as RuleStyle };
    expect(rulingOf(retired).id).toBe("blank");
    expect(ruleLines(retired)).toEqual([]);
    expect(rulePitch(retired)).toBe(0);
  });

  it("is not fooled by a style that names something on Object.prototype", () => {
    // The fallback exists for strings from outside this build, and these are
    // strings from outside this build. Looked up with `??` they resolve to an
    // inherited function, which is truthy, so `ruling.pitch` is undefined and
    // every length computed from it turns into NaN without a single throw.
    for (const style of ["toString", "constructor", "valueOf"]) {
      const stale = { style: style as RuleStyle };
      expect(rulingOf(stale).id).toBe("blank");
      expect(rulePitch(stale)).toBe(0);
      expect(gridPitch(stale)).toBe(0);
      expect(ruleLines(stale)).toEqual([]);
    }
  });

  it("falls back to Letter and normal margins for the same reason", () => {
    const stale = paper({
      size: "constructor" as PaperSize,
      margin: "toString" as MarginSize,
    });
    expect(pageSize(stale)).toEqual({ width: 8500, height: 11000 });
    expect(marginOf(stale)).toBe(MARGINS.normal);
  });
});

describe("ruleLines", () => {
  const hand = (over: Partial<Rule> = {}): Rule => ({
    style: "hand-5-8",
    ...over,
  });

  it("draws a handwriting set as top, midline and baseline", () => {
    expect(ruleLines(hand())).toEqual([
      { at: 0, role: "top", dashed: false },
      { at: 313, role: "mid", dashed: true },
      { at: 625, role: "base", dashed: false },
    ]);
  });

  it("takes the descender space out of the repeat, not out of the pitch", () => {
    // The tail space is a third of the repeat, so the writing space shrinks
    // and the ⅝ paper stays ⅝ paper. Anything else would silently reprice
    // every ruling the moment a parent ticked the box.
    const lines = ruleLines(hand({ descender: true }));
    expect(lines.at(-1)).toEqual({ at: 417, role: "base", dashed: false });
    expect(rulePitch(hand({ descender: true }))).toBe(625);
  });

  it("dashes the midline unless asked not to", () => {
    expect(ruleLines(hand())[1].dashed).toBe(true);
    expect(ruleLines(hand({ midline: "solid" }))[1].dashed).toBe(false);
    expect(ruleLines(hand({ midline: "none" })).map((l) => l.role)).toEqual([
      "top",
      "base",
    ]);
  });

  it("gives a notebook rule one line, at the foot of its repeat", () => {
    // You write on top of the line, so it belongs at the bottom of the space.
    expect(ruleLines({ style: "college" })).toEqual([
      { at: RULINGS.college.pitch, role: "line", dashed: false },
    ]);
  });

  it("leaves grid rulings to the renderer", () => {
    // Two pitches and a stroke pattern, not a list of offsets.
    for (const style of ["graph", "dot", "isometric"] as const) {
      expect(ruleLines({ style })).toEqual([]);
    }
  });
});

describe("grid pitches", () => {
  it("lets a graph or dot sheet override the square", () => {
    expect(gridPitch({ style: "graph" })).toBe(inches(0.25));
    expect(gridPitch({ style: "graph", pitch: GRID_PITCHES.centimetre })).toBe(
      GRID_PITCHES.centimetre,
    );
  });

  it("ignores an override on a ruling that doesn't have squares", () => {
    expect(rulePitch({ style: "hand-5-8", pitch: 999 })).toBe(625);
    // And reports no square at all, rather than the vertical pitch: a
    // handwriting rule has no grid for a renderer to draw.
    expect(gridPitch({ style: "hand-5-8", pitch: 999 })).toBe(0);
    expect(gridPitch({ style: "college" })).toBe(0);
  });

  it("spaces isometric rows by the height of the triangle, not its side", () => {
    // A quarter-inch side at 30° puts the rows 0.2165in apart. Using the side
    // would stretch the grid vertically and stop it being isometric at all.
    expect(gridPitch({ style: "isometric" })).toBe(250);
    expect(rulePitch({ style: "isometric" })).toBe(217);
    expect(toInches(rulePitch({ style: "isometric" }))).toBeCloseTo(0.2165, 2);
  });
});
