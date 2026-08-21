import { Button } from "@/components/ui/kit";
import { comboMultiplier } from "@/engine/combo";

import type { StormState } from "@/engine/typing/storm";

/**
 * The two numbers a live run keeps, drawn inside the sky (docs/typing.md §8.6).
 *
 * Nothing here decides any of it: `score`, `combo` and the miss stamp are read
 * off the reducer, because a HUD that worked out what a hit was worth would be
 * a second opinion about it at sixty frames a second, and the one on screen is
 * the one a child would believe. `comboMultiplier(state.combo)` is the
 * multiplier the hit that JUST LANDED was paid at rather than a forecast —
 * `fire` pays a hit at the streak it lands on, so the ×1.4 that appears the
 * instant after a fourth clean hit is what that hit was worth.
 *
 * The two numbers are `aria-hidden`, which is the right side of a trade worth
 * saying out loud. Hailstorm is a physical keyboard and a reaction time, so a
 * child who cannot see the falling letters cannot play it at all (§8.8), and a
 * live region reciting a score that moves every 300ms is a denial of service
 * rather than an accommodation (§4.4). The attribute is on each number rather
 * than on the sky that holds them, because the way out is in here too and that
 * is the one thing on this screen everybody needs.
 *
 * `QUIT_KEY` has to exist alongside this button rather than instead of it:
 * while the gun is live, `Tab` is one of the keys it swallows, so the button
 * cannot be reached by tabbing to it. The button goes when the gun does,
 * because `StormOver` then carries the way out and two of them would be two
 * answers to "how do I leave" on one screen.
 *
 * The `--flare` wash over the score is a child element keyed by `missTintAt`
 * (§8.10, decision 57). A fresh node runs its animation once, an unchanged key
 * is the same node and does not restart it, and there is no timer here to be
 * left mid-flash by a screen that unmounted. What holds it to WCAG 2.3.1 is
 * `MIN_TINT_GAP_MS` in the reducer, where the clock is.
 */
export function StormHud({
  state,
  onQuit,
}: {
  state: StormState;
  /** Ask to leave mid-run. Absent on a screen that offers no way out. */
  onQuit?: () => void;
}) {
  const { combo, missTintAt, score } = state;

  return (
    <div className="storm__hud">
      <p className="storm__score u-mono" aria-hidden="true">
        {score}
        {/* Mounted by the stamp — see the header. Absent until the first miss,
            so a run does not start with a flash of red over a score of
            nothing. */}
        {missTintAt !== null && (
          <span key={`miss${missTintAt}`} className="storm__miss" />
        )}
      </p>

      {onQuit && state.ending === null && (
        <Button variant="bare" className="storm__quit" onClick={onQuit}>
          Quit
        </Button>
      )}

      {/* `--lime` only once there is a streak to be paid for: at ×1 this is a
          fact about the rules, and at ×1.6 it is a thing a child earned. */}
      <p
        className="storm__combo u-mono"
        aria-hidden="true"
        data-hot={combo > 0 ? "" : undefined}
      >{`×${comboMultiplier(combo).toFixed(1)}`}</p>
    </div>
  );
}
