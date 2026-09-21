import { useEffect, useState } from "react";

/**
 * Is the key a held-key lesson asks for actually down (§5.8)?
 *
 * The one place in the island that trusts `keyup`, and on purpose. The echo
 * releases on a timer because a key left lit is a lie about where the hand is
 * (§4.3); here a missed release leaves the run believing the key is still
 * held, which costs a child nothing. The two ways a release goes missing that
 * matter — the window losing focus, the tab being hidden — are both read as a
 * release below.
 */

export type HoldWatch = {
  /** A keydown anywhere. The held key's own is canceled, repeats included. */
  keydown: (event: Pick<KeyboardEvent, "code" | "preventDefault">) => void;
  keyup: (event: Pick<KeyboardEvent, "code">) => void;
  /** The window went away; whatever was held, the run can no longer tell. */
  release: () => void;
};

/**
 * The watch as a plain state machine, for the reason `createKeyEcho` is one:
 * the unit suite runs in Node with no DOM.
 *
 * `preventDefault` on the held key is the load-bearing line. Holding `f` types
 * an `f`, and then types it again thirty times a second once auto-repeat
 * starts. Canceled on the keydown — the first press and every repeat behind
 * it — nothing reaches the field: not the character, not a `keypress`, not an
 * `input` event. Every other key is left exactly as it was.
 */
export function createHoldWatch(
  code: string,
  emit: (held: boolean) => void,
): HoldWatch {
  return {
    keydown(event) {
      if (event.code !== code) return;
      event.preventDefault();
      emit(true);
    },
    keyup(event) {
      if (event.code === code) emit(false);
    },
    release() {
      emit(false);
    },
  };
}

/**
 * The watch, wired to the window. `null` asks for nothing and answers `false`.
 *
 * Capture, as the echo binds (§4.3): ahead of the field's own handler and of
 * anything that stops propagation between it and the window. It is also the
 * phase where canceling the held key has to happen for the field never to
 * see the character.
 */
export function useHeldKey(code: string | null): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (code === null) return;
    const watch = createHoldWatch(code, setHeld);
    const onKeyDown = (event: KeyboardEvent) => watch.keydown(event);
    const onKeyUp = (event: KeyboardEvent) => watch.keyup(event);
    const onRelease = () => watch.release();
    const onHidden = () => {
      if (document.visibilityState === "hidden") watch.release();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    window.addEventListener("blur", onRelease);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
      window.removeEventListener("blur", onRelease);
      document.removeEventListener("visibilitychange", onHidden);
      setHeld(false);
    };
  }, [code]);

  return held;
}

/**
 * Has `held` been true for `ms` without a break?
 *
 * The gate a held-key lesson opens on (§5.8, decision 77): a second of the
 * key down, unbroken, before the run begins. A release inside the second
 * clears the timer, so the next press starts the count from nothing — which
 * is what lets the meter on screen (`HoldReady`) and this agree without
 * either reading the other.
 */
export function useHeldFor(held: boolean, ms: number): boolean {
  const [long, setLong] = useState(false);

  useEffect(() => {
    if (!held) {
      setLong(false);
      return;
    }
    const timer = window.setTimeout(() => setLong(true), ms);
    return () => window.clearTimeout(timer);
  }, [held, ms]);

  return long;
}
