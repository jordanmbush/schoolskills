import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { Button, Confetti } from "@/components/ui/kit";
import TopBar from "@/components/TopBar";
import {
  WRONG_ANSWER_PENALTY_MS,
  cumulativeSplits,
  factsToDrill,
  raceTimeMs,
  timeLimitOf,
  timedOutCount,
} from "@/engine/records";
import { buildDrill, describeConfig, isTyping } from "@/engine/decks";
import { clock, delta as formatDelta, plural } from "@/engine/format";
import { randomSeed } from "@/engine/random";
import { sfx } from "@/services/sound";
import { Rewards } from "@/games/race";
import { Scoreline } from "./results/Scoreline";
import { SplitsTable } from "./results/SplitsTable";

export default function RaceResults() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);
  const { outcome, pending, start, clear } = useRace();
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
  /**
   * `start()` clears the outcome and sets a pending race in ONE update, and
   * the navigate that follows it is batched with that update. So there is
   * exactly one render where the outcome has gone and the route is still
   * here — and without the `pending` arm below, this guard fires in that gap
   * and replaces the navigation to the track with one back to setup.
   *
   * That is not theoretical: it is what "Race again" did on this screen from the day
   * it shipped. The mirror image of it is guarded in `RaceTrack`, and this is the half
   * that was missed.
   */
  if (!outcome) {
    return (
      <Navigate to={`/p/${profile.id}/race${pending ? "/go" : ""}`} replace />
    );
  }

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
      // `mode` picks the family, so a spelling run drills words and an
      // arithmetic one drills facts without this knowing which it was.
      config: buildDrill(missedFacts, session.mode, {
        // Typing has its own results screen, so this is always a card config.
        inputMode: isTyping(session.config) ? "type" : session.config.inputMode,
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

      <Scoreline session={session} accuracy={accuracy} />

      <Rewards
        levelledUpTo={levelledUpTo}
        bonuses={bonuses}
        newBadges={newBadges}
      />
      <SplitsTable
        session={session}
        ghost={ghost}
        mySplits={mySplits}
        ghostSplits={ghostSplits}
      />

      <div className="results__actions">
        {practiceFirst && (
          <Button variant="go" onClick={practise}>
            Practise {plural(missedFacts.length, "fact")}
          </Button>
        )}
        <Button
          variant={practiceFirst ? "accent" : "go"}
          onClick={() => raceAgain(ghost)}
        >
          Race again
        </Button>
        {!ghost && (
          <Button variant="accent" onClick={() => raceAgain(selfGhost)}>
            Race this ghost
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            clear();
            navigate(`/p/${profile.id}/race`);
          }}
        >
          Change settings
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clear();
            navigate(`/p/${profile.id}`);
          }}
        >
          Back to hub
        </Button>
      </div>
    </main>
  );
}
