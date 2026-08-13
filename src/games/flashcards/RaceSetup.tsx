import { useEffect, useMemo, useState } from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { useRace } from "@/components/state/RaceContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/kit";
import {
  presetForAge,
  snapTimeLimit,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { configKey, describeConfig } from "@/engine/decks";
import { wordListForAge } from "@/engine/decks/wordlists";
import { ghostsFor } from "@/engine/records";
import { randomSeed } from "@/engine/random";
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

export default function RaceSetup() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const { start } = useRace();
  const navigate = useNavigate();
  const location = useLocation();

  // "Drill these" elsewhere in the hub arrives here with a deck already built,
  // so the player sees what they're about to practise before it starts.
  const handed = (location.state as { config?: CardConfig } | null)?.config;
  const [config, setConfig] = useState<CardConfig>(
    () => handed ?? presetForAge(profile?.age ?? 8).config,
  );
  const [rivalId, setRivalId] = useState<string | null>(null);
  /** Raw text while the clock field is being typed into; null when it isn't. */
  const [limitDraft, setLimitDraft] = useState<string | null>(null);

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

  if (!profile) return <Navigate to="/" replace />;

  const isWords = config.kind === "words";
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
   * Switching subject keeps how the race is run — length, clock, and whether
   * it's typed or tapped — and replaces only what's on the cards. Someone who
   * has set an 8-second 20-card race shouldn't have to set it again to try
   * the same shape on spellings.
   */
  function setSubject(next: "numbers" | "words") {
    if (isWords === (next === "words")) return;
    sfx.tap();
    const shared = {
      cardCount: config.cardCount,
      inputMode: config.inputMode,
      timeLimitMs: config.timeLimitMs ?? null,
    };
    setConfig(
      next === "words"
        ? {
            kind: "words",
            listId: wordListForAge(profile!.age).id,
            ...shared,
          }
        : { ...presetForAge(profile!.age).config, ...shared },
    );
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
    navigate(`/p/${profile!.id}/race/go`);
  }

  return (
    <main className="setup">
      <TopBar
        profile={profile}
        back={{ to: `/p/${profile.id}`, label: "Hub" }}
      />

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

          <div className="control">
            <span className="control__label">Practising</span>
            <div className="segmented">
              {(
                [
                  ["numbers", "🔢", "Numbers", "Times tables and sums"],
                  ["words", "🔤", "Words", "Spelling and sight words"],
                ] as const
              ).map(([subject, icon, label, hint]) => (
                <Button
                  key={subject}
                  variant="bare"
                  className={`segmented__btn segmented__btn--stack${isWords === (subject === "words") ? " is-on" : ""}`}
                  onClick={() => setSubject(subject)}
                  pressed={isWords === (subject === "words")}
                >
                  <span className="segmented__word">
                    <span aria-hidden="true">{icon}</span> {label}
                  </span>
                  <span className="segmented__hint">{hint}</span>
                </Button>
              ))}
            </div>
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
