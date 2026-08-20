import { SHIELD_FINGERS } from "@/engine/typing/storm";
import { sfx } from "@/services/sound";

import type { StormState } from "@/engine/typing/storm";

/**
 * What a storm sounds like, as a function of two frames (docs/typing.md §8.12).
 *
 * ── Read off the state, not raised by the code that changed it ───────────────
 * `fire` and `tick` are the only two things that move a run, and neither of
 * them returns an event list — they return the next `StormState`, and every
 * event worth a sound is a difference between that and the one before it: a
 * hit is the combo going up, a miss is the miss count going up, a letter
 * getting through is a shield zone going down, and the end of the run is
 * `ending` arriving. So the sound is a diff, and the diff is a pure function
 * that a unit test can drive a whole wave through in a millisecond.
 *
 * The alternative is the reducer handing back "and here is what happened",
 * which is a second description of the run living beside the run — and the
 * copy is the one that drifts. `storm.ts` is deliberately a model with no
 * events in it (§8.9); this is the view asking it what changed.
 *
 * ── Why it is not derived from what the screen draws ─────────────────────────
 * `useStormClock` publishes to React only when the PICTURE changes, and every
 * event here does change it — so a hook watching rendered states would see all
 * of them today. It would be one React batching decision away from not seeing
 * them, though: two publishes inside one flush render once, and the sound for
 * the first would simply never play. Diffing where the state is produced has
 * no such window, which is why the clock calls this and the field does not.
 */

/** One thing a run can be heard doing. */
export type StormSound =
  "shoot" | "hit" | "miss" | "shieldHit" | "shieldBreak" | "breach" | "cleared";

/**
 * Everything that happened between two frames, in the order it should be
 * heard.
 *
 * The shot comes first and the answer to it second, so a hit is a `pew` with a
 * chime on top rather than the other way round — a stroke's own sound must
 * never arrive after the sound of what it did.
 *
 * At most three: a stroke is `shoot` plus exactly one of `hit`/`miss`, and a
 * tick is at most one shield sound plus the ending. **A tick that resolves
 * several landings is still one shield sound.** A backgrounded tab hands the
 * loop a second's worth of wave at once (`MAX_STEP_MS`), and a dozen crunches
 * fired inside one frame is a burst of noise that says nothing about which
 * zone or how many — the same reasoning that makes several landings on one
 * zone a single tint rather than several (§8.10, decision 42).
 */
export function soundsFor(
  before: StormState,
  after: StormState,
): readonly StormSound[] {
  const sounds: StormSound[] = [];

  // Every stroke the gun takes moves exactly one of these two: `fire` either
  // resolves the lowest letter, which is the combo going up, or charges a
  // miss. So the trigger does not have to be reported separately — a shot is
  // recoverable from its own outcome, and a `shoot` with no outcome would be
  // a keydown the rules refused (an ended run, a held modifier, the way out).
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
        // news as finishing a race and should not have a second tune. What is
        // different is that a storm can also end badly, which is why the run
        // screen takes `fanfare` off `useRaceFinish` and the ending is
        // announced from here instead (`sfx.breach`).
        sfx.finish();
        break;
    }
}
