import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { OPERATIONS, buildDeck, configKey } from "@/engine/decks/flashcards";
import {
  WRONG_ANSWER_PENALTY_MS,
  bestRun,
  cumulativeSplits,
  sessionsFor,
} from "@/engine/records";
import { cardXp } from "@/engine/progress";
import { sfx } from "@/services/sound";
import type { CardResult, Profile, Session } from "@/engine/types";
import { AnswerPad } from "./race/AnswerPad";
import { CardFace } from "./race/CardFace";
import { Hud } from "./race/Hud";
import { Lane } from "./race/Lane";
import { QuitSheet } from "./race/QuitSheet";
import { SaveFailed } from "./race/SaveFailed";
import { useCountdown } from "./race/useCountdown";
import { useGhostGap } from "./race/useGhostGap";
import { useRaceClock } from "./race/useRaceClock";
import { useRaceFinish } from "./race/useRaceFinish";
import { useRaceKeyboard } from "./race/useRaceKeyboard";
import type { Feedback } from "./race/types";

const RIGHT_PAUSE_MS = 320;
const WRONG_PAUSE_MS = 1500;
/** Long enough to actually read an answer you never got to attempt. */
const TIMEOUT_PAUSE_MS = 1900;

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
  if (!pending || pending.profileId !== profile.id) {
    return <Navigate to={`/p/${profile.id}/race`} replace />;
  }

  return (
    <Track
      profile={profile}
      pending={pending}
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
  pending: NonNullable<ReturnType<typeof useRace>["pending"]>;
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
  const spec = OPERATIONS[config.operation];
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
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [streak, setStreak] = useState(0);
  const [quitting, setQuitting] = useState(false);

  const misses = useRef(0);
  const bestStreak = useRef(0);
  const earnedXp = useRef(0);
  const results = useRef<CardResult[]>([]);
  const advanceTimer = useRef<number | null>(null);
  const entryRef = useRef("");
  const completeRef = useRef<() => Promise<void>>(async () => {});
  /**
   * Breaks a definition cycle: the clock needs something to call when a card
   * times out, and `submit` needs the clock to bank the time. The ref lets the
   * clock be created first and still reach the real handler.
   */
  const submitRef = useRef<(value: string | null) => void>(() => {});

  const card = deck[index];
  const total = deck.length;

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

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  /* ── Answering ─────────────────────────────────────────────────────── */

  /**
   * The clock re-renders this screen ~16×/second. `submit` therefore has to
   * keep a stable identity — an effect that depends on it would otherwise tear
   * down and restart its timer on every tick and never fire. Everything it
   * needs is read from this ref instead of from the closure.
   */
  const live = useRef({ phase, feedback, card, streak, total, limitMs });
  live.current = { phase, feedback, card, streak, total, limitMs };

  /** `null` means the card's clock ran out before an answer arrived. */
  const submit = useCallback(
    (value: string | null) => {
      const { phase, feedback, card, streak, total, limitMs } = live.current;
      if (phase !== "racing" || feedback !== null || hasFinished()) return;
      const lateOut = value === null;
      // A timeout banks exactly the limit, so the stopwatch, the fuse and the
      // saved split all agree even if the timer fires a frame or two late.
      // Whole milliseconds keep the saved file readable and the totals exact.
      const ms = lateOut ? limitMs! : Math.round(onCard());
      // Both sides through `normalise`, so "07" marks the same as "7" — and
      // so that a deck can forgive more without this line changing.
      const ok =
        !lateOut && spec.normalise(value) === spec.normalise(card.answer);
      bank(ms);
      if (lateOut) spendFuse();
      results.current.push({
        prompt: card.prompt,
        answer: card.answer,
        given: value,
        ok,
        ms,
        factId: card.factId,
        ...(lateOut && { timedOut: true }),
      });

      if (ok) {
        const next = streak + 1;
        setStreak(next);
        bestStreak.current = Math.max(bestStreak.current, next);
        earnedXp.current += cardXp(ms, next);
        sfx.correct(next);
      } else {
        setStreak(0);
        misses.current += 1;
        if (lateOut) sfx.timeout();
        else sfx.wrong();
      }

      setFeedback({
        kind: lateOut ? "timeout" : ok ? "right" : "wrong",
        given: value,
      });
      advanceTimer.current = window.setTimeout(
        () => {
          setFeedback(null);
          setEntry("");
          entryRef.current = "";
          if (results.current.length >= total) {
            void completeRef.current();
          } else {
            setIndex((i) => i + 1);
            startCard();
          }
        },
        ok ? RIGHT_PAUSE_MS : lateOut ? TIMEOUT_PAUSE_MS : WRONG_PAUSE_MS,
      );
      // Every other value above comes from a ref; these are all pinned with
      // empty dependency lists precisely so this callback can stay stable.
    },
    [bank, spendFuse, onCard, startCard, hasFinished, spec],
  );
  submitRef.current = submit;

  // The entry is mirrored into a ref so Enter can read it without the handler
  // having to re-subscribe on every keystroke.
  const pushDigit = useCallback((digit: string) => {
    if (entryRef.current.length >= 4) return;
    entryRef.current += digit;
    setEntry(entryRef.current);
  }, []);

  const dropDigit = useCallback(() => {
    entryRef.current = entryRef.current.slice(0, -1);
    setEntry(entryRef.current);
  }, []);

  useRaceKeyboard({
    active: phase === "racing" && feedback === null,
    inputMode: config.inputMode,
    choices: card.choices,
    answerLength: card.answer.length,
    entry,
    entryRef,
    submit,
    pushDigit,
    dropDigit,
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
      />

      <AnswerPad
        mode={config.inputMode}
        choices={card.choices}
        disabled={settled}
        onDigit={pushDigit}
        onBack={dropDigit}
        onEnter={() => entryRef.current !== "" && submit(entryRef.current)}
        onChoose={submit}
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
