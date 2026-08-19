import { Navigate, useParams } from "react-router-dom";

import { usePlayer } from "@/components/state/HubContext";
import { unlockedAt } from "@/engine/typing/keys";
import { buildWave, startStorm, tick } from "@/engine/typing/storm";

import { StormField } from "./StormField";

import type { WaveSpec } from "@/engine/typing/storm";

/**
 * The Hailstorm route (docs/typing.md §9), holding one frame of a storm.
 *
 * The field is a pure function of a `StormState` and STM03 has no clock, so
 * what this screen hands it is a **still frame**: a wave built from a seed,
 * wound forward to the moment every letter has spawned and none has landed.
 * That is enough to be the thing this story is about — twelve letters, each
 * one over the cap that types it, above the board that will shoot them — and
 * it is deliberately not a game yet. STM04 puts a `requestAnimationFrame` loop
 * where `PREVIEW_MS` is, STM05 draws the shield on the line they land on,
 * STM06 gives the screen its HUD and its way out, and STM10 replaces this
 * stand-in wave with the twenty the ladder actually names.
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
 * The gap and the fall are single values rather than ranges so the frame below
 * comes out as a clean staircase — twelve letters evenly spaced down the sky,
 * one lane each — which is what makes a lane visibly checkable against the cap
 * under it. A real level samples both from a range (§8.3); this one is a
 * ruler.
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
 * both hands rather than stuttering on three — and so that the two this story
 * is named after, `f` and `y`, are the two lowest on the screen, right above
 * the caps they are claimed to line up with.
 *
 * A wave is replayable from `(spec, seed)` (§8.3), so a still frame of one is
 * reproducible too: this screen looks the same on every machine and in every
 * session, which is what makes "does `y` fall between `g` and `h`" a question
 * anybody can go and look at rather than one that depends on a lucky roll.
 */
const PREVIEW_SEED = 353;

/**
 * The instant the frame is taken: the last letter's spawn.
 *
 * Every letter is in the air at exactly this moment — the twelfth has just
 * appeared and the first, 3300ms into a 4000ms fall, is still a fifth of the
 * sky above the shield. Nothing has landed, so nothing has been resolved and
 * the shield is untouched.
 */
const PREVIEW_MS = PREVIEW_SPEC.gap[0] * (PREVIEW_SPEC.count - 1);

const PREVIEW = tick(
  startStorm(buildWave(PREVIEW_SPEC, PREVIEW_SEED)),
  PREVIEW_MS,
);

export default function StormRun() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);

  // Same guard as the other run screens: a URL naming a player who isn't on
  // this device goes back to the picker rather than rendering half a game.
  if (!profile) return <Navigate to="/" replace />;

  return <StormField state={PREVIEW} />;
}
