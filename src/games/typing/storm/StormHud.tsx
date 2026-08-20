import { Button } from "@/components/ui/kit";
import { comboMultiplier } from "@/engine/combo";

import type { StormState } from "@/engine/typing/storm";

/**
 * The two numbers a run keeps, over the sky it is being played in
 * (docs/typing.md §8.6).
 *
 * ── Score, and the multiplier it is paid at ──────────────────────────────────
 * `comboMultiplier(state.combo)` is the multiplier the hit that JUST LANDED
 * was paid at, and not a forecast for the next one. `fire` sets `combo` to
 * `state.combo + 1` and pays that hit at the streak it lands on, so this is
 * the figure the score has already moved by — measured in a browser, the HUD
 * reads ×1.4 the instant after a fourth clean hit, and that hit paid 14. The
 * next one is a step higher, ×0.1 more until the ×2 cap, which is the same
 * fact said forwards: this is the streak the next hit builds on.
 *
 * It is the prominent half on purpose all the same. The score is a running
 * total and says nothing about how the run is going now; `×1.7` says seven
 * clean hits in a row and still climbing, and that is the whole of what this
 * screen is trying to teach — that a run of clean hits is worth more than the
 * same hits scattered. It is `comboMultiplier`, the same curve `cardXp` pays a
 * flash card at, so the figure a child watches climb here is the figure their
 * XP is worth (`stormXp`). One streak, one multiplier, two currencies.
 *
 * Nothing here decides any of that. `score`, `combo` and the miss stamp are
 * read off the reducer, where every rule about them lives (§8.9): a HUD that
 * worked out what a hit was worth would be a second opinion about it at sixty
 * frames a second, and the one on screen is the one a child would believe.
 *
 * ── In the sky, not beside it (decision 45) ──────────────────────────────────
 * `.storm` is a two-track grid — the sky, and the board that never gives — and
 * the sky is what gives: about 78px of it at 1280×360, and about 21px at
 * 1280×250 (§8.2). A HUD row would be taken out of the one track with nothing
 * left to give, so this is drawn INSIDE the sky instead, and costs it no
 * height at all. It is first in the sky so the stones paint over it rather
 * than under it: a number must never hide a letter that has to be shot, which
 * is also why the score sits in the HUD's dim ink rather than in `--chalk`.
 *
 * The two numbers are `aria-hidden`, which is the right side of that trade and
 * worth saying out loud. Hailstorm is a physical keyboard and a reaction time —
 * a child who cannot see the falling letters cannot play it at all (§8.8) —
 * and a live region reciting a score that moves every 300ms is a denial of
 * service rather than an accommodation (§4.4). The attribute is on each of
 * them rather than on the sky that holds them, because the way out is in here
 * too and that is the one thing on this screen everybody needs (below).
 *
 * ── The way out ─────────────────────────────────────────────────────────────
 * A storm fills the viewport and there is no site chrome over a game
 * (CLAUDE.md), so without this a child who cannot play — the tablet §8.8 is
 * about, or anyone who has simply had enough — is on a screen with no exit but
 * the browser's own. It sits between the two numbers because those are the two
 * corners already taken, and because the middle of the HUD is the part of the
 * sky a child is least often reading: the letters that matter are the low
 * ones.
 *
 * It is a real control and not a decoration: `pointer-events` are given back
 * to it in `game.css` (the sky refuses them, so a drag cannot select a
 * hailstorm), and it is the one thing in the sky a finger is allowed to land
 * on. `QUIT_KEY` is the same door for a child who has a keyboard, and it has
 * to exist separately: while the gun is live, `Tab` is one of the keys it
 * swallows, so this button cannot be reached by tabbing to it.
 *
 * It goes when the gun does. Once the run has an ending, the panel that stands
 * where the board did carries the way out (`StormOver`), and two of them would
 * be two answers to "how do I leave" on one screen.
 *
 * ── One flash per miss, and never a sequence ─────────────────────────────────
 * The `--flare` wash over the score is a child element keyed by `missTintAt`,
 * a wave-time stamp that only ever goes forward — the mechanism the shield's
 * damage tint already uses (§8.10, decision 42). A fresh node runs its
 * animation once, an unchanged key is the same node and does not restart it,
 * and there is no timer here to be left mid-flash by a screen that unmounted.
 *
 * **The stamp rather than `misses`, and that is the whole of decision 57.** A
 * wave's tint rate is a property of its own schedule, held under three a
 * second by the twenty levels themselves — but a miss is a child pressing a
 * wrong key, and eight or ten a second is a hand rather than a bug. The gun
 * already ignores key auto-repeat (decision 44), which takes 30Hz off the
 * table; what keeps the rest of it under WCAG 2.3.1's three flashes a second
 * is `MIN_TINT_GAP_MS` in the reducer, where the clock is. So this element
 * mounts at most once every 340ms however fast the keys come, and every other
 * cost of a miss is charged in full whether it lights or not.
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
