import { Keyboard } from "./Keyboard";
import { useKeyEcho } from "./useKeyEcho";
import type { KeyboardMode } from "@/engine/types";

/**
 * The board as a typist actually meets it: the picture, plus what their hands
 * are doing to it (docs/typing.md §4).
 *
 * Three pieces built apart meet here and nowhere else — `Keyboard` draws
 * (#130), `useKeyEcho` listens (#131), `KeyboardMode` decides how much of it a
 * child wants (#133). It exists as its own component for two reasons, both
 * about what a keystroke is allowed to cost:
 *
 *   - **The echo re-renders this and not the passage.** `useKeyEcho` publishes
 *     on every keydown and again when each key's 120ms release fires. Called
 *     up in `TypingTrack`, every one of those would re-render the twenty words
 *     of the passage and the lane behind them, at the speed a child types.
 *     Called here, they re-render sixty spans and stop.
 *   - **"Off" is off, not hidden.** The caller mounts this only when the mode
 *     is not "off" — which is why `mode` excludes it rather than returning
 *     `null` for it. A board that returned `null` after calling the hook would
 *     still hold a window listener and a timer per key for a child who asked
 *     to be rid of it.
 *
 * Nothing here can take focus. That is not a promise this file keeps by being
 * careful; the board is sixty inert `<span>`s under `pointer-events: none`
 * (§4.5), so there is no element to focus and no handler to move it. It
 * matters more than it sounds: on a phone the OS keyboard is raised only by
 * the focused `<input>`, so a board that stole focus would take the real
 * keyboard away with it and end the run.
 */
export function LiveKeyboard({
  mode,
  next,
}: {
  /**
   * How much board to draw. "off" is absent because that decision belongs to
   * the caller — see above.
   */
  mode: Exclude<KeyboardMode, "off">;
  /**
   * The character the passage is waiting on, or `null` when it isn't waiting
   * on one — before the countdown clears, and once the run is over.
   */
  next: string | null;
}) {
  /**
   * The expectation is the real next character in BOTH modes, and only the
   * hint is withheld in "keys".
   *
   * "Show me the board but not the answer" is a statement about the hint, not
   * about the marking: a child who has stopped needing to be told which key
   * comes next has not stopped needing to be told they hit the wrong one —
   * that is the rung of the ladder they are on. Passing `null` here to match
   * the hint would turn every wrong key green.
   */
  const { down, wrong } = useKeyEcho({ expect: next });

  return (
    <Keyboard down={down} wrong={wrong} next={mode === "guide" ? next : null} />
  );
}
