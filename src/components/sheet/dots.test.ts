import { describe, expect, it } from "vitest";

import { dotPath, dotsOf, dottedGrid } from "./dots";
import { parseStroke } from "./glyphs";

const GAP = 10;
const NEAR = 5.5;

const dots = (d: string, grid = dottedGrid(NEAR)) =>
  dotsOf(parseStroke(d), GAP, NEAR, grid);

describe("the dots of a dotted line", () => {
  it("goes a gap apart along a stroke, the first at its start", () => {
    const found = dots("M 0 0 L 45 0");
    expect(found.map((p) => p.x)).toEqual([0, 10, 20, 30, 40]);
    expect(found.every((p) => p.y === 0)).toBe(true);
  });

  it("goes round a curve by its length, not its chord", () => {
    // A half circle of radius 20: 62.8 long, so seven dots including the first.
    const found = dots("M 0 0 C 0 -26.5 40 -26.5 40 0");
    expect(found.length).toBeGreaterThanOrEqual(6);
    expect(found.length).toBeLessThanOrEqual(8);
  });

  it("leaves out a dot that crowds one another stroke has placed", () => {
    const grid = dottedGrid(NEAR);
    dots("M 0 0 L 100 0", grid);
    // A stroke crossing at x=50, dotted every 10 from y=-25: the dot at y=0 lands on the first line's.
    const crossing = dots("M 50 -20 L 50 20", grid);
    expect(crossing.map((p) => p.y)).not.toContain(0);
    expect(crossing.map((p) => p.y)).toContain(-20);
    expect(crossing).toHaveLength(4);
  });

  it("leaves out the first dot of a stroke that starts on a dot already there", () => {
    const grid = dottedGrid(NEAR);
    dots("M 0 0 L 100 0", grid);
    const starts = dots("M 32 0 L 32 30", grid);
    expect(starts[0]).toEqual({ x: 32, y: 10 });
  });

  it("keeps the first dot of a stroke that starts clear of the others", () => {
    const grid = dottedGrid(NEAR);
    dots("M 0 0 L 100 0", grid);
    const starts = dots("M 35 20 L 35 50", grid);
    expect(starts[0]).toEqual({ x: 35, y: 20 });
  });

  it("draws a stretch gone over twice once", () => {
    const grid = dottedGrid(NEAR);
    const first = dots("M 0 0 L 100 0", grid);
    // The same ground again, dotted from an offset start so its dots fall between the first's.
    const again = dots("M 5 0 L 95 0", grid);
    expect(first).toHaveLength(11);
    expect(again).toEqual([]);
  });

  it("does not thin a tight bend against itself", () => {
    const found = dots("M 0 0 C 0 30 12 30 12 0");
    expect(found.length).toBeGreaterThanOrEqual(4);
  });
});

describe("dots as a path", () => {
  it("writes each as a stroke with no length", () => {
    expect(
      dotPath([
        { x: 1, y: 2 },
        { x: 3.04, y: 4 },
      ]),
    ).toBe("M 1 2 h 0 M 3 4 h 0");
  });
});
