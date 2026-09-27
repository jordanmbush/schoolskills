/**
 * The pen's headings and the link between two letters (§25): the cubic that
 * replaces one letter's exit stroke and the next letter's lead-in.
 */
import { flatten, type Point, type Segment } from "./glyphs";

/** The share of the distance between two letters each handle of a join takes. */
const HANDLE = 0.42;

/**
 * The other shares a handle may take when the usual one makes the link
 * wobble: leave the way the tail set off, dip, and climb, or climb, flatten
 * and climb again.
 */
const SHARES = [0.2, 0.3, HANDLE, 0.55];

/** How much more turning than the smoothest link a choice of handles may have and still be preferred for being nearer the usual (radians). */
const WOBBLE_TOLERANCE = 0.06;

/** How much a bend as tight as the distance it spans costs, against a radian of turning. */
const TIGHTNESS = 0.12;

export const tenth = (value: number): number => Math.round(value * 10) / 10;

export const endOf = (segment: Segment): Point => ({
  x: segment.points[segment.points.length - 2],
  y: segment.points[segment.points.length - 1],
});

/** The direction the pen has when it leaves `from` along `segment`, as a unit vector. */
export function headingOut(segment: Segment, from: Point): Point {
  const controls: Point[] = [];
  for (let i = 0; i < segment.points.length; i += 2) {
    controls.push({ x: segment.points[i], y: segment.points[i + 1] });
  }
  return unit(
    from,
    controls.find((p) => p.x !== from.x || p.y !== from.y) ?? from,
  );
}

/** The direction the pen has when it arrives at the end of `segment`. */
export function headingIn(segment: Segment, from: Point): Point {
  const end = endOf(segment);
  const controls: Point[] = [from];
  for (let i = 0; i < segment.points.length - 2; i += 2) {
    controls.push({ x: segment.points[i], y: segment.points[i + 1] });
  }
  const last =
    [...controls].reverse().find((p) => p.x !== end.x || p.y !== end.y) ?? from;
  return unit(last, end);
}

export function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}

/** `segment` drawn the other way, back to `from`, where it started. */
export function reversed(segment: Segment, from: Point): Segment {
  const p = segment.points;
  if (segment.type === "C") {
    return { type: "C", points: [p[2], p[3], p[0], p[1], from.x, from.y] };
  }
  if (segment.type === "Q") {
    return { type: "Q", points: [p[0], p[1], from.x, from.y] };
  }
  return { type: segment.type, points: [from.x, from.y] };
}

function cubic(
  from: Point,
  out: Point,
  to: Point,
  into: Point,
  outReach: number,
  intoReach: number,
): Segment {
  return {
    type: "C",
    points: [
      tenth(from.x + out.x * outReach),
      tenth(from.y + out.y * outReach),
      tenth(to.x - into.x * intoReach),
      tenth(to.y - into.y * intoReach),
      to.x,
      to.y,
    ],
  };
}

/**
 * How much a link turns from end to end, counting every turn back, and how
 * tight its tightest bend is: a link that only ever bends one way turns
 * exactly as much as its ends differ.
 */
function shape(from: Point, link: Segment): { turns: number; radius: number } {
  const points = flatten([{ type: "M", points: [from.x, from.y] }, link], 24);
  let turns = 0;
  let radius = Infinity;
  for (let i = 2; i < points.length; i++) {
    const a = Math.atan2(
      points[i].y - points[i - 1].y,
      points[i].x - points[i - 1].x,
    );
    const b = Math.atan2(
      points[i - 1].y - points[i - 2].y,
      points[i - 1].x - points[i - 2].x,
    );
    const turn = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    turns += turn;
    if (turn > 1e-6) {
      const step = Math.hypot(
        points[i].x - points[i - 1].x,
        points[i].y - points[i - 1].y,
      );
      radius = Math.min(radius, step / turn);
    }
  }
  return { turns, radius };
}

/**
 * The link between two letters. The usual handles serve nearly every pair;
 * where they make it dip and climb or flatten and climb, shorter or longer
 * ones that bend it one way only are taken instead, the nearest to the usual
 * that turns no more than the smoothest does.
 */
export function connector(
  from: Point,
  out: Point,
  to: Point,
  into: Point,
): Segment {
  const span = Math.hypot(to.x - from.x, to.y - from.y);
  const usual = cubic(from, out, to, into, HANDLE * span, HANDLE * span);
  if (span === 0) return usual;
  const options = SHARES.flatMap((a) =>
    SHARES.map((b) => {
      const link = cubic(from, out, to, into, a * span, b * span);
      const { turns, radius } = shape(from, link);
      return {
        link,
        cost: turns + TIGHTNESS * (span / radius),
        off: Math.abs(a - HANDLE) + Math.abs(b - HANDLE),
      };
    }),
  );
  const best = Math.min(...options.map((o) => o.cost));
  const fair = options.filter((o) => o.cost <= best + WOBBLE_TOLERANCE);
  return fair.reduce((best, o) => (o.off < best.off ? o : best)).link;
}
