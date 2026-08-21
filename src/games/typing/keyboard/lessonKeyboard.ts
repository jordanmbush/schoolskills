import type { KeyboardMode } from "@/engine/types";
import { forcedKeyboard, type Lesson } from "@/engine/typing/lessons";
import { keyboardMode } from "./KeyboardSetting";

/**
 * How much of the board a run puts on screen — the one resolution (§4.2).
 *
 * A lesson's mode **seeds** the run rather than overriding it, because every
 * one of the hundred names a mode (§4.2, decision 27): read as a plain `??`
 * chain the player's own setting would lose on all hundred rungs. What the
 * child chose travels with the run in `config.keyboard`, which is `chosen`
 * here. Three arms, in the order they win:
 *
 *   - **A locked lesson**, which nothing overrules, this function included —
 *     the disabled control in the brief is UI, and this arm is the rule. Which
 *     lesson insists on what is `forcedKeyboard`'s to say, in the engine,
 *     because `eyes-up` (§6.7) has to tell a board a child turned off from one
 *     the lesson turned off for them.
 *   - **What the child chose**, for the run they chose it on.
 *   - **The lesson's own mode, then the player's, then `guide`** — §4.2's line,
 *     unchanged, and the arm free play takes.
 *
 * Called from the brief (to seed its control) and from the track (to draw the
 * board). One function, so those two can't disagree about a run that is already
 * on screen.
 */
export function keyboardFor(
  lesson: Lesson | null,
  /** `Profile.keyboard` raw, defaults and all — `keyboardMode` resolves it. */
  profileMode?: KeyboardMode,
  /** `TypingConfig.keyboard`: what the child chose in the brief, if anything. */
  chosen?: KeyboardMode | null,
): KeyboardMode {
  const forced = lesson ? forcedKeyboard(lesson) : null;
  if (forced) return forced;
  return chosen ?? lesson?.keyboard ?? keyboardMode(profileMode);
}

/**
 * Why this lesson's keyboard cannot be changed, or `null` when it can.
 *
 * A sentence and not a boolean, because a disabled control has to say what it
 * is doing (§4.2).
 *
 * Keyed on the mode the lesson insists on rather than on its number, so the
 * copy follows the table: re-cut the ladder and the checkpoints move with it.
 * The `keys` arm is unreachable today — no row is `keys!` — and is written
 * anyway, because `Keyboard` in `lessons.ts` permits it and a missing arm would
 * be an empty explanation rather than a type error.
 *
 * A lock over `keyboard: null` is not a lock, and says so by handing back
 * `null` here: a lesson that names no mode is insisting on nothing, and
 * `keyboardFor` above lets the player through for the same reason. Both ask
 * `forcedKeyboard` rather than each reading the two fields itself, so a control
 * greyed out with a reason cannot sit over a run that honoured the child.
 */
export function keyboardLock(lesson: Lesson): string | null {
  const forced = forcedKeyboard(lesson);
  if (!forced) return null;

  switch (forced) {
    case "off":
      return "Checkpoints are typed without the keyboard — that is what makes passing one worth something.";
    case "guide":
      return "The guide stays on while a lesson is teaching new keys.";
    default:
      return "This lesson sets the keyboard itself.";
  }
}
