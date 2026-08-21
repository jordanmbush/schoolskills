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
 * The Hailstorm route (docs/typing.md §9), playing one of the twenty levels.
 *
 * The screen is six things joined: a field that draws a `StormState`, a clock
 * that produces one per animation frame, a keyboard that shoots, the way out
 * (below), the ending that says which finger let it through and offers a drill
 * of that finger's keys (`StormOver`), and — the moment the storm stops — the
 * run written to the record book as a `Session` (§8.7, `stormSession.ts`).
 *
 * **Which storm is in the URL** (`#/p/:profileId/storm/:lessonId`), because a
 * level is a rung of the ladder and the ladder is where a child chose it. The
 * lesson is the whole of what this route reads: the wave comes from it
 * (`stormWave`, which draws the pool from `unlockedAt(n)` — §5.6), the run
 * files itself under it (`typing:L39`, §8.7), and nothing here holds a spec of
 * its own for the two to drift apart from.
 *
 * A `lessonId` that is not a storm — a passage, a level id, a typo — goes back
 * to the ladder rather than rendering an empty sky. It is not an error case so
 * much as the ordinary end of a hand-edited URL, and the ladder is where the
 * answer to "which storms are there" is drawn.
 */

/**
 * The route, which owns nothing but which attempt is being played.
 *
 * **A retry is a new run, not the same one rewound** (decision 51), and that is
 * why it is a remount rather than a fresh wave handed to a component that stays
 * put. Three things a second go has to get right come free from starting the
 * component again, and every one of them would have to be undone by hand
 * otherwise:
 *
 *   - **It has not been saved.** `useRaceFinish` guards its own double-finish
 *     with a ref that latches for the life of the hook, so a screen that kept
 *     that hook across a retry would write the first run and silently never
 *     write another. A new instance is a new latch — which is the guard, said
 *     structurally rather than kept in step by a second flag.
 *   - **Its history includes the run before it.** `history` is snapshotted at
 *     mount so the run being saved cannot alter its own scoring; a second
 *     attempt badged against the first attempt's snapshot would be counting a
 *     record book that no longer exists.
 *   - **Its clock starts at zero.** `useStormClock` starts a fresh run when it
 *     is handed a different wave, and a remount is the plainest way to hand it
 *     one.
 *
 * The wave itself is rebuilt from the same `(spec, seed)`, so "try this wave
 * again" means the same letters in the same lanes at the same speeds (§8.3) —
 * a different run of the same storm, which is the only version of beating it
 * that means a child got better.
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
     save it under lesson 45's id. Every reason a retry is a remount is a
     reason a different level is one too (see below); the difference is that a
     retry means to meet the same wave and this must not. */
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
 * ── Saved through the race's own finish ──────────────────────────────────────
 * `useRaceFinish` and not a second save path, because a storm is a `Session`
 * and every hard part of writing one has already been solved there: scoring
 * through `summariseRun`, the badges, the XP into the profile, and the failure
 * that matters — IndexedDB refusing a write on a full disk or in private
 * browsing — held in state so the answers are still in memory and `SaveFailed`
 * can offer to try again (§8.7's "no new code downstream", from the other
 * side).
 *
 * What it is handed that a race is not:
 *
 *   - **No ghost, and no previous best.** Nothing chases a storm, and a storm
 *     holds no record: `compareRuns` ranks runs on time, and a run that ended
 *     at letter three took less of it than one that cleared the wave — so a
 *     best would go to dying early, and pay a personal-best bonus for it. XP
 *     must never reward the thing the game is against (§8.6, decision 50).
 *
 *     `previousBest: null` is only half of that, and the smaller half: it
 *     buys this run's own 150 XP bonus and its `personalRecord` flag, and
 *     nothing else. What stops the record book, the house best and every
 *     future rival list from ranking the run is `config.storm`, which
 *     `stormConfig` sets and `isRanked` reads — the run is still filed under
 *     its `configKey`, so a later story that wants to rank storms on
 *     something other than time has every run it needs.
 *   - **A results path that is the screen it is already on.** The ending
 *     stands where the board did (decision 47) and IS this run's results
 *     screen, so the navigation `useRaceFinish` performs on a good save is a
 *     replace onto the current route: it commits the history entry a race
 *     would, and moves nothing.
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
   * Is the quit sheet up? (§8.8, decision 54.)
   *
   * It is the storm's pause as well as its question, and the two are one flag
   * because they are one moment: a wave that went on falling behind the sheet
   * would break a child's shield while they read "it won't be saved", and a
   * gun still listening would fire `Space` and `Enter` at the letters instead
   * of at the two buttons in front of them. `useStormClock` takes it as
   * `paused` and stops the loop, which costs the run nothing — wave time is
   * measured between frames, and there are none.
   *
   * **Quitting saves nothing, and there is no code here that makes that true.**
   * The run is written by the effect below, which fires on an `ending` the
   * reducer stamps; a wave abandoned halfway has none, so leaving is a
   * navigation and the route unmounts with the run still only in memory. That
   * is worth stating because it is the kind of guarantee somebody later adds a
   * "save the partial run" line against without noticing it was a promise.
   */
  const [quitting, setQuitting] = useState(false);

  /**
   * Has the child started this wave? (§8.13, decision 71.)
   *
   * A storm does not begin on mount. It hangs at time zero, with an empty sky
   * and a panel in it, until a key says go — the reason being that this is the
   * one game on the site entered with the hands in the wrong place: a tile is
   * clicked with a mouse, and what the first letter then asks for is eight
   * fingers on the home row (`StormReady`). The 3·2·1 every race opens with
   * cannot serve for that, because three seconds is a guess at something only
   * the child knows.
   *
   * False on every attempt, and a retry is a new component (`StormRun`), so
   * the beat is offered again after a loss — which is exactly when a child is
   * most likely to have taken a hand off the keys.
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
   * whole life (`StormState.wave`), and the config is its length and its
   * lesson, both of which are decided before the first letter falls. Which is
   * safe only because a different lesson is a different mount — see the key in
   * `StormRun`, without which this initialiser would keep the first storm a
   * child opened for as long as they stayed on the route.
   */
  const [wave] = useState(() => stormWave(lesson));
  const config = useMemo(() => stormConfig(lesson.id, wave), [lesson.id, wave]);
  const { state, skyRef } = useStormClock(wave, {
    paused: quitting,
    started,
    // The first press is spent starting the wave rather than shot at it — see
    // `started`, and the gun's own note about why it is taken there.
    onStart: () => setStarted(true),
    // The keyboard's way to the same sheet the button opens. It is taken
    // inside the gun's own listener because every other key while the run is
    // live is a shot, and a way out that cost ten points would be a trap
    // (`QUIT_KEY`).
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
    // frame this render is of, because `useStormClock` publishes an ending
    // and the effect below fires on it.
    readTally: () => stormTally(state),
    saveSession,
    finish,
    notify,
    navigate,
    resultsPath: `/p/${profile.id}/storm/${lesson.id}`,
    // Nothing to disarm. The gun dies with the run inside `useStormClock` and
    // the field is frozen where the clock stopped, so there is no phase a
    // saving storm is in that it is not in already.
    onSaving: () => {},
    // And nothing to play. A storm can end by being lost, so the sound of an
    // ending is decided off the ending itself, on the frame the reducer
    // stamped it — `sfx.finish` for a wave cleared, `sfx.breach` for a shield
    // that failed (`stormSounds.ts`). The race's default would congratulate a
    // child for dying.
    fanfare: () => {},
  });

  /**
   * Save the run, once, on the frame it ends.
   *
   * Through a ref for the reason `TypingTrack` uses one: `complete` is a fresh
   * closure on every render, so naming it as a dependency would re-run this on
   * every re-render — and the ending screen re-renders whenever the hub's
   * sessions change, which the save itself does. The dependency is
   * `state.ending`, which the reducer replaces exactly once per run and then
   * leaves alone, so this fires on the ending frame and on no other.
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

  // The same screen a race shows, and for the same reason: the run is over,
  // the answers are still in memory, and nothing is lost until the player
  // leaves. It stands in for the whole field rather than beside it, because a
  // storm that could not be written down is not a storm to go on looking at.
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
        // the stones out of the sky: nothing is shown of the storm before the
        // storm starts (`StormField`).
        ready={started ? undefined : <StormReady />}
        // Drawn where the board was, and only once the run is over — which is
        // `StormField`'s call to make, off the same `ending` the gun dies on.
        over={
          <StormOver
            state={state}
            mode={typingMode(lesson.id)}
            profileId={profile.id}
            onRetry={onRetry}
          />
        }
      />

      {/* The race's sheet and not a second one, because it is the same
          question with a different noun: the storm is paused behind it, the
          run is not saved either way, and "it won't be saved and no XP is
          earned" is the one thing being weighed. Quitting goes back to the
          ladder, which is where the tile that will send a child here lives. */}
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
