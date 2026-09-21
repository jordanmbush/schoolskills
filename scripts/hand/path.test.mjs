import { describe, expect, it } from "vitest";

import {
  absolute,
  bounds,
  parseTransform,
  rounded,
  serialise,
  transformed,
} from "./path.mjs";

describe("absolute", () => {
  it("keeps the four commands as they are", () => {
    expect(absolute("M 1 2 L 3 4 C 5 6 7 8 9 10 Q 11 12 13 14")).toEqual([
      { type: "M", points: [1, 2] },
      { type: "L", points: [3, 4] },
      { type: "C", points: [5, 6, 7, 8, 9, 10] },
      { type: "Q", points: [11, 12, 13, 14] },
    ]);
  });

  it("makes relative commands absolute from the current point", () => {
    expect(absolute("m 10 20 l 5 5 c 1 1 2 2 3 3")).toEqual([
      { type: "M", points: [10, 20] },
      { type: "L", points: [15, 25] },
      { type: "C", points: [16, 26, 17, 27, 18, 28] },
    ]);
  });

  it("reads implicit repeats, and a repeat after a move as a line", () => {
    expect(absolute("M 0 0 10 0 10 10")).toEqual([
      { type: "M", points: [0, 0] },
      { type: "L", points: [10, 0] },
      { type: "L", points: [10, 10] },
    ]);
    expect(absolute("m 0 0 10 0 10 10")).toEqual([
      { type: "M", points: [0, 0] },
      { type: "L", points: [10, 0] },
      { type: "L", points: [20, 10] },
    ]);
    expect(absolute("M 0 0 c 1 1 2 2 3 3 1 1 2 2 3 3")).toHaveLength(3);
  });

  it("rewrites H and V as lines", () => {
    expect(absolute("M 1 2 H 10 V 20 h 5 v -5")).toEqual([
      { type: "M", points: [1, 2] },
      { type: "L", points: [10, 2] },
      { type: "L", points: [10, 20] },
      { type: "L", points: [15, 20] },
      { type: "L", points: [15, 15] },
    ]);
  });

  it("expands the shorthand curves by reflecting the last control point", () => {
    expect(absolute("M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0")).toEqual([
      { type: "M", points: [0, 0] },
      { type: "C", points: [0, 10, 10, 10, 10, 0] },
      { type: "C", points: [10, -10, 20, -10, 20, 0] },
    ]);
    expect(absolute("M 0 0 Q 5 10 10 0 T 20 0")).toEqual([
      { type: "M", points: [0, 0] },
      { type: "Q", points: [5, 10, 10, 0] },
      { type: "Q", points: [15, -10, 20, 0] },
    ]);
    // After anything but a curve of the same kind, the control point is the
    // current point.
    expect(absolute("M 0 0 L 10 0 S 20 10 20 0")[2]).toEqual({
      type: "C",
      points: [10, 0, 20, 10, 20, 0],
    });
  });

  it("reads the number forms a tool writes", () => {
    expect(absolute("M10-5L.5,1.5e1")).toEqual([
      { type: "M", points: [10, -5] },
      { type: "L", points: [0.5, 15] },
    ]);
  });

  it("refuses a closed path and an arc, naming the fix", () => {
    expect(() => absolute("M 0 0 L 10 0 Z")).toThrow(/closed path/);
    expect(() => absolute("M 0 0 A 5 5 0 0 1 10 0")).toThrow(/arc/);
  });

  it("refuses data that is not a path", () => {
    expect(() => absolute("")).toThrow(/empty/);
    expect(() => absolute("1 2 3")).toThrow(/starts with a number/);
    expect(() => absolute("L 1 2")).toThrow(/start with M/);
    expect(() => absolute("M 1")).toThrow(/ran out/);
  });
});

describe("parseTransform", () => {
  it("is the identity when there is nothing to do", () => {
    expect(parseTransform(undefined)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(parseTransform("  ")).toEqual([1, 0, 0, 1, 0, 0]);
  });

  it("reads the four forms and composes them left to right", () => {
    expect(parseTransform("translate(10, 20)")).toEqual([1, 0, 0, 1, 10, 20]);
    expect(parseTransform("scale(2)")).toEqual([2, 0, 0, 2, 0, 0]);
    expect(parseTransform("scale(2 3)")).toEqual([2, 0, 0, 3, 0, 0]);
    expect(parseTransform("matrix(1 2 3 4 5 6)")).toEqual([1, 2, 3, 4, 5, 6]);
    // Translate then scale: a point at (1, 1) scales to (2, 2), then moves.
    const m = parseTransform("translate(10 10) scale(2)");
    expect(transformed([{ type: "M", points: [1, 1] }], m)[0].points).toEqual([
      12, 12,
    ]);
  });

  it("rotates about a centre when given one", () => {
    const m = parseTransform("rotate(90 10 10)");
    const [x, y] = transformed([{ type: "M", points: [20, 10] }], m)[0].points;
    expect(x).toBeCloseTo(10);
    expect(y).toBeCloseTo(20);
  });

  it("refuses what it does not read", () => {
    expect(() => parseTransform("skewX(10)")).toThrow(/unsupported/);
    expect(() => parseTransform("matrix(1 2 3)")).toThrow(/6 numbers/);
  });
});

describe("the written form", () => {
  it("rounds, serialises and bounds", () => {
    const segments = rounded(
      absolute("M 0.4 0.6 C 1.5 2.5 3.4 4.4 5 6 L -2.6 10.2"),
    );
    expect(serialise(segments)).toBe("M 0 1 C 2 3 3 4 5 6 L -3 10");
    expect(bounds(segments)).toEqual({ minX: -3, maxX: 5, minY: 1, maxY: 10 });
  });
});
