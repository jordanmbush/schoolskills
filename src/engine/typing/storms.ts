import { unlockedAt } from "./keys";
import { LESSONS, type Lesson, type StormFocus } from "./lessons";
import { buildWave, type Wave, type WaveSpec } from "./storm";

/**
 * The twenty Hailstorm levels, as waves (docs/typing.md §5.7, §8.1, §8.3).
 *
 * `lessons.ts` writes down what each storm *is* and this module turns that
 * into a `WaveSpec` the engine can build. The split is the acceptance
 * criterion rather than bookkeeping: a `StormShape` has no `keys` field and
 * the table `satisfies` it, so there is nowhere to write a character down and
 * the pool can only ever come from `unlockedAt(n)` — **a storm can never ask
 * for a key the ladder has not taught** (decision 56). Move lesson 39's storm
 * to rung 12 and it rains what a child at lesson 12 has met, with nothing to
 * edit.
 *
 * It cannot live in `lessons.ts`. That module is the one file in
 * `engine/typing/` the deck layer may import (§5.3, decision 7), and
 * `unlockedAt` lives in `keys.ts`, which imports the ladder to build the
 * alphabets from it — so a pool computed there would be a cycle at module
 * load. Here the direction is one way: `lessons.ts` → `storm.ts` (a type,
 * erased), `storms.ts` → both.
 *
 * The seed is here for the same reason: a level's weather is a function of the
 * ladder and nothing else (decision 58), which is what lets the no-strobe rule
 * (§8.10) be measured on the twenty waves that actually ship rather than on a
 * sample of what the generator might roll.
 */

/**
 * A lesson that is a storm, with its wave in the type rather than in a comment.
 *
 * Every function below takes one of these, so "this lesson has a wave" is
 * checked once, at the door, by `isStormLesson`. The alternative is each of
 * them handing back `null` for a lesson that is a passage, and four callers
 * deciding what to do about an answer that cannot happen.
 */
export type StormLesson = Lesson & {
  kind: Extract<Lesson["kind"], { type: "storm" }>;
};

/**
 * Is this rung a Hailstorm level?
 *
 * Takes `null` and `undefined` because that is what its callers hold: a route
 * param resolved through `lessonById` is a lesson, a lesson that is not a
 * storm, or nothing at all, and all three are answered "no" here rather than
 * at three call sites.
 */
export const isStormLesson = (
  lesson: Lesson | null | undefined,
): lesson is StormLesson => lesson?.kind.type === "storm";

/** The twenty, in ladder order. */
export const STORM_LESSONS: readonly StormLesson[] =
  LESSONS.filter(isStormLesson);

/**
 * What each `focus` name matches, as a test over one character.
 *
 * Named classes rather than character lists, because the list is always "the
 * ones this child has met" — `unlockedAt(n)` filtered, never a set written
 * down beside it. Lesson 53 is the case that makes the difference: the digits
 * a child has by then are `3 4 5 6`, and a hand-written `0123456789` would
 * rain four keys the ladder has not taught.
 *
 * `marks` is stated as the complement — neither letter nor digit nor space —
 * so that a symbol added to the layout is in it without an edit here.
 */
const FOCUS: Record<StormFocus, (ch: string) => boolean> = {
  capitals: (ch) => /^[A-Z]$/.test(ch),
  digits: (ch) => /^[0-9]$/.test(ch),
  marks: (ch) => ch.trim() !== "" && !/^[A-Za-z0-9]$/.test(ch),
};

/**
 * How much of a focused level is its focus: **about half** (§5.7).
 *
 * A share rather than a fixed multiplier, because the two ends of the ladder
 * pull opposite ways. At lesson 53 four digits stand against sixty letters and
 * marks, so "three copies of each" would put 17% of "Hailstorm · Digits" on
 * the number row; at lesson 34 the alphabet is already nearly half capitals,
 * and the same multiplier would rain almost nothing else. So the number of
 * copies is solved for rather than chosen.
 */
const FOCUS_SHARE = 0.5;

/**
 * The characters this level can drop: everything unlocked by its rung, with
 * the level's focus repeated up to `FOCUS_SHARE` of the pool.
 *
 * The space is left in exactly as `unlockedAt` hands it over. `buildWave`
 * drops it — the shield has no thumb segment for it to damage (§8.5) — and
 * dropping it here as well would be a second copy of that rule, in the module
 * least likely to be re-read when the first one changes.
 */
export function stormPool(lesson: StormLesson): string[] {
  const alphabet = [...unlockedAt(lesson.n)];
  const focus = lesson.kind.wave.focus;
  if (!focus) return alphabet;

  const matches = alphabet.filter(FOCUS[focus]);
  // A focus the ladder has not taught yet is no focus at all, and the level
  // still has to be playable: an empty match list would divide by zero here
  // and hand `buildWave` an empty pool, which is a wave of nothing (§8.3).
  // Today no storm is focused on a class its rung has not reached — the test
  // pins that — so this is the safe direction rather than a live case.
  if (matches.length === 0) return alphabet;

  // Solve `copies × m / (rest + copies × m) = FOCUS_SHARE` for `copies`, and
  // never go below doubling: a level that says what it is about has to rain
  // more of it than a level that does not.
  const rest = alphabet.length - matches.length;
  const share = FOCUS_SHARE / (1 - FOCUS_SHARE);
  const copies = Math.max(2, Math.round((rest * share) / matches.length));

  const pool = [...alphabet];
  for (let copy = 1; copy < copies; copy++) pool.push(...matches);
  return pool;
}

/**
 * This level's `WaveSpec`: the shape the table wrote, with the pool the ladder
 * decides.
 *
 * **The level's shape is spread first and `keys` is written last**, so the
 * pool this module computes is the last word and a level cannot override it
 * (decision 56). The ordering is the enforcement at runtime; `satisfies
 * StormShape` on the table in `lessons.ts` is what makes writing a stray
 * `keys` there a type error rather than an inert field this line discards.
 *
 * `focus` and `seed` ride along harmlessly — `buildWave` reads `count`, `gap`,
 * `fall` and `keys` and carries the rest for the reducer — and having them on
 * the spec means a wave in hand can still say which level it is, which is what
 * a retry rebuilds from (§8.3).
 */
export function waveSpecFor(lesson: StormLesson): WaveSpec {
  return { ...lesson.kind.wave, keys: stormPool(lesson) };
}

/**
 * This level's storm, built.
 *
 * One call, so that nothing outside this module has to hold both halves of
 * `(spec, seed)` and no screen can build lesson 45's spec at lesson 39's seed.
 * It is not memoised: a wave is a few dozen small objects and it is built once
 * per run, where a cache would be a second place a level's weather lives.
 */
export function stormWave(lesson: StormLesson): Wave {
  return buildWave(waveSpecFor(lesson), lesson.kind.wave.seed);
}
