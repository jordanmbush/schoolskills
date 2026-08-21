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
 * What a lesson teaches and what it asks for, before the clock starts (§9).
 *
 * A tile is a door and a door is not an explanation. A child who starts without
 * this is guessing at the target while being timed.
 *
 * The lesson's mode **seeds** this screen's keyboard control rather than
 * overruling the child's own setting (§4.2); `lessonKeyboard.ts` owns both
 * halves of that and this screen is where a child meets them. The choice lives
 * in this component's state, dies with it, and travels to the run in
 * `config.keyboard` the way the passage travels in `config.words`.
 *
 * Start is offered off `tileState`, the same function the tiles are drawn from,
 * so the express lane survives the trip (§6.6). Asking twice — once to draw the
 * tile, once to offer Start — is deliberate: a screen that can say "locked"
 * must not also be able to start the thing it just called locked.
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
  /**
   * `Profile.keyboard`, for the arm of §4.2 an unpinned lesson falls through
   * to.
   */
  profileKeyboard?: KeyboardMode;
  /** The chosen mode is handed over; `undefined` when the lesson pinned it. */
  onStart: (keyboard?: KeyboardMode) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const locked = tileState(lesson, progress) === "locked";
  const why = keyboardLock(lesson);

  /**
   * Seeded from the lesson, resolved once, on mount. `LessonBrief` is mounted
   * per lesson (`key={lesson.id}` at the call site), so opening a second brief
   * seeds a second time rather than carrying the first one's choice onto a
   * lesson that suggests something else.
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
            where a child is stopped by it. */}
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
 * nothing says so — silence would read as a missing line rather than as "no new
 * keys today".
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
 * Same three in §6.1's order, so the list a child reads before the run is the
 * list that fills beside them during it (`LessonBars`) and the list they are
 * marked against after it (`PassBars`). Empty bars would be the other way of
 * showing this and a worse one: three troughs at zero over the word "Accuracy"
 * reads as a score, and the score is nought.
 */
function Asks({ lesson }: { lesson: Lesson }) {
  // A storm is marked on surviving a wave rather than on three bars, and its
  // tile opens `StormBrief` instead (§8.8) — so this arm is the type-level half
  // of that rather than a screen a child reaches, and it is what narrows the
  // three bars below to the criteria that have them.
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
 * Through `verdictFor` rather than through a wpm helper, so the two numbers are
 * the ones this lesson was actually marked on (§6.1) — a brief quoting a
 * different accuracy would be quietly arguing with the results screen that
 * produced it.
 */
function bestNote(best: Run, lesson: Lesson): string {
  const verdict = verdictFor(best, lesson);
  const line = `Your best here: ${Math.round(verdict.wpm.got)} words a minute, ${percent(verdict.accuracy.got)} right.`;
  return verdict.passed ? `${line} Passed.` : line;
}
