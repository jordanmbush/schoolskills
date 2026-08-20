/**
 * What a streak is worth: one multiplier, for every game that keeps one.
 *
 * It is its own module rather than a pair of exports in `progress.ts` because
 * of who needs it now. `cardXp` folds this curve into the XP for a card, the
 * race draws it on the combo badge, and Hailstorm scales a hit by it and
 * prints it in the HUD (docs/typing.md §8.6) — and `engine/typing/storm.ts`
 * may not import `progress.ts`. That file is reachable from
 * `engine/decks/index.ts`, the front door every island on the site downloads,
 * and `progress.ts` pulls the deck registry, the hundred lessons and the
 * ladder in behind it (§5.3, decision 7); the hundred lessons name a
 * `WaveSpec` on each storm row, which would close the import into a cycle.
 *
 * The alternative was a second `1 + min(streak, 10) / 10` written in the storm,
 * and a second copy of a curve is how a race and a shooter end up paying out
 * on scales that only look the same. A leaf module both can import is three
 * lines and cannot drift.
 */

/**
 * How many hits a combo counts before it stops growing.
 *
 * Ten, so the ceiling is ×2 — worth chasing, and reachable inside a run that
 * a five-year-old will finish. Uncapped it would make the last card of a long
 * race worth more than the first twenty put together, which stops rewarding
 * accuracy and starts rewarding length.
 */
const MAX_COMBO_STEPS = 10;

/** What the next answer is worth, given the streak it lands on: ×1 to ×2. */
export function comboMultiplier(streak: number) {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) / 10;
}
