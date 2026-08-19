import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOLD_MS, createKeyEcho } from "./useKeyEcho";

/**
 * What the echo owes a child who is not allowed to look at their hands.
 *
 * Two of these protect decisions that a well-meaning change would undo, and
 * they are the reason this state machine is a plain object rather than only a
 * hook (docs/typing.md §4.3):
 *
 *   - **A key releases on a timer, never on `keyup`.** "Wouldn't `keyup` be
 *     simpler?" is the obvious question, and the answer is only visible in the
 *     cases where the `keyup` never comes — lost focus, key repeat, unmount
 *     mid-chord. So the suite presses keys and never releases them, which is
 *     the failure mode, not an omission.
 *   - **Wrongness comes from the code, decided on the press.** The tests type
 *     `$` and shift+`4` at the same expectation to pin that a buffer
 *     comparison could not tell them apart.
 *
 * These drive the machine directly: the unit suite has no DOM, so a rendered
 * hook could not be pressed at all. What that leaves untested is the listener
 * and the `useState` around it.
 */

/** A board with its latest published echo kept to hand. */
function board() {
  const echo = { down: new Set<string>(), wrong: new Set<string>() };
  const machine = createKeyEcho((next) => {
    echo.down = new Set(next.down);
    echo.wrong = new Set(next.wrong);
  });
  return {
    press: machine.press,
    stop: machine.stop,
    down: () => [...echo.down].sort(),
    wrong: () => [...echo.wrong].sort(),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createKeyEcho", () => {
  it("releases a key that was never let go", () => {
    const keys = board();
    keys.press("KeyF", "f");
    expect(keys.down()).toEqual(["KeyF"]);

    // No `keyup` is ever delivered — the window lost focus, or the OS ate it.
    vi.advanceTimersByTime(HOLD_MS + 1);
    expect(keys.down()).toEqual([]);
    expect(keys.wrong()).toEqual([]);
  });

  it("re-arms on a repeat rather than stacking releases behind it", () => {
    const keys = board();
    keys.press("KeyF", "f");
    vi.advanceTimersByTime(HOLD_MS - 20);

    // A held key repeats. The second press must move the release, not queue a
    // second one that would put the key out while it is still down.
    keys.press("KeyF", "f");
    vi.advanceTimersByTime(HOLD_MS - 20);
    expect(keys.down()).toEqual(["KeyF"]);

    vi.advanceTimersByTime(21);
    expect(keys.down()).toEqual([]);
  });

  it("flares the key that was struck when it wasn't the one wanted", () => {
    const keys = board();
    keys.press("KeyD", "f");
    expect(keys.down()).toEqual(["KeyD"]);
    expect(keys.wrong()).toEqual(["KeyD"]);
  });

  it("leaves a correct key lit and unflared", () => {
    const keys = board();
    keys.press("KeyF", "f");
    expect(keys.down()).toEqual(["KeyF"]);
    expect(keys.wrong()).toEqual([]);
  });

  it("lights both keys of a capital, and blames neither", () => {
    const keys = board();
    // The technique: the shift on the hand opposite the letter, held first.
    keys.press("ShiftRight", "A");
    keys.press("KeyA", "A");
    expect(keys.down()).toEqual(["KeyA", "ShiftRight"]);
    expect(keys.wrong()).toEqual([]);
  });

  it("never counts a modifier wrong, whatever is expected", () => {
    const keys = board();
    for (const code of ["ShiftLeft", "ControlLeft", "AltRight", "MetaLeft"])
      keys.press(code, "f");
    expect(keys.wrong()).toEqual([]);
    expect(keys.down()).toHaveLength(4);
  });

  it("judges the key, not the character it would have produced", () => {
    // `$` is shift+`4`, so both of these end a buffer comparison at "$ typed
    // where $ was wanted". Only one of them is the right key.
    const wanted = board();
    wanted.press("Digit4", "$");
    expect(wanted.wrong()).toEqual([]);

    const missed = board();
    missed.press("Digit5", "$");
    expect(missed.wrong()).toEqual(["Digit5"]);
  });

  it("calls CapsLock what it is", () => {
    const keys = board();
    keys.press("CapsLock", "a");
    expect(keys.wrong()).toEqual(["CapsLock"]);
  });

  it("blames nothing when there is nothing expected", () => {
    const keys = board();
    keys.press("KeyQ", null);
    expect(keys.down()).toEqual(["KeyQ"]);
    expect(keys.wrong()).toEqual([]);

    // Nor when the expected character isn't on this layout at all — a curly
    // quote that got past the passage filter has no key to blame.
    keys.press("KeyW", "“");
    expect(keys.wrong()).toEqual([]);
  });

  it("clears a wrong key's flare when that key is struck correctly", () => {
    const keys = board();
    keys.press("KeyD", "f");
    expect(keys.wrong()).toEqual(["KeyD"]);

    // Same key, next character: `d` is now right and must stop flaring even
    // though its release from the first press hasn't come round yet.
    keys.press("KeyD", "d");
    expect(keys.down()).toEqual(["KeyD"]);
    expect(keys.wrong()).toEqual([]);
  });

  it("drops pending releases when it stops", () => {
    const keys = board();
    keys.press("KeyF", "f");
    keys.stop();

    // Unmounting mid-chord: the release must not fire into a gone component.
    expect(() => vi.advanceTimersByTime(HOLD_MS + 1)).not.toThrow();
    expect(vi.getTimerCount()).toBe(0);
  });
});
