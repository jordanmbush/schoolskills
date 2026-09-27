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
 * A round letter — one whose first segments are its `top` (`Join.top`) —
 * is entered over its crown, the highest point of that top, whichever line
 * the join sets off from. The join lands there heading right, runs back
 * along the top to where the letter starts, and the letter is written from
 * there over the same ground. So a bridge from an `o` becomes the top of
 * the `a` after it, and a join up from the baseline climbs outside the
 * bowl's back. Landing anywhere else loses a letter: a join that drops past
 * the top into the bowl's side leaves an `a` with no top, which reads as a
 * `u`, and one that climbs to the start of a `c` crosses its open side and
 * closes it into an `e`.
 *
 * Any other letter with no lead-in is entered where it starts. Along the
 * bar of an `e` the join arrives heading that way and the curve flows
 * into the letter. Down a stem — the unlooped models draw every `i`, `t`,
 * `n` and `b` from the top, with nothing for a join to replace — the join
 * arrives along the straight line from where it left, since a pen with no
 * lead-in to trace goes to the top of the stem directly and turns there.
 * Arriving the way the stem sets off would swing the join up over the top
 * of the stem and back down into it.
 *
 * A capital begins its word: its join is `initial`, so a run ends before it
 * whatever the letter before it did. The run it starts keeps any stroke the
 * capital writes before the one that joins — the stem of a `K` — ahead of
 * the line, so a model's numbering is still the pen's order.
 */
import type { Join } from "@/engine/sheets/hands/hand";

import { armTo, earOf } from "./ear";
import { strokeLength, type Point, type Segment } from "./glyphs";
import { landing, type Ground } from "./landing";
import {
  connector,
  endOf,
  headingIn,
  headingOut,
  reversed,
  unit,
} from "./links";

export type { Ground } from "./landing";

export type Placed = {
  /** The letter's strokes on the sheet, in mil. */
  strokes: Segment[][];
  join?: Join;
};

/**
 * How a join arrives at a letter with no lead-in and no bowl: the way the
 * letter sets off, unless that is downward, when it is the straight line in
 * from where the join left. `from` and `to` are on the sheet, y down.
 */
function entering(from: Point, to: Point, setsOff: Point): Point {
  return setsOff.y > 0 ? unit(from, to) : setsOff;
}

/**
 * Where a join into a round letter lands: on the crown, the highest point
 * of the `top` segments after `skip`, heading against the way the letter
 * leaves it. `back` is the top from the crown back to where the letter
 * starts, which the letter then writes again.
 */
function overCrown(
  first: Segment[],
  before: Point[],
  skip: number,
  top: number,
): { at: Point; heading: Point; back: Segment[] } {
  let crown = skip;
  for (let at = skip + 1; at <= skip + top && at < first.length; at++) {
    if (before[at].y < before[crown].y) crown = at;
  }
  const at = before[crown];
  const leaving = headingOut(first[crown], at);
  const back = first
    .slice(skip, crown)
    .map((segment, k) => reversed(segment, before[skip + k]))
    .reverse();
  return { at, heading: { x: -leaving.x, y: -leaving.y }, back };
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

/** A crossbar: one level straight stroke, long enough not to be a dot. */
function level(
  stroke: Segment[],
  least: number,
): { from: Point; to: Point } | null {
  if (stroke.length !== 2 || stroke[1].type !== "L") return null;
  const from = { x: stroke[0].points[0], y: stroke[0].points[1] };
  const to = endOf(stroke[1]);
  return Math.abs(to.y - from.y) < 1 && to.x - from.x >= least
    ? { from, to }
    : null;
}

/**
 * The strokes a letter comes back for, with its crossbar written on to the
 * crossbar of the letter before when the two are level and nearly meet: the
 * two t's of `tt` are crossed with one bar, as a pen does it. `marks` are the
 * run's strokes so far, and the bar is drawn on in place there.
 */
function crossed(
  marks: Segment[][],
  next: Segment[][],
  ground?: Ground,
): Segment[][] {
  if (ground === undefined || marks.length === 0 || next.length === 0) {
    return next;
  }
  const least = 0.25 * ground.xHeight;
  const a = level(marks[marks.length - 1], least);
  const b = level(next[0], least);
  if (
    a === null ||
    b === null ||
    Math.abs(a.from.y - b.from.y) >= 1 ||
    b.from.x <= a.from.x ||
    b.from.x - a.to.x > 0.35 * ground.xHeight
  ) {
    return next;
  }
  marks[marks.length - 1] = [
    { type: "M", points: [a.from.x, a.from.y] },
    { type: "L", points: [Math.max(a.to.x, b.to.x), a.to.y] },
  ];
  return next.slice(1);
}

type Exit = { at: Point; heading: Point };

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
 * one letter's strokes, or one joined run's.
 */
export function joined(letters: Placed[], ground?: Ground): Segment[][][] {
  const units: Segment[][][] = [];
  let run: Run | null = null;

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
        ? { at: bodyEnd, heading: headingOut(tail[0], bodyEnd) }
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

    // Joined in: drop the lead-in.
    const skip = 1 + join.lead;
    const kept = first.slice(skip, tailAt);
    if (join.top) {
      const crown = overCrown(first, before, skip, join.top);
      run.line.push(
        connector(run.exit.at, run.exit.heading, crown.at, crown.heading),
        ...crown.back,
      );
    } else {
      let start = before[skip] ?? endOf(first[skip - 1]);
      let arriving =
        skip > 1
          ? headingIn(first[skip - 1], before[skip - 1])
          : entering(run.exit.at, start, headingOut(first[skip], start));
      let from = skip;
      const lands =
        ground !== undefined && skip > 1
          ? landing(first, before, skip, tailAt, run.exit.at, ground)
          : null;
      if (lands !== null) {
        start = lands.at;
        arriving = lands.heading;
        from = lands.index;
        kept.splice(
          0,
          kept.length,
          lands.rest,
          ...first.slice(lands.index + 1, tailAt),
        );
      }
      const link = connector(run.exit.at, run.exit.heading, start, arriving);
      run.line.push(link);
      const ear = earOf(first, before, skip, tailAt);
      if (ear !== null && (lands === null || ear - 1 > from)) {
        const reach = armTo(
          before[ear - 1],
          first[ear - 1],
          first[ear],
          run.exit.at,
          lands === null ? [link] : [link, lands.rest],
          strokeLength(first.slice(0, skip)),
        );
        if (reach !== null)
          kept.splice(ear - 1 - from, 2, reach.arm, reach.back);
      }
    }
    run.line.push(...kept);
    run.marks.push(...crossed(run.marks, [...written, ...marks], ground));
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
  const kept = first.length - 1 - join.lead - join.tail;
  return kept >= 1 ? join : null;
}
