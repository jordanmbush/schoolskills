import { FINGER_ZONES } from "@/engine/keyboard";
import { SHIELD_FINGERS } from "@/engine/typing/storm";

import type { ShieldFinger, StormState } from "@/engine/typing/storm";
import type { CSSProperties } from "react";

/**
 * The shield: eight segments across the bottom of the field, one per finger
 * (docs/typing.md §8.5, decision 21).
 *
 * ── Why finger zones, and not one segment per key ────────────────────────────
 * A per-key shield is the obvious build and it is the wrong one, because of
 * what a child can do with what it tells them. A hole under `o` tells you
 * nothing: `o` is one of forty-odd keys, it will not come round again for a
 * while, and "get better at `o`" is not a thing anybody can practise. A hole
 * under the **right ring finger** tells you what to practise — that finger is
 * a lesson, a drill and a habit, and `o l . 9` are all behind it. It is also
 * the one thing this game can teach that no accuracy percentage ever will: a
 * child watching their own right ring finger crumble is learning something
 * about their hands. Eight is small enough to read at a glance while a storm
 * is falling, and forty-odd would be a strip of noise nobody could read at
 * all.
 *
 * ── Over the fingers that broke it ───────────────────────────────────────────
 * A segment is only that lesson if it is over the right keys, so the spans are
 * `FINGER_ZONES` — the home row grouped by finger, in key units off the same
 * `--key` the board and the lanes use (§8.2). Nothing here computes a
 * position: the engine says which stretch of the board a finger owns, the
 * stylesheet multiplies it, and there is no arithmetic in this file for the
 * shield and the keyboard to disagree about. The one correction they share is
 * half a `--key-gap`, which both the lane and the segment step back by, so a
 * seam lands in the gutter between two keycaps rather than down the middle of
 * one — written in `game.css` as `var(--key-gap) / 2` on both, and never as
 * the number it currently works out to.
 *
 * ── One tint per landing, and never a flash sequence ─────────────────────────
 * Damage is a single ~150ms tint (§8.10), and the mechanism is what keeps that
 * true rather than the duration in the stylesheet. Each pulse is a child
 * element keyed by a **counter that only ever goes up** — landings for the
 * tint, repairs for the mend — so React mounts a fresh node exactly when one
 * more of them has happened, and the animation on that node runs once. It
 * cannot restart on a frame where nothing happened to that zone, because the
 * key did not change; and two letters landing on one zone inside a single
 * `tick` move the counter by two, which is still one mount and therefore still
 * one tint. Nothing here holds a timer, and there is no state that could be
 * left mid-flash by a screen that unmounted.
 *
 * The counters are read off the run rather than stored on it, which is what
 * `StormState` asks of anything wanting a per-finger tally: `resolved` says
 * what landed and where, and a zone's hit points say what is left, so the only
 * unknown is how many repairs went in and that falls out of the other two.
 */

/** What one zone has been through: the two things worth drawing an event for. */
export type ZoneTally = {
  /** Letters that reached this zone. Each is one damage tint. */
  readonly hit: number;
  /** Points repaired back into it (§8.5). Each is one mend pulse. */
  readonly mend: number;
};

/**
 * The eight zones' histories, from the run itself.
 *
 * `hit` is a filter over `resolved` — the tally `StormState` deliberately does
 * not keep, because a second copy of it is a second thing to hold in step
 * sixty times a second.
 *
 * `mend` is arithmetic over the same: a zone's hit points are
 * `spec.shield - absorbed + repairs` by construction, so solving for repairs
 * needs nothing that is not already on screen. **Absorbed, not landed**: the
 * letter that ends a run lands on a zone that is already at nothing and takes
 * no point off it (`tick` breaks before the decrement), so counting it would
 * read as a phantom repair on the frame a child dies. It still tints — it is
 * the loudest thing that ever gets through — which is why the two counters are
 * separate rather than one.
 */
export function zoneTally(state: StormState): Record<ShieldFinger, ZoneTally> {
  const full = state.wave.spec.shield;
  const fatal = state.ending?.kind === "breached" ? state.ending.index : -1;

  const hit = {} as Record<ShieldFinger, number>;
  const absorbed = {} as Record<ShieldFinger, number>;
  for (const finger of SHIELD_FINGERS) {
    hit[finger] = 0;
    absorbed[finger] = 0;
  }

  state.resolved.forEach((outcome, index) => {
    if (outcome?.outcome !== "landed") return;
    const { finger } = state.wave.letters[index];
    hit[finger] += 1;
    if (index !== fatal) absorbed[finger] += 1;
  });

  return Object.fromEntries(
    SHIELD_FINGERS.map((finger) => [
      finger,
      {
        hit: hit[finger],
        mend: state.shield[finger] + absorbed[finger] - full,
      },
    ]),
  ) as Record<ShieldFinger, ZoneTally>;
}

/**
 * The shield, as markup. A pure function of one `StormState`, like the rest of
 * the field — see the file header for what each piece of it is for.
 */
export function StormShield({ state }: { state: StormState }) {
  const full = state.wave.spec.shield;
  const tally = zoneTally(state);

  return (
    <div className="storm__shield">
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
                // declare no shield at all, and every zone of it starts as a
                // hole — and `0 / 0` is a `NaN` that CSS cannot multiply, so
                // the armour's height would be dropped for `auto`. That
                // happens to look like the hole it is, which is exactly the
                // kind of accident not to leave load-bearing.
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
