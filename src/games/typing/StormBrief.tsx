import { useId } from "react";

import { Button, Scrim } from "@/components/ui/kit";
import { plural } from "@/engine/format";
import { lessonNumbered } from "@/engine/typing/lessons";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { StormLesson } from "@/engine/typing/storms";

import { lockNote } from "./lessonNotes";
import { STORM_NOTE, tileState } from "./LessonTile";

/**
 * What a Hailstorm level is, before a child presses Play (docs/typing.md §8.1,
 * §8.8, §9).
 *
 * The other eighty rungs open `LessonBrief`, which is three bars, a best and a
 * keyboard control — and a storm has none of the three. It is marked on
 * surviving a wave, it holds no record at all (decision 50), and its keyboard
 * is not a hint under a passage but the gun itself (§8.2), so there is nothing
 * on that screen a storm could honestly fill in. Hence a second door rather
 * than a fourth arm inside the first: what the two briefs share is a shape, and
 * what they say is entirely different.
 *
 * Three things are on it and each earns its line:
 *
 *   - **How it is played.** A child arriving at lesson 4 has never seen a
 *     falling-letter game and the rule that decides everything — only the
 *     lowest letter can be shot (§8.4) — is not guessable from watching.
 *   - **What this storm is.** How many letters, how deep the shield, whether
 *     it repairs, and what it mostly rains. The twenty levels differ in
 *     exactly those four things (§5.6's storm table), so they are what makes
 *     "First ice" and "Whiteout" different screens rather than the same screen
 *     with different numbers behind it.
 *   - **That it is not required.** Said here in full, because the tile can only
 *     carry it as a phrase: nothing on the ladder waits on a storm, and the
 *     lesson above it opens off the lesson *below* it (§8.8, decision 24).
 *
 * There is deliberately no "your best". A storm is unranked everywhere on the
 * site (`isRanked`), so a brief that quoted one would be inventing a record
 * that `bestRun` refuses to hold — and a run that ended early would hold it.
 */
export function StormBrief({
  lesson,
  progress,
  onStart,
  onClose,
}: {
  lesson: StormLesson;
  progress: LadderProgress;
  onStart: () => void;
  onClose: () => void;
}) {
  const titleId = useId();
  // The same `tileState` the tile is drawn from, for the same reason
  // `LessonBrief` asks it: a screen that can say "locked" must not also be able
  // to start the thing it just called locked. A storm is never `next` — the
  // pointer is carried over it — so this only ever reads back one of three.
  const locked = tileState(lesson, progress) === "locked";
  const { count, shield, repairAt, focus } = lesson.kind.wave;

  /* The rung above this one, which is what "nothing waits on it" is about. No
     two storms are adjacent on the ladder (§5.5), so this is always an ordinary
     lesson; the fallback is written rather than asserted because the ladder is
     data and a brief is not a place to throw. */
  const above = lessonNumbered(lesson.n + 1);

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

        <p className="brief__new">
          Letters fall down the column of the key that types them. Shoot the
          lowest one before it reaches your shield — any other key is a miss.
        </p>

        <section className="brief__asks" aria-label="This storm">
          <h3 className="brief__askshead">This storm</h3>
          <ul>
            <li>
              <b>{plural(count, "letter")}</b>
              {focus ? `, mostly ${FALLS[focus]}.` : "."}
            </li>
            <li>
              <b>Shield</b> — {shield} per finger, and a finger at nothing is a
              hole.
            </li>
            <li>
              <b>{repairAt > 0 ? "Repairs" : "No repairs"}</b>
              {repairAt > 0
                ? ` — every ${repairAt} in a row mends your weakest finger.`
                : " — what breaks stays broken."}
            </li>
          </ul>
        </section>

        {/* The promise, in the two sentences it takes: what it is, and what it
            cannot cost. A child who is afraid of losing their place is a child
            who does not press Play. */}
        <p className="brief__best">
          {STORM_NOTE}{" "}
          {above
            ? `Lesson ${above.n} opens whether you play this or not.`
            : "Nothing on the ladder waits on it."}
        </p>

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
            <Button variant="go" onClick={onStart}>
              Play
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * What a focused level mostly rains, in the child's words rather than the
 * table's.
 *
 * `focus` is a class of character (`storms.ts` decides what each one matches)
 * and this is the only place it is said out loud, so the three names cannot
 * drift apart across screens — there is one screen.
 */
const FALLS: Record<
  NonNullable<StormLesson["kind"]["wave"]["focus"]>,
  string
> = {
  capitals: "capital letters",
  digits: "numbers",
  marks: "punctuation",
};
