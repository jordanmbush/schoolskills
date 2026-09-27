import { describe, expect, it } from "vitest";

import { parseStroke } from "./glyphs";
import { withoutRetraces } from "./retrace";

/** Length of ink a stroke draws, straight lines only. */
function inked(stroke: ReturnType<typeof parseStroke>): number {
  let at = { x: 0, y: 0 };
  let total = 0;
  for (const s of stroke) {
    const to = {
      x: s.points[s.points.length - 2],
      y: s.points[s.points.length - 1],
    };
    if (s.type === "L") total += Math.hypot(to.x - at.x, to.y - at.y);
    at = to;
  }
  return total;
}

describe("withoutRetraces", () => {
  it("leaves a stroke that never goes over the same ground alone", () => {
    const stroke = parseStroke("M 0 0 C 50 -60 150 -60 200 0 L 260 80");
    expect(withoutRetraces(stroke, 4)).toBe(stroke);
  });

  it("drops a stem drawn back down the way it went up", () => {
    const stroke = parseStroke("M 0 200 L 60 0 L 0 200 L -40 260");
    const out = withoutRetraces(stroke, 4);
    // the way down is gone; the line beyond the start remains
    const lines = out.filter((s) => s.type === "L");
    const reach = Math.max(...lines.map((s) => s.points[1]));
    expect(reach).toBeGreaterThan(250);
    expect(
      out.some((s) => s.type === "M" && s.points[1] > 190 && s.points[1] < 215),
    ).toBe(true);
    // 210 up + 72 on past the start; the 210 back down is not drawn again
    expect(inked(out)).toBeLessThan(330);
    expect(inked(out)).toBeGreaterThan(250);
  });

  it("draws a loop that is gone round twice once, and keeps what comes after", () => {
    // a circle of radius 100 drawn as four cubics, twice, then a tail off to the right
    const k = 55.23;
    const circle =
      "C 100 -" +
      k +
      " " +
      k +
      " -100 0 -100 C -" +
      k +
      " -100 -100 -" +
      k +
      " -100 0 C -100 " +
      k +
      " -" +
      k +
      " 100 0 100 C " +
      k +
      " 100 100 " +
      k +
      " 100 0";
    const twice = parseStroke(`M 100 0 ${circle} ${circle} L 300 40`);
    const once = withoutRetraces(twice, 4);
    const curves = once.filter((s) => s.type === "C").length;
    expect(curves).toBeLessThanOrEqual(4);
    expect(once.some((s) => s.type === "L" && s.points[0] === 300)).toBe(true);
  });

  it("does not take one line crossing another for ground gone over", () => {
    const stroke = parseStroke("M 0 0 L 200 200 L 200 0 L 0 200");
    expect(withoutRetraces(stroke, 4)).toBe(stroke);
  });
});
