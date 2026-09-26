/**
 * The ear of an `s` (§25): where the letter turns back on its own lead-in,
 * and the spur that carries it on to a join that runs clear of it.
 */
import { distance, flatten, nearest, type Point, type Segment } from "./glyphs";
import { headingIn, headingOut, tenth, unit } from "./links";

/**
 * How near the line it was entered by a turn-back must lie, as a share of
 * that line's length, to be the ear that meets it; and how far from either
 * end of the line, since a turn-back at the far end is the letter's own peak.
 */
const EAR_ON = 0.05;
const EAR_FROM_ENDS = 0.15;
/** A spur this short, as a share of the lead-in, is already touching the join. */
const EAR_TOUCHES = 0.04;
/** The handles of a spur, as a share of its length. */
const SPUR = 0.5;

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
 * The stroke that carries an ear on to the join, when the join runs clear of
 * it: from the ear, the way the arm arrives, curving to meet the nearest
 * point of the join square on. Null when the ear already touches the join.
 * After a letter that leaves from the top of the line, the join crosses well
 * above where the lead-in would have been, and the ear would hang in the air.
 */
export function spurTo(
  ear: Point,
  arriving: Point,
  from: Point,
  link: Segment,
  scale: number,
): Segment | null {
  const line = flatten([{ type: "M", points: [from.x, from.y] }, link], 40);
  let meets: Point = line[0];
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1];
    const b = line[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const span = dx * dx + dy * dy;
    const along =
      span === 0
        ? 0
        : Math.min(
            Math.max(((ear.x - a.x) * dx + (ear.y - a.y) * dy) / span, 0),
            1,
          );
    const point = { x: a.x + along * dx, y: a.y + along * dy };
    if (distance(ear, point) < distance(ear, meets)) meets = point;
  }
  const reach = distance(ear, meets);
  const atEnd = [line[0], line[line.length - 1]].some(
    (p) => distance(p, meets) < 1e-6,
  );
  if (atEnd || reach <= EAR_TOUCHES * scale) return null;
  const toward = unit(ear, meets);
  if (arriving.x * toward.x + arriving.y * toward.y < 0.2) return null;
  const handle = SPUR * reach;
  return {
    type: "C",
    points: [
      tenth(ear.x + arriving.x * handle),
      tenth(ear.y + arriving.y * handle),
      tenth(meets.x - toward.x * handle),
      tenth(meets.y - toward.y * handle),
      tenth(meets.x),
      tenth(meets.y),
    ],
  };
}
