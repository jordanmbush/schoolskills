import { describe, expect, it } from "vitest";

import { parseStroke } from "./glyphs";
import { centreOf, guidesOf } from "./guides";
import { letterInk } from "./strokes";

/** A ⅝ rule's writing space, and the ink a letter takes on it. */
const WRITING = 625;
const INK = letterInk(WRITING);

/** An `a` as the row places it: a bowl and a stem, in mil, y down. */
const BOWL = parseStroke(
  "M 300 130 C 250 65 165 55 110 110 C 55 165 50 265 100 330 C 150 395 235 405 290 350 C 345 295 350 195 300 130",
);
const STEM = parseStroke("M 330 75 L 330 390");

describe("centreOf", () => {
  it("is the middle of the ink's box", () => {
    expect(centreOf([parseStroke("M 0 0 L 100 50")])).toEqual({ x: 50, y: 25 });
    expect(centreOf([STEM, parseStroke("M 10 10 L 20 20")])).toEqual({
      x: 170,
      y: 200,
    });
  });
});

describe("guidesOf", () => {
  const set = guidesOf([BOWL, STEM], WRITING, INK);

  it("puts a dot on every stroke's first point", () => {
    expect(set.guides[0].start).toMatchObject({ x: 300, y: 130 });
    expect(set.guides[1].start).toMatchObject({ x: 330, y: 75 });
    expect(set.dot).toBeGreaterThan(INK.width);
  });

  it("runs the arrow beside the stroke, never on it", () => {
    const [bowl, stem] = set.guides;
    expect(bowl.line.length).toBeGreaterThan(2);
    expect(bowl.head).not.toBeNull();
    // Every point of the stem's arrow is off the stem by the gap.
    for (const point of stem.line) {
      expect(Math.abs(point.x - 330)).toBeGreaterThan(INK.width * 2);
    }
  });

  it("puts the arrow on the side away from the letter's middle", () => {
    const centre = centreOf([BOWL, STEM]);
    const [bowl, stem] = set.guides;
    // The stem is the letter's right edge, so its arrow sits to the right.
    for (const point of stem.line) expect(point.x).toBeGreaterThan(centre.x);
    // The bowl's arrow follows its top, above the ink.
    for (const point of bowl.line) expect(point.y).toBeLessThan(centre.y);
  });

  it("points the head the way the pen goes", () => {
    const stem = set.guides[1];
    const tip = stem.line[stem.line.length - 1];
    const first = stem.line[0];
    expect(tip.y).toBeGreaterThan(first.y);
    // A head pointing down: its base is above its tip.
    const ys = (stem.head?.match(/-?[\d.]+/g) ?? [])
      .map(Number)
      .filter((_, i) => i % 2 === 1);
    expect(ys[0]).toBeGreaterThan(ys[1]);
    expect(ys[0]).toBeGreaterThan(ys[2]);
  });

  it("gives a short stroke its dot and number but no arrow", () => {
    const dash = parseStroke("M 100 100 L 130 100");
    const [only] = guidesOf([dash], WRITING, INK).guides;
    expect(only.line).toEqual([]);
    expect(only.head).toBeNull();
    expect(only.number).toBeDefined();
  });

  it("keeps the numbers clear of the dots, the arrows and each other", () => {
    const clearance = set.numeral * 0.8;
    const [one, two] = set.guides.map((guide) => guide.number);
    expect(Math.hypot(one.x - two.x, one.y - two.y)).toBeGreaterThanOrEqual(
      clearance,
    );
    for (const guide of set.guides) {
      for (const other of set.guides) {
        const gap = Math.hypot(
          guide.number.x - other.start.x,
          guide.number.y - other.start.y,
        );
        expect(gap).toBeGreaterThanOrEqual(clearance);
        for (const point of other.line) {
          expect(
            Math.hypot(guide.number.x - point.x, guide.number.y - point.y),
          ).toBeGreaterThanOrEqual(clearance);
        }
      }
    }
  });

  it("puts a number by the tail of its arrow, further out than the arrow", () => {
    const [only] = guidesOf([STEM], WRITING, INK).guides;
    const tail = only.line[0];
    // Beside the stem where the arrow begins, and past the arrow.
    expect(Math.abs(only.number.y - tail.y)).toBeLessThan(1);
    expect(Math.abs(only.number.x - 330)).toBeGreaterThan(
      Math.abs(tail.x - 330),
    );
    expect(Math.sign(only.number.x - 330)).toBe(Math.sign(tail.x - 330));
  });

  it("falls back to a spot by the dot when a stroke has no arrow", () => {
    const dash = parseStroke("M 100 100 L 130 100");
    const [only] = guidesOf([dash], WRITING, INK).guides;
    expect(Math.hypot(only.number.x - 100, only.number.y - 100)).toBeCloseTo(
      set.numeral * 0.8,
    );
  });
});
