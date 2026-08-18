import { useCallback, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { buildDeck, configKey, deckSpec, modeOf } from "@/engine/decks";
import { levelCredit } from "@/engine/decks/typing";
import { cardXp } from "@/engine/progress";
import {
  WRONG_ANSWER_PENALTY_MS,
  bestRun,
  cumulativeSplits,
  sessionsFor,
} from "@/engine/records";
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
import { Passage } from "./Passage";
import { TypeField } from "./TypeField";
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
  const { config, seed, ghost } = pending;
  const spec = deckSpec(modeOf(config));
  const deck = useMemo(() => buildDeck(config, seed), [config, seed]);
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
  const raceElapsed = elapsed() + misses.current * WRONG_ANSWER_PENALTY_MS;

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
        </div>
      )}

      <Hud
        elapsedMs={elapsed()}
        misses={misses.current}
        answered={answered}
        total={total}
        onQuit={() => setQuitting(true)}
      />

      <Lane
        profile={profile}
        ghost={ghost}
        mePos={answered / total}
        ghostPos={rival.position}
        gap={rival.gap}
        note="Space moves you on"
      />

      <Passage
        deck={deck}
        results={results.current}
        entry={entry}
        credit={levelCredit(config.levelId)}
      />

      <TypeField
        value={entry}
        index={index}
        disabled={phase !== "racing" || quitting}
        onChange={setEntry}
        onCommit={commit}
      />

      {quitting && (
        <QuitSheet
          onQuit={() => navigate(`/p/${profile.id}`)}
          onKeepRacing={() => setQuitting(false)}
        />
      )}
    </main>
  );
}
