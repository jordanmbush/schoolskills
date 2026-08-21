import { useEffect, useRef, useState } from "react";

import { strokeFor } from "@/engine/keyboard";

/**
 * Press echo: which keys are lit, and which of them were the wrong one (§4.3).
 *
 * `Keyboard.tsx` draws the plastic; this decides, keystroke by keystroke, what
 * a child's hands just did.
 */

/**
 * How long a key stays lit, in milliseconds.
 *
 * A key releases on THIS TIMER and never on `keyup`, which is missed often
 * enough — focus lost mid-chord, the OS eating it during a key-repeat, a
 * modifier released after the element unmounts — that a key would be left stuck
 * lit, which is a lie about where the hand is (§4.3). Nothing in this file
 * waits on a release event.
 */
export const HOLD_MS = 120;

export type KeyEcho = {
  /** Codes lit right now. */
  down: ReadonlySet<string>;
  /** Codes flashing `--flare` because they weren't the expected character. */
  wrong: ReadonlySet<string>;
};

/** Nothing pressed. One instance, so a quiet board is the same value twice. */
const SILENT: KeyEcho = { down: new Set(), wrong: new Set() };

/**
 * The keys that are HELD rather than typed, and so are never wrong.
 *
 * Exported because two other readers have to agree with the board about what a
 * stroke even is: the same set decides which keys never flare here, which are
 * never a shot in Hailstorm (`useStormClock`), and which make no sound
 * (`keySounds.ts`, §4.8). Two lists would be a shift that flared red without
 * costing anything, or cost something without saying so.
 *
 * Shift is the reason the set exists: it is not a mistake, it is the technique
 * (§3.3), and the child who reaches for the far shift a beat before the letter
 * would otherwise be told in red that they had erred by doing it right. Held
 * keys still light, because a lit shift is exactly the "where is my hand" the
 * board exists to answer.
 *
 * CapsLock is deliberately NOT here. It is not held to make a character, no
 * stroke on this layout uses it, and hitting it in place of `a` is precisely
 * the mistake that wants pointing out — before it turns the next line into
 * SHOUTING nobody can explain.
 */
export const HELD = new Set([
  "ShiftLeft",
  "ShiftRight",
  "ControlLeft",
  "ControlRight",
  "AltLeft",
  "AltRight",
  "MetaLeft",
  "MetaRight",
]);

/**
 * Was this the wrong key for the character we are waiting on?
 *
 * Decided from `event.code` against `strokeFor(expect)`, and never by comparing
 * what landed in the input against what was wanted (§4.3).
 *
 * Nothing is wrong when there is nothing to be wrong about: the beat between
 * two words has no expected character, and a character this layout cannot
 * produce (a curly quote that escaped the passage filter) has no key to blame.
 * Neither is a mistake, so neither flares.
 */
function isWrong(code: string, expect: string | null): boolean {
  if (HELD.has(code)) return false;
  const stroke = expect === null ? null : strokeFor(expect);
  return stroke !== null && code !== stroke.code;
}

export type KeyEchoBoard = {
  /** Light `code`, flaring it if it wasn't the key `expect` needed. */
  press: (code: string, expect: string | null) => void;
  /** Drop every pending release. What unmounting does. */
  stop: () => void;
};

/**
 * The echo as a plain state machine: presses in, two sets out, one timer per
 * key.
 *
 * Split out of the hook below because it is the part with behaviour, and the
 * unit suite runs in Node with no DOM (`vitest.config.ts`) — a rendered hook
 * could not be driven at all here, and "a press with no keyup still releases"
 * is the assertion this most needs to keep holding. What is left in the hook is
 * a `keydown` listener and a `useState`.
 *
 * `emit` is handed fresh sets rather than the live ones, so a consumer holding
 * last render's echo is holding what it was actually shown.
 */
export function createKeyEcho(emit: (echo: KeyEcho) => void): KeyEchoBoard {
  const down = new Set<string>();
  const wrong = new Set<string>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const publish = () => emit({ down: new Set(down), wrong: new Set(wrong) });

  return {
    press(code, expect) {
      down.add(code);
      if (isWrong(code, expect)) wrong.add(code);
      else wrong.delete(code);

      // One release per code, re-armed rather than stacked: every keydown for
      // a code — the first, and each OS auto-repeat behind it — replaces that
      // code's pending release, so the light goes out HOLD_MS after the last
      // keydown seen for it.
      //
      // What that is not is a picture of which keys are still held down.
      // Auto-repeat does not begin for a few hundred ms, well past HOLD_MS, so
      // a key held down goes dark and relights once the repeats arrive, and a
      // held modifier — which does not repeat at all — simply goes dark. The
      // board echoes strokes (§4.3).
      clearTimeout(timers.get(code));
      timers.set(
        code,
        setTimeout(() => {
          timers.delete(code);
          down.delete(code);
          wrong.delete(code);
          publish();
        }, HOLD_MS),
      );

      publish();
    },
    stop() {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    },
  };
}

/**
 * The echo, wired to the window.
 *
 * `keydown` on the window rather than on the input, because the board has to
 * stay honest wherever focus went — a click on the page background moves focus
 * off the field, and a board that stopped echoing there would read as a
 * keyboard that had stopped working.
 */
export function useKeyEcho({ expect }: { expect: string | null }): KeyEcho {
  const [echo, setEcho] = useState<KeyEcho>(SILENT);

  /**
   * The live expectation, read by the listener rather than closed over. The
   * listener binds once — a fresh binding per character would be a listener
   * churned on every keystroke, and a stale closure would judge this key
   * against the last one.
   *
   * A ref has the opposite hazard: an expectation too FRESH for the key being
   * judged. The keystroke that commits a word is the keystroke that moves this
   * ref, so anything reading it after the commit has re-rendered is asking "was
   * SPACE the right key for the NEXT word's first letter?" — and telling a
   * child in red that they finished a word correctly. The capture flag below is
   * what keeps the read in front of the write.
   */
  const expected = useRef(expect);
  expected.current = expect;

  useEffect(() => {
    const board = createKeyEcho(setEcho);
    const onKeyDown = (event: KeyboardEvent) =>
      board.press(event.code, expected.current);

    // Capture, not bubble — the third argument is load-bearing.
    //
    // §4.3 asks for the key to be judged ON THE PRESS, before anything has
    // re-rendered, and bubbling does not deliver that. React delegates
    // `TypeField`'s `onKeyDown` at the island root, which is inside `window`,
    // so it runs first; on SPACE it commits the word, queueing `setEntry("")`
    // and `setIndex(i + 1)`. React flushes a discrete update in a microtask,
    // and a microtask checkpoint runs BETWEEN two listeners of one real event
    // — so a bubble-phase echo sees the SPACE after the track has re-rendered
    // and the expectation has advanced, and flares every correctly finished
    // word red on the space bar.
    //
    // Capture runs at the very start of propagation, ahead of every handler
    // that could move the expectation. It also survives a `stopPropagation()`
    // anywhere between the field and the window, which bubbling would not.
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      // Unmounting mid-chord is one of the ways a `keyup` goes missing. There
      // is no state left to strand, but a timer that outlives the component
      // would call `setEcho` on it.
      board.stop();
    };
  }, []);

  return echo;
}
