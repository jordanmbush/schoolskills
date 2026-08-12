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
  OPERATIONS,
  OPERATION_ORDER,
  buildDeck,
  configKey,
  presetForAge,
  snapTimeLimit,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { ghostsFor } from "@/engine/records";
import { randomSeed } from "@/engine/random";
import { sfx } from "@/services/sound";
import { ClockPicker } from "./setup/ClockPicker";
import { DeckPicker } from "./setup/DeckPicker";
import { PresetRow } from "./setup/PresetRow";
import { RivalList } from "./setup/RivalList";
import type { FlashConfig, InputMode, Operation } from "@/engine/types";

const CARD_COUNTS = [10, 15, 20, 30, 50];
const TABLE_NUMBERS = Array.from({ length: 12 }, (_, i) => i + 1);

export default function RaceSetup() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const { start } = useRace();
  const navigate = useNavigate();
  const location = useLocation();

  // "Drill these" elsewhere in the hub arrives here with a deck already built,
  // so the player sees what they're about to practise before it starts.
  const handed = (location.state as { config?: FlashConfig } | null)?.config;
  const [config, setConfig] = useState<FlashConfig>(
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

  const spec = OPERATIONS[config.operation];
  const patch = (next: Partial<FlashConfig>) =>
    setConfig((current) => ({ ...current, ...next }));

  const otherNumbers = Array.from(
    { length: 13 - spec.minOther },
    (_, i) => i + spec.minOther,
  );
  // A drill sizes its own deck, so make room for whatever length it picked.
  const cardCounts = CARD_COUNTS.includes(config.cardCount)
    ? CARD_COUNTS
    : [...CARD_COUNTS, config.cardCount].sort((a, b) => a - b);
  // Three real cards from the current settings, so the effect of a tick is
  // visible without starting a race.
  const sample = buildDeck(config, 7)
    .slice(0, 3)
    .map((card) => card.prompt);

  const ascending = (list: number[]) => [...list].sort((a, b) => a - b);

  const limitSeconds = config.timeLimitMs ? config.timeLimitMs / 1000 : null;
  // Show exactly what's being typed while the field has focus; otherwise show
  // the stored value, which is always on the quarter-second grid.
  const limitShown =
    limitDraft ?? (limitSeconds === null ? "" : String(limitSeconds));

  function setLimit(ms: number | null) {
    setLimitDraft(null);
    patch({ timeLimitMs: ms === null ? null : snapTimeLimit(ms) });
  }

  /** Nudges the clock a step, starting from the age default if it's off. */
  function bumpLimit(stepMs: number) {
    sfx.tap();
    setLimit((config.timeLimitMs ?? timeLimitForAge(profile!.age)) + stepMs);
  }

  /**
   * Unticking a table also drops that number from the right-hand grid, so
   * "I unticked 12" means no 12 appears on any card — which is what the grid
   * looks like it promises.
   */
  function toggleTable(n: number) {
    sfx.tap();
    setConfig((current) => {
      if (!current.tables.includes(n)) {
        return { ...current, tables: ascending([...current.tables, n]) };
      }
      const tables = current.tables.filter((t) => t !== n);
      if (tables.length === 0) return current;
      const others = current.others.filter((o) => o !== n);
      return {
        ...current,
        tables,
        others: others.length === 0 ? current.others : others,
      };
    });
  }

  function toggleOther(n: number) {
    sfx.tap();
    setConfig((current) => {
      const has = current.others.includes(n);
      const others = has
        ? current.others.filter((o) => o !== n)
        : [...current.others, n];
      return {
        ...current,
        others: others.length === 0 ? current.others : ascending(others),
      };
    });
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
        <PresetRow
          currentKey={key}
          onChoose={(next) => {
            sfx.tap();
            setConfig(next);
          }}
        />

        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Fine tune</h2>
            <span className="chip">
              {spec.symbol} {spec.label}
            </span>
          </div>

          <div className="control">
            <span className="control__label">Operation</span>
            <div className="segmented">
              {OPERATION_ORDER.map((op) => (
                <Button
                  key={op}
                  variant="bare"
                  className={`segmented__btn${config.operation === op ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    // Division can't pair with 0, so drop it when switching.
                    const next = OPERATIONS[op as Operation];
                    patch({
                      operation: op,
                      others: config.others.filter((n) => n >= next.minOther),
                    });
                  }}
                  pressed={config.operation === op}
                >
                  <span aria-hidden="true">{OPERATIONS[op].symbol}</span>
                  <span className="segmented__word">
                    {OPERATIONS[op].label}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          <DeckPicker
            config={config}
            spec={spec}
            focusNumbers={TABLE_NUMBERS}
            pairNumbers={otherNumbers}
            sample={sample}
            onToggleFocus={toggleTable}
            onTogglePair={toggleOther}
            patch={patch}
            tap={sfx.tap}
          />

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
                    patch({ cardCount: count });
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
                patch({ timeLimitMs: null });
                return;
              }
              const typed = Number(text);
              if (Number.isFinite(typed))
                patch({ timeLimitMs: snapTimeLimit(typed * 1000) });
            }}
            onDraftEnd={() => setLimitDraft(null)}
          />

          <div className="control">
            <span className="control__label">Answering</span>
            <div className="segmented">
              {(
                [
                  ["type", "Type it", "Keypad or keyboard"],
                  ["choose", "Tap one", "Four choices"],
                ] as Array<[InputMode, string, string]>
              ).map(([mode, label, hint]) => (
                <Button
                  key={mode}
                  variant="bare"
                  className={`segmented__btn segmented__btn--stack${config.inputMode === mode ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    patch({ inputMode: mode });
                  }}
                  pressed={config.inputMode === mode}
                >
                  <span className="segmented__word">{label}</span>
                  <span className="segmented__hint">{hint}</span>
                </Button>
              ))}
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
