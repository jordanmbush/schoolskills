import { useEffect, useState } from "react";

/**
 * Does this device have a physical keyboard? (§4.5, §8.8, decision 53.)
 *
 * Hailstorm is the one screen that cannot be played without one, so the ladder
 * asks and says so on the tile rather than failing mysteriously.
 *
 * There is no browser API for it, so the answer is two signals of very
 * different strength: a `keydown` that latches, and a pointer media query that
 * only ever decides what the keydown has not. Everything neither can answer is
 * a yes, and nothing is stored (§8.8).
 */

/** Every mounted `useKeyboardPresence`, so proof reaches all of them at once. */
const watchers = new Set<() => void>();

/** Has a real key been seen on this device since the page loaded? */
let proven = false;

/**
 * A keydown that proves a physical keyboard: a `code`, which is the same field
 * the gun reads (`useStormClock`), so proof is "a key the storm could have been
 * played with" (§8.8).
 *
 * Both the empty string and `"Unidentified"` are what browsers put in `code`
 * when they have nothing to say.
 *
 * Exported for its test, and because "what counts as proof" is the kind of
 * rule that gets quietly restated at a call site.
 */
export function provesKeyboard(event: Pick<KeyboardEvent, "code">): boolean {
  return (
    typeof event.code === "string" &&
    event.code !== "" &&
    event.code !== "Unidentified"
  );
}

function onKeyDown(event: KeyboardEvent) {
  if (proven || !provesKeyboard(event)) return;
  proven = true;
  window.removeEventListener("keydown", onKeyDown, true);
  for (const wake of [...watchers]) wake();
}

/**
 * Media query for "every pointer on this device is a fingertip".
 *
 * `any-` rather than the primary `pointer`/`hover`, because the question is
 * what the device HAS and not what it is being driven by at this instant — a
 * laptop being used by touch still has its keyboard sitting there.
 */
const TOUCH_ONLY = "(any-pointer: coarse) and (any-hover: none)";

/** The media query object, or `null` where there is no `matchMedia` to ask. */
function touchOnly(): MediaQueryList | null {
  if (typeof window === "undefined") return null;
  if (typeof window.matchMedia !== "function") return null;
  return window.matchMedia(TOUCH_ONLY);
}

/**
 * The rule itself, as arithmetic over the two signals — proof, and what the
 * pointer says (`true` touch-only, `false` not, `null` for a browser that
 * cannot be asked).
 *
 * Separate from the browser so the half that matters can be tested without one:
 * nothing but a definite "every pointer here is a fingertip", with no key ever
 * seen, closes the door (§8.8).
 */
export function keyboardPresent(
  seenKey: boolean,
  touchOnlyDevice: boolean | null,
): boolean {
  return seenKey || touchOnlyDevice !== true;
}

/** The answer right now, for this page and this device. */
function look(): boolean {
  return keyboardPresent(proven, touchOnly()?.matches ?? null);
}

export function useKeyboardPresence(): boolean {
  // Server-rendered as `true`, like any other device this cannot answer
  // (§8.8): the markup a page ships with must not be the one that shuts a door.
  const [present, setPresent] = useState(look);

  useEffect(() => {
    const wake = () => setPresent(look());
    watchers.add(wake);

    // The proof listener outlives this component and is removed only by the
    // proof itself (§8.8). One capture listener per page load, on the same
    // window the gun binds to.
    if (!proven) window.addEventListener("keydown", onKeyDown, true);

    // A trackpad case being attached moves `any-hover` under a tablet, which
    // is a device that just grew a keyboard. Nothing here waits for a
    // keystroke to notice it.
    const query = touchOnly();
    query?.addEventListener("change", wake);

    // The state was read before the effect ran; a key pressed in between would
    // otherwise be a proof nothing published.
    wake();

    return () => {
      watchers.delete(wake);
      query?.removeEventListener("change", wake);
    };
  }, []);

  return present;
}
