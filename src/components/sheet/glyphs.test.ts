import { describe, expect, it } from "vitest";

import {
  along,
  arrowhead,
  beside,
  flatten,
  parseStroke,
  pathOf,
  placeStroke,
  strokeLength,
} from "./glyphs";

describe("parseStroke", () => {
  it("reads the four-command form the ingest writes", () => {
    expect(parseStroke("M 1 2 L 3 4 C 5 6 7 8 9 10 Q 11 12 13 14")).toEqual([
      { type: "M", points: [1, 2] },
      { type: "L", points: [3, 4] },
      { type: "C", points: [5, 6, 7, 8, 9, 10] },
      { type: "Q", points: [11, 12, 13, 14] },
    ]);
    expect(parseStroke("M -3 0.5 L 3 -4")[1].points).toEqual([3, -4]);
  });

  it("refuses anything else, because the data module is generated", () => {
    expect(() => parseStroke("M 0 0 l 1 1")).toThrow(/bad stroke/);
    expect(() => parseStroke("M 0 0 L 1")).toThrow(/bad stroke/);
    expect(() => parseStroke("M 0 0 Z")).toThrow(/bad stroke/);
  });
});

describe("placeStroke", () => {
  it("scales, moves and turns y over", () => {
    // A stem from the top line (1000) to the baseline (0), at half a mil a
    // unit, origin x=100, baseline y=800.
    const placed = placeStroke("M 60 1000 L 60 0", 100, 800, 0.5);
    expect(pathOf(placed)).toBe("M 130 300 L 130 800");
  });

  it("keeps a tail below the baseline", () => {
    const placed = placeStroke("M 0 0 L 0 -500", 0, 800, 0.5);
    expect(placed[1].points).toEqual([0, 1050]);
  });

  it("writes tenths, not long fractions", () => {
    expect(pathOf(placeStroke("M 1 1", 0, 0, 0.3333))).toBe("M 0.3 -0.3");
  });
});

describe("walking a stroke", () => {
  it("measures a straight stroke exactly", () => {
    const segments = parseStroke("M 0 0 L 30 40");
    expect(strokeLength(segments)).toBe(50);
    const mid = along(segments, 25);
    expect(mid.x).toBeCloseTo(15);
    expect(mid.y).toBeCloseTo(20);
    expect(mid.angle).toBeCloseTo(Math.atan2(40, 30));
  });

  it("measures a curve to within a flattening step", () => {
    // A quarter circle of radius 100 as one cubic: length 157.08.
    const segments = parseStroke("M 100 0 C 100 55.2 55.2 100 0 100");
    expect(strokeLength(segments)).toBeGreaterThan(156);
    expect(strokeLength(segments)).toBeLessThan(157.2);
    expect(flatten(segments)).toHaveLength(13);
  });

  it("clamps to the ends and faces right on a dot", () => {
    const segments = parseStroke("M 0 0 L 10 0");
    expect(along(segments, 99)).toEqual({ x: 10, y: 0, angle: 0 });
    expect(along(segments, -5)).toEqual({ x: 0, y: 0, angle: 0 });
    expect(along(parseStroke("M 5 5"), 3)).toEqual({ x: 5, y: 5, angle: 0 });
  });
});

describe("beside", () => {
  it("runs parallel to a straight stroke, one gap off it", () => {
    const line = parseStroke("M 0 0 L 100 0");
    const right = beside(line, 20, 60, 5, 1, 4);
    expect(right).toEqual([
      { x: 20, y: 5 },
      { x: 30, y: 5 },
      { x: 40, y: 5 },
      { x: 50, y: 5 },
      { x: 60, y: 5 },
    ]);
    const left = beside(line, 20, 60, 5, -1, 4);
    expect(left.every((p) => p.y === -5)).toBe(true);
  });

  it("clamps the stretch to the stroke and gives nothing for no length", () => {
    const line = parseStroke("M 0 0 L 10 0");
    expect(beside(line, -5, 50, 1, 1, 2).map((p) => p.x)).toEqual([0, 5, 10]);
    // A stretch of no length is the one spot beside the stroke there.
    expect(beside(line, 8, 4, 1, 1)).toEqual([{ x: 8, y: 1 }]);
    expect(beside(parseStroke("M 3 3"), 0, 1, 1, 1)).toEqual([]);
  });

  it("follows a curve", () => {
    // A quarter circle of radius 100 from (100, 0) round to (0, 100): the
    // outside is further from the origin than the curve, the inside nearer.
    const arc = parseStroke("M 100 0 C 100 55.2 55.2 100 0 100");
    const outside = beside(arc, 0, 157, 10, -1, 6);
    const inside = beside(arc, 0, 157, 10, 1, 6);
    for (const p of outside) expect(Math.hypot(p.x, p.y)).toBeGreaterThan(105);
    for (const p of inside) expect(Math.hypot(p.x, p.y)).toBeLessThan(95);
  });
});

describe("arrowhead", () => {
  it("is a closed triangle with its point at the tip", () => {
    const d = arrowhead(10, 0, 0, 4, 3);
    expect(d).toBe("M 10 0 L 6 -1.5 L 6 1.5 Z");
    // Pointing down the page: the base is above the tip.
    const down = arrowhead(0, 10, Math.PI / 2, 4, 3);
    const numbers = down.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    expect(numbers[3]).toBeCloseTo(6);
    expect(numbers[5]).toBeCloseTo(6);
    expect(numbers[2]).toBeCloseTo(-numbers[4]);
  });
});
