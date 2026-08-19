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
import { RivalList } from "@/games/race";
import { sfx } from "@/services/sound";
import { KeyboardSetting } from "./keyboard/KeyboardSetting";
import type { KeyboardMode, TypingConfig } from "@/engine/types";

const LENGTHS = [20, 30, 50, 80];

/**
 * Picking a level and a length.
 *
 * Shorter than the flash-card setup on purpose: there is no operation, no
 * number grid, no input mode and no per-word clock to choose. A typing run is
 * a level and a length, and everything else about it is the same for everyone.
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

  if (!profile) return <Navigate to="/" replace />;

  const credit = levelCredit(config.levelId);
  const mine = sessionsFor(sessions, profile.id, key);
  const best = bestRun(mine);
  const bestWpm = best ? wordsPerMinute(best.cards, best.durationMs) : null;

  /**
   * Saved to the profile the moment it moves, unlike everything else on this
   * screen: a level and a length describe one run, but how much of the
   * keyboard you need is about the child, and it should still be true next
   * week without being chosen again. Same shape as the sound toggle in
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

      <div className="setup__grid">
        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Typing</h2>
            <span className="chip">{describeConfig(config)}</span>
          </div>

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
