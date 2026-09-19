import { describe, expect, it } from "vitest";

import { parseStroke, type Segment } from "./glyphs";
import { joined, type Placed } from "./joined";

/**
 * Synthetic letters on a sheet 100 mil tall: baseline at 100, midline at 50,
 * y down. Each is one joining stroke, a lead-in of one segment, a body, and
 * a tail of one segment.
 */
const BASELINE = 100;
const MIDLINE = 50;

/** An `i`: lead-in rising to the midline, a stem down, a tail rising. */
const i = (x: number): Placed => ({
  strokes: [
    parseStroke(`M ${x} 100 L ${x + 20} 50 L ${x + 20} 100 L ${x + 40} 60`),
    parseStroke(`M ${x + 20} 30 L ${x + 20} 31`),
  ],
  join: { lead: 1, tail: 1 },
});

/**
 * An `o`: no lead-in, a bowl from the top round in four quarters and back,
 * a check at the top. The first quarter is the top a bridge covers.
 */
const o = (x: number): Placed => ({
  strokes: [
    parseStroke(
      [
        `M ${x + 15} 50`,
        `C ${x + 5} 50 ${x} 60 ${x} 75`,
        `C ${x} 90 ${x + 5} 100 ${x + 15} 100`,
        `C ${x + 25} 100 ${x + 30} 90 ${x + 30} 75`,
        `C ${x + 30} 60 ${x + 25} 50 ${x + 15} 50`,
        `L ${x + 30} 45`,
      ].join(" "),
    ),
  ],
  join: { lead: 0, tail: 1, top: 1 },
});

/**
 * A capital `K`: a stem written first, then an arm ending in a tail, and
 * nothing joins into it.
 */
const K = (x: number): Placed => ({
  strokes: [
    parseStroke(`M ${x} 0 L ${x} 100`),
    parseStroke(`M ${x + 30} 0 L ${x} 50 L ${x + 30} 100 L ${x + 50} 60`),
  ],
  join: { lead: 0, tail: 1, stroke: 1, initial: true },
});

/**
 * An `n` of an unlooped model: no lead-in, a stem drawn down from the
 * midline, an arch, and a tail.
 */
const n = (x: number): Placed => ({
  strokes: [
    parseStroke(
      `M ${x} 50 L ${x} 100 L ${x} 60 L ${x + 20} 60 L ${x + 20} 100 L ${x + 40} 60`,
    ),
  ],
  join: { lead: 0, tail: 1 },
});

/** A `b` of the unlooped American model: joined into, with no tail to join out of. */
const b = (x: number): Placed => ({
  strokes: [parseStroke(`M ${x} 0 L ${x} 100 L ${x + 20} 50`)],
  join: { lead: 0, tail: 0 },
});

/** A mark with no join: a full stop. */
const stop = (x: number): Placed => ({
  strokes: [parseStroke(`M ${x} 100 L ${x + 1} 100`)],
});

const d = (segments: Segment[]) =>
  segments.map((s) => `${s.type} ${s.points.join(" ")}`).join(" ");

describe("joined", () => {
  it("leaves a letter that does not join as it is", () => {
    const units = joined([stop(0)], BASELINE, MIDLINE);
    expect(units).toEqual([stop(0).strokes]);
  });

  it("writes a lone letter whole, lead-in and tail included", () => {
    const [unit] = joined([i(0)], BASELINE, MIDLINE);
    expect(d(unit[0])).toBe(d(i(0).strokes[0]));
    expect(unit).toHaveLength(2);
  });

  it("joins two letters into one line, then the marks in order", () => {
    const units = joined([i(0), i(50)], BASELINE, MIDLINE);
    expect(units).toHaveLength(1);
    const [line, dot1, dot2] = units[0];
    // The first letter's tail and the second's lead-in are gone; between
    // the body of one and the body of the other is one cubic.
    const parts = d(line).split(" ");
    expect(d(line)).toMatch(
      /^M 0 100 L 20 50 L 20 100 C [\d.]+ [\d.]+ [\d.]+ [\d.]+ 70 50 L 70 100 L 90 60$/,
    );
    expect(parts.filter((p) => p === "C")).toHaveLength(1);
    expect(d(dot1)).toBe(d(i(0).strokes[1]));
    expect(d(dot2)).toBe(d(i(50).strokes[1]));
  });

  it("sets the join off the way the tail went and arrives the way the lead-in came", () => {
    const [[line]] = joined([i(0), i(50)], BASELINE, MIDLINE);
    const cubic = line.find((s) => s.type === "C")!;
    const [x1, y1, x2, y2] = cubic.points;
    // From (20,100) the tail rose up and right, so the first handle is up
    // and right of it; the lead-in of the second `i` arrived rising, so the
    // second handle is below and left of (70,50).
    expect(x1).toBeGreaterThan(20);
    expect(y1).toBeLessThan(100);
    expect(x2).toBeLessThan(70);
    expect(y2).toBeGreaterThan(50);
  });

  it("covers the top of a bowl after a midline exit and climbs into it after a baseline one", () => {
    const afterO = d(joined([o(0), o(60)], BASELINE, MIDLINE)[0][0]);
    const afterI = d(joined([i(0), o(60)], BASELINE, MIDLINE)[0][0]);
    const top = "C 65 50 60 60 60 75";
    const left = "C 60 90 65 100 75 100";
    // After the `o`, whose body ends at the top, the second bowl's first
    // quarter is skipped: the join lands on its left side and the rest of
    // the bowl follows.
    expect(afterO).not.toContain(top);
    expect(afterO).toMatch(new RegExp(`C [\\d. ]+ 60 75 ${left}`));
    // After the `i`, which ends on the baseline, the whole bowl is drawn.
    expect(afterI).toMatch(new RegExp(`C [\\d. ]+ 75 50 ${top} ${left}`));
  });

  it("ends a run at a letter that does not join, and starts again after it", () => {
    const units = joined([i(0), stop(50), i(60)], BASELINE, MIDLINE);
    expect(units).toHaveLength(3);
    expect(d(units[0][0])).toBe(d(i(0).strokes[0]));
    expect(d(units[2][0])).toBe(d(i(60).strokes[0]));
  });

  it("ends a run before an initial letter, whatever came before it", () => {
    const units = joined([i(0), K(50)], BASELINE, MIDLINE);
    expect(units).toHaveLength(2);
    expect(d(units[0][0])).toBe(d(i(0).strokes[0]));
    expect(d(units[1][1])).toBe(d(K(50).strokes[1]));
  });

  it("joins out of an initial letter, the stroke it wrote first ahead of the line", () => {
    const units = joined([K(0), i(60)], BASELINE, MIDLINE);
    expect(units).toHaveLength(1);
    const [stem, line, dot] = units[0];
    expect(d(stem)).toBe(d(K(0).strokes[0]));
    expect(d(line)).toMatch(
      /^M 30 0 L 0 50 L 30 100 C [\d. ]+ 80 50 L 80 100 L 100 60$/,
    );
    expect(d(dot)).toBe(d(i(60).strokes[1]));
  });

  it("enters a letter that starts down a stem along the line in from where it left", () => {
    const [unit] = joined([i(0), n(50)], BASELINE, MIDLINE);
    const [, , , connector] = unit[0];
    // The i's body ends at (20,100) and the n starts at (50,50): the second
    // handle sits on that line, below the top of the stem, where arriving the
    // way the stem sets off would have put it above.
    expect(connector.type).toBe("C");
    const [, , hx, hy] = connector.points;
    expect(hy).toBeGreaterThan(50);
    expect((hx - 20) / (hy - 100)).toBeCloseTo((50 - 20) / (50 - 100), 1);
  });

  it("joins into a letter with no tail and ends the run there", () => {
    const units = joined([i(0), b(50), i(100)], BASELINE, MIDLINE);
    expect(units).toHaveLength(2);
    const line = d(units[0][0]);
    expect(line.startsWith(d(i(0).strokes[0].slice(0, 3)))).toBe(true);
    expect(line.endsWith("L 50 100 L 70 50")).toBe(true);
    expect(d(units[1][0])).toBe(d(i(100).strokes[0]));
  });

  it("ends a run after a letter with no tail", () => {
    const b: Placed = { ...i(0), join: { lead: 1, tail: 0 } };
    const units = joined([b, i(50)], BASELINE, MIDLINE);
    expect(units).toHaveLength(2);
    expect(d(units[0][0])).toBe(d(b.strokes[0]));
  });

  it("skips over a space and joins nothing across it", () => {
    const units = joined([i(0), { strokes: [] }, i(60)], BASELINE, MIDLINE);
    expect(units).toHaveLength(2);
  });

  it("treats a join that would leave no body as no join at all", () => {
    const stub: Placed = {
      strokes: [parseStroke("M 0 100 L 10 50")],
      join: { lead: 1, tail: 1 },
    };
    expect(joined([stub, i(20)], BASELINE, MIDLINE)).toHaveLength(2);
  });
});
