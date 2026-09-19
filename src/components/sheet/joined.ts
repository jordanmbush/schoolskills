/**
 * Letters written as one line where they join (§25).
 *
 * A hand that joins draws each letter as it is written alone, with a lead-in
 * and an exit tail, and its `Join` says how many segments of the first
 * stroke each of those is. Two letters that join are the first without its
 * tail, one connecting curve, and the second without its lead-in — and the
 * run carries on for as long as each letter joins out and the next joins in.
 * What comes out is one path per run for the line the pen never lifts from,
 * followed by the strokes the pen comes back for, the dots and crossbars,
 * in the order the letters sit. A run is then one thing to the guide layout,
 * which is right: a joined pair is written as one stroke and numbered so.
 *
 * The connecting curve is a cubic from the point where the first letter's
 * body ends, heading the way its tail set off, to the point where the second
 * letter's body starts, heading the way its lead-in arrived — so a rise from
 * the baseline turns over into the next letter's first hump, and a bridge
 * from the top of an `o` dips and climbs into a loop, without a drawing of
 * either. Both handles are the same share of the distance between the two
 * points, tuned on the specimen: shorter and a join is a straight brace,
 * longer and it swings out into a loop of its own.
 *
 * Whether a join sets off from the midline is read off the first letter
 * rather than stored: a body that ends nearer the midline than the baseline
 * leaves from its top, the way `o`, `v`, `w` and `b` do, and a join from
 * there covers the top of a round letter instead of climbing into it
 * (`Join.top`).
 *
 * A letter with no lead-in is entered where it starts, and how the join
 * arrives depends on which way the letter sets off. Over the top of a bowl
 * or along the bar of an `e`, the join arrives heading that way and the
 * curve flows into the letter. Down a stem — the unlooped models draw every
 * `i`, `t`, `n` and `b` from the top, with nothing for a join to replace —
 * the join arrives along the straight line from where it left, since a pen
 * with no lead-in to trace goes to the top of the stem directly and turns
 * there. Arriving the way the stem sets off would swing the join up over the
 * top of the stem and back down into it.
 *
 * A capital begins its word: its join is `initial`, so a run ends before it
 * whatever the letter before it did. The run it starts keeps any stroke the
 * capital writes before the one that joins — the stem of a `K` — ahead of
 * the line, so a model's numbering is still the pen's order.
 */
import type { Join } from "@/engine/sheets/hands/hand";

import type { Point, Segment } from "./glyphs";

export type Placed = {
  /** The letter's strokes on the sheet, in mil. */
  strokes: Segment[][];
  join?: Join;
};

/** The share of the distance between two letters each handle of a join takes. */
const HANDLE = 0.42;

const tenth = (value: number): number => Math.round(value * 10) / 10;

const endOf = (segment: Segment): Point => ({
  x: segment.points[segment.points.length - 2],
  y: segment.points[segment.points.length - 1],
});

/** The direction the pen has when it leaves `from` along `segment`, as a unit vector. */
function headingOut(segment: Segment, from: Point): Point {
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
function headingIn(segment: Segment, from: Point): Point {
  const end = endOf(segment);
  const controls: Point[] = [from];
  for (let i = 0; i < segment.points.length - 2; i += 2) {
    controls.push({ x: segment.points[i], y: segment.points[i + 1] });
  }
  const last =
    [...controls].reverse().find((p) => p.x !== end.x || p.y !== end.y) ?? from;
  return unit(last, end);
}

function unit(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length === 0 ? { x: 1, y: 0 } : { x: dx / length, y: dy / length };
}

/**
 * How a join arrives at a letter with no lead-in: the way the letter sets
 * off, unless that is downward, when it is the straight line in from where
 * the join left. `from` and `to` are on the sheet, y down.
 */
function entering(from: Point, to: Point, setsOff: Point): Point {
  return setsOff.y > 0 ? unit(from, to) : setsOff;
}

function connector(from: Point, out: Point, to: Point, into: Point): Segment {
  const reach = HANDLE * Math.hypot(to.x - from.x, to.y - from.y);
  return {
    type: "C",
    points: [
      tenth(from.x + out.x * reach),
      tenth(from.y + out.y * reach),
      tenth(to.x - into.x * reach),
      tenth(to.y - into.y * reach),
      to.x,
      to.y,
    ],
  };
}

/** The joining stroke in its parts: the point before each segment, for the tangents. */
function walk(stroke: Segment[]): Point[] {
  const before: Point[] = [];
  let at: Point = { x: 0, y: 0 };
  for (const segment of stroke) {
    before.push(at);
    at = endOf(segment);
  }
  return before;
}

type Exit = { at: Point; heading: Point; mid: boolean };

type Run = {
  /** The strokes the run's first letter writes before its joining stroke. */
  before: Segment[][];
  line: Segment[];
  marks: Segment[][];
  tail: Segment[];
  exit: Exit | null;
};

/**
 * The letters grouped into what the pen draws without lifting: each entry is
 * one letter's strokes, or one joined run's. `baseline` and `midline` are
 * where the letters stand and where the x-height sits on the sheet, in mil,
 * y down.
 */
export function joined(
  letters: Placed[],
  baseline: number,
  midline: number,
): Segment[][][] {
  const units: Segment[][][] = [];
  let run: Run | null = null;
  const halfway = (baseline + midline) / 2;

  const close = () => {
    if (run === null) return;
    units.push([...run.before, [...run.line, ...run.tail], ...run.marks]);
    run = null;
  };

  for (const letter of letters) {
    const join = usable(letter);
    if (join === null) {
      close();
      if (letter.strokes.length > 0) units.push(letter.strokes);
      continue;
    }
    const index = join.stroke ?? 0;
    const first = letter.strokes[index] ?? [];
    const written = letter.strokes.slice(0, index);
    const marks = letter.strokes.slice(index + 1);
    const before = walk(first);
    const tailAt = first.length - join.tail;
    const tail = first.slice(tailAt);
    const bodyEnd = before[tailAt] ?? endOf(first[first.length - 1]);
    const exit: Exit | null =
      join.tail > 0
        ? {
            at: bodyEnd,
            heading: headingOut(tail[0], bodyEnd),
            mid: bodyEnd.y < halfway,
          }
        : null;

    if (join.initial) close();
    if (run === null || run.exit === null) {
      close();
      run = {
        before: written,
        line: first.slice(0, tailAt),
        marks,
        tail,
        exit,
      };
      if (exit === null) close();
      continue;
    }

    // Joined in: drop the lead-in, and the top of a bowl after a bridge.
    const skip = 1 + join.lead + (run.exit.mid ? (join.top ?? 0) : 0);
    const start = before[skip] ?? endOf(first[skip - 1]);
    const arriving =
      skip > 1
        ? headingIn(first[skip - 1], before[skip - 1])
        : entering(run.exit.at, start, headingOut(first[skip], start));
    run.line.push(connector(run.exit.at, run.exit.heading, start, arriving));
    run.line.push(...first.slice(skip, tailAt));
    run.marks.push(...written, ...marks);
    run.tail = tail;
    run.exit = exit;
    if (exit === null) close();
  }
  close();
  return units;
}

/** The join, or nothing for a letter whose first stroke is too short to have one. */
function usable(letter: Placed): Join | null {
  const join = letter.join;
  const first = letter.strokes[join?.stroke ?? 0];
  if (join === undefined || first === undefined) return null;
  const kept = first.length - 1 - join.lead - join.tail - (join.top ?? 0);
  return kept >= 1 ? join : null;
}
