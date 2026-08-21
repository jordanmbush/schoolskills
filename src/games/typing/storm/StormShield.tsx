import { FINGER_ZONES } from "@/engine/keyboard";
import { SHIELD_FINGERS, zoneTally } from "@/engine/typing/storm";

import type { StormState } from "@/engine/typing/storm";
import type { CSSProperties } from "react";

/**
 * The shield: eight segments across the bottom of the field, one per finger
 * (docs/typing.md §8.5, decision 21).
 *
 * Nothing here computes a position. The spans are `FINGER_ZONES` — the home
 * row grouped by finger, in key units off the same `--key` the board and the
 * lanes use — and the stylesheet multiplies them, so there is no arithmetic in
 * this file for the shield and the keyboard to disagree about. The half
 * `--key-gap` step back that a segment shares with a lane is written in
 * `game.css` as `var(--key-gap) / 2` on both, never as the number it currently
 * works out to (§8.2).
 *
 * **One tint per landing, and never a flash sequence** (§8.10). The mechanism
 * is what keeps that true rather than the duration in the stylesheet: each
 * pulse is a child element keyed by a counter that only ever goes up —
 * landings for the tint, repairs for the mend — so React mounts a fresh node
 * exactly when one more of them has happened, and the animation on that node
 * runs once. It cannot restart on a frame where nothing happened to that zone,
 * because the key did not change; and two letters landing on one zone in a
 * single `tick` move the counter by two, which is still one mount and
 * therefore still one tint. Nothing here holds a timer, so there is no state
 * that could be left mid-flash by a screen that unmounted.
 *
 * The counters are read off the run rather than stored on it: `resolved` says
 * what landed and where, a zone's hit points say what remains, and the repairs
 * fall out of the two. `zoneTally` does that arithmetic in the engine beside
 * the reducer, because the ending screen names a finger out of the same
 * numbers and a view that owned them would have made a second screen import a
 * component to count landings.
 */

/**
 * The shield, as markup. A pure function of one `StormState`, like the rest of
 * the field — see the file header for what each piece of it is for.
 */
export function StormShield({ state }: { state: StormState }) {
  const full = state.wave.spec.shield;
  const tally = zoneTally(state);

  return (
    // Hidden for the reason the rest of the sky's moving parts are (§4.4,
    // `StormField`): eight numbers that change as letters land are not an
    // announcement anybody could act on.
    <div className="storm__shield" aria-hidden="true">
      {SHIELD_FINGERS.map((finger) => {
        const zone = FINGER_ZONES[finger];
        const hp = state.shield[finger];
        const { hit, mend } = tally[finger];

        return (
          <div
            // The finger is the identity of a segment, and the order is
            // `SHIELD_FINGERS` — the board order the reducer breaks ties in,
            // so the zone a repair lights is the one a child could have
            // predicted from watching (§8.5).
            key={finger}
            className="storm__zone"
            // An attribute rather than a class, exactly as the keycaps carry
            // theirs: it is one of a closed set the stylesheet enumerates, and
            // it is what gives a segment the same hue as the keys under it.
            data-finger={finger}
            // A zone at zero is a hole, and the stylesheet has no way to ask
            // what `--hp` is worth. `undefined` rather than `false` so the
            // attribute is absent rather than present and false.
            data-hole={hp <= 0 ? "" : undefined}
            style={
              {
                "--zone-x": zone.x,
                "--zone-w": zone.width,
                // A fraction, so the stylesheet needs to know neither how deep
                // this level's shield is nor how much of it is left. The
                // division is guarded because `full` can be zero — a wave may
                // declare no shield at all — and `0 / 0` is a `NaN` that CSS
                // cannot multiply, so the armour's height would be dropped for
                // `auto`. That happens to look like the hole it is, which is
                // exactly the kind of accident not to leave load-bearing.
                "--hp": full > 0 ? hp / full : 0,
              } as CSSProperties
            }
          >
            {/* Mounted by the counter, and that is the whole no-strobe
                mechanism (see the header). Rendered only above zero so the
                eight segments do not all flash on the frame a run starts. */}
            {hit > 0 && <span className="storm__hit" key={`hit${hit}`} />}
            {mend > 0 && <span className="storm__mend" key={`mend${mend}`} />}
          </div>
        );
      })}
    </div>
  );
}
