import { useEffect, useRef, useState } from "react";

import { strokeFor } from "@/engine/keyboard";

/**
 * Press echo: which keys are lit, and which of them were the wrong one
 * (docs/typing.md §4.3).
 *
 * This is the half of the board that moves. `Keyboard.tsx` draws the plastic;
 * this decides, keystroke by keystroke, what a child's hands just did — so
 * they can see it without looking down, which is the entire point of the
 * world.
 */

/**
 * How long a key stays lit, in milliseconds.
 *
 * A key releases on THIS TIMER and not on `keyup`, which is the one decision
 * in this file worth defending. `keyup` is missed more often than you would
 * think: the window loses focus mid-chord and the release lands somewhere
 * else, the OS eats it during a key-repeat, a modifier comes up after the
 * element has unmounted. Every one of those leaves a key stuck lit, and a key
 * stuck lit is worse than no highlight at all — it is a lie about where the
 * hand is, told to a child who is trusting the picture precisely because they
 * are not allowed to look at the real keyboard.
 *
 * A timer cannot get stuck. It also happens to feel better: a flash reads as
 * "that fired", a hold reads as "something is wrong".
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
 * Shift is the reason this set exists. Shift is not a mistake, it is the
 * technique: a capital is right-shift plus a left-hand letter (§3.3), and the
 * child who reaches for the far shift a beat before the letter — the thing
 * this course is trying hardest to teach — would otherwise be told in red that
 * they had erred by doing it right. They still light, because a lit shift is
 * exactly the "where is my hand" the board exists to answer. Ctrl, Alt and the
 * Cmd keys are here for the duller version of the same reason: a child
 * switching windows is not attempting the letter.
 *
 * CapsLock is deliberately NOT here. It is not held to make a character, no
 * stroke on this layout uses it, and hitting it in place of `a` is precisely
 * the mistake that wants pointing out — before it turns the next line into
 * SHOUTING nobody can explain.
 */
const HELD = new Set([
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
 * Decided from `event.code` against `strokeFor(expect)`, and never by
 * comparing what landed in the input against what was wanted. Two reasons,
 * both fatal to the buffer version: a buffer cannot tell shift+`4` from `$`
 * — same character, different keys, and only one of them is a mistake — and
 * it cannot answer at all until React has re-rendered, by which point the
 * flash is late enough to belong to the next keystroke. The keydown handler
 * already holds the code; the comparison here is immediate and exact.
 *
 * Nothing is wrong when there is nothing to be wrong about: free play between
 * words has no expected character, and a character this layout cannot produce
 * (a curly quote that escaped the passage filter) has no key to blame.
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
 * is the assertion this story most needs to hold in a year. What is left in
 * the hook is a `keydown` listener and a `useState`.
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

      // A held key repeats, and each repeat re-arms the same release rather
      // than stacking a second one behind it — so a key held down stays lit
      // for as long as it is held, and goes out 120ms after it is let go
      // whether or not the `keyup` ever arrives.
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
 * stay honest wherever focus went — and because Hailstorm has no input at all
 * (§8.2), where this same hook is the gun.
 *
 * Both sets change at most ten times a second, so a `useState` per keystroke
 * costs nothing next to the race clock already re-rendering this screen
 * sixteen times a second.
 */
export function useKeyEcho({ expect }: { expect: string | null }): KeyEcho {
  const [echo, setEcho] = useState<KeyEcho>(SILENT);

  /**
   * The live expectation, read by the listener rather than closed over. The
   * listener binds once — a fresh binding per character would be a listener
   * churned on every keystroke, and a stale closure would judge this key
   * against the last one.
   */
  const expected = useRef(expect);
  expected.current = expect;

  useEffect(() => {
    const board = createKeyEcho(setEcho);
    const onKeyDown = (event: KeyboardEvent) =>
      board.press(event.code, expected.current);

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      // Unmounting mid-chord is one of the ways a `keyup` goes missing. There
      // is no state left to strand, but a timer that outlives the component
      // would call `setEcho` on it.
      board.stop();
    };
  }, []);

  return echo;
}
