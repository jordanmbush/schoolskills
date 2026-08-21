import { useEffect } from "react";

import { keyFor } from "@/engine/keyboard";
import { sfx } from "@/services/sound";

import { HELD } from "./useKeyEcho";

/**
 * What the board sounds like under a child's hands (§4.8).
 *
 * A second hook rather than a line in `useKeyEcho`, though the two mount
 * together and listen to the same event:
 *
 *   - **The echo publishes React state on every keystroke; this publishes
 *     nothing.** A clack is a side effect with no render behind it, and
 *     keeping it out of the hook that owns `useState` is what makes that
 *     obvious rather than something you have to check.
 *   - **The echo is a pure state machine with a unit suite that runs in Node**
 *     (`createKeyEcho`). Putting a call to `services/sound` inside its
 *     listener would put a mixer in the import graph of the one part of the
 *     board that is testable without a browser.
 */

/**
 * One thing a keystroke can sound like.
 *
 * Three, and not one per key: a typewriter has three voices, and every other
 * key on the board is a lever that swings and hits the paper (§4.8).
 */
export type KeySound = "strike" | "space" | "return";

/**
 * What this keystroke sounds like, or `null` for one that makes no sound.
 *
 * The signature takes the event and nothing else: a wrong key clacks exactly
 * like a right one, which is a decision rather than an omission (§4.8).
 *
 * Split from the player below so the three silences are testable without a
 * mixer, in the same shape `stormSounds.ts` uses for the same reason.
 */
export function soundForKey(
  event: Pick<KeyboardEvent, "code" | "repeat">,
): KeySound | null {
  // 1. A held key is one stroke. The board relights on auto-repeat because its
  // light is a timer that has to be re-armed (`HOLD_MS`); a clack re-fired
  // every 33ms is a drone instead (§4.8, decision 44).
  if (event.repeat) return null;

  // 2. A modifier is held, not struck — the same `HELD` set the echo never
  // flares, so one list covers both (§4.8).
  if (HELD.has(event.code)) return null;

  // 3. The clack is the picture's voice, so a key the board does not draw — a
  // numpad `7`, a media key, `F7` — makes no sound (§4.8).
  const key = keyFor(event.code);
  if (!key) return null;

  if (key.code === "Space") return "space";
  if (key.code === "Enter") return "return";
  return "strike";
}

/**
 * Play what a keystroke sounds like.
 *
 * `sfx` is silent when the player has sound off and in any environment with no
 * `AudioContext`, so neither this nor its callers carry a guard of their own.
 */
export function playKeySound(
  event: Pick<KeyboardEvent, "code" | "repeat">,
): void {
  switch (soundForKey(event)) {
    case "strike":
      sfx.keyStrike();
      break;
    case "space":
      sfx.keySpace();
      break;
    case "return":
      sfx.keyReturn();
      break;
  }
}

/**
 * The clack, wired to the window.
 *
 * On `window` rather than on the field, and in the capture phase, for the two
 * reasons `useKeyEcho` binds the same way: the board has to stay honest
 * wherever focus went, and capture runs ahead of every handler that could
 * `stopPropagation` — `TypeField`'s space handler among them, which
 * `preventDefault`s the key that commits a word.
 *
 * No state, no publish, no return value: this hook never re-renders anything.
 * It is bound once for the life of the board and removed with it, which is
 * also the whole of the "only when the keyboard is present" rule — `mode:
 * "off"` never mounts `LiveKeyboard` at all (§4.8).
 */
export function useKeyClack(): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => playKeySound(event);
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
