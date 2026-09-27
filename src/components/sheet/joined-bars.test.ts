import { describe, expect, it } from "vitest";

import { joined, type Ground, type Placed } from "./joined";
import type { Segment } from "./glyphs";

const GROUND: Ground = { baseline: 1000, xHeight: 500 };

const line = (x1: number, x2: number, y: number): Segment[] => [
  { type: "M", points: [x1, y] },
  { type: "L", points: [x2, y] },
];

/** A small letter whose joining stroke is a body of three segments and which comes back for one bar. */
const letter = (at: number, bar: Segment[] | null): Placed => ({
  strokes: [
    [
      { type: "M", points: [at, 1000] },
      { type: "L", points: [at + 20, 900] },
      { type: "L", points: [at + 60, 500] },
      { type: "L", points: [at + 100, 900] },
      { type: "L", points: [at + 140, 1000] },
    ],
    ...(bar === null ? [] : [bar]),
  ],
  join: { lead: 1, tail: 1 },
});

const bars = (letters: Placed[]) =>
  joined(letters, GROUND)
    .flat()
    .filter((stroke) => stroke.length === 2 && stroke[1].type === "L");

describe("crossbars that meet", () => {
  it("crosses two level bars that nearly meet with one", () => {
    const found = bars([
      letter(0, line(0, 300, 600)),
      letter(400, line(400, 700, 600)),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0][0].points).toEqual([0, 600]);
    expect(found[0][1].points).toEqual([700, 600]);
  });

  it("leaves bars that are far apart, at different heights, or too short to be one", () => {
    const apart = bars([
      letter(0, line(0, 300, 600)),
      letter(900, line(900, 1200, 600)),
    ]);
    expect(apart).toHaveLength(2);
    const stepped = bars([
      letter(0, line(0, 300, 600)),
      letter(400, line(400, 700, 560)),
    ]);
    expect(stepped).toHaveLength(2);
    const dots = bars([
      letter(0, line(0, 300, 600)),
      letter(400, line(400, 400, 600)),
    ]);
    expect(dots).toHaveLength(2);
  });

  it("carries one bar across three letters", () => {
    const found = bars([
      letter(0, line(0, 300, 600)),
      letter(400, line(400, 700, 600)),
      letter(800, line(800, 1100, 600)),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0][1].points).toEqual([1100, 600]);
  });

  it("does nothing without the ground to measure against", () => {
    const found = joined([
      letter(0, line(0, 300, 600)),
      letter(400, line(400, 700, 600)),
    ])
      .flat()
      .filter((stroke) => stroke.length === 2 && stroke[1].type === "L");
    expect(found).toHaveLength(2);
  });
});
