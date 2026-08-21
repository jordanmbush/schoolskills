/**
 * What a streak is worth: one multiplier, for every game that keeps one.
 *
 * A leaf module rather than two more exports on `progress.ts`, because
 * `engine/typing/storm.ts` needs the curve and may not import that file
 * (docs/typing.md §8.6). The alternative was a second `1 + min(streak, 10) / 10`
 * written in the storm, and a second copy of a curve is how a race and a
 * shooter end up paying out on scales that only look the same.
 */

/**
 * How many hits a combo counts before it stops growing.
 *
 * Ten, so the ceiling is reachable inside a run a five-year-old will finish.
 * Uncapped, the last card of a long race would be worth more than the first
 * twenty put together, which stops rewarding accuracy and starts rewarding
 * length.
 */
const MAX_COMBO_STEPS = 10;

/**
 * What the next answer is worth, given the streak it lands on: ×1 to ×2.
 *
 * The ceiling is the cap divided by itself, so retuning `MAX_COMBO_STEPS`
 * changes how fast a child climbs and never what they climb to.
 */
export function comboMultiplier(streak: number) {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) / MAX_COMBO_STEPS;
}
