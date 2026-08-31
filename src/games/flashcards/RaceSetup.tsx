import { useEffect, useMemo, useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import { useSubject } from "@/components/state/SubjectContext";
import { useWorld, worldOfRace } from "@/components/state/useWorld";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/kit";
import { snapTimeLimit, timeLimitForAge } from "@/engine/decks/flashcards";
import {
  buildDrill,
  configKey,
  describeConfig,
  isTyping,
  modeOf,
} from "@/engine/decks";
import { plural } from "@/engine/format";
import { ghostsFor, sessionsFor, troubleFacts } from "@/engine/records";
import { randomSeed } from "@/engine/random";
import { WORLDS } from "@/engine/worlds";
import { sfx } from "@/services/sound";
import { ClockPicker } from "./setup/ClockPicker";
import { MathsSettings } from "./setup/MathsSettings";
import { PresetRow } from "./setup/PresetRow";
import { RivalList } from "@/games/race";
import { WordSettings } from "./setup/WordSettings";
import type { CardConfig, InputMode } from "@/engine/types";

const CARD_COUNTS = [10, 15, 20, 30, 50];

/** How answering reads depends on what's on the card. */
const ANSWER_LABELS: Record<
  "numbers" | "words",
  Array<[InputMode, string, string]>
> = {
  numbers: [
    ["type", "Type it", "Keypad or keyboard"],
    ["choose", "Tap one", "Four choices"],
  ],
  words: [
    ["type", "Spell it", "Type what you hear"],
    ["choose", "Spot it", "Four words to pick from"],
  ],
};

/**
 * What to race, and who against — the first screen behind a player's name.
 *
 * Subject-agnostic, like every screen on this island: `useSubject()` decides
 * which decks exist and what the world is called, and nothing here branches on
 * a deck family beyond the two settings panels.
 *
 * It is also where a player lands, which is why the top bar carries the record
 * book and the other worlds. A screen in front of this one had nothing to
 * offer that this one doesn't — the deck, the clock and the rival are all
 * chosen here — so it was a step between a child's name and the only button
 * they wanted.
 */
export default function RaceSetup() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const { start } = useRace();
  const subject = useSubject();
  const navigate = useNavigate();
  const location = useLocation();

  // "Drill these" in the record book arrives here with a deck already built,
  // so the player sees what they're about to practise before it starts. A drill
  // is always built from a deck this app owns, so it can't hand in a subject
  // this screen has no settings for.
  const handed = (location.state as { config?: CardConfig } | null)?.config;
  const [config, setConfig] = useState<CardConfig>(
    () => handed ?? subject.startingConfig(profile?.age ?? 8),
  );
  const [rivalId, setRivalId] = useState<string | null>(null);
  /** Raw text while the clock field is being typed into; null when it isn't. */
  const [limitDraft, setLimitDraft] = useState<string | null>(null);

  const mode = modeOf(config);

  // Picking a spelling list turns this screen into the jungle while the player
  // watches — the deck decides the world, so choosing one is choosing where to
  // stand. See src/engine/worlds.ts.
  useWorld(worldOfRace(config));

  const key = configKey(config);
  const rivals = useMemo(
    () => (profile ? ghostsFor(sessions, profiles, key, profile.id) : []),
    [sessions, profiles, key, profile],
  );

  // A rival is only a fair race at the exact same settings, so tweaking the
  // deck drops a rival who no longer has a matching run.
  useEffect(() => {
    if (rivalId && !rivals.some((g) => g.session.id === rivalId))
      setRivalId(null);
  }, [rivalId, rivals]);

  /**
   * The facts this player keeps getting wrong on the deck currently chosen.
   *
   * Memoised on the mode rather than the whole config, because `troubleFacts`
   * walks every card of every saved run and the config changes on every dial —
   * including on each keystroke in the clock field. Six at most, and the offer
   * below appears from three up: `buildDrill` runs two passes at each fact and
   * never builds fewer than six cards, so a shorter list would only come round
   * again.
   */
  const mine = useMemo(
    () => sessionsFor(sessions, profile?.id ?? ""),
    [sessions, profile?.id],
  );
  const trouble = useMemo(() => troubleFacts(mine, mode, 6), [mine, mode]);

  if (!profile) return <Navigate to="/" replace />;

  const isWords = config.kind === "words";
  // Everywhere else you could be. The world you're standing in isn't offered.
  const elsewhere = WORLDS.filter((w) => w.id !== subject.world);
  const patchShared = (next: Partial<CardConfig>) =>
    setConfig((current) => ({ ...current, ...next }) as CardConfig);

  // A drill sizes its own deck, so make room for whatever length it picked.
  const cardCounts = CARD_COUNTS.includes(config.cardCount)
    ? CARD_COUNTS
    : [...CARD_COUNTS, config.cardCount].sort((a, b) => a - b);

  const limitSeconds = config.timeLimitMs ? config.timeLimitMs / 1000 : null;
  // Show exactly what's being typed while the field has focus; otherwise show
  // the stored value, which is always on the quarter-second grid.
  const limitShown =
    limitDraft ?? (limitSeconds === null ? "" : String(limitSeconds));

  function setLimit(ms: number | null) {
    setLimitDraft(null);
    patchShared({ timeLimitMs: ms === null ? null : snapTimeLimit(ms) });
  }

  /** Nudges the clock a step, starting from the age default if it's off. */
  function bumpLimit(stepMs: number) {
    sfx.tap();
    setLimit((config.timeLimitMs ?? timeLimitForAge(profile!.age)) + stepMs);
  }

  /**
   * Load the missed facts into the screen rather than starting them.
   *
   * A drill is a deck, and the deck is what this screen chooses — so a child
   * handed one still sees what they are about to practise, still picks a rival
   * and still presses Start. The record book makes the same offer beside the
   * facts themselves; it is repeated here because a child who never opens the
   * record book is the one it was written for.
   *
   * Narrowed through the deck registry's own guard: `buildDrill` answers for
   * every family, and the typing one belongs to another island.
   */
  function drill() {
    sfx.select();
    const deck = buildDrill(
      trouble.map((fact) => fact.factId),
      mode,
      {
        inputMode: profile!.age <= 6 ? "choose" : "type",
        timeLimitMs: timeLimitForAge(profile!.age),
      },
    );
    if (!isTyping(deck)) setConfig(deck);
  }

  function launch() {
    const ghost = rivals.find((g) => g.session.id === rivalId) ?? null;
    sfx.whoosh();
    start({
      profileId: profile!.id,
      config,
      // Racing a ghost replays that run's deck, so both drivers face the same cards.
      seed: ghost ? ghost.session.seed : randomSeed(),
      ghost,
    });
    navigate(`/p/${profile!.id}/go`);
  }

  return (
    <main className="setup">
      <TopBar profile={profile} back={{ to: "/", label: "Players" }}>
        {/*
          Hop straight to another world without going back out to the map.
          Real <a>s, not router links: each world is a different island behind
          a different Astro page, and the HashRouter here owns none of them.
        */}
        {elsewhere.map((world) => (
          <a
            key={world.id}
            className="topbar__icon"
            href={world.href}
            title={world.name}
          >
            <span aria-hidden="true">{world.icon}</span>
            <span className="u-sr">{world.name}</span>
          </a>
        ))}
        <Link
          className="topbar__icon"
          to={`/p/${profile.id}/progress`}
          title="Progress"
        >
          <span aria-hidden="true">📈</span>
          <span className="u-sr">Progress</span>
        </Link>
      </TopBar>

      {/* The player picker in front of this screen is shared by all three
          islands and so names no subject. Without this line nothing inside the
          game says whether you are in The Grid or the jungle — and a line is
          all it takes, where a display title would push Start off the fold. */}
      <header className="setup__head">
        <p className="u-eyebrow">{subject.eyebrow}</p>
        {trouble.length >= 3 && (
          <Button variant="bare" className="setup__drill" onClick={drill}>
            Practise the {plural(trouble.length, "fact")} you keep missing →
          </Button>
        )}
      </header>

      <div className="setup__grid">
        {!isWords && (
          <PresetRow
            currentKey={key}
            onChoose={(next) => {
              sfx.tap();
              setConfig(next);
            }}
          />
        )}

        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Fine tune</h2>
            <span className="chip">{describeConfig(config)}</span>
          </div>

          {config.kind === "words" ? (
            <WordSettings config={config} onChange={setConfig} />
          ) : (
            <MathsSettings config={config} onChange={setConfig} />
          )}

          <div className="control">
            <span className="control__label">How many cards</span>
            <div className="segmented">
              {cardCounts.map((count) => (
                <Button
                  key={count}
                  variant="bare"
                  className={`segmented__btn u-mono${config.cardCount === count ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    patchShared({ cardCount: count });
                  }}
                  pressed={config.cardCount === count}
                >
                  {count}
                </Button>
              ))}
            </div>
          </div>

          <ClockPicker
            limitMs={config.timeLimitMs ?? null}
            shownSeconds={limitShown}
            onPreset={(ms) => {
              sfx.tap();
              setLimit(ms);
            }}
            onStep={bumpLimit}
            onType={(text) => {
              setLimitDraft(text);
              if (text.trim() === "") {
                patchShared({ timeLimitMs: null });
                return;
              }
              const typed = Number(text);
              if (Number.isFinite(typed))
                patchShared({ timeLimitMs: snapTimeLimit(typed * 1000) });
            }}
            onDraftEnd={() => setLimitDraft(null)}
          />

          <div className="control">
            <span className="control__label">Answering</span>
            <div className="segmented">
              {ANSWER_LABELS[isWords ? "words" : "numbers"].map(
                ([mode, label, hint]) => (
                  <Button
                    key={mode}
                    variant="bare"
                    className={`segmented__btn segmented__btn--stack${config.inputMode === mode ? " is-on" : ""}`}
                    onClick={() => {
                      sfx.tap();
                      patchShared({ inputMode: mode });
                    }}
                    pressed={config.inputMode === mode}
                  >
                    <span className="segmented__word">{label}</span>
                    <span className="segmented__hint">{hint}</span>
                  </Button>
                ),
              )}
            </div>
          </div>
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
