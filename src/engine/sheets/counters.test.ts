import { describe, expect, it } from "vitest";

import {
  DOT,
  DOT_GAP,
  LABEL_ROOM,
  MOST_DOTS,
  counters,
  countersGeometry,
  grouped,
} from "./counters";
import type { CounterLayout } from "./types";

/**
 * The counters, held to being countable: every dot the picture claims is
 * placed, every ring holds exactly its share, what does not divide stands
 * outside every ring, and nothing is drawn past the height the family
 * reserved.
 */

const LAYOUTS: CounterLayout[] = ["share", "group", "array"];

const within = (
  dot: { x: number; y: number },
  ring: { x: number; y: number; width: number; height: number },
): boolean =>
  dot.x > ring.x &&
  dot.x < ring.x + ring.width &&
  dot.y > ring.y &&
  dot.y < ring.y + ring.height;

describe("a counters picture", () => {
  it("places every dot, and no more", () => {
    for (const layout of LAYOUTS) {
      for (let total = 1; total <= MOST_DOTS; total += 1) {
        for (let per = 1; per <= total; per += 1) {
          const picture = counters(total, per, layout, 7500);
          expect(countersGeometry(picture).dots, `${layout} ${total}/${per}`) //
            .toHaveLength(total);
        }
      }
    }
  });

  it("rings the groups, and leaves the remainder outside every ring", () => {
    for (const layout of ["share", "group"] as const) {
      for (const [total, per] of [
        [12, 4],
        [14, 4],
        [21, 3],
        [7, 7],
        [5, 2],
      ]) {
        const picture = counters(total, per, layout, 7500);
        const { groups, left } = grouped(picture);
        const { dots, rings } = countersGeometry(picture);
        expect(rings, `${layout} ${total}/${per}`).toHaveLength(groups);
        for (const ring of rings) {
          expect(dots.filter((dot) => within(dot, ring))).toHaveLength(per);
        }
        const outside = dots.filter(
          (dot) => !rings.some((ring) => within(dot, ring)),
        );
        expect(outside, `${layout} ${total}/${per}`).toHaveLength(left);
      }
    }
  });

  it("draws no rings when they are the child's to draw, and spaces the dots evenly", () => {
    const picture = counters(21, 3, "group", 3600, { rings: false });
    const { dots, rings } = countersGeometry(picture);
    expect(rings).toHaveLength(0);
    // Nothing about the spacing says where a group ends: every neighbour on a
    // row is the same distance along.
    const rows = new Map<number, number[]>();
    for (const dot of dots)
      rows.set(dot.y, [...(rows.get(dot.y) ?? []), dot.x]);
    for (const xs of rows.values()) {
      for (let at = 1; at < xs.length; at += 1) {
        expect(xs[at] - xs[at - 1]).toBe(DOT + DOT_GAP);
      }
    }
    expect(rows.size).toBeGreaterThan(1);
  });

  it("sets an array out in rows of `per`, and writes both counts", () => {
    const picture = counters(12, 4, "array", 7500);
    const { dots, rings, labels } = countersGeometry(picture);
    expect(rings).toHaveLength(0);
    expect(labels.map((label) => label.text)).toEqual(["4", "3"]);
    const columns = new Set(dots.map((dot) => dot.x));
    const rows = new Set(dots.map((dot) => dot.y));
    expect(columns.size).toBe(4);
    expect(rows.size).toBe(3);
    // The counts sit in the gutters, clear of the dots.
    for (const dot of dots) {
      expect(dot.x - DOT / 2).toBeGreaterThanOrEqual(LABEL_ROOM);
      expect(dot.y - DOT / 2).toBeGreaterThanOrEqual(LABEL_ROOM);
    }
  });

  it("keeps everything inside the height it declared", () => {
    for (const layout of LAYOUTS) {
      for (const width of [1650, 2300, 3600, 7500]) {
        for (const [total, per] of [
          [24, 6],
          [24, 4],
          [21, 3],
          [12, 4],
          [20, 5],
        ]) {
          for (const rings of [true, false]) {
            const picture = counters(total, per, layout, width, { rings });
            const { dots, rings: drawn, labels } = countersGeometry(picture);
            const where = `${layout} ${total}/${per} in ${width}`;
            for (const dot of dots) {
              expect(dot.y + DOT / 2, where).toBeLessThanOrEqual(
                picture.height,
              );
              expect(dot.y - DOT / 2, where).toBeGreaterThanOrEqual(0);
              expect(dot.x - DOT / 2, where).toBeGreaterThanOrEqual(0);
            }
            for (const ring of drawn) {
              expect(ring.y + ring.height, where).toBeLessThanOrEqual(
                picture.height,
              );
              expect(ring.y, where).toBeGreaterThanOrEqual(0);
            }
            for (const label of labels) {
              expect(label.y, where).toBeLessThanOrEqual(picture.height);
            }
          }
        }
      }
    }
  });

  it("wraps a row of rings rather than running off the page", () => {
    // Four rings of six are wider than a column, so they go two and two.
    const wide = counters(24, 6, "share", 7500);
    const narrow = counters(24, 6, "share", 2300);
    expect(narrow.height).toBeGreaterThan(wide.height);
    const { rings } = countersGeometry(narrow);
    for (const ring of rings) {
      expect(ring.x + ring.width).toBeLessThanOrEqual(2300);
    }
    expect(new Set(rings.map((ring) => ring.y)).size).toBe(2);
  });

  it("holds a saved config to something countable", () => {
    expect(counters(90, 4, "share", 7500).total).toBe(MOST_DOTS);
    expect(counters(12, 30, "share", 7500).per).toBe(12);
    expect(counters(12, 0, "share", 7500).per).toBe(1);
    expect(counters(0, 1, "share", 7500).total).toBe(1);
    expect(counters(12, 4, "share", 0).width).toBe(1);
  });

  it("is the same drawing every time", () => {
    const a = counters(14, 4, "share", 3600, { caption: "x" });
    const b = counters(14, 4, "share", 3600, { caption: "x" });
    expect(a).toEqual(b);
    expect(countersGeometry(a)).toEqual(countersGeometry(b));
  });

  it("counts the groups and what is left", () => {
    expect(grouped(counters(14, 4, "share", 7500))).toEqual({
      groups: 3,
      left: 2,
    });
    expect(grouped(counters(12, 3, "group", 7500))).toEqual({
      groups: 4,
      left: 0,
    });
  });
});
