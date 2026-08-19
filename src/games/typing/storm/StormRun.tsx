import { Navigate, useParams } from "react-router-dom";

import { usePlayer } from "@/components/state/HubContext";
import { unlockedAt } from "@/engine/typing/keys";
import { buildWave } from "@/engine/typing/storm";

import { StormField } from "./StormField";
import { useStormClock } from "./useStormClock";

import type { WaveSpec } from "@/engine/typing/storm";

/**
 * The Hailstorm route (docs/typing.md §9), playing one wave.
 *
 * The screen is three things joined: a field that draws a `StormState`, a
 * clock that produces one per animation frame, and a keyboard that shoots. It
 * is still not a whole game — a run that ends leaves the field standing with
 * its score on it, because STM07 owns the death screen, the finger it names
 * and the drill it offers, and STM10 replaces this stand-in wave with the
 * twenty the ladder actually names.
 *
 * Unlinked on purpose. Nothing on the ladder points here until STM10 puts the
 * storm tiles on it, so the only way in is the URL — which is exactly what a
 * screen with no quit button should be.
 */

/**
 * A stand-in storm: everything a child has met by the end of block 4, falling
 * one after another.
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
  keys: [...unlockedAt(40)],
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
 * depends on a lucky roll.
 */
const PREVIEW_SEED = 353;

/**
 * Built once, at module scope, because a wave is fixed for the life of a run
 * and this one is fixed for the life of the tab: `useStormClock` starts a
 * fresh `StormState` per mount, so re-entering the route replays the same
 * storm from zero rather than building a second, identical copy of it.
 */
const PREVIEW_WAVE = buildWave(PREVIEW_SPEC, PREVIEW_SEED);

export default function StormRun() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);
  const { state, skyRef } = useStormClock(PREVIEW_WAVE);

  // Same guard as the other run screens: a URL naming a player who isn't on
  // this device goes back to the picker rather than rendering half a game.
  // Below the hooks, so the clock is armed and cancelled in the same order on
  // every render — the redirect unmounts this, which is what stops it.
  if (!profile) return <Navigate to="/" replace />;

  return <StormField state={state} skyRef={skyRef} />;
}
