import { useCallback, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { buildDeck, configKey, deckSpec, modeOf } from "@/engine/decks";
import { levelCredit, nextChar } from "@/engine/decks/typing";
import { cardXp } from "@/engine/progress";
import {
  WRONG_ANSWER_PENALTY_MS,
  bestRun,
  cumulativeSplits,
  sessionsFor,
} from "@/engine/records";
import { lessonById } from "@/engine/typing/lessons";
import {
  Hud,
  Lane,
  QuitSheet,
  SaveFailed,
  useCountdown,
  useGhostGap,
  useRaceClock,
  useRaceFinish,
} from "@/games/race";
import { sfx } from "@/services/sound";
import { LessonBars } from "./LessonBars";
import { Passage } from "./Passage";
import { TypeField } from "./TypeField";
import { keyboardFor } from "./keyboard/lessonKeyboard";
import { LiveKeyboard } from "./keyboard/LiveKeyboard";
import type {
  CardResult,
  Profile,
  Session,
  TypingConfig,
} from "@/engine/types";

/**
 * The typing race.
 *
 * Structurally the flash-card loop with the pauses taken out. A word is a
 * card, space commits it, and the run is scored and saved by exactly the same
 * machinery — which is what makes a rival's pace visible word by word instead
 * of as a WPM at the end.
 *
 * The two real differences, and both are deliberate:
 *
 * - **No feedback pause.** A card race holds the screen for a second and a
 *   half on a wrong answer so it can be read. Doing that here would break the
 *   one thing typing practice is for, which is not stopping. A wrong word goes
 *   red in the passage behind you and the next word is already live.
 * - **Space is the whole interface.** No Enter, no submit button. Backspace
 *   works inside the current word and nowhere else, because a typing test that
 *   lets you walk back through a finished passage isn't measuring anything.
 *
 * ── And the same loop with the race taken out ────────────────────────────────
 * A run from the ladder is a lesson, and a lesson is not a race
 * (docs/typing.md §7). It is this component with four things removed and one
 * added, all of them off `config.lessonId` and none of them a second loop:
 * no ghost, no lane, no wrong-answer penalty, no starting gun in the copy —
 * and the three pass bars filling live where the rival's gap would be.
 *
 * One component rather than two because of what is NOT different: space still
 * commits a word and a word is still a `Card`. Keeping that is what makes the
 * record book, the splits, the trouble list, XP and the drill builder work on
 * lessons for free, and it is the single highest-leverage thing here not to
 * change. Free play — the five levels, their ghosts and their personal bests —
 * runs through these same lines and is untouched by any of it.
 */
export default function TypingTrack() {
  const { profileId } = useParams();
  const { sessions, saveSession, notify } = useHub();
  const profile = usePlayer(profileId);
  const { pending, outcome, finish } = useRace();
  const navigate = useNavigate();

  if (!profile) return <Navigate to="/" replace />;
  // Finishing clears `pending` and sets `outcome` in one update; without this
  // the guard below would fire in the single render between them and send the
  // player back to setup having never seen their score.
  if (outcome) return <Navigate to={`/p/${profile.id}/results`} replace />;
  if (!pending || pending.profileId !== profile.id) {
    return <Navigate to={`/p/${profile.id}`} replace />;
  }
  const { config } = pending;
  if (config.kind !== "typing") {
    return <Navigate to={`/p/${profile.id}`} replace />;
  }

  return (
    <Track
      profile={profile}
      pending={{ ...pending, config }}
      sessions={sessions}
      saveSession={saveSession}
      notify={notify}
      finish={finish}
      navigate={navigate}
    />
  );
}

type TrackProps = {
  profile: Profile;
  pending: NonNullable<ReturnType<typeof useRace>["pending"]> & {
    config: TypingConfig;
  };
  sessions: Session[];
  saveSession: ReturnType<typeof useHub>["saveSession"];
  notify: ReturnType<typeof useHub>["notify"];
  finish: ReturnType<typeof useRace>["finish"];
  navigate: ReturnType<typeof useNavigate>;
};

function Track({
  profile,
  pending,
  sessions,
  saveSession,
  notify,
  finish,
  navigate,
}: TrackProps) {
  const { config, seed } = pending;
  const spec = deckSpec(modeOf(config));
  const deck = useMemo(() => buildDeck(config, seed), [config, seed]);

  /**
   * The lesson this run is, or `null` when it is free play — the one switch
   * every difference below hangs off (§7).
   *
   * Read from the config rather than from a route or a prop, so that what a run
   * IS travels with the run: `pending` is what the countdown, the save and the
   * results screen all read, and a second source for "is this a lesson" is a
   * second thing to get out of step with `modeOf`, which files the run under
   * this same id. `lessonById` is total — a config with no lesson id, and one
   * naming a lesson this build has re-cut, both land here as free play.
   */
  const lesson = lessonById(config.lessonId);

  /**
   * Nothing is chasing you on a lesson (§7).
   *
   * The ladder never offers a rival, so this is belt and braces — but it is the
   * one value the lane, the gap, the overtake sound and `beatGhost` all hang
   * off, so making it null HERE is what makes "no ghost" true of the whole
   * screen rather than of the four places that would each have to remember.
   */
  const ghost = lesson ? null : pending.ghost;
  const ghostSplits = useMemo(
    () => (ghost ? cumulativeSplits(ghost.session) : null),
    [ghost],
  );

  // Snapshotted at mount so the run we're about to save can't affect it.
  const [history] = useState(() => sessionsFor(sessions, profile.id));
  const [previousBest] = useState(() =>
    bestRun(sessionsFor(sessions, profile.id, configKey(config))),
  );

  const [phase, setPhase] = useState<"countdown" | "racing" | "saving">(
    "countdown",
  );
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [quitting, setQuitting] = useState(false);

  const misses = useRef(0);
  const bestStreak = useRef(0);
  const streak = useRef(0);
  const earnedXp = useRef(0);
  const results = useRef<CardResult[]>([]);
  const completeRef = useRef<() => Promise<void>>(async () => {});

  const total = deck.length;

  const { elapsed, onCard, bank, startCard } = useRaceClock({
    // No per-card clock, so nothing here can time out.
    limitMs: null,
    racing: phase === "racing",
    resolved: false,
    quitting,
    index,
    onTimeout: () => {},
  });
  /**
   * The clock a rival is measured against — and on a lesson, just the clock.
   *
   * **No `WRONG_ANSWER_PENALTY_MS` on a lesson** (§7). Three seconds a miss is
   * a race mechanic: it is there to make a wrong answer cost something when the
   * only thing a race counts is time. A lesson already counts accuracy, on a
   * bar of its own, so charging for it again double-counts it — and it would
   * make the wpm figure a lie, because a "minute" with penalties folded into it
   * is not a minute and the number stops being words per minute of anything.
   * Free play keeps every second of it; free play is a race.
   */
  const raceElapsed =
    elapsed() + (lesson ? 0 : misses.current * WRONG_ANSWER_PENALTY_MS);

  const rival = useGhostGap({ splits: ghostSplits, raceElapsed, index, total });

  const { saveError, complete, retry, hasFinished } = useRaceFinish({
    profile,
    config,
    seed,
    ghost,
    history,
    previousBest,
    readTally: () => ({
      cards: results.current,
      cardXp: earnedXp.current,
      bestStreak: bestStreak.current,
      maxDeficitMs: rival.maxDeficitMs(),
    }),
    saveSession,
    finish,
    notify,
    navigate,
    resultsPath: `/p/${profile.id}/results`,
    onSaving: () => setPhase("saving"),
  });
  completeRef.current = complete;

  const countdown = useCountdown({
    active: phase === "countdown",
    onGo: useCallback(() => {
      startCard();
      setPhase("racing");
    }, [startCard]),
  });

  /**
   * Commit the word in the buffer and move on. Called on space, and once more
   * when the passage's last word is committed with Enter — a passage doesn't
   * end with a space.
   */
  const commit = useCallback(
    (typed: string) => {
      if (hasFinished()) return;
      const card = deck[results.current.length];
      if (!card) return;
      const ms = Math.round(onCard());
      const ok = spec.normalise(typed) === spec.normalise(card.answer);
      bank(ms);
      results.current.push({
        prompt: card.prompt,
        answer: card.answer,
        given: typed,
        ok,
        ms,
        factId: card.factId,
      });

      if (ok) {
        streak.current += 1;
        bestStreak.current = Math.max(bestStreak.current, streak.current);
        earnedXp.current += cardXp(ms, streak.current);
        // Only every fifth, and only once a run is going. A chime per word at
        // sixty words a minute is a fire alarm.
        if (streak.current % 5 === 0) sfx.correct(streak.current);
      } else {
        streak.current = 0;
        misses.current += 1;
        sfx.wrong();
      }

      setEntry("");
      if (results.current.length >= total) {
        void completeRef.current();
      } else {
        setIndex((i) => i + 1);
        startCard();
      }
    },
    [deck, spec, onCard, bank, startCard, total, hasFinished],
  );

  /**
   * The character the passage is waiting on — the whole input to the board.
   *
   * WHICH character that is, space bar included once a word is fully typed, is
   * `nextChar`'s to say. What is decided here is when the passage is waiting on
   * nothing at all: `null` during the 3·2·1, while the quit sheet is up, and
   * once the last word is in and the run is saving. That comes off `live`, the
   * same flag `TypeField` is disabled on rather than a second reading of the
   * same two pieces of state, because the two have to agree — a key pressed at
   * a disabled field that the board marked wrong would be blaming a child for
   * a keystroke the game had already thrown away.
   */
  const live = phase === "racing" && !quitting;
  const next = live ? nextChar(deck[index]?.answer ?? "", entry) : null;

  /**
   * How much of the board is on screen — §4.2's one line, resolved in the one
   * place that resolves it (`keyboardFor`).
   *
   * Three inputs and the same three the brief showed before the run started: a
   * locked lesson wins outright, then what the child chose in the brief
   * (`config.keyboard`, travelling with the run exactly as its words do), then
   * the lesson's own suggestion, the player's setting and `guide`. Free play
   * has no lesson and makes no choice, so it lands on the profile's setting and
   * is untouched by any of it.
   *
   * Reading the choice off the config rather than off a prop is what makes it
   * survive the navigation: `pending` is what the countdown, the save and the
   * results screen all read, and a mode that lived anywhere else would be gone
   * by the time this component mounted.
   */
  const board = keyboardFor(lesson, profile.keyboard, config.keyboard);

  if (saveError) {
    return (
      <SaveFailed
        message={saveError}
        onRetry={retry}
        onDiscard={() => navigate(`/p/${profile.id}`)}
      />
    );
  }

  const answered = results.current.length;

  return (
    <main
      className="race typing"
      style={{ "--tint": profile.color } as React.CSSProperties}
    >
      {phase === "countdown" && (
        <div className="countdown" aria-live="assertive">
          <span key={countdown} className="countdown__num u-display">
            {countdown === 0 ? "GO" : countdown}
          </span>
          {/* The 3·2·1 stays on a lesson, because it is the moment the hands go
              on the home row and that is worth keeping for its own sake — but
              it is not a starting gun there, so it doesn't talk like one
              (§7). */}
          {lesson && <p className="countdown__note">Fingers on home row</p>}
        </div>
      )}

      <Hud
        elapsedMs={elapsed()}
        misses={misses.current}
        answered={answered}
        total={total}
        onQuit={() => setQuitting(true)}
        penalty={!lesson}
      />

      {/* The lane is the race; the bars are the lesson. They stand in the same
          place because they answer the same question — how is this going —
          and a lesson answers it with the criteria rather than with a rival
          (§7). */}
      {lesson ? (
        <LessonBars
          lesson={lesson}
          config={config}
          cards={results.current}
          elapsedMs={elapsed()}
        />
      ) : (
        <Lane
          profile={profile}
          ghost={ghost}
          mePos={answered / total}
          ghostPos={rival.position}
          gap={rival.gap}
          note="Space moves you on"
        />
      )}

      <Passage
        deck={deck}
        results={results.current}
        entry={entry}
        credit={levelCredit(config.levelId)}
      />

      <TypeField
        value={entry}
        index={index}
        disabled={!live}
        onChange={setEntry}
        onCommit={commit}
      />

      {/* Under the line being typed on, and after it in the DOM as well as on
          screen — the board is a map of the keyboard, so it reads last, and
          `TypeField` keeps the tab order's first and only stop. Rendered
          nothing at all on "off": see `LiveKeyboard`. */}
      {board !== "off" && <LiveKeyboard mode={board} next={next} />}

      {quitting && (
        <QuitSheet
          onQuit={() => navigate(`/p/${profile.id}`)}
          onKeepRacing={() => setQuitting(false)}
        />
      )}
    </main>
  );
}
