import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOLD_MS, createKeyEcho } from "./useKeyEcho";

/**
 * What the echo owes a child who is not allowed to look at their hands (§4.3).
 *
 * Two decisions are pinned, and both are visible in how the cases are written:
 *
 *   - **A key releases on a timer, never on `keyup`.** The suite presses keys
 *     and never releases them, which is the failure mode `keyup` cannot cover
 *     — lost focus, key repeat, unmount mid-chord — not an omission.
 *   - **Wrongness comes from the code, decided on the press.** `$` and
 *     shift+`4` are typed at the same expectation, because a buffer
 *     comparison could not tell them apart.
 *
 * The machine is driven directly, and is a plain object rather than only a
 * hook so that it can be: the unit suite has no DOM, so a rendered hook could
 * not be pressed at all. What that leaves untested is the listener and the
 * `useState` around it.
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

  it("does not blame the space that commits a word", () => {
    // The keystroke a child makes most often: a finished word expects SPACE,
    // so the space bar is the RIGHT key here. The other half of the contract
    // is the capture-phase note in `useKeyEcho` — the expectation has to be
    // read before the commit advances it.
    const keys = board();
    keys.press("Space", " ");
    expect(keys.down()).toEqual(["Space"]);
    expect(keys.wrong()).toEqual([]);
  });

  it("does blame a space struck in the middle of a word", () => {
    // The other half: space is not exempt from marking, it is only correct
    // when it is what the passage was waiting for.
    const keys = board();
    keys.press("Space", "e");
    expect(keys.wrong()).toEqual(["Space"]);
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
