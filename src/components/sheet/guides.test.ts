import { describe, expect, it } from "vitest";

import { flatten, parseStroke, type Point } from "./glyphs";
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

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** The distance from a point to a stroke's ink, walked as a polyline. */
function offInk(p: Point, stroke: ReturnType<typeof parseStroke>): number {
  const line = flatten(stroke);
  let best = Infinity;
  for (let i = 1; i < line.length; i += 1) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = dx * dx + dy * dy || 1;
    const t = Math.min(
      Math.max(((p.x - a.x) * dx + (p.y - a.y) * dy) / span, 0),
      1,
    );
    best = Math.min(best, distance(p, { x: a.x + t * dx, y: a.y + t * dy }));
  }
  return best;
}

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

  it("points the head the way the pen goes, past the end of the shaft", () => {
    const stem = set.guides[1];
    const last = stem.line[stem.line.length - 1];
    const first = stem.line[0];
    expect(last.y).toBeGreaterThan(first.y);
    // A head pointing down: its tip is below its base, and the shaft stops
    // where the base begins rather than running on under it.
    const numbers = (stem.head?.match(/-?[\d.]+/g) ?? []).map(Number);
    const [tipX, tipY, , baseY] = numbers;
    expect(tipY).toBeGreaterThan(baseY);
    expect(Math.abs(tipX - last.x)).toBeLessThan(1);
    expect(tipY - last.y).toBeCloseTo(INK.width * 2.6, 0);
  });

  it("gives a short stroke its dot and number but no arrow", () => {
    const dash = parseStroke("M 100 100 L 130 100");
    const [only] = guidesOf([dash], WRITING, INK).guides;
    expect(only.line).toEqual([]);
    expect(only.head).toBeNull();
    expect(only.number).toBeDefined();
  });

  it("keeps the numbers off the ink, the dots and each other", () => {
    // The layout aims at a little under half a numeral from its center — its
    // edge, near enough — and trades a hair of that for a better spot.
    const edge = set.numeral * 0.4;
    const [one, two] = set.guides.map((guide) => guide.number);
    expect(distance(one, two)).toBeGreaterThanOrEqual(set.numeral * 0.9);
    for (const guide of set.guides) {
      for (const stroke of [BOWL, STEM]) {
        expect(offInk(guide.number, stroke)).toBeGreaterThanOrEqual(edge);
      }
      for (const other of set.guides) {
        expect(distance(guide.number, other.start)).toBeGreaterThanOrEqual(
          edge + set.dot,
        );
      }
    }
  });

  it("sits a number against the tail of its own arrow", () => {
    for (const guide of set.guides) {
      expect(distance(guide.number, guide.line[0])).toBeCloseTo(
        set.numeral * 0.65,
        0,
      );
    }
    // A lone stem: the number is behind the tail, on the arrow's side.
    const [only] = guidesOf([STEM], WRITING, INK).guides;
    const tail = only.line[0];
    expect(only.number.y).toBeLessThan(tail.y);
    expect(Math.sign(only.number.x - 330)).toBe(Math.sign(tail.x - 330));
  });

  it("slides an arrow along a stroke that another stroke cuts across", () => {
    const stem = parseStroke("M 100 0 L 100 600");
    const bar = parseStroke("M 40 150 L 200 150");
    const [down, across] = guidesOf([stem, bar], WRITING, INK).guides;
    // The stem's arrow would have run through the bar; it moved past it.
    expect(down.line.length).toBeGreaterThan(0);
    for (const point of down.line) expect(point.y).toBeGreaterThan(150 + 40);
    expect(offInk(down.number, bar)).toBeGreaterThanOrEqual(set.numeral * 0.4);
    // The bar is too short to run anywhere but across the stem, and does.
    expect(across.head).not.toBeNull();
  });

  it("falls back to a spot by the dot when a stroke has no arrow", () => {
    const dash = parseStroke("M 100 100 L 130 100");
    const [only] = guidesOf([dash], WRITING, INK).guides;
    expect(Math.hypot(only.number.x - 100, only.number.y - 100)).toBeCloseTo(
      set.numeral * 0.8,
    );
  });
});
