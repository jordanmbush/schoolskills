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
 * The spacings a line is allowed to count in.
 *
 * Ones, twos, fives and the tens above them — the intervals a child already
 * counts in. Nothing here is a spacing nobody would say out loud: a line
 * marked every seven is arithmetic homework of its own.
 */
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];

/**
 * The most ticks a line carries before its labels touch.
 *
 * Twelve two-digit labels across a three-inch column is about a quarter of an
 * inch each, which is legible at the small type a tick label is set in. More
 * than that and the line stops being something to count along.
 */
const MAX_TICKS = 12;

/**
 * A number line covering everything between `low` and `high`.
 *
 * One line for the whole sheet rather than one per problem: a child reads the
 * scale once and then uses it twenty times, and twenty lines drawn at twenty
 * different scales is twenty things to read. Zero is always on it, because
 * that is where counting starts.
 */
export function numberLine(low: number, high: number, width: Mil): NumberLine {
  const span = Math.max(1, Math.max(0, high) - Math.min(0, low));
  const step =
    STEPS.find((by) => span / by <= MAX_TICKS) ?? STEPS[STEPS.length - 1];
  const from = Math.min(0, Math.floor(low / step) * step);
  // At least five steps, so a line for single digits is still a line rather
  // than a pair of ticks with the answer between them.
  return { from, to: Math.max(from + step * 5, up(high, step)), step, width };
}

/** Every labelled value on a line, left to right. */
export function ticks(line: NumberLine): number[] {
  if (line.step <= 0 || line.to <= line.from) return [];
  const count = Math.floor((line.to - line.from) / line.step) + 1;
  return Array.from({ length: count }, (_, i) => line.from + i * line.step);
}

const up = (value: number, step: number) => Math.ceil(value / step) * step;
