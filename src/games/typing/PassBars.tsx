import { percent } from "@/engine/format";
import type { Lesson } from "@/engine/typing/lessons";
import type { Bar, Verdict } from "@/engine/typing/verdict";
import { weakestKey } from "./lessonNotes";

/**
 * The three bars a lesson is judged on, in the order they matter (§6.1).
 *
 * One component for both places the bars appear: filling live under a lesson in
 * `LessonBars`, and standing still under its verdict on the results screen. The
 * bars a child watched fill are the bars they are then marked against, drawn by
 * the same lines from the same `Verdict` — a results screen that re-drew them
 * its own way could tell a child they had it a word before they did.
 */
export function PassBars({
  lesson,
  verdict,
}: {
  lesson: Lesson;
  verdict: Verdict;
}) {
  const key = weakestKey(verdict.keys);

  return (
    <section className="passbars" aria-label="What this lesson asks for">
      <Meter
        label="Accuracy"
        bar={verdict.accuracy}
        value={percent(verdict.accuracy.got)}
        target={percent(verdict.accuracy.need)}
      />
      {/* Absent on a review lesson and on every checkpoint — they introduce
          nothing, so a bar for it would be one that can never move (§6.1).
          Which of many keys gets the room is `weakestKey`'s to say. */}
      {key && (
        <Meter
          label={`New key ${key.key}`}
          bar={key}
          value={percent(key.got)}
          target={percent(key.need)}
        />
      )}
      {/* No speed bar on a Hailstorm level: a storm has no passage and so no
          words per minute, and §6.1's verdict says so with a bar that can never
          fail. Drawn, that is a full green bar over the word the child has just
          been told they missed, which reads as a bug rather than as "not asked
          for". So the column is not there, and `missNote` says in words what
          the wave did. */}
      {lesson.pass.kind !== "storm" && (
        <Meter
          label="Speed"
          bar={verdict.wpm}
          value={String(Math.round(verdict.wpm.got))}
          target={`${verdict.wpm.need} wpm`}
        />
      )}
    </section>
  );
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
  // Belt and braces against a criterion that asks for nothing. The storm arm
  // is the one that carries `need: 0` and it no longer reaches this function,
  // but a bar is a division and a division wants a floor under it.
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
