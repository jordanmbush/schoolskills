import type { KeyboardMode } from "@/engine/types";
import { forcedKeyboard, type Lesson } from "@/engine/typing/lessons";
import { keyboardMode } from "./KeyboardSetting";

/**
 * How much of the board a run puts on screen — the one resolution
 * (docs/typing.md §4.2).
 *
 * §4.2 writes it as `lesson.keyboard ?? profile.keyboard ?? "guide"`, and that
 * is still the chain. What it does not say, because it reads as an edge case
 * until you count the table, is that **every one of the hundred lessons names
 * a mode**: the `??` never falls through on the ladder, so a child who set
 * their keyboard to Off had it turned back on by lesson 7 and `keyboardLocked`
 * distinguished nothing at all. #142's review reproduced exactly that.
 *
 * So a lesson's mode **seeds** rather than overrides. The brief opens on the
 * lesson's suggestion, an unlocked lesson may be changed before Start, and the
 * choice travels with the run in `config.keyboard` — which is what `chosen` is
 * here. Three arms, in the order they win:
 *
 *   - **A locked lesson.** The lesson insists and nothing overrules it, this
 *     function included: the control is disabled in the brief, and this arm is
 *     what makes that a rule rather than a piece of UI politeness. The two ends
 *     of the ladder are why it exists — lesson 1 forces `guide`, because a
 *     child who has never seen a keyboard cannot be asked to guess, and every
 *     checkpoint forces `off`, because a checkpoint passed while reading the
 *     answer off the screen measures nothing. Which lesson insists on what is
 *     `forcedKeyboard`'s to say, in the engine: `eyes-up` (§6.7) has to tell a
 *     board a child turned off from one the lesson turned off for them, and a
 *     rule only this file knew would be a rule the badge had to guess at.
 *   - **What the child chose**, for the run they chose it on.
 *   - **The lesson's own mode, then the player's, then `guide`** — §4.2's line,
 *     unchanged, and the arm free play takes. Free play has no lesson and makes
 *     no choice, so it reads the profile exactly as it did before the ladder
 *     existed.
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
 * A sentence and not a boolean, because the disabled control has to **say what
 * it is doing**. A toggle that silently ignores the setting a child chose is
 * the bug #142's review found; a toggle greyed out with no reason is the same
 * bug wearing a nicer suit. Both ends of the ladder have a reason worth giving,
 * and giving it is the difference between "this is broken" and "this lesson is
 * about something".
 *
 * Keyed on the mode the lesson insists on rather than on its number, so the
 * copy follows the table: re-cut the ladder and the checkpoints move with it.
 * The `keys` arm is unreachable today — no row is `keys!` — and is written
 * anyway, because `Keyboard` in `lessons.ts` permits it and a missing arm would
 * be an empty explanation rather than a type error.
 *
 * A lock over `keyboard: null` is not a lock, and says so by handing back
 * `null` here: a lesson that names no mode is insisting on nothing, and
 * `keyboardFor` above lets the player through for the same reason. The two have
 * to agree — a control greyed out with a reason while the run honoured the
 * child's setting anyway would be the first bug all over again, inverted — so
 * both ask `forcedKeyboard` rather than each reading the two fields itself.
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
