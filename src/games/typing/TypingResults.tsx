import { Navigate, useNavigate, useParams } from "react-router-dom";
import { usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import TopBar from "@/components/TopBar";
import { Button, Confetti } from "@/components/ui/kit";
import { isTyping } from "@/engine/decks";
import { levelCredit, wordsPerMinute } from "@/engine/decks/typing";
import { clock, delta, percent } from "@/engine/format";
import { cumulativeSplits, raceTimeMs } from "@/engine/records";
import { randomSeed } from "@/engine/random";
import { lessonById } from "@/engine/typing/lessons";
import { Rewards } from "@/games/race";
import { SplitsTable } from "@/games/flashcards/results/SplitsTable";
import { sfx } from "@/services/sound";
import LessonResults from "./LessonResults";

/**
 * What the run was worth.
 *
 * Words per minute leads, because that's the number a typist thinks in — but
 * accuracy sits beside it rather than being folded into a single "net WPM".
 * A child who types fast and gets half of it wrong should see both, not one
 * blended figure that hides which half is the problem.
 *
 * That is **free play**, which is a race. A run from the ladder is marked
 * against three criteria rather than ranked against a rival, so it gets a
 * screen of its own (`LessonResults`, docs/typing.md §6.1) and this one is
 * left exactly as it was — the wpm, the accuracy, the splits and the ghost.
 */
export default function TypingResults() {
  const { profileId } = useParams();
  const profile = usePlayer(profileId);
  const { outcome, pending, start, clear } = useRace();
  const navigate = useNavigate();

  if (!profile) return <Navigate to="/" replace />;
  /**
   * `start()` clears the outcome and sets a pending race in ONE update, and
   * the navigate that follows it is batched with that update. So there is
   * exactly one render where the outcome has gone and the route is still
   * here — and without the `pending` arm below, this guard fires in that gap
   * and replaces the navigation to the track with one back to setup.
   *
   * That is not theoretical: it is what "Type it again" did on this screen from the day
   * it shipped. The mirror image of it is guarded in `TypingTrack`, and this is the half
   * that was missed.
   */
  if (!outcome) {
    return <Navigate to={`/p/${profile.id}${pending ? "/go" : ""}`} replace />;
  }

  const { session, ghost, personalRecord, previousBest, newBadges, bonuses } =
    outcome;

  /**
   * Which of the two screens this run gets, decided by the run itself.
   *
   * Off `config.lessonId` and not off a route or a prop, for the same reason
   * `TypingTrack` reads it there: what a run IS travels with the run, and a
   * second source for "is this a lesson" is a second thing to get out of step
   * with `modeOf`, which files it under this same id. Below every guard above,
   * so the two navigation races those guards were written for are settled
   * before either screen renders — `LessonResults` starts runs and clears
   * outcomes exactly as this one does, and it is this component's guards that
   * catch it when it does.
   */
  const lesson = isTyping(session.config)
    ? lessonById(session.config.lessonId)
    : null;
  if (lesson) {
    return (
      <LessonResults lesson={lesson} outcome={outcome} profile={profile} />
    );
  }

  const wpm = wordsPerMinute(session.cards, session.durationMs);
  // Through the deck registry's own guard rather than reading `kind` here:
  // narrowing the config union is `decks/index.ts`'s job and nowhere else's.
  const credit = isTyping(session.config)
    ? levelCredit(session.config.levelId)
    : undefined;
  const accuracy =
    session.correct / Math.max(1, session.correct + session.incorrect);
  const previousWpm = previousBest
    ? wordsPerMinute(previousBest.cards, previousBest.durationMs)
    : null;

  const headline = personalRecord
    ? "New personal best"
    : session.beatGhost === true
      ? `You beat ${ghost?.isSelf ? "your ghost" : ghost?.profile.name}`
      : session.beatGhost === false
        ? `${ghost?.isSelf ? "Your ghost" : ghost?.profile.name} held on`
        : session.incorrect === 0
          ? "Not a single miss"
          : "Run complete";

  function again(withGhost: typeof ghost) {
    sfx.whoosh();
    start({
      profileId: profile!.id,
      config: session.config,
      seed: withGhost ? withGhost.session.seed : randomSeed(),
      ghost: withGhost,
    });
    navigate(`/p/${profile!.id}/go`, { replace: true });
  }

  return (
    <main className="results">
      <Confetti burst={personalRecord ? 1 : 0} />
      <TopBar
        profile={outcome.profileAfter}
        back={{ to: `/p/${profile.id}`, label: "Typing" }}
      />

      <section className="results__head anim-rise">
        <p className="u-eyebrow">Typing</p>
        <h1 className="u-display results__title">{headline}</h1>
      </section>

      <section className="scoreline panel anim-rise">
        <div className="stat stat--xp">
          <span className="stat__value">{wpm}</span>
          <span className="stat__label">Words a minute</span>
        </div>
        <div className="stat">
          <span className="stat__value">{percent(accuracy)}</span>
          <span className="stat__label">Accuracy</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {session.correct}
            <span className="scoreline__of">
              /{session.correct + session.incorrect}
            </span>
          </span>
          <span className="stat__label">Words</span>
        </div>
        <div className="stat">
          <span className="stat__value">{clock(raceTimeMs(session))}</span>
          {/* `raceTimeMs` is the clock plus three seconds a miss, and that is
              the truth about a free-play run: it is a race, the penalty is
              what stops "guess fast" beating "know it", and it is the number
              the personal best and the ghost are decided on. A lesson has no
              penalty at all (§7) and says so with a plain "Time" — the label
              is per-screen because the thing it names is. */}
          <span className="stat__label">
            {session.incorrect > 0 ? "Time + penalties" : "Time"}
          </span>
        </div>
        <div className="stat">
          <span className="stat__value">
            +{session.xpEarned.toLocaleString()}
          </span>
          <span className="stat__label">XP earned</span>
        </div>
      </section>

      {previousWpm !== null && (
        <p className="results__note u-mono">
          {wpm === previousWpm
            ? `Exactly your previous best of ${previousWpm} wpm`
            : `${wpm > previousWpm ? "+" : ""}${wpm - previousWpm} wpm against your best of ${previousWpm}`}
          {previousBest &&
            ` · ${delta(raceTimeMs(session) - raceTimeMs(previousBest))} on the clock`}
        </p>
      )}

      <Rewards
        levelledUpTo={outcome.levelledUpTo}
        bonuses={bonuses}
        newBadges={newBadges}
      />

      <div className="results__actions">
        <Button variant="go" onClick={() => again(null)}>
          Type it again
        </Button>
        <Button
          variant="accent"
          onClick={() =>
            again({ session, profile: outcome.profileAfter, isSelf: true })
          }
        >
          Race this run
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            clear();
            navigate(`/p/${profile.id}`);
          }}
        >
          Change level
        </Button>
        {/* One record book for both games, and it lives with the flash
            cards — same origin, same storage, so it already has these runs. */}
        <a
          className="btn btn--ghost"
          href={`/flash-cards#/p/${profile.id}/progress`}
        >
          Record book
        </a>
      </div>

      <SplitsTable
        session={session}
        ghost={ghost}
        mySplits={cumulativeSplits(session)}
        ghostSplits={ghost ? cumulativeSplits(ghost.session) : null}
      />
      {/* The splits list every word of the passage back, one to a row, so
          this screen shows the text as surely as the race did. */}
      {credit && <p className="passage__credit">{credit}</p>}
    </main>
  );
}
