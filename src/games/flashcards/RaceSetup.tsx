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
import { Avatar } from "@/components/ui/kit";
import {
  OPERATIONS,
  OPERATION_ORDER,
  PRESETS,
  TIME_LIMITS,
  TIME_MAX_MS,
  TIME_MIN_MS,
  TIME_STEP_MS,
  buildDeck,
  configKey,
  presetForAge,
  snapTimeLimit,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { accuracyOf, ghostsFor, raceTimeMs } from "@/engine/records";
import { clock, percent, shortDate } from "@/engine/format";
import { randomSeed } from "@/engine/random";
import { sfx } from "@/services/sound";
import type { FlashConfig, Ghost, InputMode, Operation } from "@/engine/types";

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
  const drill = config.facts?.length ? config.facts : null;
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
        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Pick a race</h2>
          </div>
          <div className="preset-row">
            {PRESETS.map((preset) => {
              const chosen = configKey(preset.config) === key;
              return (
                <button
                  key={preset.id}
                  className={`preset${chosen ? " is-chosen" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    setConfig(preset.config);
                  }}
                  aria-pressed={chosen}
                >
                  <span className="preset__emoji" aria-hidden="true">
                    {preset.emoji}
                  </span>
                  <span className="preset__name u-display">{preset.name}</span>
                  <span className="preset__tag">{preset.tagline}</span>
                </button>
              );
            })}
          </div>
        </section>

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
                <button
                  key={op}
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
                  aria-pressed={config.operation === op}
                >
                  <span aria-hidden="true">{OPERATIONS[op].symbol}</span>
                  <span className="segmented__word">
                    {OPERATIONS[op].label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {drill ? (
            <div className="control">
              <span className="control__label">Practice set</span>
              <p className="drill__lead">
                The {drill.length} facts you&apos;ve been missing most. Answer
                each one twice.
              </p>
              <ul className="factchips">
                {drill.map(([a, b]) => (
                  <li key={`${a}:${b}`} className="factchip u-mono">
                    {a} {spec.symbol} {b}
                  </li>
                ))}
              </ul>
              <div className="control__row">
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    sfx.tap();
                    patch({ facts: undefined });
                  }}
                >
                  Pick numbers instead
                </button>
              </div>
            </div>
          ) : (
            <div className="control">
              <div className="numbers">
                <div className="numbers__side">
                  <span className="control__label">{spec.focusLabel}</span>
                  <div className="tablegrid">
                    {TABLE_NUMBERS.map((n) => (
                      <button
                        key={n}
                        className={`tablegrid__cell u-mono${config.tables.includes(n) ? " is-on" : ""}`}
                        onClick={() => toggleTable(n)}
                        aria-pressed={config.tables.includes(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="control__row">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => patch({ tables: TABLE_NUMBERS })}
                    >
                      All
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => patch({ tables: [2, 5, 10] })}
                    >
                      Easy three
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => patch({ tables: [6, 7, 8, 9] })}
                    >
                      Tricky four
                    </button>
                  </div>
                </div>

                <div className="numbers__side">
                  <span className="control__label">{spec.pairLabel}</span>
                  <div className="tablegrid">
                    {otherNumbers.map((n) => (
                      <button
                        key={n}
                        className={`tablegrid__cell u-mono${config.others.includes(n) ? " is-on" : ""}`}
                        onClick={() => toggleOther(n)}
                        aria-pressed={config.others.includes(n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="control__row">
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => patch({ others: otherNumbers })}
                    >
                      All
                    </button>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => patch({ others: [...config.tables] })}
                    >
                      Match tables
                    </button>
                  </div>
                </div>
              </div>
              <p className="numbers__note">
                Cards only ever use numbers lit up on both sides. Unticking a
                number on the left removes it from the right too.
              </p>
              <p className="numbers__preview u-mono">
                e.g. {sample.join(" · ")}
              </p>
            </div>
          )}

          <div className="control">
            <span className="control__label">How many cards</span>
            <div className="segmented">
              {cardCounts.map((count) => (
                <button
                  key={count}
                  className={`segmented__btn u-mono${config.cardCount === count ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    patch({ cardCount: count });
                  }}
                  aria-pressed={config.cardCount === count}
                >
                  {count}
                </button>
              ))}
            </div>
          </div>

          <div className="control">
            <span className="control__label">Time per card</span>
            <div className="segmented">
              {TIME_LIMITS.map(({ ms, label }) => {
                const on = (config.timeLimitMs ?? null) === ms;
                return (
                  <button
                    key={label}
                    className={`segmented__btn u-mono${on ? " is-on" : ""}`}
                    onClick={() => {
                      sfx.tap();
                      setLimit(ms);
                    }}
                    aria-pressed={on}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="timelimit">
              <button
                className="timelimit__step u-mono"
                onClick={() => bumpLimit(-TIME_STEP_MS)}
                aria-label="Quarter of a second less"
              >
                −
              </button>
              <span className="timelimit__field">
                <input
                  className="timelimit__input u-mono"
                  type="number"
                  inputMode="decimal"
                  step={TIME_STEP_MS / 1000}
                  min={TIME_MIN_MS / 1000}
                  max={TIME_MAX_MS / 1000}
                  value={limitShown}
                  placeholder="off"
                  aria-label="Seconds per card"
                  onChange={(event) => {
                    const text = event.target.value;
                    setLimitDraft(text);
                    if (text.trim() === "") {
                      patch({ timeLimitMs: null });
                      return;
                    }
                    const typed = Number(text);
                    if (Number.isFinite(typed))
                      patch({ timeLimitMs: snapTimeLimit(typed * 1000) });
                  }}
                  onBlur={() => setLimitDraft(null)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
                <span className="timelimit__unit u-mono">s</span>
              </span>
              <button
                className="timelimit__step u-mono"
                onClick={() => bumpLimit(TIME_STEP_MS)}
                aria-label="Quarter of a second more"
              >
                +
              </button>
              <span className="timelimit__hint">
                Or set it exactly — quarter-second steps, down to{" "}
                {TIME_MIN_MS / 1000}s. Clear the box for no clock.
              </span>
            </div>

            <p className="numbers__note">
              {config.timeLimitMs
                ? "Run out of time and the answer is shown, then the next card comes up. Anything you miss lands on your practice list."
                : "No card clock. The whole race is timed instead — take as long as you need on any one card."}
            </p>
          </div>

          <div className="control">
            <span className="control__label">Answering</span>
            <div className="segmented">
              {(
                [
                  ["type", "Type it", "Keypad or keyboard"],
                  ["choose", "Tap one", "Four choices"],
                ] as Array<[InputMode, string, string]>
              ).map(([mode, label, hint]) => (
                <button
                  key={mode}
                  className={`segmented__btn segmented__btn--stack${config.inputMode === mode ? " is-on" : ""}`}
                  onClick={() => {
                    sfx.tap();
                    patch({ inputMode: mode });
                  }}
                  aria-pressed={config.inputMode === mode}
                >
                  <span className="segmented__word">{label}</span>
                  <span className="segmented__hint">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="panel anim-rise setup__rivals">
          <div className="panel__head">
            <h2 className="panel__title">Who are you racing?</h2>
          </div>
          <p className="muted setup__rival-note">
            Only runs with these exact settings show up here — same cards, same
            order, fair race.
          </p>

          <ul className="rivals">
            <li>
              <button
                className={`rival${rivalId === null ? " is-chosen" : ""}`}
                onClick={() => {
                  sfx.tap();
                  setRivalId(null);
                }}
                aria-pressed={rivalId === null}
              >
                <span className="rival__icon" aria-hidden="true">
                  🕐
                </span>
                <span className="rival__body">
                  <span className="rival__name u-display">Just the clock</span>
                  <span className="rival__meta">
                    No ghost — set a time to beat
                  </span>
                </span>
              </button>
            </li>
            {rivals.map((ghost: Ghost) => (
              <li key={ghost.session.id}>
                <button
                  className={`rival${rivalId === ghost.session.id ? " is-chosen" : ""}`}
                  style={
                    { "--tint": ghost.profile.color } as React.CSSProperties
                  }
                  onClick={() => {
                    sfx.tap();
                    setRivalId(ghost.session.id);
                  }}
                  aria-pressed={rivalId === ghost.session.id}
                >
                  <Avatar profile={ghost.profile} size="2.4rem" />
                  <span className="rival__body">
                    <span className="rival__name u-display">
                      {ghost.isSelf ? "Your best" : ghost.profile.name}
                    </span>
                    <span className="rival__meta u-mono">
                      {clock(raceTimeMs(ghost.session))} ·{" "}
                      {percent(accuracyOf(ghost.session))} ·{" "}
                      {shortDate(ghost.session.finishedAt)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button className="btn btn--go setup__go" onClick={launch}>
            Start race
          </button>
        </section>
      </div>
    </main>
  );
}
