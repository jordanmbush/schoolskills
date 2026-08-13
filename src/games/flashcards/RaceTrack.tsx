import { useCallback, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { buildDeck, configKey, deckSpec, modeOf } from "@/engine/decks";
import {
  WRONG_ANSWER_PENALTY_MS,
  bestRun,
  cumulativeSplits,
  sessionsFor,
} from "@/engine/records";
import type { CardConfig, CardResult, Profile, Session } from "@/engine/types";
import { AnswerPad } from "./race/AnswerPad";
import { WordPad } from "./race/WordPad";
import { CardFace } from "./race/CardFace";
import { useAnswerEntry } from "./race/useAnswerEntry";
import { useCardSubmit } from "./race/useCardSubmit";
import { useCardVoice } from "./race/useCardVoice";
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
import { useRaceKeyboard } from "./race/useRaceKeyboard";
import type { Feedback } from "@/games/race";

export default function RaceTrack() {
  const { profileId } = useParams();
  const { sessions, saveSession, notify } = useHub();
  const profile = usePlayer(profileId);
  const { pending, outcome, finish } = useRace();
  const navigate = useNavigate();

  if (!profile) return <Navigate to="/" replace />;
  // Finishing a race clears `pending` and sets `outcome` in one update, and the
  // imperative navigate to /results is batched with it. So there is exactly one
  // render where we're still on this route with no pending race — and without
  // this line the guard below fires in that gap, replacing the navigation to
  // results with one back to setup. The player finishes a race, their run saves
  // correctly, and they land on the setup screen having never seen their score.
  if (outcome) {
    return <Navigate to={`/p/${profile.id}/race/results`} replace />;
  }
  // A refresh mid-race clears the pending setup; send them back to configure.
  // The typing check can't fire — the two games are separate islands with
  // separate providers — but it's what narrows `config` to a card deck, and
  // it would be the right behaviour if they ever shared one.
  if (!pending || pending.profileId !== profile.id) {
    return <Navigate to={`/p/${profile.id}/race`} replace />;
  }
  const { config } = pending;
  if (config.kind === "typing") {
    return <Navigate to={`/p/${profile.id}/race`} replace />;
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
    config: CardConfig;
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
  /** Fixed for the whole run — a mid-race change isn't a thing. */
  const limitMs = config.timeLimitMs ?? null;
  /** Owns the marking rule; see `DeckSpec.normalise`. Constant for the race. */
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
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [streak, setStreak] = useState(0);
  const [quitting, setQuitting] = useState(false);

  /**
   * The running tally, kept here rather than inside `useCardSubmit` because
   * `useRaceFinish` is built first and has to be able to read it — the two
   * halves of the loop meet at these four refs.
   */
  const misses = useRef(0);
  const bestStreak = useRef(0);
  const earnedXp = useRef(0);
  const results = useRef<CardResult[]>([]);
  const completeRef = useRef<() => Promise<void>>(async () => {});
  /**
   * Breaks a definition cycle: the clock needs something to call when a card
   * times out, and `submit` needs the clock to bank the time. The ref lets the
   * clock be created first and still reach the real handler.
   */
  const submitRef = useRef<(value: string | null) => void>(() => {});

  const card = deck[index];
  const total = deck.length;

  const {
    entry,
    entryRef,
    set: setEntry,
    push,
    drop,
    clear,
  } = useAnswerEntry();
  const { audible, replay } = useCardVoice({
    card,
    racing: phase === "racing",
  });

  const { fuseRef, elapsed, onCard, secondsLeft, bank, spendFuse, startCard } =
    useRaceClock({
      limitMs,
      racing: phase === "racing",
      resolved: feedback !== null,
      quitting,
      index,
      onTimeout: () => submitRef.current(null),
    });
  const raceElapsed = elapsed() + misses.current * WRONG_ANSWER_PENALTY_MS;

  const rival = useGhostGap({
    splits: ghostSplits,
    raceElapsed,
    index,
    total,
  });

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
    resultsPath: `/p/${profile.id}/race/results`,
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

  /* ── Answering ─────────────────────────────────────────────────────── */

  const { submit } = useCardSubmit({
    spec,
    card,
    phase,
    feedback,
    streak,
    total,
    limitMs,
    tally: { results, misses, bestStreak, earnedXp },
    bank,
    spendFuse,
    onCard,
    startCard,
    hasFinished,
    onLastCard: useCallback(() => void completeRef.current(), []),
    setStreak,
    setFeedback,
    setIndex,
    clearEntry: clear,
  });
  submitRef.current = submit;

  /** A word being typed into a real field, rather than tapped or keypadded. */
  const typingWord = Boolean(card.speak) && config.inputMode === "type";

  useRaceKeyboard({
    // The field owns the keyboard when one is on screen. Leaving the
    // window-level listener bound as well would swallow Enter and re-handle
    // every letter — and its length-based auto-submit would fire the moment a
    // word hit the right number of letters, before it could be checked.
    active: phase === "racing" && feedback === null && !typingWord,
    inputMode: config.inputMode,
    choices: card.choices,
    answerLength: card.answer.length,
    entry,
    entryRef,
    submit,
    pushDigit: push,
    dropDigit: drop,
  });

  /* ── Render ────────────────────────────────────────────────────────── */

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
  const settled = feedback !== null || phase !== "racing";

  return (
    <main
      className="race"
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
        note={
          limitMs === null
            ? "Racing the clock"
            : `${limitMs / 1000}s a card — beat every one`
        }
      />

      <CardFace
        card={card}
        index={index}
        feedback={feedback}
        entry={entry}
        inputMode={config.inputMode}
        limitMs={limitMs}
        secondsLeft={secondsLeft()}
        streak={streak}
        fuseRef={fuseRef}
        racing={phase === "racing"}
        audible={audible}
        onSpeak={replay}
      />

      {typingWord ? (
        <WordPad
          value={entry}
          index={index}
          disabled={settled}
          onChange={setEntry}
          onSubmit={() =>
            entryRef.current.trim() !== "" && submit(entryRef.current)
          }
        />
      ) : (
        <AnswerPad
          mode={config.inputMode}
          choices={card.choices}
          disabled={settled}
          onDigit={push}
          onBack={drop}
          onEnter={() => entryRef.current !== "" && submit(entryRef.current)}
          onChoose={submit}
        />
      )}

      {quitting && (
        <QuitSheet
          onQuit={() => navigate(`/p/${profile.id}`)}
          onKeepRacing={() => setQuitting(false)}
        />
      )}
    </main>
  );
}
