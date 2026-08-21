import { useEffect } from "react";

import { keyFor } from "@/engine/keyboard";
import { sfx } from "@/services/sound";

import { HELD } from "./useKeyEcho";

/**
 * What the board sounds like under a child's hands (docs/typing.md §4.8).
 *
 * `useKeyEcho` is the board's eyes — which key went down, and whether it was
 * the wrong one. This is the board's ears, and it is deliberately the simpler
 * of the two: it looks at one keystroke, in isolation, and says which of three
 * noises a typewriter would have made. It knows nothing about the passage, the
 * expectation, the streak or the clock, and that is the point — see
 * `soundForKey` below.
 *
 * ── Why it is a second hook and not a line in `useKeyEcho` ────────────────────
 * The two are mounted and unmounted together and listen to the same event, so
 * merging them would work. They are apart for two reasons that outlast the
 * convenience:
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
 * Three, and not one per key, because a typewriter only has three voices: the
 * typebars, the space bar, and the bell-and-carriage on Return. Everything
 * else on the board — every letter, every digit, `Tab`, `Caps`, `Backspace` —
 * is a lever that swings and hits the paper, and they sound alike because they
 * *are* alike.
 */
export type KeySound = "strike" | "space" | "return";

/**
 * What this keystroke sounds like, or `null` for one that makes no sound.
 *
 * ── It is not told whether the key was right ─────────────────────────────────
 * The signature takes the event and nothing else: no expectation, no verdict.
 * A wrong key clacks exactly like a right one, and that is a decision rather
 * than an omission. The board already flares the wrong key `--flare` (§4.3),
 * the passage already goes red behind you, and the run already plays
 * `sfx.wrong` at the word. A keyboard that scolded a child on the way *down*
 * would be a fourth opinion about one keystroke, arriving before any of the
 * other three knew the answer — and it would make the one sound a child hears
 * constantly into a running commentary on their mistakes.
 *
 * So the clack says "that key went down" and nothing more. It is the sound of
 * a machine working, which is what makes it bearable eight times a second.
 *
 * ── Three silences ───────────────────────────────────────────────────────────
 * Split from the player below so all three are testable without a mixer, in
 * the same shape `stormSounds.ts` uses for the same reason.
 */
export function soundForKey(
  event: Pick<KeyboardEvent, "code" | "repeat">,
): KeySound | null {
  // 1. A held key is one stroke, not thirty a second of it.
  //
  // The board relights on auto-repeat, because its light is a timer that has
  // to be re-armed by something (`HOLD_MS`). The sound has the opposite
  // failure: a flash re-fired every 33ms reads as a key still held, and a
  // clack re-fired every 33ms is a drone. Hailstorm made the same call for the
  // same reason — a held key is not a shot there either (decision 44).
  if (event.repeat) return null;

  // 2. A modifier is held, not struck.
  //
  // The same `HELD` set the echo never flares, so one rule covers both: a
  // capital is right-shift and a left-hand letter (§3.3), and it should be one
  // sound, on the letter — not a clack for the reach and a clack for the key.
  // It also keeps a child switching windows with Cmd-Tab from typing at their
  // own desktop.
  if (HELD.has(event.code)) return null;

  // 3. A key the board does not draw makes no sound.
  //
  // The clack is the board's voice, so it says exactly what the picture says:
  // a numpad `7`, a media key or `F7` lights nothing and so clacks nothing. It
  // is the same rule that keeps a keyboard shortcut on some layout this build
  // has never heard of from sounding like a letter being typed.
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
