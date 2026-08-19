import { percent } from "@/engine/format";
import { lessonNumbered, type Lesson } from "@/engine/typing/lessons";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { KeyBar, Verdict } from "@/engine/typing/verdict";

/**
 * A verdict, in a sentence a seven-year-old reads once (docs/typing.md §6.1).
 *
 * The whole reason there are three bars rather than one score is that **a
 * single number tells you that you failed and not what to do**. Bars alone are
 * only most of the way there: a child who has just missed something has to
 * read three of them, compare each against its mark and work out which one
 * cost them the lesson. This file does that reading for them and says it in
 * words — "you were fast enough; the `z` key needs more practice" — which is
 * the difference between a score and an instruction.
 *
 * Strings rather than JSX on purpose. What is hard here is the *choice* — which
 * bar to name, which to praise, and what a storm says instead — and keeping it
 * as text in, text out is what lets that choice be pinned by a test without a
 * results screen, a router and a hub around it.
 */

/**
 * The new keys, as one bar.
 *
 * A lesson introduces two characters as a rule, six at lesson 67 and fifteen at
 * lesson 31 — and fifteen bars is a wall rather than a signal. So the bar shown
 * is the key that is holding you up, because the gate is every key at once
 * (§6.4): the run is only through when the weakest one is, and naming it is the
 * instruction the child needs.
 *
 * "Weakest" is a not-yet-passed key before a lower fraction, which is not the
 * same ordering. A key struck right three times reads 100% and is still not
 * `ok`, because the strike floor is the half of the gate a fraction cannot
 * carry — so a bar that looks full and one that looks nearly full can be the
 * failing one and the passing one respectively.
 */
export function weakestKey(keys: KeyBar[]): KeyBar | null {
  return keys.reduce<KeyBar | null>((worst, key) => {
    if (!worst) return key;
    if (worst.ok !== key.ok) return worst.ok ? key : worst;
    return key.got < worst.got ? key : worst;
  }, null);
}

/** Sentence case and a full stop, so the clauses below can be written plain. */
const sentence = (text: string) =>
  `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;

/**
 * Why this run did not pass, and what was already there.
 *
 * Two clauses, and the order of the first is §6.1's order — accuracy, then the
 * new keys, then speed — because that is the order the criteria matter in and
 * therefore the order to fix them in. A child failing accuracy *and* speed is
 * told about accuracy: speeding up would only make it worse.
 *
 * The praise is the last bar that was met, read the other way down the same
 * list, which is why it can never name the bar the fix just named. It is not
 * decoration. "You were fast enough" is the half of the instruction that says
 * *don't change that* — without it, a child who slows down to fix `z` and
 * drops under the speed bar has been taught the wrong lesson by a screen that
 * only ever said no.
 *
 * Only ever called on a run that did not pass.
 */
export function missNote(lesson: Lesson, verdict: Verdict): string {
  // ── The storm arm (§6.1, §8.7) ────────────────────────────────────────────
  // A Hailstorm level is marked on surviving the wave and on accuracy, and
  // `Verdict` carries no bar for the first of them — surviving is a fact about
  // the run's length, so §6.1's type leaves `wpm` full and `keys` empty and
  // lets `passed` carry it. That is right for the model and wrong on a screen:
  // full bars over the word "failed" read as a bug at seven. So the storm's
  // reason is stated in words here, and `PassBars` draws no bar a storm was
  // never asked for.
  //
  // Which reason is decidable from the verdict alone: `passed` is accuracy AND
  // survival, so a failed run with its accuracy bar met can only have died in
  // the wave. Nothing about how a wave works is invented here — that is #159's
  // to build, and this is what the screen says until it does.
  if (lesson.pass.kind === "storm") {
    return verdict.accuracy.ok
      ? sentence("the wave got through — you have to face the whole storm")
      : sentence(
          `the storm wants ${percent(verdict.accuracy.need)} of the letters, and you hit ${percent(verdict.accuracy.got)}`,
        );
  }

  const key = weakestKey(verdict.keys);
  const fix = !verdict.accuracy.ok
    ? `slow down — ${percent(verdict.accuracy.need)} of your words have to be right, and you were at ${percent(verdict.accuracy.got)}`
    : key && !key.ok
      ? `the ${key.key} key needs more practice`
      : `a bit faster — ${verdict.wpm.need} words a minute, and you were at ${Math.round(verdict.wpm.got)}`;

  const praise = verdict.wpm.ok
    ? "you were fast enough"
    : verdict.keys.length > 0 && verdict.keys.every((bar) => bar.ok)
      ? "your new keys are there"
      : verdict.accuracy.ok
        ? "your accuracy is there"
        : null;

  return praise ? sentence(`${praise}; ${fix}`) : sentence(fix);
}

/**
 * Which lesson a pass just opened, and the line that says so (§6.5, §6.6).
 *
 * Unlock is `max(cleared) + 1`, so the run that just cleared the frontier is
 * the one whose number `best` now IS — which is the whole test for "did this
 * open anything". A child at lesson 41 replaying lesson 3 opens nothing, and
 * is told where they are up to instead of being told a lie; passing checkpoint
 * 40 from a standing start opens 41, because clearing a checkpoint clears
 * everything below it by that same `max`.
 *
 * `next` is the ladder's own pointer, already carried over any Hailstorm level
 * standing in the way (§8.8) — so the lesson this hands back is never a storm,
 * and the button built on it never sends a child to a wave they did not ask
 * for. At the top of the hundred it is `null`, and there is no next lesson to
 * offer.
 */
export function nextNote(
  lesson: Lesson,
  progress: LadderProgress,
): { next: Lesson | null; text: string } {
  const next = progress.next > lesson.n ? lessonNumbered(progress.next) : null;

  if (!next) {
    return { next, text: "That is the top of the ladder. Every lesson done." };
  }
  return {
    next,
    text:
      progress.best === lesson.n
        ? `Lesson ${next.n} just opened: ${next.title}.`
        : `Next up is lesson ${next.n}: ${next.title}.`,
  };
}
