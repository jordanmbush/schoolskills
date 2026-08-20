import { useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { usePlayer } from "@/components/state/HubContext";
import { typingMode } from "@/engine/decks/typing";
import { unlockedAt } from "@/engine/typing/keys";
import { buildWave } from "@/engine/typing/storm";

import { StormField } from "./StormField";
import { StormOver } from "./StormOver";
import { useStormClock } from "./useStormClock";

import type { WaveSpec } from "@/engine/typing/storm";

/**
 * The Hailstorm route (docs/typing.md §9), playing one wave.
 *
 * The screen is four things joined: a field that draws a `StormState`, a clock
 * that produces one per animation frame, a keyboard that shoots, and — once
 * the storm stops — the ending that says which finger let it through and
 * offers a drill of that finger's keys (`StormOver`).
 *
 * What it is still not is a whole game. STM10 replaces the stand-in wave below
 * with the twenty the ladder actually names, and STM08 saves the run as a
 * `Session`; until then nothing that happens here is written down anywhere.
 *
 * Unlinked on purpose. Nothing on the ladder points here until STM10 puts the
 * storm tiles on it, so the only way in is the URL — which is exactly what a
 * screen with no quit button should be.
 */

/**
 * Which lesson this stand-in stands in for: 39, "Hailstorm · Shift under
 * fire" — the last of block 4's two storm levels.
 *
 * One number for the pool AND the mode, so the two cannot drift. The wave
 * draws on the alphabet lesson 39 is played at, and the run files itself under
 * `typing:L39` exactly as a lesson run does (§8.7) — which is what the ending
 * screen builds its drill through. STM10 replaces all of this with the lesson
 * the ladder tile named.
 */
const PREVIEW_LESSON = 39;

/**
 * A stand-in storm: everything a child has met by lesson 39, falling one after
 * another.
 *
 * `unlockedAt` rather than a hand-written pool, because "a wave draws only on
 * keys the ladder has already taught" is the rule STM10 has to keep and a
 * stand-in that broke it would be a stand-in nobody could reason from.
 *
 * The gap and the fall are single values rather than ranges, so this wave is a
 * ruler where a real level is a roll of the dice (§8.3): twelve letters, one
 * every 300ms, each taking four seconds to cross — which puts all twelve in
 * the air together from 3.3s until the first one lands at 4s. That overlap is
 * the point as much as the ruler is. §8.9 promises sixty frames a second with
 * ten letters, the shield and the keyboard on screen, and a stand-in that only
 * ever showed one would be a stand-in that never asked the question.
 */
const PREVIEW_SPEC: WaveSpec = {
  keys: [...unlockedAt(PREVIEW_LESSON)],
  count: 12,
  gap: [300, 300],
  fall: [4000, 4000],
  shield: 3,
  repairAt: 0,
};

/**
 * The seed, picked so the twelve letters land on twelve different keys across
 * both hands rather than stuttering on three — and so that the two this epic
 * is named after, `f` and `y`, are among the first to fall, right above the
 * caps they are claimed to line up with.
 *
 * A wave is replayable from `(spec, seed)` (§8.3), so this storm is the same
 * storm on every machine and in every session: "does `y` fall between `g` and
 * `h`" stays a question anybody can go and look at rather than one that
 * depends on a lucky roll. It is also what "try this wave again" means — the
 * retry below rebuilds from these same two values and meets the same twelve
 * letters in the same lanes.
 */
const PREVIEW_SEED = 353;

/** The mode a run of it files under, and the drill's family (§8.7). */
const PREVIEW_MODE = typingMode(`L${PREVIEW_LESSON}`);

export default function StormRun() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);

  /**
   * The wave, rebuilt on retry.
   *
   * `useStormClock` starts a fresh run whenever it is handed a different wave
   * OBJECT, so building a second one from the same `(spec, seed)` is both the
   * retry and the promise the retry makes: same twelve letters, same lanes,
   * same speeds, from zero. Held in state rather than at module scope for that
   * reason alone — a constant could not change identity, and a child would
   * press "try this wave again" and watch nothing happen.
   */
  const [wave, setWave] = useState(() => buildWave(PREVIEW_SPEC, PREVIEW_SEED));
  const { state, skyRef } = useStormClock(wave);

  // Same guard as the other run screens: a URL naming a player who isn't on
  // this device goes back to the picker rather than rendering half a game.
  // Below the hooks, so the clock is armed and cancelled in the same order on
  // every render — the redirect unmounts this, which is what stops it.
  if (!profile) return <Navigate to="/" replace />;

  return (
    <StormField
      state={state}
      skyRef={skyRef}
      // Drawn where the board was, and only once the run is over — which is
      // `StormField`'s call to make, off the same `ending` the gun dies on.
      over={
        <StormOver
          state={state}
          mode={PREVIEW_MODE}
          profileId={profile.id}
          onRetry={() => setWave(buildWave(PREVIEW_SPEC, PREVIEW_SEED))}
        />
      }
    />
  );
}
