import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { Avatar, Confetti } from "@/components/ui/kit";
import TopBar from "@/components/TopBar";
import {
  WRONG_ANSWER_PENALTY_MS,
  cumulativeSplits,
  factsToDrill,
  raceTimeMs,
  timeLimitOf,
  timedOutCount,
} from "@/engine/records";
import { BADGES_BY_ID } from "@/engine/progress";
import { buildDrill, describeConfig } from "@/engine/decks/flashcards";
import { clock, delta as formatDelta, percent, plural } from "@/engine/format";
import { randomSeed } from "@/engine/random";
import { sfx } from "@/services/sound";

export default function RaceResults() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);
  const { outcome, start, clear } = useRace();
  const navigate = useNavigate();
  const [burst, setBurst] = useState(0);

  const celebrate =
    outcome !== null &&
    (outcome.personalRecord ||
      outcome.session.beatGhost === true ||
      outcome.session.incorrect === 0);

  useEffect(() => {
    if (!outcome) return;
    if (celebrate) {
      setBurst((b) => b + 1);
      sfx.record();
    }
    if (outcome.levelledUpTo) window.setTimeout(() => sfx.levelUp(), 900);
    if (outcome.newBadges.length > 0)
      window.setTimeout(() => sfx.badge(), 1400);
  }, [outcome, celebrate]);

  if (!profile) return <Navigate to="/" replace />;
  if (!outcome) return <Navigate to={`/p/${profile.id}/race`} replace />;

  const {
    session,
    ghost,
    personalRecord,
    previousBest,
    newBadges,
    bonuses,
    levelledUpTo,
  } = outcome;
  const previousBestMs = previousBest ? raceTimeMs(previousBest) : null;
  const myTime = raceTimeMs(session);
  const accuracy =
    session.correct / Math.max(1, session.correct + session.incorrect);
  const mySplits = cumulativeSplits(session);
  const ghostSplits = ghost ? cumulativeSplits(ghost.session) : null;
  const limitMs = timeLimitOf(session);
  const ranOut = timedOutCount(session);
  const missedFacts = factsToDrill(
    session.cards.filter((card) => !card.ok),
    session.mode,
  );

  const headline = personalRecord
    ? "New personal best"
    : session.beatGhost === true
      ? `You beat ${ghost?.isSelf ? "your ghost" : ghost?.profile.name}`
      : session.beatGhost === false
        ? `${ghost?.isSelf ? "Your ghost" : ghost?.profile.name} held on`
        : session.incorrect === 0
          ? limitMs
            ? "Beat the clock every time"
            : "Clean run"
          : "Race complete";

  function raceAgain(withGhost: typeof ghost) {
    sfx.whoosh();
    start({
      profileId: profile!.id,
      config: session.config,
      seed: withGhost ? withGhost.session.seed : randomSeed(),
      ghost: withGhost,
    });
    navigate(`/p/${profile!.id}/race/go`, { replace: true });
  }

  /**
   * Turns the cards this run got away with into a short deck of just those
   * facts, under the same clock — the whole point being to beat it this time.
   */
  function practise() {
    sfx.whoosh();
    start({
      profileId: profile!.id,
      config: buildDrill(missedFacts, {
        operation: session.mode,
        inputMode: session.config.inputMode,
        timeLimitMs: limitMs,
      }),
      seed: randomSeed(),
      ghost: null,
    });
    navigate(`/p/${profile!.id}/race/go`, { replace: true });
  }

  const selfGhost = { session, profile: outcome.profileAfter, isSelf: true };
  const practiceFirst = missedFacts.length > 0;

  return (
    <main className="results">
      <Confetti burst={burst} />
      <TopBar
        profile={outcome.profileAfter}
        back={{ to: `/p/${profile.id}`, label: "Hub" }}
      />

      <section
        className={`verdict anim-rise${personalRecord ? " verdict--record" : ""}`}
      >
        <p className="u-eyebrow">{describeConfig(session.config)}</p>
        <h1 className="u-display verdict__title">{headline}</h1>
        <p className="verdict__time u-mono">{clock(myTime)}</p>
        <p className="verdict__breakdown u-mono">
          {clock(session.durationMs)} on the cards
          {session.incorrect > 0 && (
            <>
              {" "}
              + {(session.incorrect * WRONG_ANSWER_PENALTY_MS) / 1000}s penalty
              <span className="verdict__pen">({session.incorrect} wrong)</span>
            </>
          )}
        </p>
        {limitMs !== null && (
          <p className="verdict__breakdown u-mono">
            {session.correct} of {session.cards.length} beaten inside{" "}
            {limitMs / 1000}s
            {ranOut > 0 && (
              <span className="verdict__pen verdict__pen--late">
                · {plural(ranOut, "card")} ran out
              </span>
            )}
          </p>
        )}
        {previousBest !== null && limitMs !== null && (
          <p
            className={`verdict__vs u-mono${session.correct >= previousBest.correct ? " is-ahead" : " is-behind"}`}
          >
            {formatDelta(myTime - previousBestMs!)} · your best at this clock
            beat {previousBest.correct}
          </p>
        )}
        {previousBestMs !== null && limitMs === null && (
          <p
            className={`verdict__vs u-mono${myTime < previousBestMs ? " is-ahead" : " is-behind"}`}
          >
            {formatDelta(myTime - previousBestMs)} vs your best of{" "}
            {clock(previousBestMs)}
          </p>
        )}
        {previousBestMs === null && (
          <p className="verdict__vs u-mono">
            First run at these settings —{" "}
            {limitMs === null
              ? "that's the time to beat."
              : "that's the score to beat."}
          </p>
        )}
      </section>

      <section className="scoreline panel anim-rise">
        <div className="stat">
          <span className="stat__value">{percent(accuracy)}</span>
          <span className="stat__label">Correct</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {session.correct}
            <span className="scoreline__of">
              /{session.correct + session.incorrect}
            </span>
          </span>
          <span className="stat__label">Cards</span>
        </div>
        <div className="stat">
          <span className="stat__value">{session.bestStreak}</span>
          <span className="stat__label">Best streak</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {(
              session.durationMs /
              Math.max(1, session.cards.length) /
              1000
            ).toFixed(2)}
            s
          </span>
          <span className="stat__label">Per card</span>
        </div>
        <div className="stat stat--xp">
          <span className="stat__value">
            +{session.xpEarned.toLocaleString()}
          </span>
          <span className="stat__label">XP earned</span>
        </div>
      </section>

      {(bonuses.length > 0 || levelledUpTo || newBadges.length > 0) && (
        <section className="rewards anim-rise">
          {levelledUpTo && (
            <div className="reward reward--level">
              <span className="reward__icon" aria-hidden="true">
                🌟
              </span>
              <span>
                <strong>Level {levelledUpTo}</strong>
                <span className="reward__sub">You levelled up</span>
              </span>
            </div>
          )}
          {bonuses.map((bonus) => (
            <div key={bonus.label} className="reward">
              <span className="reward__icon" aria-hidden="true">
                ⚡
              </span>
              <span>
                <strong>{bonus.label}</strong>
                <span className="reward__sub">+{bonus.xp} XP</span>
              </span>
            </div>
          ))}
          {newBadges.map((id) => {
            const badge = BADGES_BY_ID.get(id);
            if (!badge) return null;
            return (
              <div key={id} className="reward reward--badge">
                <span className="reward__icon" aria-hidden="true">
                  {badge.icon}
                </span>
                <span>
                  <strong>{badge.name}</strong>
                  <span className="reward__sub">{badge.how}</span>
                </span>
              </div>
            );
          })}
        </section>
      )}

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Splits</h2>
          {ghost && (
            <span className="chip">
              <Avatar profile={ghost.profile} size="1.2rem" />
              {ghost.isSelf ? "Your best run" : ghost.profile.name}
            </span>
          )}
        </div>
        <div className="splits__scroll">
          <table className="splits">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Card</th>
                <th scope="col">You</th>
                {ghostSplits && <th scope="col">Rival</th>}
                {ghostSplits && <th scope="col">Gap</th>}
              </tr>
            </thead>
            <tbody>
              {session.cards.map((card, i) => {
                const gap =
                  ghostSplits && ghostSplits[i] !== undefined
                    ? mySplits[i] - ghostSplits[i]
                    : null;
                return (
                  <tr
                    key={i}
                    className={
                      card.ok
                        ? undefined
                        : card.timedOut
                          ? "splits__row--late"
                          : "splits__row--miss"
                    }
                  >
                    <td className="u-mono splits__n">{i + 1}</td>
                    <td className="splits__card">
                      {card.prompt} = {card.answer}
                      {!card.ok && (
                        <span
                          className={`splits__given${card.timedOut ? " is-late" : ""}`}
                        >
                          {card.timedOut
                            ? "ran out of time"
                            : `you said ${card.given}`}
                        </span>
                      )}
                    </td>
                    <td className="u-mono">{(card.ms / 1000).toFixed(2)}</td>
                    {ghostSplits && (
                      <td className="u-mono splits__rival">
                        {ghost!.session.cards[i]
                          ? (ghost!.session.cards[i].ms / 1000).toFixed(2)
                          : "—"}
                      </td>
                    )}
                    {ghostSplits && (
                      <td
                        className={`u-mono splits__gap${gap !== null && gap < 0 ? " is-ahead" : " is-behind"}`}
                      >
                        {gap === null ? "—" : formatDelta(gap)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="results__actions">
        {practiceFirst && (
          <button className="btn btn--go" onClick={practise}>
            Practise {plural(missedFacts.length, "fact")}
          </button>
        )}
        <button
          className={`btn ${practiceFirst ? "btn--accent" : "btn--go"}`}
          onClick={() => raceAgain(ghost)}
        >
          Race again
        </button>
        {!ghost && (
          <button
            className="btn btn--accent"
            onClick={() => raceAgain(selfGhost)}
          >
            Race this ghost
          </button>
        )}
        <button
          className="btn btn--ghost"
          onClick={() => {
            clear();
            navigate(`/p/${profile.id}/race`);
          }}
        >
          Change settings
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => {
            clear();
            navigate(`/p/${profile.id}`);
          }}
        >
          Back to hub
        </button>
      </div>
    </main>
  );
}
