import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { typingMode } from "@/engine/decks/typing";
import { sessionsFor } from "@/engine/records";
import { lessonById } from "@/engine/typing/lessons";
import { isStormLesson, stormWave } from "@/engine/typing/storms";
import { QuitSheet, SaveFailed, useRaceFinish } from "@/games/race";

import { StormField } from "./StormField";
import { StormOver } from "./StormOver";
import { StormReady } from "./StormReady";
import { stormConfig, stormTally } from "./stormSession";
import { useStormClock } from "./useStormClock";

import type { StormLesson } from "@/engine/typing/storms";
import type { Profile } from "@/engine/types";

/**
 * The Hailstorm route (§9), playing one of the twenty levels.
 *
 * The screen is six things joined: a field that draws a `StormState`, a clock
 * that produces one per animation frame, a keyboard that shoots, the way out,
 * the ending that names the finger that let the storm through (`StormOver`),
 * and — the moment the storm stops — the run written to the record book as a
 * `Session` (§8.7, `stormSession.ts`).
 *
 * **Which storm is in the URL** (`#/p/:profileId/storm/:lessonId`). The lesson
 * is the whole of what this route reads: the wave comes from it (`stormWave`),
 * the run files itself under it (`typing:L39`), and nothing here holds a spec
 * of its own for the two to drift apart from.
 *
 * A `lessonId` that is not a storm — a passage, a level id, a typo — goes back
 * to the ladder rather than rendering an empty sky. It is the ordinary end of
 * a hand-edited URL rather than an error case.
 */

/**
 * The route, which owns nothing but which attempt is being played.
 *
 * **A retry is a new run, not the same one rewound** (§8.7, decision 51), and
 * a remount is what makes that structural rather than three things to undo by
 * hand: `useRaceFinish`'s double-finish latch is fresh, so a second attempt is
 * written at all; `history` is snapshotted at mount, so that attempt is badged
 * against a record book which includes the first; and the clock starts at
 * zero, because `useStormClock` starts a fresh run when it is handed a
 * different wave.
 */
export default function StormRun() {
  const { profileId, lessonId } = useParams();
  const profile = usePlayer(profileId);
  const lesson = lessonById(lessonId);
  const [attempt, setAttempt] = useState(0);

  // Same guard as the other run screens: a URL naming a player who isn't on
  // this device goes back to the picker rather than rendering half a game.
  // Below the hooks, so they are called in the same order on every render.
  if (!profile) return <Navigate to="/" replace />;
  if (!isStormLesson(lesson))
    return <Navigate to={`/p/${profile.id}`} replace />;

  /* **The key carries the lesson as well as the attempt**, and the lesson half
     is not decoration. `StormPlay` builds its wave in a `useState` initialiser,
     which runs once per mount — so a route that stayed mounted across
     `#/…/storm/L39` → `#/…/storm/L45` (same pattern, different param, no
     remount) would go on playing lesson 39's storm under lesson 45's name, and
     save it under lesson 45's id. */
  return (
    <StormPlay
      key={`${lesson.id}:${attempt}`}
      lesson={lesson}
      profile={profile}
      onRetry={() => setAttempt((n) => n + 1)}
    />
  );
}

/**
 * One attempt: the wave, the clock, the field, and the write at the end of it.
 *
 * Saved through `useRaceFinish` and not a second save path, because a storm is
 * a `Session` and every hard part of writing one is solved there — scoring,
 * badges, XP into the profile, and IndexedDB refusing a write on a full disk
 * or in private browsing, held in state so `SaveFailed` can offer to try again
 * (§8.7).
 *
 * What it is handed that a race is not:
 *
 *   - **No ghost, and no previous best.** `previousBest: null` buys this run's
 *     own 150 XP bonus and its `personalRecord` flag, and nothing else. What
 *     keeps the record book, the house best and every future rival list from
 *     ranking a storm is `config.storm`, which `stormConfig` sets and
 *     `isRanked` reads (§8.7, decision 50).
 *   - **A results path that is the screen it is already on.** The ending IS
 *     this run's results screen, so the navigation `useRaceFinish` performs on
 *     a good save is a replace onto the current route: it commits the history
 *     entry a race would, and moves nothing.
 */
function StormPlay({
  lesson,
  profile,
  onRetry,
}: {
  /** The rung this storm is, and therefore the wave and the id (§5.6, §8.7). */
  lesson: StormLesson;
  profile: Profile;
  /** Play the same storm again, as a new run. See `StormRun`. */
  onRetry: () => void;
}) {
  const { sessions, saveSession, notify } = useHub();
  const { finish } = useRace();
  const navigate = useNavigate();

  /**
   * Is the quit sheet up? (§8.11, decision 54.)
   *
   * It is the storm's pause as well as its question, and the two are one flag
   * because they are one moment: `useStormClock` takes it as `paused` and
   * stops the loop, which costs the run nothing — wave time is measured
   * between frames, and there are none.
   *
   * **Quitting saves nothing, and no code here makes that true**: the effect
   * below writes on an `ending` the reducer stamps, and a wave abandoned
   * halfway has none (§8.11).
   */
  const [quitting, setQuitting] = useState(false);

  /**
   * Has the child started this wave? (§8.13, decision 71.)
   *
   * A storm hangs at time zero, with an empty sky and a panel in it, until a
   * key says go. False on every attempt, and a retry is a new component
   * (`StormRun`), so the beat is offered again after a loss.
   *
   * It is `useStormClock`'s to end and this screen's to hold, for the reason
   * `quitting` is: the key that starts a run has to be taken by the same
   * listener that would otherwise fire it at a letter, and there is only ever
   * one of those (`QUIT_KEY`).
   */
  const [started, setStarted] = useState(false);

  /**
   * This attempt's wave, and the config the run will be filed under.
   *
   * Built once per mount and never rebuilt: a run's wave is fixed for its
   * whole life (`StormState.wave`). Which is safe only because a different
   * lesson is a different mount — see the key in `StormRun`, without which
   * this initialiser would keep the first storm a child opened for as long as
   * they stayed on the route.
   */
  const [wave] = useState(() => stormWave(lesson));
  const config = useMemo(() => stormConfig(lesson.id, wave), [lesson.id, wave]);
  const { state, skyRef } = useStormClock(wave, {
    paused: quitting,
    started,
    // The first press is spent starting the wave rather than shot at it
    // (§8.13, `started`).
    onStart: () => setStarted(true),
    // The keyboard's way to the same sheet the button opens, taken inside the
    // gun's own listener because every other key while the run is live is a
    // shot (`QUIT_KEY`).
    onQuit: () => setQuitting(true),
  });

  // Snapshotted at mount so the run we're about to save can't affect it.
  const [history] = useState(() => sessionsFor(sessions, profile.id));

  const { saveError, complete, retry } = useRaceFinish({
    profile,
    config,
    seed: wave.seed,
    ghost: null,
    history,
    previousBest: null,
    // Read at save time, off the frame that ended the run — which is the
    // frame this render is of, because `useStormClock` publishes an ending and
    // the effect below fires on it.
    readTally: () => stormTally(state),
    saveSession,
    finish,
    notify,
    navigate,
    resultsPath: `/p/${profile.id}/storm/${lesson.id}`,
    // Nothing to disarm. The gun dies with the run inside `useStormClock` and
    // the field is frozen where the clock stopped.
    onSaving: () => {},
    // And nothing to play: a storm can end by being lost, so its ending is
    // announced off the frame the reducer stamped it (§8.12,
    // `stormSounds.ts`). The race's default would congratulate a child for
    // dying.
    fanfare: () => {},
  });

  /**
   * Save the run, once, on the frame it ends.
   *
   * Through a ref because `complete` is a fresh closure on every render, so
   * naming it as a dependency would re-run this on every re-render — and the
   * ending screen re-renders whenever the hub's sessions change, which the
   * save itself does. The dependency is `state.ending`, which the reducer
   * replaces exactly once per run and then leaves alone.
   *
   * `complete` refuses a second call for the life of this component anyway;
   * across attempts, a retry is a new component (`StormRun`).
   */
  const completeRef = useRef<() => Promise<void>>(async () => {});
  completeRef.current = complete;

  useEffect(() => {
    if (state.ending === null) return;
    void completeRef.current();
  }, [state.ending]);

  // The same screen a race shows, and it stands in for the whole field rather
  // than beside it: a storm that could not be written down is not a storm to
  // go on looking at.
  if (saveError)
    return (
      <SaveFailed
        message={saveError}
        onRetry={retry}
        onDiscard={() => navigate(`/p/${profile.id}`)}
      />
    );

  return (
    <>
      <StormField
        state={state}
        skyRef={skyRef}
        onQuit={() => setQuitting(true)}
        // Present exactly while the wave is waiting, which is also what takes
        // the stones out of the sky (`StormField`).
        ready={started ? undefined : <StormReady />}
        // Drawn where the ending goes, and only once the run is over — which
        // is `StormField`'s call to make.
        over={
          <StormOver
            state={state}
            mode={typingMode(lesson.id)}
            profileId={profile.id}
            onRetry={onRetry}
          />
        }
      />

      {/* The race's sheet and not a second one: it is the same question with a
          different noun, and "it won't be saved and no XP is earned" is the
          one thing being weighed. Quitting goes back to the ladder, which is
          where the tile that sent a child here lives. */}
      {quitting && (
        <QuitSheet
          title="Quit this storm?"
          keep="Keep playing"
          label="Quit the storm"
          onQuit={() => navigate(`/p/${profile.id}`)}
          onKeepRacing={() => setQuitting(false)}
        />
      )}
    </>
  );
}
