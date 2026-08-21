import { SHIELD_FINGERS } from "@/engine/typing/storm";
import { sfx } from "@/services/sound";

import type { StormState } from "@/engine/typing/storm";

/**
 * What a storm sounds like, as a function of two frames (docs/typing.md §8.12,
 * decision 66).
 *
 * `fire` and `tick` hand back states rather than event lists, so every sound
 * is a difference between two of them. That makes it a pure function a unit
 * test can drive a whole wave through in a millisecond, and it keeps
 * `storm.ts` a model with no events in it (§8.12).
 *
 * It is called by the clock and not by the view. A hook watching rendered
 * states would see every one of these today, but two publishes inside one
 * React flush render once — and the sound for the first would never play.
 */

/** One thing a run can be heard doing. */
export type StormSound =
  "shoot" | "hit" | "miss" | "shieldHit" | "shieldBreak" | "breach" | "cleared";

/**
 * Everything that happened between two frames, in the order it should be
 * heard.
 *
 * The shot comes first and the answer to it second: a stroke's own sound must
 * never arrive after the sound of what it did.
 *
 * At most three — a stroke is `shoot` plus exactly one of `hit`/`miss`, and a
 * tick is at most one shield sound plus the ending. **A tick that resolves
 * several landings is still one shield sound** (§8.12, §8.10): a backgrounded
 * tab hands the loop a second's worth of wave at once (`MAX_STEP_MS`), and a
 * dozen crunches at once is noise rather than an answer.
 */
export function soundsFor(
  before: StormState,
  after: StormState,
): readonly StormSound[] {
  const sounds: StormSound[] = [];

  // Every stroke the gun takes moves exactly one of these two: `fire` either
  // resolves the lowest letter, which is the combo going up, or charges a
  // miss. So the trigger needs no separate report — and a `shoot` with no
  // outcome would be a keydown the rules refused (an ended run, a held
  // modifier, the way out).
  if (after.combo > before.combo) sounds.push("shoot", "hit");
  else if (after.misses > before.misses) sounds.push("shoot", "miss");

  // Identity first, and it is a real short-circuit rather than a micro-
  // optimisation: `tick` keeps the same shield object on every frame that
  // resolves no landing, which is all but a handful of the sixty a second.
  if (after.shield !== before.shield) {
    let damaged = false;
    let emptied = false;
    for (const finger of SHIELD_FINGERS) {
      if (after.shield[finger] >= before.shield[finger]) continue;
      damaged = true;
      // The zone's last point. Checked against zero rather than against the
      // spec, because a zone that has been mended back up and knocked down
      // again is a hole for the second time and is worth saying so twice.
      if (after.shield[finger] === 0) emptied = true;
    }
    // The louder one replaces the crunch instead of stacking on it — a hole
    // opening is a turning point in the run, and two shield sounds at once is
    // one muddy sound rather than two clear ones.
    if (emptied) sounds.push("shieldBreak");
    else if (damaged) sounds.push("shieldHit");
  }

  // The fatal landing damages nothing — `tick` breaks before the decrement,
  // because the zone it fell on was already a hole — so a breach is only ever
  // this branch, and never a crunch followed by it.
  if (before.ending === null && after.ending !== null)
    sounds.push(after.ending.kind === "breached" ? "breach" : "cleared");

  return sounds;
}

/**
 * Play what changed.
 *
 * Split from the diff above so the rules stay testable without a mixer: every
 * question worth asking — "does mashing at an empty sky make a shield noise",
 * "does dying crunch first" — is a question about `soundsFor`, and this half
 * is a `switch` with nothing in it to get wrong.
 *
 * `sfx` is silent when the player has sound off and in any environment with no
 * `AudioContext`, so neither this nor its callers carry a guard of their own.
 */
export function playStormSounds(before: StormState, after: StormState): void {
  for (const sound of soundsFor(before, after))
    switch (sound) {
      case "shoot":
        sfx.shoot();
        break;
      case "hit":
        // Pitched off the streak the hit LANDED on, which is the multiplier
        // the HUD is showing by the time a child hears it (§8.6).
        sfx.shatter(after.combo);
        break;
      case "miss":
        sfx.misfire();
        break;
      case "shieldHit":
        sfx.shieldHit();
        break;
      case "shieldBreak":
        sfx.shieldBreak();
        break;
      case "breach":
        sfx.breach();
        break;
      case "cleared":
        // The race's own fanfare, because surviving a wave is the same good
        // news as finishing a race. What is different is that a storm can also
        // end badly, which is why the run screen takes `fanfare` off
        // `useRaceFinish` and the ending is announced from here (§8.12).
        sfx.finish();
        break;
    }
}
