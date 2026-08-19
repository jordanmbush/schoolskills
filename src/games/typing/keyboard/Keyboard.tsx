import type { CSSProperties } from "react";

import { KEY_ROWS } from "@/engine/keyboard";

/**
 * The keyboard, as a picture (docs/typing.md §4).
 *
 * The board itself is not defined here — `@/engine/keyboard` owns the layout,
 * the finger assignment and the geometry, because three of its four consumers
 * are not pictures (§3.1). This file is the fourth: markup and class names over
 * that table, and nothing that a lesson generator or Hailstorm would have to
 * import a component to read.
 *
 * ── Spans, and why every one of them ──────────────────────────────────────
 * Sixty-odd `<span>`s rather than sixty-odd `<button>`s, and the whole board is
 * `aria-hidden="true"`. Both halves of that are the story, not an oversight:
 *
 *   - **Never tappable, on any device** (§4.5). A board you can press is a
 *     hunt-and-peck trainer — it teaches finding a key by eye and pressing it
 *     with whichever finger is closest, which is exactly the habit this world
 *     exists to prevent. On a tablet the software keyboard is already the
 *     interface; this is a map of it, not a second one. The `<span>`s carry no
 *     handler and `pointer-events: none` covers the rest.
 *   - **Silent to a screen reader** (§4.4). Announcing sixty keys is a denial
 *     of service, not an accommodation, and every piece of state this shows is
 *     already in the passage: the live word is `aria-current`, the characters
 *     are text, the errors are in the DOM. So the picture stays a picture.
 *
 * ── One dial ──────────────────────────────────────────────────────────────
 * The board is fifteen key units wide and each key knows its own left edge in
 * those units, so the whole thing scales off a single `--key` custom property
 * in `game.css`. A phone in landscape and a laptop get the same layout at
 * different sizes rather than two layouts — there is no breakpoint here to keep
 * in step with the row stagger.
 *
 * Press echo (#131) and the next-key hint (#132) add state to these keys; #134
 * puts the board under the passage. This story is the board.
 */
export function Keyboard() {
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
            return (
              <span
                key={key.code}
                className={`keyboard__key${key.home ? " is-home" : ""}${
                  isWord ? " is-word" : ""
                }`}
                // The finger is an attribute rather than a class because it is
                // one of a closed set the CSS enumerates once, and because
                // `[data-finger]` is what the tint rules select on.
                data-finger={key.finger}
                style={{ "--x": key.x, "--w": key.width ?? 1 } as CSSProperties}
              >
                {/* The unshifted legend only. A real keycap prints `A` over a
                    key that types `a` unshifted; a child comparing the board
                    against the passage needs the character they are about to
                    type, and the shifted half is what KEY04 lights up. */}
                {key.cap[0]}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
