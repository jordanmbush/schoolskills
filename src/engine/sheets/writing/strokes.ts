/**
 * The strokes a letter is built from, as patterns to draw across a ruling.
 *
 * Every handwriting scheme opens with these before it opens with a letter,
 * and the copybooks that taught penmanship for a century kept them going long
 * after — a line of ovals and push-pulls was the warm-up before every lesson —
 * because a letter is two or three of these joined, and a hand that can draw
 * one evenly, at speed, to the end of a line can form the letter (§24).
 *
 * A pattern here is a name and what it needs of the ruling; how it is drawn
 * is `components/sheet/strokes.ts`, which is geometry rather than text and so
 * the same in every face. The one thing the engine has to know is whether the
 * row has the room a pattern wants: a tail loop drops into the descender
 * space, and a ruling without one has nowhere to put it.
 */
import { own, rulePitch, writingSpace } from "../paper";
import type { Rule, StrokePattern } from "../types";

export type StrokeSet = {
  id: StrokePattern;
  /** What it is called in a picker and in a description. */
  label: string;
  /** Which letters it is the beginning of, in one line a parent can read. */
  blurb: string;
  /** Whether it drops below the baseline, and so needs a tail space. */
  tail: boolean;
};

/**
 * The nine, in the order they are taught: straight before curved, lifted
 * before continuous, and the two loops last because they are the two strokes
 * only a joined hand needs.
 */
export const STROKE_PATTERNS: StrokeSet[] = [
  {
    id: "lines",
    label: "Straight lines",
    blurb:
      "Down from the top line to the baseline — the stroke that starts l, t, i and b, and every capital with a stem.",
    tail: false,
  },
  {
    id: "slants",
    label: "Slanted lines",
    blurb:
      "The same stroke leaning: top line to baseline at an angle, for v, w, x, k and z.",
    tail: false,
  },
  {
    id: "circles",
    label: "Circles",
    blurb:
      "Round from the top and all the way back, between the midline and the baseline: c, o, a, d, g and q.",
    tail: false,
  },
  {
    id: "zigzag",
    label: "Zigzags",
    blurb:
      "Straight lines that change direction without the pencil lifting — v, w and z at speed.",
    tail: false,
  },
  {
    id: "waves",
    label: "Waves",
    blurb:
      "A curve that rolls on without a corner: the shape of a joined u and n, and the test of an even hand.",
    tail: false,
  },
  {
    id: "humps",
    label: "Humps",
    blurb:
      "Up to the midline, over and back down to the baseline, the way n and m are made.",
    tail: false,
  },
  {
    id: "cups",
    label: "Cups",
    blurb: "Down, round the bottom and up again: u, and the bottom of y and w.",
    tail: false,
  },
  {
    id: "loops",
    label: "Loops",
    blurb:
      "Up to the top line and back down through the stroke, the way a joined l, h and b begin.",
    tail: false,
  },
  {
    id: "tails",
    label: "Tail loops",
    blurb:
      "Down below the baseline and back up through the stroke, for a joined g, j, y and f. Needs room for a tail under the lines.",
    tail: true,
  },
];

const BY_ID: Record<string, StrokeSet> = Object.fromEntries(
  STROKE_PATTERNS.map((set) => [set.id, set]),
);

/**
 * A pattern by id, or the first one — never a throw, because the id comes
 * out of a saved config and a pattern retired since it was saved should print
 * straight lines rather than nothing.
 */
export const strokePattern = (id: string): StrokeSet =>
  own(BY_ID, id, STROKE_PATTERNS[0]);

/** Whether a ruling leaves room under the baseline for a tail. */
export const hasTail = (rule: Rule): boolean =>
  rulePitch(rule) > writingSpace(rule);

/**
 * The patterns a sheet draws: the ones asked for, in the order asked, or all
 * nine in teaching order when nothing was.
 *
 * An id this build has never heard of is dropped rather than resolved, so a
 * saved list of three retired patterns prints the six that are left rather
 * than six rows of straight lines. A tail loop on a ruling with no tail space
 * is dropped too — it would print through the row below, which is worse than
 * a row missing. A list that has nothing left in it falls back to all of them.
 */
export function strokePatterns(
  asked: StrokePattern[] | undefined,
  rule: Rule,
): StrokePattern[] {
  const room = hasTail(rule);
  const fits = (set: StrokeSet): boolean => room || !set.tail;
  const chosen = (asked ?? [])
    .filter((id) => Object.hasOwn(BY_ID, id))
    .map((id) => BY_ID[id])
    .filter(fits);
  const sets = chosen.length > 0 ? chosen : STROKE_PATTERNS.filter(fits);
  return [...new Set(sets.map((set) => set.id))];
}
