/**
 * A line to count along.
 *
 * The first thing a child adds with, before they add: 6 + 3 is six hops and
 * then three more. So it is a drawing aid attached to a problem rather than a
 * block of its own — the problem-grid block is the shared primitive every
 * maths family reuses, and a line under a sum is part of the sum.
 *
 * Where the ticks go is arithmetic, so it lives here and not in the renderer,
 * for the same reason `ruleLines` does: a spacing that a browser worked out is
 * a spacing no test can check.
 */
import type { Mil, NumberLine } from "./types";

import { inches } from "./paper";

/** The axis, its ticks, and the labels under them. */
export const NUMBER_LINE_HEIGHT: Mil = inches(0.34);

/**
 * Room at each end for the outermost label, which is centred on its tick and
 * would otherwise be cut in half by the edge of the drawing. Enough for three
 * digits at the size below.
 *
 * Here rather than in the renderer that draws it, because the spacing chosen
 * below is chosen against the width that is left once both ends are paid for.
 * A second copy of this number in the view would be a line whose labels
 * overlap in exactly the cases the arithmetic here said they would not.
 */
export const LINE_INSET: Mil = 140;

/** The size a tick label is set at — about 9pt. */
export const LABEL_SIZE: Mil = 125;

/**
 * How wide a digit is at `LABEL_SIZE`.
 *
 * A little over half the size it is set at, which is what a digit measures in
 * every face a browser would pick for this. Not exact — the engine has no font
 * to ask — and it does not need to be: it is the input to "will these two
 * labels touch?", and the answer is only ever used to step down to the next
 * spacing a child would count in.
 */
const DIGIT = 0.62;

/**
 * The spacings a line is allowed to count in.
 *
 * Ones, twos, fives and the tens above them — the intervals a child already
 * counts in. Nothing here is a spacing nobody would say out loud: a line
 * marked every seven is arithmetic homework of its own.
 */
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * How much room the labels on a line need, tick to tick.
 *
 * The widest label, plus a digit's worth of air: labels are centred on their
 * ticks, so two of them exactly one label apart are two labels touching. The
 * widest is measured rather than assumed, because a line that runs to 100 to
 * cover a range of 20 is a three-digit label on a two-digit sheet.
 *
 * Exported because it is the readability promise itself, and the only thing a
 * test can hold the spacing below to.
 */
export function labelRoom(marks: number[]): Mil {
  const widest = marks.reduce(
    (most, value) => Math.max(most, String(value).length),
    1,
  );
  return Math.ceil((widest + 1) * LABEL_SIZE * DIGIT);
}

/** Whether a line's labels have the room `labelRoom` says they need. */
function fits(line: NumberLine): boolean {
  const marks = ticks(line);
  if (marks.length < 2) return false;
  const usable = Math.max(0, line.width - LINE_INSET * 2);
  return usable / (marks.length - 1) >= labelRoom(marks);
}

/**
 * A line at one candidate spacing, covering `low` to `high` in `least` steps
 * at the fewest.
 */
function lineAt(
  low: number,
  high: number,
  width: Mil,
  step: number,
  least: number,
): NumberLine {
  const from = Math.min(0, Math.floor(low / step) * step);
  return {
    from,
    to: Math.max(from + step * least, up(high, step)),
    step,
    width,
  };
}

/** A line is worth counting along at five steps; below that it is two ticks. */
const WANTED_STEPS = 5;

/**
 * A number line covering everything between `low` and `high`.
 *
 * One line for the whole sheet rather than one per problem: a child reads the
 * scale once and then uses it twenty times, and twenty lines drawn at twenty
 * different scales is twenty things to read. Zero is always on it, because
 * that is where counting starts.
 *
 * The spacing is chosen against the `width` the line is actually drawn in, and
 * that is the whole of why `width` is a parameter rather than something the
 * caller stamps on afterwards. `columns` is a setting a parent picks and six of
 * them is legal, which leaves a line an inch of paper — nine two-digit labels
 * across an inch is unreadable, and print is the whole of the output path, so
 * there is no screen it looks wrong on first.
 */
export function numberLine(low: number, high: number, width: Mil): NumberLine {
  // Five steps if they fit, and if they don't, fewer ticks further apart: a
  // short line a child can read beats a long one whose numbers run together.
  for (const least of [WANTED_STEPS, 1]) {
    const step = STEPS.find((by) => fits(lineAt(low, high, width, by, least)));
    if (step !== undefined) return lineAt(low, high, width, step, least);
  }
  // Nothing fits, which means the column is too narrow for the numbers on it
  // whatever is done. The coarsest spacing is the fewest labels there are.
  return lineAt(low, high, width, STEPS[STEPS.length - 1], 1);
}

/** Every labelled value on a line, left to right. */
export function ticks(line: NumberLine): number[] {
  if (line.step <= 0 || line.to <= line.from) return [];
  const count = Math.floor((line.to - line.from) / line.step) + 1;
  return Array.from({ length: count }, (_, i) => line.from + i * line.step);
}

const up = (value: number, step: number) => Math.ceil(value / step) * step;
