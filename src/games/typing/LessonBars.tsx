import { percent } from "@/engine/format";
import { verdictFor, type Bar, type KeyBar } from "@/engine/typing/verdict";
import type { Lesson } from "@/engine/typing/lessons";
import type { CardResult, RaceConfig } from "@/engine/types";

/**
 * What the lesson is asking for, filling as the child does it
 * (docs/typing.md §7, §6.1).
 *
 * This is what a lesson has where a race has the ghost lane. Nothing is
 * chasing you here — what you are chasing is the criteria, and the point of
 * putting them on screen while the run is live is that you can watch yourself
 * meet them. Three bars rather than one number for the reason the whole
 * verdict exists: a single score tells a seven-year-old that they failed and
 * not what to do, where "fast enough, not accurate enough" is an instruction.
 *
 * The bars are the SAME ones the results screen will draw, because they come
 * from the same `verdictFor` over the run so far — cards in, elapsed in, three
 * bars out. A HUD that counted accuracy its own way would drift from the
 * verdict by a rounding rule and tell a child they had it a word before they
 * did.
 */

/**
 * The verdict is recomputed every time the clock ticks — about sixteen times a
 * second — so it walks the cards that often. That is a pass over at most
 * `lesson.wordCount` (150 at the top of the ladder) doing character compares,
 * next to a screen that is already re-rendering the passage at that rate. It is
 * measured in microseconds and it buys the one thing worth having: there is no
 * second definition of "how it is going" to disagree with the one that decides
 * whether the lesson was passed.
 */
export function LessonBars({
  lesson,
  config,
  cards,
  elapsedMs,
}: {
  lesson: Lesson;
  /** The run's own config, which is all `verdictFor` reads it for. */
  config: RaceConfig;
  /** The words committed so far, in order. */
  cards: CardResult[];
  /** The stopwatch, so speed is speed *now* and not speed at the last word. */
  elapsedMs: number;
}) {
  const correct = cards.filter((card) => card.ok).length;
  const verdict = verdictFor(
    {
      cards,
      config,
      correct,
      incorrect: cards.length - correct,
      durationMs: elapsedMs,
    },
    lesson,
  );

  const key = weakest(verdict.keys);

  return (
    <section className="passbars" aria-label="What this lesson asks for">
      {/* §6.1's order, which is the order they matter: accuracy, then the new
          keys, then speed. */}
      <Meter
        label="Accuracy"
        bar={verdict.accuracy}
        value={percent(verdict.accuracy.got)}
        target={percent(verdict.accuracy.need)}
      />
      {/* Absent on a review lesson and on every checkpoint — they introduce
          nothing, so there is no third thing being asked and a bar for it
          would be a bar that can never move (§6.1). */}
      {key && (
        <Meter
          label={`New key ${key.key}`}
          bar={key}
          value={percent(key.got)}
          target={percent(key.need)}
        />
      )}
      <Meter
        label="Speed"
        bar={verdict.wpm}
        value={String(Math.round(verdict.wpm.got))}
        target={`${verdict.wpm.need} wpm`}
      />
    </section>
  );
}

/**
 * The new keys, as one bar.
 *
 * A lesson introduces two characters as a rule, six at lesson 67 and fifteen at
 * lesson 31 — and fifteen bars over a live passage is a wall rather than a
 * signal. So the bar shown is the key that is holding you up, because the gate
 * is every key at once (§6.4): the run is only through when the weakest one is,
 * and naming it is the instruction the child needs.
 *
 * "Weakest" is a not-yet-passed key before a lower fraction, which is not the
 * same ordering. A key struck right three times reads 100% and is still not
 * `ok`, because the strike floor is the half of the gate a fraction cannot
 * carry — so a bar that looks full and one that looks nearly full can be the
 * failing one and the passing one respectively.
 */
function weakest(keys: KeyBar[]): KeyBar | null {
  return keys.reduce<KeyBar | null>((worst, key) => {
    if (!worst) return key;
    if (worst.ok !== key.ok) return worst.ok ? key : worst;
    return key.got < worst.got ? key : worst;
  }, null);
}

/**
 * One criterion: what it wants, how far you are, and whether that is full.
 *
 * The fill is `got / need` capped, so a bar cannot report more than a full one
 * — being at 40 wpm against a target of 12 is a full bar and not a bar and a
 * half. `--lime` at the top of it because a met criterion is the same green
 * "correct" is everywhere else on this site (CLAUDE.md, the telemetry five),
 * and a plain fill below it because "not yet" is not "wrong" — `--flare`
 * would tell a child mid-run that they had failed something they are three
 * words from passing.
 */
function Meter({
  label,
  bar,
  value,
  target,
}: {
  label: string;
  bar: Bar;
  /** The reading, in this bar's own units. */
  value: string;
  /** What it has to reach, in the same units. */
  target: string;
}) {
  // A storm level asks nothing of the speed column and carries `need: 0` to
  // say so (§5.6). Nothing divides by that.
  const filled = bar.need <= 0 ? 1 : Math.min(1, bar.got / bar.need);

  return (
    <div className={`passbar${bar.ok ? " is-ok" : ""}`}>
      <span className="passbar__label">{label}</span>
      {/* The picture of a number the text beside it already gives, so a screen
          reader is handed the number once rather than a bar it cannot see. */}
      <span className="passbar__track" aria-hidden="true">
        <span className="passbar__fill" style={{ width: `${filled * 100}%` }} />
      </span>
      <span className="passbar__value u-mono">
        {value}
        <span className="passbar__need"> / {target}</span>
      </span>
    </div>
  );
}
