/**
 * The ear of an `s` (§25): where the letter turns back on its own lead-in,
 * and the arm that carries it on to a join that runs clear of it.
 */
import { distance, flatten, nearest, type Point, type Segment } from "./glyphs";
import { endOf, headingIn, headingOut, reversed, tenth, unit } from "./links";

/**
 * How near the line it was entered by a turn-back must lie, as a share of
 * that line's length, to be the ear that meets it; and how far from either
 * end of the line, since a turn-back at the far end is the letter's own peak.
 */
const EAR_ON = 0.05;
const EAR_FROM_ENDS = 0.15;
/** An arm ending this near the join, as a share of the lead-in, is already touching it. */
const EAR_TOUCHES = 0.04;

/**
 * Where the letter turns back on its own lead-in, as an index into `first`,
 * or null. The arm of an `s` ends on the line the letter is entered by, and
 * turns there; a join that replaces that line has to bring it to the arm.
 */
export function earOf(
  first: Segment[],
  before: Point[],
  skip: number,
  tailAt: number,
): number | null {
  if (skip < 2) return null;
  const lead = flatten(first.slice(0, skip), 24);
  const length = lead[lead.length - 1].at;
  for (let at = skip + 1; at < tailAt; at++) {
    const arriving = headingIn(first[at - 1], before[at - 1]);
    const leaving = headingOut(first[at], before[at]);
    if (arriving.x * leaving.x + arriving.y * leaving.y > -0.7) continue;
    const p = before[at];
    if (nearest(p, lead).d > EAR_ON * length) continue;
    if (
      distance(p, lead[0]) < EAR_FROM_ENDS * length ||
      distance(p, lead[lead.length - 1]) < EAR_FROM_ENDS * length
    ) {
      continue;
    }
    return at;
  }
  return null;
}

/**
 * The arm of an `s` climbs from the bottom of the bowl at about this angle
 * to the line it was entered by, drawn to the specimen.
 */
const CLIMB = (50 * Math.PI) / 180;
/**
 * How far the arm's first handle reaches, as a share of the way to the
 * line: it leaves the bowl exactly the way it always has, so the curve that
 * replaces it stays smooth with the stroke before it, and only its length
 * is drawn to the specimen.
 */
const LEAVE = 0.203;
/**
 * The arm's second handle, as a share of the way from the bowl to the line
 * and a share off to the side of that line, drawn to the specimen: the
 * curve dips a little wide of the line before swinging in to meet it. The
 * line is where it turns back, so nothing here need stay smooth with what
 * comes after.
 */
const ARRIVE = { along: 0.507, aside: -0.0724 };

/** Where a ray from `from` first meets the polyline, or null. */
function firstMeeting(from: Point, ray: Point, line: Point[]): Point | null {
  let best: { at: Point; along: number } | null = null;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const dx = line[i].x - a.x;
    const dy = line[i].y - a.y;
    const turn = ray.x * dy - ray.y * dx;
    if (turn === 0) continue;
    const along = ((a.x - from.x) * dy - (a.y - from.y) * dx) / turn;
    const across = ((a.x - from.x) * ray.y - (a.y - from.y) * ray.x) / turn;
    if (along <= 0 || across < 0 || across > 1) continue;
    if (best === null || along < best.along) {
      best = { at: { x: a.x + across * dx, y: a.y + across * dy }, along };
    }
  }
  return best?.at ?? null;
}

/**
 * Where an arm climbing from `from` along `ray` meets the line, or, when it
 * would pass just clear of the line's end, the point of the line that lies
 * nearest the way it climbs.
 */
function meeting(from: Point, ray: Point, line: Point[]): Point | null {
  const exact = firstMeeting(from, ray, line);
  if (exact !== null) return exact;
  const wanted = Math.atan2(ray.y, ray.x);
  let best: { at: Point; off: number } | null = null;
  for (const p of line) {
    if (p.y >= from.y || (p.x - from.x) * ray.x <= 0) continue;
    const off = Math.abs(Math.atan2(p.y - from.y, p.x - from.x) - wanted);
    if (best === null || off < best.off) best = { at: p, off };
  }
  return best === null ? null : { x: best.at.x, y: best.at.y };
}

/**
 * The arm of an ear carried on to the line the letter is entered by, when
 * that line runs clear of where the arm ends. After a letter that leaves
 * from the top of the line, the join crosses well above where the lead-in
 * would have been, and a short arm would hang in the air. So the arm is
 * drawn again as one smooth curve from the bottom of the bowl, climbing up
 * and out to meet the line, and back over the same ground.
 *
 * `start` is where the arm leaves the bowl, `arm` and `back` the arm and the
 * way back as drawn, and `entry` the line the letter is entered by, from
 * `from`. Null when the arm already ends on that line, or when a way back
 * that does not return to `start` would make a different letter.
 */
export function armTo(
  start: Point,
  arm: Segment,
  back: Segment,
  from: Point,
  entry: Segment[],
  scale: number,
): { arm: Segment; back: Segment } | null {
  const tip = endOf(arm);
  if (distance(endOf(back), start) > 1) return null;
  const line = flatten([{ type: "M", points: [from.x, from.y] }, ...entry], 40);
  if (nearest(tip, line).d <= EAR_TOUCHES * scale) return null;
  const leaving = headingOut(arm, start);
  const side = leaving.x < 0 ? -1 : 1;
  const toward = { x: side * Math.cos(CLIMB), y: -Math.sin(CLIMB) };
  const meets = meeting(start, toward, line);
  if (meets === null) return null;
  const reach = distance(start, meets);
  const along = unit(start, meets);
  let aside = { x: -along.y, y: along.x };
  if (leaving.x * aside.x + leaving.y * aside.y > 0) {
    aside = { x: -aside.x, y: -aside.y };
  }
  const h1 = {
    x: start.x + leaving.x * LEAVE * reach,
    y: start.y + leaving.y * LEAVE * reach,
  };
  const h2 = {
    x: start.x + (along.x * ARRIVE.along + aside.x * ARRIVE.aside) * reach,
    y: start.y + (along.y * ARRIVE.along + aside.y * ARRIVE.aside) * reach,
  };
  const climbing: Segment = {
    type: "C",
    points: [
      tenth(h1.x),
      tenth(h1.y),
      tenth(h2.x),
      tenth(h2.y),
      tenth(meets.x),
      tenth(meets.y),
    ],
  };
  return { arm: climbing, back: reversed(climbing, start) };
}
