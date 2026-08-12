import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { buildDeck, configKey } from "@/engine/decks/flashcards";
import {
  WRONG_ANSWER_PENALTY_MS,
  bestRun,
  compareRuns,
  cumulativeSplits,
  sessionsFor,
} from "@/engine/records";
import {
  cardXp,
  comboMultiplier,
  evaluateBadges,
  finishBonuses,
  levelFromXp,
} from "@/engine/progress";
import { clock, delta as formatDelta } from "@/engine/format";
import { sfx } from "@/services/sound";
import type { CardResult, Ghost, Profile, Session } from "@/engine/types";
import { Scrim } from "@/components/ui/kit";

const RIGHT_PAUSE_MS = 320;
const WRONG_PAUSE_MS = 1500;
/** Long enough to actually read an answer you never got to attempt. */
const TIMEOUT_PAUSE_MS = 1900;
/** The card clock ticks audibly over its last three seconds. */
const TICK_FROM_MS = 3000;

type Feedback = {
  kind: "right" | "wrong" | "timeout";
  given: number | null;
} | null;

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
  const [countdown, setCountdown] = useState(3);
  const [index, setIndex] = useState(0);
  const [entry, setEntry] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [streak, setStreak] = useState(0);
  const [, setTick] = useState(0);
  const [quitting, setQuitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const cardStart = useRef(0);
  const banked = useRef(0);
  const misses = useRef(0);
  const bestStreak = useRef(0);
  const earnedXp = useRef(0);
  const results = useRef<CardResult[]>([]);
  const maxDeficit = useRef(0);
  const wasBehind = useRef(false);
  const advanceTimer = useRef<number | null>(null);
  const finishing = useRef(false);
  const entryRef = useRef("");
  const completeRef = useRef<() => Promise<void>>(async () => {});
  const fuse = useRef<HTMLDivElement | null>(null);
  /** Stops the animation loop from re-inflating the fuse after a card lands. */
  const fuseHeld = useRef(false);
  /** When the quit sheet went up, or 0 while play is running. */
  const pausedAt = useRef(0);

  const card = deck[index];
  const total = deck.length;

  const elapsed = () => {
    if (phase !== "racing" || feedback !== null) return banked.current;
    // Reading the pause mark instead of the wall clock holds the time still
    // while the quit sheet is up.
    const now = pausedAt.current || performance.now();
    return banked.current + (now - cardStart.current);
  };
  const raceElapsed = elapsed() + misses.current * WRONG_ANSWER_PENALTY_MS;

  /* ── Countdown ─────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "countdown") return;
    sfx.countdown(countdown);
    const timer = window.setTimeout(
      () => {
        if (countdown === 0) {
          cardStart.current = performance.now();
          setPhase("racing");
        } else {
          setCountdown((n) => n - 1);
        }
      },
      countdown === 0 ? 420 : 680,
    );
    return () => window.clearTimeout(timer);
  }, [phase, countdown]);

  /* ── Clock ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "racing") return;
    let frame = 0;
    let last = 0;
    const loop = (now: number) => {
      if (now - last > 60) {
        last = now;
        setTick((t) => t + 1);
      }
      // The fuse is written straight to the DOM rather than rendered: it has
      // to move at full frame rate, and it has to keep draining for players
      // who've asked for reduced motion — so it can't be a CSS animation.
      if (
        limitMs !== null &&
        fuse.current &&
        !fuseHeld.current &&
        !pausedAt.current
      ) {
        const left = 1 - (now - cardStart.current) / limitMs;
        fuse.current.style.setProperty(
          "--left",
          String(Math.min(1, Math.max(0, left))),
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [phase, limitMs]);

  useEffect(
    () => () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    },
    [],
  );

  /* ── Ghost position ────────────────────────────────────────────────── */
  const ghostCardsDone = ghostSplits
    ? ghostSplits.filter((t) => t <= raceElapsed).length
    : 0;
  const checkpoint = ghostSplits
    ? ghostSplits[Math.min(index, ghostSplits.length - 1)]
    : null;
  const gap = checkpoint === null ? null : raceElapsed - checkpoint;

  useEffect(() => {
    if (gap === null) return;
    maxDeficit.current = Math.max(maxDeficit.current, gap);
    const behind = gap > 0;
    if (wasBehind.current && !behind) sfx.overtake();
    wasBehind.current = behind;
  }, [gap]);

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
  const submit = useCallback((value: number | null) => {
    const { phase, feedback, card, streak, total, limitMs } = live.current;
    if (phase !== "racing" || feedback !== null || finishing.current) return;
    const lateOut = value === null;
    // A timeout banks exactly the limit, so the stopwatch, the fuse and the
    // saved split all agree even if the timer fires a frame or two late.
    // Whole milliseconds keep the saved file readable and the totals exact.
    const ms = lateOut
      ? limitMs!
      : Math.round(performance.now() - cardStart.current);
    const ok = !lateOut && value === card.answer;
    banked.current += ms;
    fuseHeld.current = true;
    if (lateOut) fuse.current?.style.setProperty("--left", "0");
    results.current.push({
      prompt: card.prompt,
      answer: card.answer,
      given: value,
      ok,
      ms,
      facts: card.facts,
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
          cardStart.current = performance.now();
          fuseHeld.current = false;
        }
      },
      ok ? RIGHT_PAUSE_MS : lateOut ? TIMEOUT_PAUSE_MS : WRONG_PAUSE_MS,
    );
    // Deliberately empty: every value above comes from a ref.
  }, []);

  const timeUp = useCallback(() => submit(null), [submit]);

  /**
   * Putting the quit sheet up pauses the card. Resuming shifts the card's
   * start forward by however long the sheet was open, so a pause neither
   * costs time nor buys thinking time. Declared before the timer below so the
   * shift lands before that effect reschedules.
   */
  useEffect(() => {
    if (phase !== "racing") return;
    if (quitting) {
      pausedAt.current = performance.now();
    } else if (pausedAt.current) {
      cardStart.current += performance.now() - pausedAt.current;
      pausedAt.current = 0;
    }
  }, [quitting, phase]);

  /**
   * The per-card clock, plus its last-three-seconds ticks. Scheduled once per
   * card: `timeUp` keeps a stable identity, so the ~16×/second clock re-render
   * can't tear it down and restart it. The delay is measured from when the
   * card actually appeared, so a re-run can never hand out extra time.
   */
  useEffect(() => {
    if (limitMs === null || phase !== "racing" || feedback !== null) return;
    if (quitting) return;
    const left = limitMs - (performance.now() - cardStart.current);
    const timers = [window.setTimeout(timeUp, Math.max(0, left))];
    for (let at = 1000; at <= TICK_FROM_MS; at += 1000) {
      if (left > at)
        timers.push(window.setTimeout(() => sfx.tick(), left - at));
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [limitMs, phase, feedback, index, quitting, timeUp]);

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

  async function complete() {
    if (finishing.current) return;
    finishing.current = true;
    setPhase("saving");
    sfx.finish();
    await save();
  }
  completeRef.current = complete;

  async function save() {
    const cards = results.current;
    const correct = cards.filter((c) => c.ok).length;
    const incorrect = cards.length - correct;
    const durationMs = cards.reduce((sum, c) => sum + c.ms, 0);
    // Timed runs are ranked on cards beaten before time, untimed ones on the
    // clock — `compareRuns` owns that rule so the record book and this screen
    // can never disagree about what "better" means.
    const scored = { durationMs, correct, incorrect, config };

    const personalRecord =
      previousBest !== null && compareRuns(scored, previousBest) < 0;
    const beatGhost = ghost ? compareRuns(scored, ghost.session) < 0 : null;
    const bonuses = finishBonuses({
      perfect: incorrect === 0 && correct > 0,
      personalRecord,
      beatGhost: beatGhost === true,
      cardCount: cards.length,
    });
    const xpEarned =
      earnedXp.current + bonuses.reduce((sum, b) => sum + b.xp, 0);

    const draft = {
      profileId: profile.id,
      game: "flashcards" as const,
      mode: config.operation,
      configKey: configKey(config),
      config,
      seed,
      durationMs,
      correct,
      incorrect,
      bestStreak: bestStreak.current,
      xpEarned,
      ghostSessionId: ghost?.session.id ?? null,
      beatGhost,
      cards,
    };

    const earnedBadges = evaluateBadges({
      session: draft,
      history,
      personalRecord,
      maxDeficitMs: maxDeficit.current,
      xpAfter: profile.xp + xpEarned,
    });
    const newBadges = earnedBadges.filter((id) => !profile.badges.includes(id));

    try {
      const saved = await saveSession({ ...draft, earnedBadges });
      const levelBefore = levelFromXp(profile.xp).level;
      const levelAfter = levelFromXp(saved.profile.xp).level;
      finish({
        session: saved.session,
        profileAfter: saved.profile,
        ghost,
        personalRecord,
        previousBest,
        newBadges,
        bonuses,
        levelledUpTo: levelAfter > levelBefore ? levelAfter : null,
      });
      navigate(`/p/${profile.id}/race/results`, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save this race";
      setSaveError(message);
      notify(message, "bad");
    }
  }

  /* ── Keyboard ──────────────────────────────────────────────────────── */
  useEffect(() => {
    if (phase !== "racing") return;
    function onKey(event: KeyboardEvent) {
      if (feedback !== null) return;
      if (config.inputMode === "choose") {
        const slot = Number(event.key);
        if (slot >= 1 && slot <= 4 && card.choices) {
          event.preventDefault();
          submit(card.choices[slot - 1]);
        }
        return;
      }
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        pushDigit(event.key);
      } else if (event.key === "Backspace") {
        event.preventDefault();
        dropDigit();
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (entryRef.current !== "") submit(Number(entryRef.current));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, feedback, config.inputMode, card, submit, pushDigit, dropDigit]);

  // Auto-submit the moment the entry is as long as the answer — keeps the pace
  // up without making kids hunt for Enter.
  useEffect(() => {
    if (phase !== "racing" || feedback !== null || config.inputMode !== "type")
      return;
    if (entry.length > 0 && entry.length === String(card.answer).length) {
      const value = Number(entry);
      const timer = window.setTimeout(() => submit(value), 90);
      return () => window.clearTimeout(timer);
    }
  }, [entry, phase, feedback, config.inputMode, card.answer, submit]);

  /* ── Render ────────────────────────────────────────────────────────── */

  if (saveError) {
    return (
      <main className="boot">
        <p className="u-eyebrow">Race finished</p>
        <h1 className="u-display boot__title">Couldn&apos;t save this race</h1>
        <p className="boot__msg">{saveError}</p>
        <p className="boot__hint">
          Your answers are still here. Try again once the hub server is back.
        </p>
        <div className="boot__actions">
          <button
            className="btn btn--go"
            onClick={() => {
              setSaveError(null);
              void save();
            }}
          >
            Save again
          </button>
          <button
            className="btn btn--ghost"
            onClick={() => navigate(`/p/${profile.id}`)}
          >
            Discard and go back
          </button>
        </div>
      </main>
    );
  }

  const answered = results.current.length;
  const combo = comboMultiplier(streak);
  const secondsLeft =
    limitMs === null || phase !== "racing" || feedback !== null
      ? null
      : Math.max(
          0,
          Math.ceil((limitMs - (performance.now() - cardStart.current)) / 1000),
        );

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

      <header className="race__hud">
        <button className="race__quit" onClick={() => setQuitting(true)}>
          Quit
        </button>

        <div className="race__clock u-mono">
          <span className="race__clock-time">{clock(elapsed())}</span>
          {misses.current > 0 && (
            <span className="race__penalty">
              +{(misses.current * WRONG_ANSWER_PENALTY_MS) / 1000}s
            </span>
          )}
        </div>

        <div className="race__count u-mono">
          <span className="race__count-now">
            {Math.min(answered + 1, total)}
          </span>
          <span className="race__count-of">/ {total}</span>
        </div>
      </header>

      <Lane
        profile={profile}
        ghost={ghost}
        mePos={answered / total}
        ghostPos={ghostSplits ? Math.min(ghostCardsDone / total, 1) : null}
        gap={gap}
        note={
          limitMs === null
            ? "Racing the clock"
            : `${limitMs / 1000}s a card — beat every one`
        }
      />

      <section className={`card${feedback ? ` card--${feedback.kind}` : ""}`}>
        {limitMs !== null && (
          // Keyed on the card so a new card remounts it with a full bar. The
          // prefix keeps it from colliding with the combo badge's key.
          <div
            key={`fuse-${index}`}
            ref={fuse}
            className={`fuse${secondsLeft !== null && secondsLeft <= 3 ? " is-urgent" : ""}${feedback?.kind === "timeout" ? " is-spent" : ""}`}
          >
            <span className="fuse__track">
              <span className="fuse__fill" />
            </span>
            <span className="fuse__num u-mono" aria-hidden="true">
              {secondsLeft ?? 0}
            </span>
          </div>
        )}
        <p className="card__prompt u-display" aria-live="polite">
          {card.prompt}
        </p>
        <div className="card__answer">
          {feedback?.kind === "timeout" ? (
            <span className="card__truth u-mono">
              <span className="card__late">Out of time</span> {card.answer}
            </span>
          ) : feedback?.kind === "wrong" ? (
            <span className="card__truth u-mono">
              <s>{feedback.given}</s> {card.answer}
            </span>
          ) : config.inputMode === "type" ? (
            <span className={`card__entry u-mono${entry ? "" : " is-empty"}`}>
              {entry || "?"}
            </span>
          ) : (
            <span className="card__entry u-mono is-empty">?</span>
          )}
        </div>
        {streak >= 3 && (
          <span key={streak} className="combo anim-pop">
            🔥 {streak} in a row · ×{combo.toFixed(1)} XP
          </span>
        )}
      </section>

      {config.inputMode === "type" ? (
        <Keypad
          disabled={feedback !== null || phase !== "racing"}
          onDigit={pushDigit}
          onBack={dropDigit}
          onEnter={() =>
            entryRef.current !== "" && submit(Number(entryRef.current))
          }
        />
      ) : (
        <div className="choices">
          {(card.choices ?? []).map((choice, i) => (
            <button
              key={choice}
              className="choices__btn u-mono"
              disabled={feedback !== null || phase !== "racing"}
              onClick={() => submit(choice)}
            >
              <span className="choices__key">{i + 1}</span>
              {choice}
            </button>
          ))}
        </div>
      )}

      {quitting && (
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Quit the race"
        >
          <Scrim onClose={() => setQuitting(false)} label="Keep racing" />
          <div className="sheet__panel panel anim-pop">
            <h2 className="panel__title">Quit this race?</h2>
            <p className="muted">It won&apos;t be saved and no XP is earned.</p>
            <div className="sheet__actions">
              <button
                className="btn btn--danger btn--sm"
                onClick={() => navigate(`/p/${profile.id}`)}
              >
                Quit
              </button>
              <button
                className="btn btn--accent"
                onClick={() => setQuitting(false)}
              >
                Keep racing
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* ── The signature element: a rally split against a ghost ──────────────── */

function Lane({
  profile,
  ghost,
  mePos,
  ghostPos,
  gap,
  note,
}: {
  profile: Profile;
  ghost: Ghost | null;
  mePos: number;
  ghostPos: number | null;
  gap: number | null;
  note: string;
}) {
  const ahead = gap !== null && gap < 0;
  return (
    <div className="lane">
      <div className="lane__track">
        <span className="lane__finish" aria-hidden="true">
          🏁
        </span>
        {ghostPos !== null && ghost && (
          <span
            className="lane__puck lane__puck--ghost"
            style={
              {
                "--p": ghostPos,
                "--tint": ghost.profile.color,
              } as React.CSSProperties
            }
            title={ghost.isSelf ? "Your best run" : ghost.profile.name}
          >
            {ghost.profile.emoji}
          </span>
        )}
        <span
          className="lane__puck lane__puck--me"
          style={
            {
              "--p": mePos,
              "--tint": profile.color,
            } as React.CSSProperties
          }
        >
          {profile.emoji}
        </span>
      </div>

      {gap === null ? (
        <p className="lane__note u-mono">{note}</p>
      ) : (
        <p
          className={`lane__gap u-mono${ahead ? " is-ahead" : " is-behind"}`}
          aria-live="off"
        >
          <span className="lane__gap-num">{formatDelta(gap)}</span>
          <span className="lane__gap-word">{ahead ? "ahead" : "behind"}</span>
        </p>
      )}
    </div>
  );
}

/* ── Keypad ────────────────────────────────────────────────────────────── */

function Keypad({
  disabled,
  onDigit,
  onBack,
  onEnter,
}: {
  disabled: boolean;
  onDigit: (digit: string) => void;
  onBack: () => void;
  onEnter: () => void;
}) {
  return (
    <div className="keypad">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
        <button
          key={digit}
          className="keypad__key u-mono"
          disabled={disabled}
          onClick={() => onDigit(digit)}
        >
          {digit}
        </button>
      ))}
      <button
        className="keypad__key keypad__key--util"
        disabled={disabled}
        onClick={onBack}
        aria-label="Delete"
      >
        ⌫
      </button>
      <button
        className="keypad__key u-mono"
        disabled={disabled}
        onClick={() => onDigit("0")}
      >
        0
      </button>
      <button
        className="keypad__key keypad__key--enter"
        disabled={disabled}
        onClick={onEnter}
        aria-label="Submit"
      >
        ↵
      </button>
    </div>
  );
}
