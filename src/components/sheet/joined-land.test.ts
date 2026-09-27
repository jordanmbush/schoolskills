import { describe, expect, it } from "vitest";

import { flatten, parseStroke, type Segment } from "./glyphs";
import { joined, type Ground, type Placed } from "./joined";

/**
 * Synthetic letters on a sheet 100 mil tall: baseline at 100, a small
 * letter 50 high, y down. A bridge from the top of a letter lands partway up
 * the next one instead of dropping to the end of its lead-in, and a link that
 * would dip and climb bends one way only.
 */
const ground: Ground = { baseline: 100, xHeight: 50 };

/** A letter that leaves from the top of the line, heading right, like an `o`. */
const high = (x: number): Placed => ({
  strokes: [
    parseStroke(`M ${x} 80 C ${x} 60 ${x + 10} 50 ${x + 20} 50 L ${x + 35} 50`),
  ],
  join: { lead: 0, tail: 1 },
});

/** A letter that leaves from the baseline. */
const low = (x: number): Placed => ({
  strokes: [parseStroke(`M ${x} 100 L ${x + 20} 96 L ${x + 35} 90`)],
  join: { lead: 0, tail: 1 },
});

/**
 * An `l`: a lead-in from the foot rising to a third of the line, the
 * up-stroke going on to twice the line, a stem down and a tail.
 */
const l = (x: number): Placed => ({
  strokes: [
    parseStroke(
      [
        `M ${x} 95`,
        `L ${x + 15} 80`,
        `L ${x + 40} 0`,
        `L ${x + 30} 100`,
        `L ${x + 50} 90`,
      ].join(" "),
    ),
  ],
  join: { lead: 1, tail: 1 },
});

/** A letter whose lead-in ends in a point, like the top of an `i`: up to the midline, then back down. */
const point = (x: number): Placed => ({
  strokes: [
    parseStroke(`M ${x} 95 L ${x + 30} 50 L ${x + 20} 100 L ${x + 40} 90`),
  ],
  join: { lead: 1, tail: 1 },
});

const line = (letters: Placed[], on?: Ground): Segment[] =>
  joined(letters, on)[0][0];
const endOf = (segment: Segment) => ({
  x: segment.points[segment.points.length - 2],
  y: segment.points[segment.points.length - 1],
});
/** The connector: the first cubic after the first letter's own strokes. */
const link = (drawn: Segment[]): Segment => drawn[2];

describe("a join from the top of a letter", () => {
  it("lands partway up the next letter, sagging a little", () => {
    const drawn = line([high(0), l(60)], ground);
    const lands = endOf(link(drawn));
    const height = ground.baseline - lands.y;
    // Left at height 50; the bridge sags a fifth of the line to meet the next letter.
    expect(height).toBeGreaterThan(50 - 0.25 * ground.xHeight - 1);
    expect(height).toBeLessThan(50 - 0.1 * ground.xHeight);
    // The next letter goes on from there, up to its own top.
    expect(Math.min(...drawn.map((s) => endOf(s).y))).toBe(0);
  });

  it("lands at the end of the lead-in when the ground is not given", () => {
    const drawn = line([high(0), l(60)]);
    expect(endOf(link(drawn))).toEqual({ x: 75, y: 80 });
  });

  it("runs to the point of a letter that turns back at the end of its lead-in, climbing a little into it", () => {
    const drawn = line([high(0), point(60)], ground);
    const bridge = link(drawn);
    expect(endOf(bridge)).toEqual({ x: 90, y: 50 });
    // The last handle sits below the point: the bridge is still climbing when it gets there.
    expect(bridge.points[3]).toBeGreaterThan(50);
    expect(drawn).toHaveLength(5);
  });

  it("does not change a join from the baseline", () => {
    const drawn = line([low(0), l(60)], ground);
    expect(endOf(link(drawn))).toEqual({ x: 75, y: 80 });
  });
});

describe("the link between two letters", () => {
  const turned = (from: { x: number; y: number }, segment: Segment): number => {
    const points = flatten(
      [{ type: "M", points: [from.x, from.y] }, segment],
      40,
    );
    let total = 0;
    for (let i = 2; i < points.length; i++) {
      const a = Math.atan2(
        points[i].y - points[i - 1].y,
        points[i].x - points[i - 1].x,
      );
      const b = Math.atan2(
        points[i - 1].y - points[i - 2].y,
        points[i - 1].x - points[i - 2].x,
      );
      total += Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    }
    return total;
  };

  /** The link with both handles a share of the way, as it was drawn before it chose. */
  const usual = (
    from: { x: number; y: number },
    out: number,
    to: { x: number; y: number },
    into: number,
  ): Segment => {
    const reach = 0.42 * Math.hypot(to.x - from.x, to.y - from.y);
    return {
      type: "C",
      points: [
        from.x + Math.cos(out) * reach,
        from.y - Math.sin(out) * reach,
        to.x - Math.cos(into) * reach,
        to.y + Math.sin(into) * reach,
        to.x,
        to.y,
      ],
    };
  };

  /** A letter that sets off climbing at 17.5 degrees, from height 10. */
  const off = (): Placed => ({
    strokes: [parseStroke("M 0 100 L 20 90 L 34.3 85.5")],
    join: { lead: 0, tail: 1 },
  });

  /** A letter entered by a stroke arriving at 45 degrees at (x, y), then climbing on. */
  const into = (x: number, y: number): Placed => ({
    strokes: [
      parseStroke(
        `M ${x - 12} ${y + 12} L ${x} ${y} L ${x + 15} ${y - 42} L ${x + 25} ${y + 8}`,
      ),
    ],
    join: { lead: 1, tail: 1 },
  });

  it("bends one way only where the usual handles make it flatten and climb again", () => {
    const drawn = line([off(), into(75, 82)]);
    const from = { x: 20, y: 90 };
    const to = { x: 75, y: 82 };
    const wobbly = usual(from, (17.5 * Math.PI) / 180, to, Math.PI / 4);
    expect(turned(from, link(drawn))).toBeLessThan(turned(from, wobbly) - 0.05);
    expect(endOf(link(drawn))).toEqual(to);
  });

  it("keeps the usual handles where they already bend one way", () => {
    const drawn = line([off(), into(80, 55.4)]);
    const from = { x: 20, y: 90 };
    const to = { x: 80, y: 55.4 };
    const smooth = usual(from, (17.5 * Math.PI) / 180, to, Math.PI / 4);
    link(drawn).points.forEach((value, i) => {
      expect(value).toBeCloseTo(smooth.points[i], 0);
    });
  });
});
