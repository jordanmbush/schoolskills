import { unlockedAt } from "./keys";
import { LESSONS, type Lesson, type StormFocus } from "./lessons";
import { buildWave, type Wave, type WaveSpec } from "./storm";

/**
 * The twenty Hailstorm levels, as waves (docs/typing.md §5.6, §8.1, §8.3).
 *
 * `lessons.ts` writes down what each storm *is* — how many letters, how far
 * apart, how fast, how deep the shield, whether it repairs — and this module
 * is where that becomes a `WaveSpec` the engine can build. The split is not
 * bookkeeping. It is the whole of the acceptance criterion that **a storm can
 * never ask for a key the ladder has not taught** (decision 56): a
 * `StormShape` has no `keys` field, so there is nowhere on the table to write a character, and the
 * pool can only ever come from `unlockedAt(n)` — the same computed alphabet
 * every lesson's words are drawn from (§5.2). Move lesson 39's storm to rung
 * 12 and it rains what a child at lesson 12 has met, with nothing to edit.
 *
 * ── Why it is not in `lessons.ts` ────────────────────────────────────────────
 * That module is the one file in `engine/typing/` the deck layer may import
 * (§5.3, decision 7), and `unlockedAt` lives in `keys.ts`, which imports the
 * ladder to build the alphabets from it. A pool computed in `lessons.ts` would
 * therefore be a cycle at module load — the alphabets being built out of a
 * table that is still being built. Here, the direction is one way:
 * `lessons.ts` → `storm.ts` (a type, erased), `storms.ts` → both.
 *
 * ── And why the seed is here too ─────────────────────────────────────────────
 * A Hailstorm level is a **level**: the same weather every time it is opened
 * (decision 58). So the wave a child meets at lesson 45 is a function of the
 * ladder and nothing else — not of the visit, not of the clock — which is what
 * lets the no-strobe rule (§8.10) be measured on the twenty waves that
 * actually ship rather than on a sample of what the generator might roll.
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
 * a child has at lesson 53 are `3 4 5 6`, because 54, 55 and 56 are still
 * ahead of them, and a hand-written `0123456789` would rain four keys the
 * ladder has not taught.
 *
 * `marks` is everything that is neither a letter nor a digit nor the space —
 * which is what "punctuation and symbols" is, and is stated as the complement
 * so that a symbol added to the layout is in it without an edit here.
 */
const FOCUS: Record<StormFocus, (ch: string) => boolean> = {
  capitals: (ch) => /^[A-Z]$/.test(ch),
  digits: (ch) => /^[0-9]$/.test(ch),
  marks: (ch) => ch.trim() !== "" && !/^[A-Za-z0-9]$/.test(ch),
};

/**
 * How much of a focused level is its focus: **about half**.
 *
 * A share rather than a fixed multiplier, and the reason is lesson 53. Four
 * digits have arrived by then — `3 4 5 6` — against a good sixty letters and
 * marks, so "three copies of each digit" would put 17% of "Hailstorm · Digits"
 * on the number row and the level would be a review lesson wearing a title.
 * At lesson 34 the opposite is true: 26 capitals against 30 other characters
 * means the alphabet is already nearly half capitals and a multiplier that
 * ignored that would rain almost nothing else.
 *
 * So the number of copies is solved for rather than chosen: repeat the focus
 * until it is about as much of the pool as everything else put together. It is
 * still a weighting and never a replacement — a storm is practice at
 * everything the child has, and a "Digits" that rained only digits would be a
 * number-row drill with a shield in front of it.
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
 * The spread is `shape` last so that a level cannot override `keys`, which is
 * the guarantee this module exists for — and `focus` and `seed` ride along
 * into the spec harmlessly. They are inert to `buildWave` (it reads `count`,
 * `gap`, `fall` and `keys`, and carries the rest for the reducer), and having
 * them on the spec means a wave in hand can still say which level it is —
 * which is what a retry rebuilds from (§8.3).
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
