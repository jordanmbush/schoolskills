import { Button } from "@/components/ui/kit";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { Lesson } from "@/engine/typing/lessons";
import { lockNote } from "./lessonNotes";

/**
 * One rung of the ladder, as a square on a map (docs/typing.md §9).
 *
 * A tile carries three things and only three: which lesson it is, what state
 * that lesson is in for this child, and what happens when it is pressed. The
 * shape of the map — ten rows, blocks named down the side — is `LessonLadder`'s
 * problem; a tile does not know it has ninety-nine neighbours.
 *
 * **Every state is in the accessible name, not only in the colour.** The number
 * is the visible label and the sentence beside it is the spoken one, which is
 * the same split `TopBar` uses for its icons. A ladder that said "passed" in
 * cyan and "locked" in grey and nothing else would be a hundred unlabelled
 * buttons to a child using a screen reader, and some of them do.
 */

/**
 * What a tile is, in the order the states are decided.
 *
 * Four rather than a pair of booleans because they are exclusive on screen —
 * a tile is filled, or lit, or outlined, or dim — and a component that took
 * `cleared` and `open` separately would have to answer what a cleared-but-
 * locked tile looks like, which is not a thing.
 */
export type TileState = "cleared" | "next" | "open" | "locked";

/**
 * Which of the four this lesson is, for this child — **the whole unlock rule**
 * (docs/typing.md §6.6, decision 16).
 *
 * `LadderProgress.next` is the pointer and NOT the rule, and its own docstring
 * says so at length. A screen that opened a tile on `n <= next` alone would
 * pass every test anyone thought to write and quietly delete the placement
 * test, because the thing it removes is not on screen to look broken. So, in
 * full:
 *
 *   - **Everything up to and including `next` is open.** The pointer is
 *     carried over Hailstorm levels rather than made to jump them (§8.8), so
 *     the storm it stepped past is at or below `next` and stays playable —
 *     skippable is not the same as skipped, and no storm ever gates the
 *     lesson after it.
 *   - **Every checkpoint is open, always.** All ten, at every value of `next`,
 *     including on a profile that has never run anything. That is the express
 *     lane: a nine-year-old who already types opens checkpoint 40, passes it,
 *     and starts at 41 rather than spending a week on `fff jjj`. Passing one
 *     clears everything below it by the same `max` rule that opens the next
 *     lesson, so it is a placement test without a placement test existing.
 *
 * Nothing else gates, and a failed attempt costs nothing (§6.6) — which is
 * what makes "just try one" the whole of the levelling advice.
 */
export function tileState(lesson: Lesson, progress: LadderProgress): TileState {
  if (progress.cleared.has(lesson.n)) return "cleared";
  if (lesson.n === progress.next) return "next";
  if (lesson.n < progress.next || lesson.checkpoint) return "open";
  return "locked";
}

/**
 * What a Hailstorm tile is, said the same way wherever it is said.
 *
 * The tile's accessible name and the ladder's legend both open with it, and a
 * third copy would be one to keep in step: a legend that described a different
 * kind of tile from the tiles it is a legend for is a legend that has quietly
 * stopped being one.
 */
export const STORM_NOTE = "Hailstorm — worth playing, never required.";

/**
 * Why a Hailstorm tile cannot be entered, or `null` when it can be.
 *
 * **Two reasons, and the keyboard one wins** (docs/typing.md §8.8, #155). A
 * storm tile is shut today for everybody, because there is no wave behind it
 * yet — and shut on a tablet for a reason that will still be true long after
 * #156 builds one. Told only "coming soon", a child on an iPad would press it
 * again in a month and find it still doing nothing, with no more idea why. So
 * the reason a child is given is the one that is about them and their device,
 * and the reason about the calendar is what is left when it does not apply.
 *
 * #156 deletes the second arm and returns `null` there: a keyboard is then the
 * only thing between a child and a wave, and `LessonTile` opens the tile off
 * this same answer without knowing that anything changed.
 *
 * It is deliberately not "you have no keyboard" said as a fact. The detection
 * is a guess (`useKeyboardPresence`), and a guess that has been wrong is
 * undone by one keystroke — which is why the ladder's legend, where there is
 * room to say it once rather than a hundred times, offers exactly that.
 */
export function stormReason(hasKeyboard: boolean): string | null {
  if (!hasKeyboard)
    return "Hailstorm needs a keyboard, so this one stays shut.";
  return "Coming soon.";
}

/** The state, said out loud. Read after the lesson's number and title. */
const SAID: Record<TileState, string> = {
  cleared: "Passed",
  next: "Start here",
  open: "Open",
  locked: "Locked",
};

/**
 * The tile's accessible name: which lesson, what it is called, where you are
 * with it, and — where it is true — why it is open when the one before it is
 * not, or what would open it when it isn't.
 *
 * The checkpoint clause is the copy half of decision 16. A child who cannot
 * see the ring around a checkpoint has no other way to learn that the tile
 * forty rungs above their own is one they are allowed to press.
 */
function tileLabel(
  lesson: Lesson,
  state: TileState,
  blocked: string | null,
): string {
  const what = `Lesson ${lesson.n}, ${lesson.title}`;

  // A storm level says what it is, and — where there is one — why it cannot be
  // entered, rather than being a tile that does nothing when pressed. Its
  // place on the map is worth drawing either way: it is what makes lesson 4
  // arriving before the first word look deliberate.
  if (lesson.kind.type === "storm")
    return `${what}. ${STORM_NOTE} ${blocked ?? `${SAID[state]}.`}`;

  // Only worth saying while it is ahead of the child: a checkpoint they have
  // already passed is just a lesson they passed, and "always open" on it would
  // be a sentence about a door they walked through.
  const note =
    lesson.checkpoint && state !== "cleared"
      ? " Checkpoint — always open, whatever you have passed."
      : "";

  // What unlocks it, on the tile as well as in the brief (#145). The tile is
  // the only place a locked lesson is met by a child who never presses it, and
  // "Locked" on its own is a state rather than a way out of one.
  const how = state === "locked" ? ` ${lockNote(lesson)}` : "";

  return `${what}.${note} ${SAID[state]}.${how}`;
}

export function LessonTile({
  lesson,
  progress,
  hasKeyboard,
  onOpen,
}: {
  lesson: Lesson;
  progress: LadderProgress;
  /**
   * Whether this device looks like it has a physical keyboard
   * (`useKeyboardPresence`). Only a Hailstorm tile reads it — every other rung
   * of the ladder is a passage, and a passage on a tablet is typed on the
   * software keyboard like anything else (§4.5).
   */
  hasKeyboard: boolean;
  onOpen: (lesson: Lesson) => void;
}) {
  const state = tileState(lesson, progress);
  const storm = lesson.kind.type === "storm";
  // One answer, drawn twice: what stops a storm tile is also what it says.
  const blocked = storm ? stormReason(hasKeyboard) : null;
  const openable = state !== "locked" && blocked === null;

  const classes = [
    "ladder__tile",
    `is-${state}`,
    lesson.checkpoint ? "is-checkpoint" : "",
    storm ? "is-storm" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Button
      variant="bare"
      className={classes}
      /* `aria-disabled` rather than `disabled`: a disabled button drops out of
         the tab order, and a child moving through the ladder on a keyboard
         would then hear the lessons they have reached and nothing about the
         ninety they have not. The map is the information; being told a rung is
         locked is half of it. */
      aria-disabled={openable ? undefined : true}
      onClick={() => {
        if (openable) onOpen(lesson);
      }}
    >
      <span className="ladder__n u-mono" aria-hidden="true">
        {lesson.n}
      </span>
      <span className="u-sr">{tileLabel(lesson, state, blocked)}</span>
    </Button>
  );
}
