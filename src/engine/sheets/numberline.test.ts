import { describe, expect, it } from "vitest";

import {
  JUMP_ROOM,
  NUMBER_LINE_HEIGHT,
  hopLine,
  jumps,
  lineHeight,
  numberLine,
  ticks,
} from "./numberline";
import type { NumberLine } from "./types";

/**
 * The hops of a repeated subtraction: where they go, and the room they take.
 * The ticks and their spacing are held to their promises by the families that
 * draw a plain line; this is the half a lesson adds (§23).
 */

const line = (over: Partial<NumberLine> = {}): NumberLine => ({
  from: 0,
  to: 12,
  step: 1,
  width: 7500,
  ...over,
});

describe("a number line with hops on it", () => {
  it("stands taller by exactly the room the hops need, and no taller without them", () => {
    expect(lineHeight(line())).toBe(NUMBER_LINE_HEIGHT);
    expect(lineHeight(line({ jumps: { start: 12, size: 3 } }))).toBe(
      NUMBER_LINE_HEIGHT + JUMP_ROOM,
    );
  });

  it("hops back by the divisor from the dividend to nought", () => {
    expect(jumps(line({ jumps: { start: 12, size: 3 } }))).toEqual([
      { from: 12, to: 9 },
      { from: 9, to: 6 },
      { from: 6, to: 3 },
      { from: 3, to: 0 },
    ]);
  });

  it("stops above nought when the total does not divide", () => {
    expect(
      jumps(line({ to: 14, jumps: { start: 14, size: 4 } })).map(
        (hop) => hop.to,
      ),
    ).toEqual([10, 6, 2]);
  });

  it("hops from where it was told to, not from the end of the line", () => {
    // `numberLine` may round the end up to a whole step; the dividend is
    // still where the hops start.
    const chosen = numberLine(0, 21, 3600);
    expect(chosen.to).toBeGreaterThanOrEqual(21);
    const hops = jumps({ ...chosen, jumps: { start: 21, size: 3 } });
    expect(hops[0].from).toBe(21);
    expect(hops).toHaveLength(7);
    expect(hops[hops.length - 1].to).toBe(0);
  });

  it("draws no hops for a start off the line or a size of nothing", () => {
    expect(jumps(line({ jumps: { start: 13, size: 3 } }))).toEqual([]);
    expect(jumps(line({ jumps: { start: -1, size: 3 } }))).toEqual([]);
    expect(jumps(line({ jumps: { start: 12, size: 0 } }))).toEqual([]);
    expect(jumps(line())).toEqual([]);
  });

  it("never draws more hops than can be read", () => {
    const many = jumps(line({ to: 1000, jumps: { start: 1000, size: 1 } }));
    expect(many.length).toBeLessThanOrEqual(40);
  });
});

describe("a line built for hopping along", () => {
  it("ends on the start and puts every landing on a tick", () => {
    // 21 ÷ 3 in a narrow column: a line counted in twos runs to 22 and has no
    // 21, 18, 15 or 12 on it. Counted in threes it has all of them.
    const narrow = hopLine(21, [3], 3600);
    expect(narrow.to).toBe(21);
    expect(narrow.from).toBe(0);
    const marks = ticks(narrow);
    for (const hop of jumps({ ...narrow, jumps: { start: 21, size: 3 } })) {
      expect(marks, `${hop.from} → ${hop.to}`).toContain(hop.to);
      expect(marks).toContain(hop.from);
    }
    expect(3 % narrow.step).toBe(0);
    // Room to count in ones across a page, so the finest spacing is kept.
    expect(hopLine(12, [3], 7500)).toEqual({
      from: 0,
      to: 12,
      step: 1,
      width: 7500,
    });
  });

  it("counts in what every hop of a chunked line shares", () => {
    // 156 with 120 and then 36 taken away: a line to 160 in tens has no 156
    // on it, and a line in twelves has 156, 36 and 0.
    const chunked = hopLine(156, [120, 36], 7500);
    expect(chunked.to).toBe(156);
    expect(156 % chunked.step).toBe(0);
    expect(120 % chunked.step).toBe(0);
    expect(36 % chunked.step).toBe(0);
    const marks = ticks(chunked);
    for (const at of [156, 36, 0]) expect(marks).toContain(at);
  });

  it("falls back to a plain line for a start that is not one", () => {
    expect(hopLine(0, [3], 3600)).toEqual(numberLine(0, 1, 3600));
    expect(hopLine(-5, [3], 3600)).toEqual(numberLine(0, 1, 3600));
  });
});
