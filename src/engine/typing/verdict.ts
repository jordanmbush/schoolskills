import type { CardResult, Session } from "@/engine/types";

import { wordsPerMinute } from "@/engine/decks/typing";
import { accuracyOf } from "@/engine/records";
import type { Lesson, PassCriteria } from "./lessons";

/**
 * Did this run pass this lesson, and if not, which part missed
 * (docs/typing.md §6.1, §6.4)?
 *
 * Three bars rather than one score, for a reason that is about a seven-year-old
 * and not about statistics: **a single number tells you that you failed and not
 * what to do**. Three bars, each either full or not, say "you were fast enough
 * and not accurate enough" or "you have `x` but not `z`", which is an
 * instruction a child can act on. A blended "net WPM" — the industry default —
 * hides exactly the distinction a beginner most needs.
 *
 * So this module never returns a percentage and a verdict. It returns the three
 * criteria side by side, each with what was asked and what arrived, and leaves
 * `passed` as the conjunction of them. What draws them is LES09's problem; what
 * they mean is this file's.
 */

/**
 * One criterion, as a results screen draws it: how far you got, what was asked,
 * and whether that is a full bar.
 *
 * `got` and `need` are in the criterion's own units — a fraction 0–1 for the
 * two accuracy bars, words per minute for the speed one — so a bar renders as
 * `got / need` capped at full without anything having to know which bar it is
 * holding.
 */
export type Bar = { got: number; need: number; ok: boolean };

/** A bar for one newly-introduced character. `key` is that character. */
export type KeyBar = Bar & { key: string };

/**
 * The three bars and their conjunction.
 *
 * The order they are *shown* in is the order they matter — accuracy, then the
 * new keys, then speed (§6.1) — and the order they are written in here is the
 * doc's. A renderer should follow §6.1 rather than the field order.
 */
export type Verdict = {
  passed: boolean;
  accuracy: Bar;
  wpm: Bar;
  /** One per newly-introduced key. Empty on a review or a checkpoint. */
  keys: KeyBar[];
};

/**
 * The parts of a run a verdict is decided on.
 *
 * A `Pick` rather than the whole `Session` for the same reason `records.ts`
 * takes `Scored`: what passes a lesson is what the child did, not which profile
 * did it or when. A caller holding a run that has not been saved yet — the
 * results screen, which shows the bars before the write comes back — can still
 * ask.
 */
export type Run = Pick<
  Session,
  "cards" | "config" | "correct" | "incorrect" | "durationMs"
>;

/** The lesson arm of the criteria, which is the arm with a gate on it. */
type LessonPass = Extract<PassCriteria, { kind: "lesson" }>;

const bar = (got: number, need: number): Bar => ({
  got,
  need,
  ok: got >= need,
});

/**
 * Did the wave get all the way through, or did the run end early (§8.7)?
 *
 * A Hailstorm run is a `Session` like any other, and the one thing that is
 * different about it is that it can stop in the middle: dying at letter 18 of
 * 40 saves a session with eighteen cards, `correct`, `incorrect` and
 * `durationMs` all honest, and the `survive` criterion simply not met. So
 * surviving is "you faced every letter the wave had", and the wave's length
 * (§8.3's `count`) is read off the run's own config rather than off today's
 * ladder — the same rule `configKey` follows (§5.4). A wave re-tuned from forty
 * letters to thirty next year must not hand a pass, in hindsight, to a run that
 * died at eighteen.
 *
 * A run whose config carries no length counts as survived. That is the lenient
 * direction on purpose: a storm level opens no door on the ladder (§8.8), so
 * being wrong here costs a line on a results screen and never a lesson.
 */
const survived = (run: Run) =>
  run.cards.length >=
  (run.config?.kind === "typing" ? run.config.wordCount : 0);

/**
 * The new-key gate, one bar per character the lesson introduces (§6.4).
 *
 * This is the criterion that turns a hundred typing tests into a hundred
 * lessons. Accuracy and speed together still miss the thing the lesson was
 * *for*: a lesson that introduces `z` can be passed at 95% and 12 wpm while
 * getting `z` wrong every single time it appears, because `z` is 3% of the
 * text. So every introduced character must be struck correctly at least
 * `keyAccuracy` of the time, over at least `keyStrikes` strikes — and the
 * generator is tested to put that many occurrences in the passage at every
 * seed (§5.2), so the gate can never be unpassable through bad luck.
 *
 * No lesson introduces the space bar — it is unlocked from lesson 1, in
 * `keys.ts` — so the key that commits every word is never one of these bars.
 *
 * ── Per-key stats come from the cards, not from keystrokes ───────────────────
 * A `CardResult` carries `answer` and `given`, so a word typed right
 * contributes a hit to each of its characters and a word typed wrong
 * contributes a miss to each character that differs from the answer.
 *
 * That is a deliberate, documented approximation, and what it forgives is a
 * **correction**: a key struck wrong and then backspaced away counts as a hit,
 * because what ended up on the line is right. The trade was taken knowingly.
 * Recording raw keystrokes would mean a new field on `Session` — a shared
 * engine type that every game on this site reads and writes — for one game's
 * benefit; and it would mean the gate measures something the child cannot see
 * on the results screen, which lists the words they typed. Being failed on `z`
 * by a `z` that is not in any of them is unexplainable at seven. Measuring what
 * ended up on the line is both simpler and more explicable, and if it ever
 * proves too soft the fix is a `noBackspace` flag on the lesson rather than a
 * schema change.
 *
 * The comparison is positional, which errs the other way: `zip` typed as `zzip`
 * marks every character after the insertion wrong. Both halves are the same
 * bargain — this describes the text, not the fingers.
 */
function keyBars(
  cards: CardResult[],
  introduces: readonly string[],
  pass: LessonPass,
): KeyBar[] {
  const tally = new Map(
    introduces.map((key) => [key, { strikes: 0, hits: 0 }]),
  );

  for (const card of cards) {
    // A card marked right is right in every character, whatever `given` holds.
    // That is the forgiveness above, and it also keeps the gate agreeing with
    // the mark the child was shown on the screen: marking is the deck spec's
    // to do, and a verdict that second-guessed it would fail a key the run had
    // already called correct.
    const typed = card.ok ? card.answer : (card.given ?? "");
    // Indexed rather than iterated, because the two strings have to stay
    // aligned: `typed[i]` is what was offered for `answer[i]`, and a character
    // never reached — a word cut short, or a `given` of null on a timeout — is
    // `undefined`, which differs, which is a miss.
    for (let i = 0; i < card.answer.length; i++) {
      const seen = tally.get(card.answer[i]);
      if (!seen) continue;
      seen.strikes += 1;
      if (typed[i] === card.answer[i]) seen.hits += 1;
    }
  }

  return introduces.map((key) => {
    const { strikes, hits } = tally.get(key) ?? { strikes: 0, hits: 0 };
    const got = strikes === 0 ? 0 : hits / strikes;
    return {
      key,
      got,
      need: pass.keyAccuracy,
      // Deliberately not `got >= need`. The strike floor is the second half of
      // the gate and a fraction cannot carry it: three strikes of `z` all
      // landed is a lucky guess, not a key learnt, and a run that met `z` once
      // would otherwise pass it at 100%. So a bar can read full and still not
      // be `ok`, and `ok` is what `passed` and the results screen go by.
      ok: strikes >= pass.keyStrikes && got >= pass.keyAccuracy,
    };
  });
}

/**
 * Three bars and a pass, for one run of one lesson.
 *
 * Pure, and stored nowhere. A lesson is passed if a session exists that meets
 * its criteria, which is a filter over sessions the hub has already loaded
 * (§6.5) — so there is no `passedLessons` field, no new object store and no
 * `DB_VERSION` bump behind this. Tune lesson 40's wpm down next year and every
 * child who was one wpm short is through, with no backfill, and with nothing
 * that can disagree with the record book.
 *
 * `deckSpec` never throws on a mode it does not know, and this is the same
 * promise one layer up: a `Lesson` is the only thing that says what passing it
 * means, so a run and the lesson it was played on are all there is to ask.
 */
export function verdictFor(run: Run, lesson: Lesson): Verdict {
  // Whole-lesson accuracy, from the run's own counters — `accuracyOf` is the
  // site's one definition of the word, and a second one here would let the
  // results screen and the record book quietly disagree about the same run. It
  // returns 0 rather than NaN for a run with nothing in it.
  const accuracy = bar(accuracyOf(run), lesson.pass.accuracy);

  if (lesson.pass.kind === "storm")
    return {
      // Survive plus accuracy, which is all a storm level is marked on.
      passed: accuracy.ok && survived(run),
      accuracy,
      // A storm has no passage, so it has no words per minute — §5.6 prints —
      // in that column. Zero against a need of zero says "not a passage"
      // rather than "typed nothing", the same thing `wordCount: 0` says about
      // a storm level on the ladder, and `ok` stays true so a bar a storm does
      // not have can never fail one.
      wpm: { got: 0, need: 0, ok: true },
      // A storm level introduces nothing, and its criteria carry no
      // `keyAccuracy` to gate anything with.
      keys: [],
    };

  // Gross wpm, reused unchanged from the deck family that already counts it:
  // every keystroke counts, right or wrong, and accuracy stands beside it as
  // its own bar instead of being folded in. A child who types fast and misses
  // half of it should see both numbers, not one that hides which is which.
  const wpm = bar(wordsPerMinute(run.cards, run.durationMs), lesson.pass.wpm);
  const keys = keyBars(run.cards, lesson.introduces, lesson.pass);

  return {
    passed: accuracy.ok && wpm.ok && keys.every((key) => key.ok),
    accuracy,
    wpm,
    keys,
  };
}
