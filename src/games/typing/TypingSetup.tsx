import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/kit";
import { configKey, describeConfig } from "@/engine/decks";
import {
  TYPING_LEVELS,
  levelCredit,
  typingLevelForAge,
  wordsPerMinute,
} from "@/engine/decks/typing";
import { bestRun, ghostsFor, sessionsFor } from "@/engine/records";
import { randomSeed } from "@/engine/random";
import { ladderProgress } from "@/engine/typing/ladder";
import { isStormLesson } from "@/engine/typing/storms";
import { RivalList } from "@/games/race";
import { sfx } from "@/services/sound";
import { KeyboardSetting } from "./keyboard/KeyboardSetting";
import { useKeyboardPresence } from "./keyboard/useKeyboardPresence";
import { LessonBrief } from "./LessonBrief";
import { LessonLadder } from "./LessonLadder";
import { StormBrief } from "./StormBrief";
import { lessonConfig, lessonKey } from "./lessonRun";
import type { Lesson } from "@/engine/typing/lessons";
import type { KeyboardMode, TypingConfig } from "@/engine/types";

const LENGTHS = [20, 30, 50, 80];

/**
 * The ladder, and free play under it (§9).
 *
 * `LessonLadder` is the screen's subject and the panel below it is the game
 * that was here before the course existed. Free play stays whole and nothing on
 * the ladder gates it (§7).
 *
 * The two halves share this screen and nothing else. A lesson is not a race
 * (§7): it carries its own words, no ghost and no rival, which is why the
 * ladder starts a run through `lessonConfig` rather than through the level and
 * length held in this component's state.
 */
export default function TypingSetup() {
  const { profileId } = useParams();
  const { profiles, sessions, updateProfile, notify } = useHub();
  const profile = usePlayer(profileId);
  const { start } = useRace();
  const navigate = useNavigate();

  const [config, setConfig] = useState<TypingConfig>(() => ({
    kind: "typing",
    levelId: typingLevelForAge(profile?.age ?? 8).id,
    wordCount: 30,
  }));
  const [rivalId, setRivalId] = useState<string | null>(null);

  /**
   * The lesson whose brief is up, or `null` for none (§9).
   *
   * Holding the lesson rather than a boolean is what lets the brief be mounted
   * per lesson below, which is how the keyboard control gets seeded afresh each
   * time instead of carrying the last lesson's choice onto one that suggests
   * something else.
   *
   * One piece of state for both kinds of rung, and the lesson itself decides
   * which brief opens over it (`isStormLesson`). Two flags would be two ways to
   * have both open at once, over a ladder where a tile is exactly one of the
   * two.
   */
  const [briefing, setBriefing] = useState<Lesson | null>(null);

  /**
   * Whether this device looks like it can play Hailstorm at all (§8.8).
   *
   * Asked here rather than inside the ladder so that screen stays a pure
   * function of its props. It is a guess that costs a keystroke to overturn —
   * see the hook.
   */
  const hasKeyboard = useKeyboardPresence();

  const key = configKey(config);
  const rivals = useMemo(
    () => (profile ? ghostsFor(sessions, profiles, key, profile.id) : []),
    [sessions, profiles, key, profile],
  );

  // A rival is only a fair race at the exact same settings.
  useEffect(() => {
    if (rivalId && !rivals.some((g) => g.session.id === rivalId))
      setRivalId(null);
  }, [rivalId, rivals]);

  /**
   * Where this child is on the ladder, from the runs the hub has already
   * loaded (§6.5).
   *
   * Memoised over the slice as well as the derivation, because `sessionsFor`
   * builds a fresh array every call and `ladderProgress` remembers its answer
   * against the array it was handed — so an unmemoised slice would pay for a
   * pass over every saved run on every keystroke of the free-play panel below.
   */
  const progress = useMemo(
    () => ladderProgress(sessionsFor(sessions, profile?.id ?? "")),
    [sessions, profile?.id],
  );

  if (!profile) return <Navigate to="/" replace />;

  const credit = levelCredit(config.levelId);
  const mine = sessionsFor(sessions, profile.id, key);
  const best = bestRun(mine);
  const bestWpm = best ? wordsPerMinute(best.cards, best.durationMs) : null;

  /**
   * Saved to the profile the moment it moves, unlike everything else on this
   * screen: a level and a length describe one run, but how much of the keyboard
   * you need is about the child (§4.2). Same shape as the sound toggle in
   * `TopBar` — write, and say so if the write didn't land, because the pills
   * are drawn from the profile and would otherwise silently spring back.
   */
  async function chooseKeyboard(next: KeyboardMode) {
    sfx.tap();
    try {
      await updateProfile(profile!.id, { keyboard: next });
    } catch {
      notify("Could not save the keyboard setting", "bad");
    }
  }

  /**
   * Start the lesson the brief is showing: fresh words, no ghost, no rival
   * (§7).
   *
   * The same three lines the results screen's "Try again" runs, and
   * deliberately so — a lesson started from a tile and a lesson started from
   * its own results are the same run, filed under the same `configKey`, or a
   * child's best would depend on which button they reached it by.
   *
   * `keyboard` is absent when the child was not offered a choice — a locked
   * lesson hands back nothing rather than the mode it insisted on — so what is
   * saved with the run says "chosen" and not merely "shown" (§4.2).
   */
  function runLesson(lesson: Lesson, keyboard?: KeyboardMode) {
    sfx.whoosh();
    const seed = randomSeed();
    start({
      profileId: profile!.id,
      config: lessonConfig(lesson, seed, keyboard),
      seed,
      ghost: null,
    });
    navigate(`/p/${profile!.id}/go`);
  }

  function launch() {
    const ghost = rivals.find((g) => g.session.id === rivalId) ?? null;
    sfx.whoosh();
    start({
      profileId: profile!.id,
      config,
      // Racing a ghost replays that run's passage, so both type the same words.
      seed: ghost ? ghost.session.seed : randomSeed(),
      ghost,
    });
    navigate(`/p/${profile!.id}/go`);
  }

  return (
    <main className="setup">
      <TopBar profile={profile} back={{ to: "/", label: "Players" }}>
        <Link className="topbar__icon" to="/flash-cards" title="Flash cards">
          <span aria-hidden="true">🔢</span>
          <span className="u-sr">Flash cards</span>
        </Link>
      </TopBar>

      <LessonLadder
        progress={progress}
        hasKeyboard={hasKeyboard}
        onOpen={setBriefing}
      />

      {/* A storm's door is its own (`StormBrief`, decision 60): no three bars,
          no best and no keyboard control, because a storm has none of the
          three. Play sends the child to the level's own route, which is where
          the wave is built — this screen never holds one. */}
      {isStormLesson(briefing) && (
        <StormBrief
          lesson={briefing}
          progress={progress}
          onStart={() => {
            sfx.whoosh();
            navigate(`/p/${profile.id}/storm/${briefing.id}`);
          }}
          onClose={() => setBriefing(null)}
        />
      )}

      {/* Keyed by the lesson, so a second brief is a second mount: the
          keyboard control is seeded from the lesson on mount, and a component
          held across two openings would show lesson 12's suggestion under
          lesson 40's title. */}
      {briefing && !isStormLesson(briefing) && (
        <LessonBrief
          key={briefing.id}
          lesson={briefing}
          progress={progress}
          best={bestRun(sessionsFor(sessions, profile.id, lessonKey(briefing)))}
          profileKeyboard={profile.keyboard}
          onStart={(keyboard) => runLesson(briefing, keyboard)}
          onClose={() => setBriefing(null)}
        />
      )}

      <div className="setup__grid">
        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Free play</h2>
            <span className="chip">{describeConfig(config)}</span>
          </div>

          {/* Said once, under the ladder, because a screen that led with a
              hundred lessons and then showed a level picker without a word
              would read as the course being over. */}
          <p className="muted">
            No lesson, no bars to meet — a passage, a clock, and anyone
            you&apos;ve raced before.
          </p>

          <div className="control">
            <span className="control__label">Level</span>
            <ul className="wordlists">
              {TYPING_LEVELS.map((level) => (
                <li key={level.id} className="wordlists__row">
                  <Button
                    variant="bare"
                    className={`wordlists__item${config.levelId === level.id ? " is-on" : ""}`}
                    pressed={config.levelId === level.id}
                    onClick={() => {
                      sfx.tap();
                      setConfig((c) => ({ ...c, levelId: level.id }));
                    }}
                  >
                    <span className="wordlists__emoji" aria-hidden="true">
                      {level.emoji}
                    </span>
                    <span className="wordlists__body">
                      <span className="wordlists__name">{level.name}</span>
                      <span className="wordlists__meta">
                        {level.group} · {level.keys}
                      </span>
                      <span className="wordlists__blurb">{level.blurb}</span>
                    </span>
                  </Button>
                </li>
              ))}
            </ul>
            {/* Under the list rather than in the row that carries it: the
                credit belongs to the words a player is about to be shown, so
                it appears when that level is the one chosen. */}
            {credit && <p className="passage__credit">{credit}</p>}
          </div>

          <div className="control">
            <span className="control__label">How many words</span>
            <div className="segmented">
              {LENGTHS.map((count) => (
                <Button
                  key={count}
                  variant="bare"
                  className={`segmented__btn u-mono${config.wordCount === count ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    setConfig((c) => ({ ...c, wordCount: count }));
                  }}
                  pressed={config.wordCount === count}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>

          <KeyboardSetting
            mode={profile.keyboard}
            onChange={(next) => void chooseKeyboard(next)}
          />

          <p className="numbers__note">
            {bestWpm === null
              ? "Type each word and press space. A word you get wrong costs you three seconds, so accuracy beats hammering."
              : `Your best at these settings: ${bestWpm} words a minute. A wrong word costs three seconds.`}
          </p>
        </section>

        <RivalList
          rivals={rivals}
          chosenId={rivalId}
          onChoose={(id) => {
            sfx.tap();
            setRivalId(id);
          }}
          onStart={launch}
        />
      </div>
    </main>
  );
}
