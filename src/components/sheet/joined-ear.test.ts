import { describe, expect, it } from "vitest";

import { distance, flatten, parseStroke, type Segment } from "./glyphs";
import { joined, type Placed } from "./joined";

/**
 * Synthetic letters on a sheet 100 mil tall: baseline at 100, midline at 50,
 * y down. The `s` is entered by a rising line and its bowl turns back on
 * that line at an ear, so a join that replaces the line has to bring the ear
 * to itself.
 */

/** An `s` at `x`: lead-in, peak, leg, the bowl's arm out to the ear and back, and a tail. */
const s = (x: number): Placed => ({
  strokes: [
    parseStroke(
      [
        `M ${x} 80`,
        `L ${x + 60} 50`,
        `L ${x + 50} 100`,
        `L ${x + 18} 71`,
        `L ${x + 50} 100`,
        `L ${x + 70} 80`,
      ].join(" "),
    ),
  ],
  join: { lead: 1, tail: 1 },
});

/** A letter that leaves from the midline, heading right, like an `o` or a `v`. */
const high = (x: number): Placed => ({
  strokes: [
    parseStroke(`M ${x} 80 C ${x} 60 ${x + 10} 50 ${x + 20} 50 L ${x + 35} 50`),
  ],
  join: { lead: 0, tail: 1 },
});

/**
 * A letter that leaves the baseline along the line an `s` at 60 is entered
 * by, so the join into it is that same line and passes through the ear.
 */
const along = (): Placed => ({
  strokes: [parseStroke("M 20 100 L 42.1 88.9 L 60 80")],
  join: { lead: 0, tail: 1 },
});

const line = (letters: Placed[]): Segment[] => joined(letters)[0][0];
const endOf = (segment: Segment) => ({
  x: segment.points[segment.points.length - 2],
  y: segment.points[segment.points.length - 1],
});

describe("an ear on the line a letter is entered by", () => {
  it("reaches out to the join when the join passes clear of it", () => {
    const drawn = line([high(0), s(60)]);
    const connector = drawn[2];
    const spur = drawn.find((segment, k) => k > 2 && segment.type === "C");
    const ear = { x: 78, y: 71 };
    const meets = flatten([{ type: "M", points: [20, 50] }, connector], 60);
    expect(spur).toBeDefined();
    expect(
      Math.min(...meets.map((p) => distance(p, endOf(spur!)))),
    ).toBeLessThan(0.5);
    expect(distance(ear, endOf(spur!))).toBeGreaterThan(5);
  });

  it("goes out and comes back over the same ground, so the pen ends where it was", () => {
    const drawn = line([high(0), s(60)]);
    const at = drawn.findIndex((segment, k) => k > 2 && segment.type === "C");
    const [out, back] = [drawn[at], drawn[at + 1]];
    expect(back.points.slice(0, 4)).toEqual([
      ...out.points.slice(2, 4),
      ...out.points.slice(0, 2),
    ]);
    expect(endOf(back)).toEqual({ x: 78, y: 71 });
    expect(drawn).toHaveLength(9);
  });

  it("leaves it alone when the join already runs through it", () => {
    expect(line([along(), s(60)])).toHaveLength(7);
  });

  it("leaves it alone when the letter is not joined in", () => {
    expect(line([s(60)])).toHaveLength(6);
  });
});
