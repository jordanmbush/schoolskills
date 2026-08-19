import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/components/state/HubContext";
import { useRace, type RaceOutcome } from "@/components/state/RaceContext";
import TopBar from "@/components/TopBar";
import { Button, Confetti } from "@/components/ui/kit";
import { isTyping } from "@/engine/decks";
import { levelCredit } from "@/engine/decks/typing";
import { clock } from "@/engine/format";
import { randomSeed } from "@/engine/random";
import { cumulativeSplits, sessionsFor } from "@/engine/records";
import { ladderProgress } from "@/engine/typing/ladder";
import { verdictFor } from "@/engine/typing/verdict";
import { Rewards } from "@/games/race";
import { SplitsTable } from "@/games/flashcards/results/SplitsTable";
import { sfx } from "@/services/sound";
import { PassBars } from "./PassBars";
import { lessonConfig } from "./lessonRun";
import { missNote, nextNote } from "./lessonNotes";
import type { Lesson } from "@/engine/typing/lessons";
import type { Profile } from "@/engine/types";

/**
 * Whether the lesson was passed, and what to do next (docs/typing.md §6.1, §9).
 *
 * The free-play screen next door is a **scoreline** — a wpm, an accuracy, a
 * clock and a rival — because free play is a race and a race is decided on a
 * number. A lesson is not (§7). What is on trial here is three criteria, and
 * the job of this screen is to turn a failure into an instruction: not "68%",
 * but "you were fast enough; the `z` key needs more practice". A child who
 * misses a lesson and cannot tell which of the three cost them has been handed
 * a wall, and a wall is what makes a seven-year-old stop climbing.
 *
 * So the bars lead, in §6.1's order, and the sentence under the headline names
 * the gap. `missNote` and `nextNote` decide what that sentence says; this file
 * only puts it on the screen.
 *
 * **Retries are unlimited and unpenalised.** There is no attempt counter here
 * and nothing anywhere that stores one — a lesson is passed if a session exists
 * that meets its criteria (§6.5), so a failed run costs a child exactly the
 * time it took and nothing else. Trying a checkpoint you are nowhere near
 * being free is the whole of the levelling advice (§6.6), and it is only true
 * because failing is.
 */
export default function LessonResults({
  lesson,
  outcome,
  profile,
}: {
  lesson: Lesson;
  outcome: RaceOutcome;
  profile: Profile;
}) {
  const { sessions } = useHub();
  const { start, clear } = useRace();
  const navigate = useNavigate();

  const { session, newBadges, bonuses } = outcome;
  const verdict = verdictFor(session, lesson);

  /**
   * Held still across renders, because `ladderProgress` memoises on the array
   * it is handed and a fresh slice every render would pay for the pass over
   * every saved run every time (§6.5). The run that has just finished is
   * already in `sessions` — `saveSession` appends before `finish` hands over —
   * so what this reads is the ladder *after* this attempt, which is the only
   * version of it that can say a lesson just opened.
   */
  const mine = useMemo(
    () => sessionsFor(sessions, profile.id),
    [sessions, profile.id],
  );
  const opened = nextNote(lesson, ladderProgress(mine));

  /**
   * A Hailstorm level is a different game on a different route (§8, §9), and
   * this screen is only ever reached by one because a storm run is an ordinary
   * `Session` and the results route is shared. Until #159 builds the wave there
   * is nothing here that could start one, so the two run actions stand down
   * rather than hand a child a lesson-shaped run of a level that has no
   * passage. Everything else on the screen — the bars, the reason, the rewards
   * — reads a storm correctly.
   */
  const storm = lesson.pass.kind === "storm";

  /**
   * Where the ladder will live (§9).
   *
   * `#/p/:id` is the setup screen until #144 turns it into the hundred tiles.
   * Every way off this screen points at the route rather than at today's
   * screen, which is what makes that story a swap rather than a hunt for the
   * links that guessed.
   */
  const ladder = `/p/${profile.id}`;

  /** The lesson the "Next lesson" button opens, when there is one to offer. */
  const nextLesson = verdict.passed && !storm ? opened.next : null;

  // Through the deck registry's own guard rather than reading `kind` here:
  // narrowing the config union is `decks/index.ts`'s job and nowhere else's.
  // A lesson's words come from the lexicon, which asks for no credit (§5.3) —
  // but the line is drawn from the config exactly as free play draws it, so a
  // lesson whose words ever come from a source that wants naming names it.
  const credit = isTyping(session.config)
    ? levelCredit(session.config.levelId)
    : undefined;

  /** Fresh words, no ghost, no attempt counter. */
  function run(of: Lesson) {
    sfx.whoosh();
    const seed = randomSeed();
    start({
      profileId: profile.id,
      config: lessonConfig(of, seed),
      seed,
      ghost: null,
    });
    navigate(`/p/${profile.id}/go`, { replace: true });
  }

  return (
    <main className="results">
      <Confetti burst={verdict.passed ? 1 : 0} />
      <TopBar
        profile={outcome.profileAfter}
        back={{ to: ladder, label: "Typing" }}
      />

      <section className="results__head anim-rise">
        <p className="u-eyebrow">
          Lesson {lesson.n} · {lesson.title}
        </p>
        {/* Plain words, read once. "Not yet" rather than "Failed": the run
            below it says what to change, and nothing on this screen has taken
            anything away. */}
        <h1 className="u-display results__title">
          {verdict.passed ? "You passed" : "Not yet"}
        </h1>
        {/* The whole point of the screen, in one line: a lesson that was
            missed says which of the three cost it, and one that was passed
            says which lesson that just opened. */}
        <p className="results__lede">
          {verdict.passed ? opened.text : missNote(lesson, verdict)}
        </p>
      </section>

      <section className="panel anim-rise">
        <PassBars lesson={lesson} verdict={verdict} />
      </section>

      <section className="scoreline panel anim-rise">
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
          <span className="stat__value">{clock(session.durationMs)}</span>
          {/* The clock, and only the clock. A lesson carries no
              `WRONG_ANSWER_PENALTY_MS` (§7) — charging three seconds a miss
              would double-count the accuracy bar right above it — so there is
              no "+ penalties" to label here. Free play is a race and still
              has both; see the label it draws next door. */}
          <span className="stat__label">Time</span>
        </div>
        <div className="stat stat--xp">
          <span className="stat__value">
            +{session.xpEarned.toLocaleString()}
          </span>
          <span className="stat__label">XP earned</span>
        </div>
      </section>

      {/* The same strip a race pays out through, so a lesson is worth the same
          XP, the same levels and the same badges as one. */}
      <Rewards
        levelledUpTo={outcome.levelledUpTo}
        bonuses={bonuses}
        newBadges={newBadges}
      />

      <div className="results__actions">
        {!storm && (
          <Button variant="go" onClick={() => run(lesson)}>
            Try again
          </Button>
        )}
        {nextLesson && (
          <Button variant="accent" onClick={() => run(nextLesson)}>
            Next lesson
          </Button>
        )}
        <Button
          variant="ghost"
          onClick={() => {
            clear();
            navigate(ladder);
          }}
        >
          Back to the ladder
        </Button>
        {/* One record book for both games, and it lives with the flash
            cards — same origin, same storage, so it already has this run. */}
        <a
          className="btn btn--ghost"
          href={`/flash-cards#/p/${profile.id}/progress`}
        >
          Record book
        </a>
      </div>

      <SplitsTable
        session={session}
        ghost={null}
        mySplits={cumulativeSplits(session)}
        ghostSplits={null}
      />
      {/* The splits list every word of the passage back, one to a row, which is
          where a child sees which words went wrong — and it is the only place
          the text appears on this screen, so the credit belongs under it. */}
      {credit && <p className="passage__credit">{credit}</p>}
    </main>
  );
}
