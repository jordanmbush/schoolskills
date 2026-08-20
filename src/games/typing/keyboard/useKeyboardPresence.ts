import { useEffect, useState } from "react";

/**
 * Does this device have a physical keyboard? (docs/typing.md §4.5, §8.8,
 * decision 53.)
 *
 * Hailstorm is the one screen on this site that cannot be played without one:
 * it needs raw `keydown` with a `code`, and there is no software keyboard on
 * screen during it (§8.8). A tile that opened a game a child cannot play is
 * the "fails mysteriously" this exists to prevent — so the ladder asks this
 * and says so instead.
 *
 * ── It is a guess, and it is built to be wrong safely ────────────────────────
 * There is no browser API for "a keyboard is attached". Everything available
 * is a proxy, and every proxy is wrong about somebody: an iPad in a
 * keyboard-only folio has a keyboard and reports the pointer of a tablet; a
 * laptop with a touchscreen reports the pointer of a tablet and has always had
 * one. So the answer is built out of two signals of very different strength,
 * and the weak one only ever decides the case the strong one has not.
 *
 *   - **Proof: a key arrived.** Any `keydown` carrying a `code` is a physical
 *     keyboard, full stop, and no media query can argue with it. This latches
 *     for the life of the page and nothing takes it back.
 *   - **A guess: the pointer.** `(any-pointer: coarse) and (any-hover: none)`
 *     is "every input this device has is a fingertip" — no mouse, no trackpad,
 *     nothing that can hover. That is a tablet or a phone. A desktop with a
 *     touchscreen fails the second half (its mouse hovers) and is not caught
 *     by it, which is the false negative that would have mattered most.
 *
 * **The default is yes.** Anything this cannot answer — an old browser with no
 * `matchMedia`, the server, a device whose pointer says nothing — is treated
 * as having a keyboard, because the two ways of being wrong are not the same
 * size. Wrongly open is a tile that does nothing when a child presses it;
 * wrongly shut is a child locked out of the game with no way to argue. And the
 * way back from wrongly shut is the proof above: press any key and the guess
 * is over, live, with nothing to reload.
 *
 * User-agent sniffing is deliberately not among the signals. It is a list of
 * strings that goes stale, it cannot see a keyboard plugged in after the page
 * loaded, and it would answer the one question here — "can this child press a
 * key" — with a fact about who made the device.
 *
 * ── Not stored ───────────────────────────────────────────────────────────────
 * Proof lives in this module and dies with the page. It could be written to
 * the profile and remembered, and deliberately is not: a device is shared, a
 * keyboard is unplugged, and a stored "yes" from March is exactly the kind of
 * stale fact that would lock the honest answer out. Re-proving it costs one
 * keystroke, and a child at a keyboard makes hundreds.
 */

/** Every mounted `useKeyboardPresence`, so proof reaches all of them at once. */
const watchers = new Set<() => void>();

/** Has a real key been seen on this device since the page loaded? */
let proven = false;

/**
 * A keydown that proves a physical keyboard.
 *
 * `code` is the whole test, and it is the same field the gun reads
 * (`useStormClock`) — so what counts as proof here is exactly "a key the storm
 * could have been played with", rather than a second, looser idea of a
 * keystroke. A software keyboard is not expected to produce one: `code` is
 * the physical key's position, which an on-screen key does not have, and both
 * the empty string and `"Unidentified"` are what browsers put there when they
 * have nothing to say.
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
 * Separate from the browser so that the half of this story that matters can be
 * tested without one: **nothing but a definite "every pointer here is a
 * fingertip", with no key ever seen, closes the door.** An unanswerable
 * device, a device with a mouse and a device that has proved itself are all
 * open, and the asymmetry is deliberate — see the file header.
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
  // Server-rendered as `true` for the same reason an unanswerable device is:
  // the markup a screen ships with must not be the one that shuts a door.
  const [present, setPresent] = useState(look);

  useEffect(() => {
    const wake = () => setPresent(look());
    watchers.add(wake);

    // The proof listener outlives this component on purpose, and is removed
    // only by the proof itself. A child who leaves the ladder for a lesson and
    // types four hundred characters has proved the point, and a listener that
    // came off with the screen would have watched none of it. It is one
    // capture listener per page load, on the same window the gun binds to, and
    // it takes itself off the moment it has its answer.
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
