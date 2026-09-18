/**
 * Putting a hand's strokes on the paper (§25).
 *
 * A stroke is stored in hand units, y up. The sheet is mil, y down, with the
 * baseline wherever the ruling put it. `placeStroke` is that change of
 * coordinates and nothing else; every number in the result is mil, as
 * `units.ts` requires of anything inside a sheet's `<svg>`.
 *
 * The rest is for the guides a model carries — where the pen goes down and
 * which way it sets off. A start dot is the first point. An arrow needs a
 * point a little way along the stroke and the direction there, which means
 * walking the curve, so the curve is flattened and walked.
 */
import type { Mil } from "@/engine/sheets/types";

export type Segment = { type: "M" | "L" | "C" | "Q"; points: number[] };

const ARITY: Record<string, number> = { M: 2, L: 2, C: 6, Q: 4 };

/**
 * The four-command absolute form and nothing else — which is what the
 * ingest writes, so anything else here is a corrupted data module rather
 * than a drawing to be lenient with.
 */
export function parseStroke(d: string): Segment[] {
  const tokens = d.split(/\s+/).filter((token) => token !== "");
  const out: Segment[] = [];
  let at = 0;
  while (at < tokens.length) {
    const type = tokens[at] as Segment["type"];
    const arity = ARITY[type];
    if (arity === undefined) throw new Error(`bad stroke command in "${d}"`);
    const points = tokens.slice(at + 1, at + 1 + arity).map(Number);
    if (points.length !== arity || points.some(Number.isNaN)) {
      throw new Error(`bad stroke numbers in "${d}"`);
    }
    out.push({ type, points });
    at += 1 + arity;
  }
  return out;
}

const tenth = (value: number): number => Math.round(value * 10) / 10;

/**
 * A stroke moved onto the sheet: its origin at `x` on `baseline`, one hand
 * unit drawn as `scale` mil, y turned over.
 */
export function placeStroke(
  d: string,
  x: Mil,
  baseline: Mil,
  scale: number,
): Segment[] {
  return parseStroke(d).map((segment) => ({
    type: segment.type,
    points: segment.points.map((value, index) =>
      index % 2 === 0
        ? tenth(x + value * scale)
        : tenth(baseline - value * scale),
    ),
  }));
}

export const pathOf = (segments: Segment[]): string =>
  segments
    .map((segment) => `${segment.type} ${segment.points.join(" ")}`)
    .join(" ");

type Point = { x: number; y: number };

const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
});

function onCurve(type: "C" | "Q", from: Point, points: number[], t: number) {
  const p = [from];
  for (let i = 0; i < points.length; i += 2) {
    p.push({ x: points[i], y: points[i + 1] });
  }
  // de Casteljau, which is the same three lines for either degree.
  let level = p;
  while (level.length > 1) {
    level = level.slice(1).map((point, i) => lerp(level[i], point, t));
  }
  void type;
  return level[0];
}

/** The stroke as points, each with the distance walked to reach it. */
export function flatten(
  segments: Segment[],
  steps = 12,
): Array<Point & { at: number }> {
  const out: Array<Point & { at: number }> = [];
  let current: Point = { x: 0, y: 0 };
  let walked = 0;
  const push = (point: Point) => {
    if (out.length > 0)
      walked += Math.hypot(point.x - current.x, point.y - current.y);
    current = point;
    out.push({ ...point, at: walked });
  };
  for (const segment of segments) {
    if (segment.type === "M" || segment.type === "L") {
      push({ x: segment.points[0], y: segment.points[1] });
      continue;
    }
    const from = current;
    for (let i = 1; i <= steps; i += 1) {
      push(onCurve(segment.type, from, segment.points, i / steps));
    }
  }
  return out;
}

/**
 * The point `distance` along the stroke, and the direction of travel there
 * in radians, screen sense. Past the end is the end; a stroke with no length
 * — a dot — faces right.
 */
export function along(
  segments: Segment[],
  distance: number,
): Point & { angle: number } {
  const points = flatten(segments);
  const last = points[points.length - 1];
  if (points.length < 2 || last.at === 0) {
    return { x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, angle: 0 };
  }
  const wanted = Math.min(Math.max(distance, 0), last.at);
  let i = 1;
  while (i < points.length - 1 && points[i].at < wanted) i += 1;
  const a = points[i - 1];
  const b = points[i];
  const span = b.at - a.at;
  const t = span === 0 ? 0 : (wanted - a.at) / span;
  const point = lerp(a, b, t);
  return { ...point, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

export const strokeLength = (segments: Segment[]): number => {
  const points = flatten(segments);
  return points.length > 0 ? points[points.length - 1].at : 0;
};

/**
 * An arrowhead: a filled triangle with its point at `x, y`, `length` long
 * behind it and `width` across its base, pointing along `angle`. Filled and
 * several line-widths wide, because it sits on the line it points along and
 * has to read against it at a glance.
 */
export function arrowhead(
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
): string {
  const backX = x - length * Math.cos(angle);
  const backY = y - length * Math.sin(angle);
  const dx = (width / 2) * Math.sin(angle);
  const dy = (width / 2) * Math.cos(angle);
  return (
    `M ${tenth(x)} ${tenth(y)} ` +
    `L ${tenth(backX + dx)} ${tenth(backY - dy)} ` +
    `L ${tenth(backX - dx)} ${tenth(backY + dy)} Z`
  );
}
