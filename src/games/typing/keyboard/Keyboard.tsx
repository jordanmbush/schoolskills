import type { CSSProperties } from "react";

import { KEY_ROWS, strokeFor } from "@/engine/keyboard";

/** Nobody typing. The board still draws — the ladder shows one at rest. */
const NONE: ReadonlySet<string> = new Set();

/**
 * The keyboard, as a picture (§4).
 *
 * The layout is not defined here — `@/engine/keyboard` owns it, because three
 * of its four consumers are not pictures (§3.1). This file is the fourth:
 * markup and class names over that table.
 *
 * Sixty-odd `<span>`s rather than `<button>`s, and the whole board is
 * `aria-hidden="true"`: it is never tappable on any device (§4.5, decision 5),
 * and announcing sixty keys is a denial of service rather than an
 * accommodation (§4.4). The spans carry no handler and `pointer-events: none`
 * covers the rest.
 *
 * The board is fifteen key units wide and each key knows its own left edge in
 * those units, so the whole thing scales off a single `--key` in
 * `keyboard.css` — one layout at two sizes, with no breakpoint to keep in step
 * with the row stagger. That dial tops out at real key pitch (§4.7), which is
 * why on a wide screen the board is wider than the 720px race column and is
 * allowed to overflow it; the CSS says how.
 *
 * The echo arrives as props rather than from a hook called here (§4.3): the
 * board stays a pure function of its props, testable by rendering it, and
 * Hailstorm can want the same echo for its gun without a second copy of the
 * listener fighting this one.
 *
 * `next` is the character the passage is waiting on, not two code props —
 * which shift goes with `A` is the layout's to answer (§3.3). WHEN the hint is
 * on is `KeyboardMode`'s: mode "keys" passes `next={null}`.
 */
export function Keyboard({
  down = NONE,
  wrong = NONE,
  next = null,
}: {
  /** Codes lit right now — `useKeyEcho`'s `down`. */
  down?: ReadonlySet<string>;
  /** Codes flashing `--flare`; always a subset of `down`. */
  wrong?: ReadonlySet<string>;
  /**
   * The character to point at, or `null` for no hint at all.
   *
   * `null` is the ordinary state, not an error: the run hasn't started, the
   * run has finished, or the mode is "keys" and nothing is being pointed at.
   */
  next?: string | null;
}) {
  /**
   * The keys the hint lights: the character's own key, and — for a capital or
   * any other shifted character — the shift on the OPPOSITE hand, which
   * `strokeFor` has already chosen and this does not second-guess (§3.3).
   *
   * `strokeFor` answers `null` for a character this layout cannot produce — a
   * curly quote that survived the passage filter — which lights nothing rather
   * than throwing, exactly as `next: null` does.
   */
  const hint = next === null ? null : strokeFor(next);

  return (
    <div className="keyboard" aria-hidden="true">
      {KEY_ROWS.map((row, index) => (
        // The row index is a stable key: the layout is a constant, and nothing
        // reorders it.
        <div className="keyboard__row" key={index}>
          {row.map((key) => {
            // A word legend — "Shift", "Bksp", "Caps" — is set smaller so it
            // fits a one-unit cap's worth of room without shrinking the letters
            // that a child is actually reading.
            const isWord = key.cap[0].length > 1;
            // Both halves of the stroke, from the one lookup. `hint.shift` is
            // `null` for an unshifted character and no key's code is `null`,
            // so an ordinary letter lights exactly one key.
            const isNext =
              hint !== null &&
              (key.code === hint.code || key.code === hint.shift);
            return (
              <span
                key={key.code}
                // `is-wrong` is written alongside `is-down` rather than
                // instead of it: a wrong key is still a key that went down,
                // and the CSS orders the two so the flare wins the colour.
                // `is-next` stacks the same way and loses the cap to both,
                // but only the cap — the hint's ring and its pulse are
                // properties the echo never declares, so a hinted key that is
                // struck shows both.
                className={[
                  "keyboard__key",
                  key.home && "is-home",
                  isWord && "is-word",
                  isNext && "is-next",
                  down.has(key.code) && "is-down",
                  wrong.has(key.code) && "is-wrong",
                ]
                  .filter(Boolean)
                  .join(" ")}
                // The finger is an attribute rather than a class: it is one of
                // a closed set the CSS enumerates once, and `[data-finger]` is
                // what the tint rules select on.
                data-finger={key.finger}
                style={{ "--x": key.x, "--w": key.width ?? 1 } as CSSProperties}
              >
                {/* The unshifted legend only. A real keycap prints `A` over a
                    key that types `a`; a child comparing the board against
                    the passage needs the character they are about to type,
                    and a capital is shown by lighting the shift beside the
                    letter. */}
                {key.cap[0]}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
