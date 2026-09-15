import { FINGER_NAMES, strokeFor, type Finger } from "@/engine/keyboard";
import type { HeldKeyLesson } from "./lessons";

/**
 * Which hand a character belongs to, and what one hand can type on its own
 * (docs/typing.md §5.8).
 *
 * A held-key lesson pins one hand to a key for the whole run, so the question
 * every part of it asks is the same one: can the *other* hand do this alone?
 * The generator asks it of every word, the table's tests ask it of every key
 * drilled, and the run asks it of nothing — by then the answer is built into
 * the text. One definition, here, so those three agree.
 */

export type Hand = "left" | "right";

/**
 * The hand a finger is on, or `null` for the thumb — which is either hand's,
 * and so is never pinned by holding a key with the other.
 */
export function handOf(finger: Finger): Hand | null {
  if (finger === "thumb") return null;
  return finger.startsWith("l-") ? "left" : "right";
}

/**
 * The hand left free when `hold` is held down, or `null` for a character no
 * key on this board types with a hand — a space, or one the layout lacks.
 */
export function freeHand(hold: string): Hand | null {
  const stroke = strokeFor(hold);
  const pinned = stroke ? handOf(stroke.finger) : null;
  if (!pinned) return null;
  return pinned === "left" ? "right" : "left";
}

/**
 * Can the free hand type every character of `text` on its own, with `hold`
 * held down?
 *
 * Three things fail it: a character the board cannot produce at all, one on
 * the pinned hand, and any shifted character — the shift that goes with a
 * key is always the *opposite* hand's (§3.3), which is the hand that is
 * holding. The space bar passes: it is the thumb's, and either thumb will do.
 */
export function oneHanded(text: string, hold: string): boolean {
  const free = freeHand(hold);
  if (!free) return false;
  for (const ch of text) {
    const stroke = strokeFor(ch);
    if (!stroke || stroke.shift) return false;
    const hand = handOf(stroke.finger);
    if (hand !== null && hand !== free) return false;
  }
  return true;
}

/** What a run needs to know about the key a lesson holds down. */
export type Hold = {
  /** The character, as the table writes it: `f` or `j`. */
  key: string;
  /** `KeyboardEvent.code` for it, which is what the run listens for. */
  code: string;
  /** "left index finger" — the finger that holds it, for the sentence that says so. */
  finger: string;
  /** The hand that does the typing. */
  free: Hand;
};

/**
 * The key a held-key lesson holds, resolved against the board.
 *
 * `null` only for a lesson whose `hold` this layout cannot place, which the
 * table's tests rule out for every lesson that ships; the callers treat it as
 * "nothing to hold" rather than as a case to throw on, for the same reason
 * `lessonById` is total.
 */
export function holdFor(lesson: HeldKeyLesson): Hold | null {
  const stroke = strokeFor(lesson.hold);
  const free = freeHand(lesson.hold);
  if (!stroke || stroke.finger === "thumb" || !free) return null;
  return {
    key: lesson.hold,
    code: stroke.code,
    finger: FINGER_NAMES[stroke.finger],
    free,
  };
}
