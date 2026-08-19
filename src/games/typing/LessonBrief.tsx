import { useId, useState } from "react";

import { Button, Scrim } from "@/components/ui/kit";
import { percent } from "@/engine/format";
import type { Lesson } from "@/engine/typing/lessons";
import type { LadderProgress } from "@/engine/typing/ladder";
import { verdictFor, type Run } from "@/engine/typing/verdict";
import type { KeyboardMode } from "@/engine/types";

import { KeyboardSetting } from "./keyboard/KeyboardSetting";
import { keyboardFor, keyboardLock } from "./keyboard/lessonKeyboard";
import { lockNote } from "./lessonNotes";
import { tileState } from "./LessonTile";

/**
 * What a lesson teaches and what it asks for, before the clock starts
 * (docs/typing.md §9, §4.2).
 *
 * A tile is a door and a door is not an explanation. Between them goes this:
 * which keys are new, the three bars that decide the run, your best if you
 * have one, and how much of the keyboard will be on screen. A child who starts
 * without any of that is guessing at the target while being timed, and the
 * three bars are the one thing on the ladder they cannot work out from the map.
 *
 * ── The keyboard is seeded here, not decided here ──────────────────────────
 * §4.2 resolves the board as `lesson.keyboard ?? profile.keyboard ?? "guide"`.
 * Every one of the hundred lessons names a mode, so read as an override that
 * chain silently beats the setting the child chose — which is the bug #142's
 * review found, and the reason `keyboardLocked` had stopped distinguishing
 * anything. So: the lesson's mode **seeds** this control, an unlocked lesson
 * may be changed before Start, and a locked one shows its pills disabled with
 * the reason on them. `lessonKeyboard.ts` owns both halves of that; this screen
 * is where a child meets them.
 *
 * The choice lives in this component's state and dies with it. That is the
 * lifetime it should have: it is a decision about *this run*, and writing it
 * back to the profile would let a lesson's own suggestion — which is what the
 * control opens on — overwrite a setting the child made for themselves in free
 * play. It travels to the run in `config.keyboard`, the way the passage
 * travels in `config.words`.
 *
 * ── It asks the ladder whether it may start ───────────────────────────────
 * `tileState`, the same function the tiles are drawn from, so the express lane
 * survives the trip: **every checkpoint is openable at any time** (§6.6), and a
 * brief that gated on `n <= next` would delete the placement test while looking
 * completely reasonable. Asking twice — once to draw the tile, once to offer
 * Start — is deliberate. A screen that can say "locked" must not also be able
 * to start the thing it just called locked.
 */
export function LessonBrief({
  lesson,
  progress,
  best,
  profileKeyboard,
  onStart,
  onClose,
}: {
  lesson: Lesson;
  progress: LadderProgress;
  /**
   * This child's best run at this lesson, or `null` for one they have never
   * tried. A run rather than a formatted line, so the numbers are read off the
   * same `verdictFor` that marked it — a brief quoting a wpm the results screen
   * rounds differently would be telling a child two things about one run.
   */
  best: Run | null;
  /** `Profile.keyboard`, for the arm of §4.2 an unpinned lesson falls through to. */
  profileKeyboard?: KeyboardMode;
  /** The chosen mode is handed over; `undefined` when the lesson pinned it. */
  onStart: (keyboard?: KeyboardMode) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const locked = tileState(lesson, progress) === "locked";
  const why = keyboardLock(lesson);

  /**
   * Seeded from the lesson, resolved once, on mount.
   *
   * `LessonBrief` is mounted per lesson (`key={lesson.id}` at the call site),
   * so opening a second brief seeds a second time rather than carrying the
   * first one's choice onto a lesson that suggests something else.
   */
  const [keyboard, setKeyboard] = useState<KeyboardMode>(() =>
    keyboardFor(lesson, profileKeyboard),
  );

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <Scrim onClose={onClose} label="Close" />
      <div className="modal__panel panel anim-pop brief">
        <p className="u-eyebrow">Lesson {lesson.n}</p>
        <h2 className="panel__title" id={titleId}>
          {lesson.title}
        </h2>

        <NewKeys lesson={lesson} />
        <Asks lesson={lesson} />

        <p className="brief__best">
          {best ? bestNote(best, lesson) : "You haven't run this one yet."}
        </p>

        <KeyboardSetting
          mode={keyboard}
          onChange={setKeyboard}
          lockedBecause={why}
        />

        {/* Said where the Start button would be, because "why can't I press
            it" is a question about the button and not about the lesson. The
            second sentence is the express lane (§6.6): this is the one screen
            where a child is stopped, and "climb" is only half the answer when
            all ten checkpoints are open behind them. */}
        {locked && (
          <p className="brief__locked">
            {lockNote(lesson)} Or try a checkpoint — every one of those is open
            already, and getting one wrong costs you nothing.
          </p>
        )}

        <div className="modal__actions">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Not now
          </Button>
          {!locked && (
            <Button
              variant="go"
              onClick={() => onStart(why ? undefined : keyboard)}
            >
              Start
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The keys this lesson is for, as keys.
 *
 * Drawn as caps rather than listed in the sentence because they are what the
 * child is about to look for: two glyphs, or fifteen at lesson 31, and a
 * comma-separated list of fifteen is a paragraph. A lesson that introduces
 * nothing says so — half the ladder is review, and silence there would read as
 * a missing line rather than as "no new keys today".
 */
function NewKeys({ lesson }: { lesson: Lesson }) {
  if (lesson.introduces.length === 0) {
    return (
      <p className="brief__new muted">
        No new keys — this one is practice on what you have.
      </p>
    );
  }

  return (
    <p className="brief__new">
      <span className="brief__newlabel">New keys</span>
      {lesson.introduces.map((key) => (
        <kbd key={key} className="brief__key u-mono">
          {key}
        </kbd>
      ))}
    </p>
  );
}

/**
 * The three bars, as what they want rather than as how you are doing.
 *
 * Same three in §6.1's order — accuracy, the new keys, then speed — so the
 * list a child reads before the run is the list that fills beside them during
 * it (`LessonBars`) and the list they are marked against after it (`PassBars`).
 * Empty bars would be the other way of showing this and a worse one: three
 * troughs at zero over the word "Accuracy" reads as a score, and the score is
 * nought.
 *
 * The new-key row is absent exactly where its bar is — a review lesson and
 * every checkpoint introduce nothing, so there is no third thing being asked.
 */
function Asks({ lesson }: { lesson: Lesson }) {
  // A Hailstorm level is marked on surviving a wave rather than on three bars,
  // and has no passage to ask anything about (§6.1). Its tile cannot open this
  // screen until #159 builds the wave; this is the arm that keeps that true
  // rather than a promise that it is.
  if (lesson.pass.kind !== "lesson") return null;
  const { accuracy, wpm, keyAccuracy, keyStrikes } = lesson.pass;

  return (
    <section className="brief__asks" aria-label="What this lesson asks for">
      <h3 className="brief__askshead">To pass, in {lesson.wordCount} words</h3>
      <ul>
        <li>
          <b>Accuracy</b> — {percent(accuracy)} of your words right.
        </li>
        {lesson.introduces.length > 0 && (
          <li>
            <b>New keys</b> — each one right {percent(keyAccuracy)} of the time,
            over at least {keyStrikes} goes.
          </li>
        )}
        <li>
          <b>Speed</b> — {wpm} words a minute.
        </li>
      </ul>
    </section>
  );
}

/**
 * Your best here, in the units the bars above just asked in.
 *
 * Through `verdictFor` rather than through a wpm helper, so the two numbers
 * are the ones this lesson was actually marked on — the accuracy a lesson
 * counts is its own (§6.1), and a brief quoting a different one would be
 * quietly arguing with the results screen that produced it.
 */
function bestNote(best: Run, lesson: Lesson): string {
  const verdict = verdictFor(best, lesson);
  const line = `Your best here: ${Math.round(verdict.wpm.got)} words a minute, ${percent(verdict.accuracy.got)} right.`;
  return verdict.passed ? `${line} Passed.` : line;
}
