import type { CardResult, Session } from "@/engine/types";

import { wordsPerMinute } from "@/engine/decks/typing";
import { accuracyOf } from "@/engine/records";
import type { Lesson, PassCriteria } from "./lessons";

/**
 * Did this run pass this lesson, and if not, which part missed
 * (docs/typing.md §6.1, §6.4)?
 *
 * Three bars rather than one score (§6.1), so this module never returns a
 * percentage and a verdict: it returns the three criteria side by side, each
 * with what was asked and what arrived, and leaves `passed` as the conjunction
 * of them. What draws them is the results screen's problem; what they mean is
 * this file's.
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
 * The order they are *shown* in is not the field order: a renderer follows
 * §6.1, which is accuracy, then the new keys, then speed.
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
 * A Hailstorm run is the one kind of `Session` that can stop in the middle:
 * dying at letter 18 of 40 saves eighteen cards with `correct`, `incorrect`
 * and `durationMs` all honest. So surviving is "you faced every letter the
 * wave had", and the wave's length is read off the run's **own config** rather
 * than off today's ladder — a wave re-tuned from forty letters to thirty next
 * year must not hand a pass, in hindsight, to a run that died at eighteen.
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
 * No lesson introduces the space bar — it is unlocked from lesson 1, in
 * `keys.ts` — so the key that commits every word is never one of these bars.
 *
 * The tally comes from the cards rather than from keystrokes, which forgives a
 * **correction**: a key struck wrong and then backspaced away counts as a hit,
 * because what ended up on the line is right. §6.4 argues that trade. The
 * comparison is positional, which errs the other way: `zip` typed as `zzip`
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
 * Pure, and stored nowhere: a lesson is passed if a session exists that meets
 * its criteria (§6.5). A run and the lesson it was played on are all there is
 * to ask — nothing here reads a profile, a clock or a store.
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
      // A storm has no passage, so it has no words per minute (§5.6 prints —
      // in that column). Zero against a need of zero says "not a passage"
      // rather than "typed nothing", and `ok` stays true so a bar a storm does
      // not have can never fail one.
      wpm: { got: 0, need: 0, ok: true },
      // A storm level introduces nothing, and its criteria carry no
      // `keyAccuracy` to gate anything with.
      keys: [],
    };

  // Gross wpm, reused unchanged from the deck family that already counts it:
  // every keystroke counts, right or wrong, and accuracy stands beside it as
  // its own bar instead of being folded in (§6.1).
  const wpm = bar(wordsPerMinute(run.cards, run.durationMs), lesson.pass.wpm);
  const keys = keyBars(run.cards, lesson.introduces, lesson.pass);

  return {
    passed: accuracy.ok && wpm.ok && keys.every((key) => key.ok),
    accuracy,
    wpm,
    keys,
  };
}
