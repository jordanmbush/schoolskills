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
import { isStormLesson } from "@/engine/typing/storms";
import { verdictFor } from "@/engine/typing/verdict";
import { Rewards, SplitsTable } from "@/games/race";
import { sfx } from "@/services/sound";
import { useKeyboardPresence } from "./keyboard/useKeyboardPresence";
import { PassBars } from "./PassBars";
import { lessonConfig } from "./lessonRun";
import { missNote, nextNote } from "./lessonNotes";
import type { Lesson } from "@/engine/typing/lessons";
import type { Profile } from "@/engine/types";

/**
 * Whether the lesson was passed, and what to do next (§6.1, §9).
 *
 * The free-play screen next door is a scoreline, because a race is decided on a
 * number. A lesson is marked rather than ranked (§7), so the bars lead, in
 * §6.1's order, and the sentence under the headline names the gap. `missNote`
 * and `nextNote` decide what that sentence says; this file only puts it on the
 * screen.
 *
 * There is no attempt counter here and nothing anywhere that stores one:
 * retries are unlimited and unpenalised (§6.5, §6.6).
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

  /**
   * Whether a storm is worth offering on this device (§8.8, decision 53).
   *
   * The same guess the ladder's tiles are drawn from, asked again here because
   * this screen makes the same offer they do. It is not proven by the run that
   * just finished: a passage typed on a tablet's software keyboard reports no
   * `code`, which is exactly what stops it counting as proof.
   */
  const hasKeyboard = useKeyboardPresence();
  const opened = nextNote(lesson, ladderProgress(mine), hasKeyboard);

  /**
   * A Hailstorm level is a different game on a different route (§8, §9), and
   * this screen is reached by one only because a storm run is an ordinary
   * `Session` and the results route is shared. `run` below builds a
   * lesson-shaped passage run, which a storm has no passage for, so the two run
   * actions stand down. Everything else on the screen — the bars, the reason,
   * the rewards — reads a storm correctly.
   */
  const storm = lesson.pass.kind === "storm";

  /**
   * Where the ladder lives (§9). Every way off this screen points at the route
   * rather than at the screen behind it, so a screen swapped in behind it needs
   * no link here changed.
   */
  const ladder = `/p/${profile.id}`;

  /**
   * The rung this pass opened, when there is one to offer.
   *
   * A Hailstorm level can be it, now that the ladder points at storms rather
   * than stepping over them (§8.8, decision 72) — so the two forward buttons
   * below are two, and not one with a label that changes. A storm is a
   * different game on a different route, and `run` builds a passage it has
   * none of.
   */
  const ahead = verdict.passed && !storm ? opened.next : null;
  const wave = ahead && isStormLesson(ahead) ? ahead : null;

  // Through the deck registry's own guard rather than reading `kind` here:
  // narrowing the config union is `decks/index.ts`'s job and nowhere else's.
  // A lesson's words come from the lexicon, which asks for no credit (§5.3) —
  // but the line is drawn from the config exactly as free play draws it, so a
  // lesson whose words ever come from a source that wants naming names it.
  const credit = isTyping(session.config)
    ? levelCredit(session.config.levelId)
    : undefined;

  /**
   * What the child chose in the brief, if they chose anything (§4.2).
   *
   * Carried onto "Try again" and onto nothing else. A retry is the same lesson
   * with fresh words, and a child who turned the guide off to sit lesson 40
   * properly should not have it switched back on by the button that means
   * "again" — but the lesson after it is a different lesson, and it gets to
   * make its own suggestion. Read through the deck registry's own guard, for
   * the same reason `credit` above is.
   */
  const chosen = isTyping(session.config) ? session.config.keyboard : undefined;

  /** Fresh words, no ghost, no attempt counter. */
  function run(of: Lesson) {
    sfx.whoosh();
    const seed = randomSeed();
    start({
      profileId: profile.id,
      config: lessonConfig(of, seed, of.id === lesson.id ? chosen : undefined),
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
          {/* The clock, and only the clock: a lesson carries no
              `WRONG_ANSWER_PENALTY_MS` (§7), so there is no "+ penalties" to
              label here. Free play is a race and still has both; see the label
              it draws next door. */}
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
        {/* Back to the ladder with the storm's door open, rather than into the
            sky. How a storm is played — only the lowest letter can be shot —
            is written on that door and nowhere else (§8.8), and a child sent
            straight past it would be shooting at the wrong letter with no way
            to find out why. It is also where "Not now" lives, which is what
            keeps an offer an offer. */}
        {wave && (
          <Button
            variant="accent"
            /* The outcome is deliberately left alone. Clearing it in the same
               handler makes `TypingResults`'s own `!outcome` guard the last
               writer of the history entry, and it navigates with `replace` —
               which drops the rung this is handing over. Leaving the screen
               without clearing is what the top bar's way out already does. */
            onClick={() => {
              sfx.whoosh();
              navigate(ladder, { state: { open: wave.id } });
            }}
          >
            Play the Hailstorm
          </Button>
        )}
        {ahead && !wave && (
          <Button variant="accent" onClick={() => run(ahead)}>
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
