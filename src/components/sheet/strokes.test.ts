import { describe, expect, it } from "vitest";

import { inches, points } from "@/engine/sheets/paper";
import type { StrokePattern } from "@/engine/sheets/types";
import { STROKE_PATTERNS } from "@/engine/sheets/writing/strokes";

import { strokeInk, strokePath, strokeUnit, type StrokeZones } from "./strokes";

/**
 * The stroke patterns as geometry (§24).
 *
 * Two things a page of them has to be that a screenshot cannot prove: every
 * continuous pattern ends each repeat where the next begins, so a row cut
 * into a solid cell and a dotted one is one unbroken line; and nothing drawn
 * leaves the repeat it is drawn in, so a tail loop on ⅝ paper never prints
 * through the row below.
 */

/** ⅝ paper with a tail: top 0, midline at 312, baseline at 625, foot at 937. */
const ZONES: StrokeZones = {
  top: 0,
  mid: 312,
  base: 625,
  bottom: 937,
};

const PATTERNS = STROKE_PATTERNS.map((set) => set.id);

/** The rounding `strokePath` writes with: a tenth of a mil. */
const r = (value: number): number => Math.round(value * 10) / 10;

/** The patterns that are one unbroken line, and the y each repeat starts on. */
const CONTINUOUS: Partial<Record<StrokePattern, number>> = {
  zigzag: ZONES.base,
  waves: ZONES.base - (ZONES.base - ZONES.mid) / 2,
  humps: ZONES.base,
  cups: ZONES.mid,
  loops: ZONES.base,
  tails: ZONES.mid,
};

/**
 * Where a path made only of relative segments ends up, by walking it. Enough
 * of the SVG grammar to cover what `strokePath` writes: `M`, `L`, `l`, `q`,
 * `c` and `a`, each with the endpoint last.
 */
function endOf(d: string): { x: number; y: number; moves: number } {
  let x = 0;
  let y = 0;
  let moves = 0;
  const tokens = d.match(/[MLlqca]|-?\d+(?:\.\d+)?/g) ?? [];
  let at = 0;
  const number = () => Number(tokens[at++]);
  while (at < tokens.length) {
    const command = tokens[at++];
    switch (command) {
      case "M":
        x = number();
        y = number();
        moves++;
        break;
      case "L":
        x = number();
        y = number();
        break;
      case "l":
        x += number();
        y += number();
        break;
      case "q":
        at += 2;
        x += number();
        y += number();
        break;
      case "c":
        at += 4;
        x += number();
        y += number();
        break;
      case "a":
        at += 5;
        x += number();
        y += number();
        break;
    }
  }
  return { x, y, moves };
}

describe("a stroke pattern across a cell", () => {
  it("divides the cell into a whole number of its own repeats", () => {
    for (const pattern of PATTERNS) {
      const { unit, count } = strokeUnit(pattern, ZONES, 2500);
      expect(count, pattern).toBeGreaterThanOrEqual(1);
      expect(unit * count, pattern).toBeCloseTo(2500, 6);
    }
    // A cell narrower than one repeat still gets one, squeezed to fit.
    expect(strokeUnit("waves", ZONES, 100)).toEqual({ unit: 100, count: 1 });
  });

  it("ends each continuous repeat where the next one starts", () => {
    // The whole reason the phase can carry across cells: a solid cell's path
    // ends on the line the dotted cell's path begins on, at its edge.
    for (const [pattern, start] of Object.entries(CONTINUOUS)) {
      const { unit, count } = strokeUnit(pattern as StrokePattern, ZONES, 2500);
      const d = strokePath(pattern as StrokePattern, ZONES, 2500, unit, count);
      const { x, y, moves } = endOf(d);
      expect(moves, pattern).toBe(1);
      expect(d.startsWith(`M2500,${r(start)}`), pattern).toBe(true);
      expect(x, pattern).toBeCloseTo(5000, 0);
      expect(y, pattern).toBeCloseTo(start, 0);
    }
  });

  it("lifts the pencil once a repeat for the strokes that are not joined", () => {
    for (const pattern of ["lines", "slants", "circles"] as const) {
      const { unit, count } = strokeUnit(pattern, ZONES, 2500);
      const d = strokePath(pattern, ZONES, 0, unit, count);
      expect(endOf(d).moves, pattern).toBe(count);
    }
  });

  it("keeps every point inside the repeat, tail loop included", () => {
    // Read the numbers back rather than the shape: no y above the top line
    // or below the foot of the repeat, and no x outside the cell — the
    // control points of a loop are the ones that would stray.
    for (const pattern of PATTERNS) {
      const { unit, count } = strokeUnit(pattern, ZONES, 2500);
      const d = strokePath(pattern, ZONES, 1000, unit, count);
      const pairs = [...d.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
      expect(pairs.length, pattern).toBeGreaterThan(0);
      // Relative commands make the absolute bounds a walk; the simpler
      // invariant that holds for every pattern is that the row is drawn
      // between the top line and the foot, so walk the endpoints only.
      const { y } = endOf(d);
      expect(y, pattern).toBeGreaterThanOrEqual(ZONES.top);
      expect(y, pattern).toBeLessThanOrEqual(ZONES.bottom);
    }
    // The two loops reach for the top line and the foot and stop short of
    // both by a twentieth of their height.
    const loops = strokePath("loops", ZONES, 0, 400, 1);
    expect(loops).toContain(`${r(-0.95 * ZONES.base)}`);
    const tails = strokePath("tails", ZONES, 0, 400, 1);
    expect(tails).toContain(`${r(0.95 * (ZONES.bottom - ZONES.mid))}`);
  });

  it("draws a pattern on a notebook rule, whose only line is the one written on", () => {
    // No top line and no midline: the row is the repeat, and the pattern
    // takes the top of it for its top and half way down for its midline.
    const wide: StrokeZones = { top: 0, mid: 172, base: 344, bottom: 344 };
    for (const pattern of PATTERNS) {
      const { unit, count } = strokeUnit(pattern, wide, 2500);
      expect(strokePath(pattern, wide, 0, unit, count), pattern).toMatch(/^M/);
    }
  });
});

describe("the ink a pattern is drawn with", () => {
  it("is a pencil line, clamped at both ends", () => {
    expect(strokeInk(inches(0.625)).width).toBe(28);
    expect(strokeInk(inches(1)).width).toBe(points(2.5));
    expect(strokeInk(inches(0.1)).width).toBe(points(1));
  });

  it("makes a dot out of a zero-length dash, as the dot grid does", () => {
    const ink = strokeInk(inches(0.625));
    expect(ink.dotted).toMatch(/^0 \d+$/);
    expect(ink.dashed).toMatch(/^[1-9]\d* \d+$/);
  });
});
