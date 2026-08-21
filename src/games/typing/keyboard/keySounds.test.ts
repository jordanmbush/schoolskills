import { describe, expect, it } from "vitest";

import { soundForKey } from "./keySounds";

/**
 * What the board is allowed to say out loud (docs/typing.md §4.8).
 *
 * The rule is one function over one event, so the whole of it is testable
 * without a mixer or a DOM — the same split `stormSounds.ts` uses, and for the
 * same reason: the questions worth asking here ("does a held key machine-gun",
 * "does a wrong key sound wrong") are questions about the rule, and
 * `playKeySound` is a `switch` with nothing in it to get wrong.
 *
 * Three of the four silences below are decisions a well-meaning change would
 * undo, so they are written as the cases that would have made a noise.
 */

/** A keydown, as the rule sees one. */
const press = (code: string, repeat = false) => ({ code, repeat });

describe("soundForKey", () => {
  it("strikes a typebar for a letter, a digit and a mark", () => {
    expect(soundForKey(press("KeyF"))).toBe("strike");
    expect(soundForKey(press("Digit4"))).toBe("strike");
    expect(soundForKey(press("Semicolon"))).toBe("strike");
  });

  it("gives the space bar its own, deeper voice", () => {
    // The key that commits a word, so the beat between words is audible.
    expect(soundForKey(press("Space"))).toBe("space");
  });

  it("rings the bell on Return", () => {
    expect(soundForKey(press("Enter"))).toBe("return");
  });

  it("sounds the same whether or not the key was the right one", () => {
    // The rule is not handed an expectation at all, which is the point: the
    // board already flares the wrong key and the run already plays `wrong` at
    // the word. This test exists to make deleting that argument visible —
    // there is nothing in the signature to pass a verdict through.
    expect(soundForKey(press("KeyD"))).toBe(soundForKey(press("KeyF")));
  });

  it("stays silent on auto-repeat", () => {
    // A held key is one stroke. The board relights on every repeat because its
    // light is a timer that must be re-armed; a clack re-fired every 33ms is a
    // drone rather than a keyboard.
    expect(soundForKey(press("KeyF"))).toBe("strike");
    expect(soundForKey(press("KeyF", true))).toBeNull();
    expect(soundForKey(press("Space", true))).toBeNull();
  });

  it("stays silent on the keys that are held rather than struck", () => {
    // A capital is right-shift and a left-hand letter — one character, and so
    // one sound, on the letter.
    expect(soundForKey(press("ShiftRight"))).toBeNull();
    expect(soundForKey(press("ControlLeft"))).toBeNull();
    expect(soundForKey(press("MetaLeft"))).toBeNull();

    // CapsLock is not held, is not part of any stroke on this layout, and is
    // exactly the mis-hit worth pointing out — the echo flares it, so it
    // clacks like everything else the board draws.
    expect(soundForKey(press("CapsLock"))).toBe("strike");
  });

  it("stays silent for a key this board does not draw", () => {
    // A numpad key, a media key, a function key: the picture shows none of
    // them, so the clack — which is the picture's voice — has nothing to say.
    expect(soundForKey(press("Numpad7"))).toBeNull();
    expect(soundForKey(press("AudioVolumeUp"))).toBeNull();
    expect(soundForKey(press("F7"))).toBeNull();
    expect(soundForKey(press(""))).toBeNull();
  });

  it("clacks for the keys that are not letters but are on the board", () => {
    // Backspace deliberately sounds like any other key. A typewriter has no
    // undo, and a quieter correction would be the board passing judgement on
    // one — which is the thing this set does not do.
    expect(soundForKey(press("Backspace"))).toBe("strike");
    expect(soundForKey(press("Tab"))).toBe("strike");
  });
});
