import { Button } from "@/components/ui/kit";
import type { LadderProgress } from "@/engine/typing/ladder";
import type { Lesson } from "@/engine/typing/lessons";
import { lockNote } from "./lessonNotes";

/**
 * One rung of the ladder, as a square on a map (§9).
 *
 * The shape of the map is `LessonLadder`'s problem; a tile does not know it has
 * ninety-nine neighbours.
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
 * Four rather than a pair of booleans because they are exclusive on screen, and
 * a component that took `cleared` and `open` separately would have to answer
 * what a cleared-but-locked tile looks like, which is not a thing.
 */
export type TileState = "cleared" | "next" | "open" | "locked";

/**
 * Which of the four this lesson is, for this child — **the whole unlock rule**
 * (§6.6, decision 16): everything up to and including `next`, plus every
 * checkpoint always.
 *
 * `LadderProgress.next` is the pointer and NOT the rule. A screen that opened a
 * tile on `n <= next` alone would pass every test anyone thought to write and
 * quietly delete the placement test, because what it removes is not on screen
 * to look broken. The pointer is also carried over Hailstorm levels rather than
 * made to jump them (§8.8), so a storm it stepped past stays playable.
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
 * kind of tile from the tiles it is a legend for has quietly stopped being one.
 */
export const STORM_NOTE = "Hailstorm — worth playing, never required.";

/**
 * Why a Hailstorm tile cannot be entered, or `null` when it can be. One reason,
 * and it is about the child's device (§8.8).
 *
 * Deliberately not "you have no keyboard" said as a fact: the detection is a
 * guess (`useKeyboardPresence`) undone by one keystroke, which is what the
 * ladder's legend offers, once, where there is room to say it. And it is never
 * a reason a storm cannot be *skipped* (§8.8), so a device with no keys costs a
 * child twenty tiles and not one rung of the course.
 */
export function stormReason(hasKeyboard: boolean): string | null {
  return hasKeyboard
    ? null
    : "Hailstorm needs a keyboard, so this one stays shut.";
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

  // What unlocks it, on the tile as well as in the brief: the tile is the only
  // place a locked rung is met by a child who never presses it, and "Locked" on
  // its own is a state rather than a way out of one. `lockNote` is one
  // definition for both kinds of tile.
  const how = state === "locked" ? ` ${lockNote(lesson)}` : "";

  // A storm says what it is, and — where there is one — why it cannot be
  // entered, rather than being a tile that does nothing when pressed. What it
  // can never say is that something is waiting on it (§8.8), which is what
  // `STORM_NOTE` carries, first, on every one of the twenty.
  if (lesson.kind.type === "storm")
    return `${what}. ${STORM_NOTE} ${blocked ?? `${SAID[state]}.${how}`}`;

  // Only worth saying while it is ahead of the child: a checkpoint they have
  // already passed is just a lesson they passed, and "always open" on it would
  // be a sentence about a door they walked through.
  const note =
    lesson.checkpoint && state !== "cleared"
      ? " Checkpoint — always open, whatever you have passed."
      : "";

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
