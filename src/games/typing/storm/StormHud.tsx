import { comboMultiplier } from "@/engine/combo";
import { stormXp } from "@/engine/progress";

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
 * Nothing here decides any of that. `score`, `combo` and `misses` are read off
 * the reducer, which is where every rule about them lives (§8.9): a HUD that
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
 * That puts it inside the sky's `aria-hidden`, which is the right side of that
 * trade and worth saying out loud. Hailstorm is a physical keyboard and a
 * reaction time — a child who cannot see the falling letters cannot play it at
 * all (§8.8 and STM09 are where that is answered honestly) — and a live region
 * reciting a score that moves every 300ms is a denial of service rather than
 * an accommodation (§4.4).
 *
 * ── One flash per miss, and never a sequence ─────────────────────────────────
 * The `--flare` wash over the score is a child element keyed by `misses`, a
 * counter that only ever goes up — the mechanism the shield's damage tint
 * already uses (§8.10, decision 42). A fresh node runs its animation once, an
 * unchanged key is the same node and does not restart it, and there is no
 * timer here to be left mid-flash by a screen that unmounted. The gun ignores
 * key auto-repeat (decision 44), so the fastest this can mount is a child's
 * own keystrokes.
 */
export function StormHud({ state }: { state: StormState }) {
  const { combo, ending, misses, score } = state;

  return (
    <div className="storm__hud">
      <p className="storm__score u-mono">
        {score}
        {/* Mounted by the counter — see the header. Only above zero, so a run
            does not start with a flash of red over a score of nothing. */}
        {misses > 0 && <span key={`miss${misses}`} className="storm__miss" />}
      </p>

      {/* `--lime` only once there is a streak to be paid for: at ×1 this is a
          fact about the rules, and at ×1.6 it is a thing a child earned. */}
      <p
        className="storm__combo u-mono"
        data-hot={combo > 0 ? "" : undefined}
      >{`×${comboMultiplier(combo).toFixed(1)}`}</p>

      {/*
        The payout, once the storm is over — the run's XP, computed at the end
        from its hits and floored at zero, which is the whole of §8.6's second
        half. It is here rather than on a screen of its own because there is no
        screen of its own yet: STM07 puts a proper ending in front of a child,
        names the finger that let the storm through and offers the drill for
        it, and this line is what tells them what they earned until it does.
      */}
      {ending !== null && (
        <p className="storm__xp u-mono">{`+${stormXp(state)} XP`}</p>
      )}
    </div>
  );
}
