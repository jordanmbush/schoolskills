/**
 * Where a join from the top of a letter lands on the next (§25): partway up
 * its lead-in or first stroke, not at the end of the lead-in.
 */
import { distance, flatten, type Point, type Segment } from "./glyphs";
import { earOf } from "./ear";
import { endOf, headingIn, headingOut, tenth, unit } from "./links";

/** Where the letters stand on the sheet, in mil: the baseline's y and the height of a small letter. */
export type Ground = { baseline: number; xHeight: number };

/** How far below where it left a bridge from the top of a letter may sag to meet the next, as a share of the x-height. */
const SAG = 0.13;

/** How much steeper than the line to it a bridge climbs into the point of an `i` or a `u`, in radians, so the corner there is blunter than a square one. */
const POINT_RISE = (18 * Math.PI) / 180;

/** `segment` from `from`, cut at `t`: the point there, the way the pen heads, and the two pieces. */
function cutAt(
  segment: Segment,
  from: Point,
  t: number,
): { at: Point; heading: Point; before: Segment; rest: Segment } {
  const lerp = (a: Point, b: Point): Point => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  });
  const end = endOf(segment);
  if (segment.type === "L") {
    const at = lerp(from, end);
    return {
      at,
      heading: unit(from, end),
      before: { type: "L", points: [at.x, at.y] },
      rest: segment,
    };
  }
  const [c1, c2] = [
    { x: segment.points[0], y: segment.points[1] },
    { x: segment.points[2], y: segment.points[3] },
  ];
  const q0 = lerp(from, c1);
  const q1 = lerp(c1, c2);
  const q2 = lerp(c2, end);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const at = lerp(r0, r1);
  return {
    at,
    heading: unit(r0, r1),
    before: { type: "C", points: [q0.x, q0.y, r0.x, r0.y, at.x, at.y] },
    rest: {
      type: "C",
      points: [r1.x, r1.y, q2.x, q2.y, end.x, end.y].map(tenth),
    },
  };
}

/** Whether two paths cross each other, slantwise, away from `apart` of `where`. */
function cross(a: Point[], b: Point[], where: Point, apart: number): boolean {
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      const d1 = { x: a[i].x - a[i - 1].x, y: a[i].y - a[i - 1].y };
      const d2 = { x: b[j].x - b[j - 1].x, y: b[j].y - b[j - 1].y };
      const turn = d1.x * d2.y - d1.y * d2.x;
      const along = Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y);
      if (along === 0 || Math.abs(turn) < 0.34 * along) continue;
      const dx = b[j - 1].x - a[i - 1].x;
      const dy = b[j - 1].y - a[i - 1].y;
      const s = (dx * d2.y - dy * d2.x) / turn;
      const u = (dx * d1.y - dy * d1.x) / turn;
      if (s < 0 || s > 1 || u < 0 || u > 1) continue;
      const at = { x: a[i - 1].x + s * d1.x, y: a[i - 1].y + s * d1.y };
      if (distance(at, where) > apart) return true;
    }
  }
  return false;
}

/**
 * Where a join from the top of a letter lands on the letter after it, or
 * null when it lands at the end of that letter's lead-in as usual. A bridge
 * from an `o` does not drop to the foot of the next letter's entry and climb
 * out; it sags a little and meets the entry stroke partway up, and the letter
 * goes on from there. That is the first point of the letter, from where it
 * starts, at the height the bridge would sag to.
 */
export function landing(
  first: Segment[],
  before: Point[],
  skip: number,
  tailAt: number,
  exit: Point,
  ground: Ground,
): { index: number; at: Point; heading: Point; rest: Segment } | null {
  const height = (p: Point) => ground.baseline - p.y;
  const wanted = height(exit) - SAG * ground.xHeight;
  if (wanted < height(before[1]) + 0.1 * ground.xHeight) return null;
  // A lead-in that ends in a point, the top of an `i` or a `u`, is not
  // climbed partway: the bridge runs to the point and the letter turns down
  // from it. The point is a turn back, so the bridge need not arrive the way
  // the lead-in did.
  const arriving = headingIn(first[skip - 1], before[skip - 1]);
  const leaving = headingOut(first[skip], before[skip]);
  if (
    height(before[skip]) >= wanted &&
    arriving.x * leaving.x + arriving.y * leaving.y <= 0 &&
    earOf(first, before, skip, tailAt) === null
  ) {
    const along = unit(exit, before[skip]);
    return {
      index: skip,
      at: before[skip],
      heading: {
        x: along.x * Math.cos(POINT_RISE) + along.y * Math.sin(POINT_RISE),
        y: -along.x * Math.sin(POINT_RISE) + along.y * Math.cos(POINT_RISE),
      },
      rest: first[skip],
    };
  }
  for (let i = 1; i < tailAt; i++) {
    const end = endOf(first[i]);
    if (height(end) < wanted) continue;
    let low = 0;
    let high = 1;
    for (let step = 0; step < 24; step++) {
      const mid = (low + high) / 2;
      if (height(cutAt(first[i], before[i], mid).at) < wanted) low = mid;
      else high = mid;
    }
    const cut = cutAt(first[i], before[i], high);
    // A stretch the rest of the letter crosses is not skipped: the crossing
    // is what closes an `e`, and without it the loop is a `c` with a tail.
    const passed = flatten(
      [
        { type: "M", points: [before[1].x, before[1].y] },
        ...first.slice(1, i),
        cut.before,
      ],
      12,
    );
    const ahead = flatten(
      [
        { type: "M", points: [cut.at.x, cut.at.y] },
        cut.rest,
        ...first.slice(i + 1, tailAt),
      ],
      12,
    );
    if (cross(passed, ahead, cut.at, 0.3 * ground.xHeight)) return null;
    return { index: i, at: cut.at, heading: cut.heading, rest: cut.rest };
  }
  return null;
}
