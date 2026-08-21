import { useId } from "react";

import { Button, Scrim } from "@/components/ui/kit";
import { plural } from "@/engine/format";
import { strokeFor } from "@/engine/keyboard";
import { unlockedAt } from "@/engine/typing/keys";
import { lessonNumbered } from "@/engine/typing/lessons";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { StormLesson } from "@/engine/typing/storms";

import { lockNote } from "./lessonNotes";
import { STORM_NOTE, tileState } from "./LessonTile";

/**
 * What a Hailstorm level is, before a child presses Play (§8.1, §8.8, §9).
 *
 * A second door rather than a fourth arm inside `LessonBrief`: what the two
 * share is a shape, and what they say is entirely different — a storm has no
 * three bars, no best and no keyboard control to fill in. What it says instead,
 * and why each of the three lines is there, is §8.8.
 *
 * There is deliberately no "your best". A storm is unranked everywhere on the
 * site (`isRanked`, §8.7), so a brief that quoted one would be inventing a
 * record that `bestRun` refuses to hold — and a run that ended early would hold
 * it.
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

  /* Can anything in this storm ask for a shift?
     Asked of the pool rather than of `focus`, because the two answer different
     questions. `focus` is what a level MOSTLY rains, and it stops being the
     whole story the moment capitals are unlocked: from lesson 34 up they are
     in every wave's pool (§5.6), so "Pairs" and "The long wave" rain them
     without being about them. A rule that only appeared on the two levels
     named for it would leave a child losing ten points on lesson 45 with
     nothing on screen that had ever mentioned it (decision 70).

     `unlockedAt(n)` is the same set `stormWave` draws this level's letters
     from, so this cannot disagree with what actually falls. */
  const shifts = [...unlockedAt(lesson.n)].some(
    (ch) => strokeFor(ch)?.shift != null,
  );

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
          {shifts ? " A capital needs a shift, just like typing one does." : ""}
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
