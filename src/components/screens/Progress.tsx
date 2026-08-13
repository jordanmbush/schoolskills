import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import TopBar from "@/components/TopBar";
import { Button } from "@/components/ui/kit";
import { BADGES } from "@/engine/progress";
import {
  bestRun,
  factStats,
  lifetimeStats,
  masteryOf,
  raceTimeMs,
  sessionsFor,
  tableProgress,
  troubleFacts,
} from "@/engine/records";
import {
  OPERATIONS,
  OPERATION_ORDER,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { buildDrill, deckSpec } from "@/engine/decks";
import { WORD_MODE_PREFIX, listIdOf } from "@/engine/decks/words";
import { TYPING_MODE_PREFIX } from "@/engine/decks/typing";
import { WORD_LISTS_BY_ID } from "@/engine/decks/wordlists";
import { sfx } from "@/services/sound";
import { DeckSwitch, type DeckChoice } from "./progress/DeckSwitch";
import { FactMap } from "./progress/FactMap";
import { WordMap } from "./progress/WordMap";
import { RecordBook, RunList } from "./progress/RecordBook";
import { duration, percent } from "@/engine/format";

export default function Progress() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const navigate = useNavigate();
  const [mode, setMode] = useState<string>("multiply");

  const mine = useMemo(
    () => (profile ? sessionsFor(sessions, profile.id) : []),
    [sessions, profile],
  );
  const grid = useMemo(() => factStats(mine, mode), [mine, mode]);
  const tables = useMemo(() => tableProgress(grid), [grid]);
  const trouble = useMemo(() => troubleFacts(mine, mode), [mine, mode]);

  /**
   * The four operations always, plus any word list or typing level this
   * player has actually raced. An untouched list is an empty panel, and a
   * switcher offering every deck ever shipped would bury the four that matter.
   */
  const decks = useMemo<DeckChoice[]>(() => {
    const raced = [...new Set(mine.map((s) => s.mode))].sort();
    const extras = (prefix: string, kind: string) =>
      raced
        .filter((m) => m.startsWith(prefix))
        .map((m) => ({
          mode: m,
          short: deckSpec(m).label,
          title: `${deckSpec(m).label} — ${kind}`,
        }));
    return [
      ...OPERATION_ORDER.map((op) => ({
        mode: op as string,
        short: OPERATIONS[op].symbol,
        title: OPERATIONS[op].label,
      })),
      ...extras(WORD_MODE_PREFIX, "spelling"),
      ...extras(TYPING_MODE_PREFIX, "typing"),
    ];
  }, [mine]);

  /** Best time per configuration, with whoever in the house holds it. */
  const records = useMemo(() => {
    if (!profile) return [];
    const keys = [...new Set(mine.map((s) => s.configKey))];
    return keys
      .map((key) => {
        const myBest = bestRun(sessionsFor(sessions, profile.id, key))!;
        const houseBest = bestRun(sessions.filter((s) => s.configKey === key))!;
        const holder = profiles.find((p) => p.id === houseBest.profileId);
        return { key, myBest, houseBest, holder };
      })
      .sort((a, b) => raceTimeMs(a.myBest) - raceTimeMs(b.myBest));
  }, [mine, sessions, profiles, profile]);

  if (!profile) return <Navigate to="/" replace />;

  const stats = lifetimeStats(mine);
  const masteredCount = [...grid.keys()].filter(
    (k) => masteryOf(grid.get(k)) === "mastered",
  ).length;
  const isTypingMode = mode.startsWith(TYPING_MODE_PREFIX);
  // Both render as a list of words rather than a 12×12 grid.
  const isWords = mode.startsWith(WORD_MODE_PREFIX) || isTypingMode;
  const spec = deckSpec(mode);
  const switcher = (
    <DeckSwitch
      choices={decks}
      current={mode}
      onChoose={(next) => {
        sfx.tap();
        setMode(next);
      }}
    />
  );

  return (
    <main className="progress">
      <TopBar
        profile={profile}
        back={{ to: `/p/${profile.id}`, label: "Hub" }}
      />

      <section className="progress__head anim-rise">
        <p className="u-eyebrow">Progress</p>
        <h1 className="u-display progress__title">
          {profile.name}&apos;s record book
        </h1>
      </section>

      <section className="hub__strip panel anim-rise">
        <div className="stat">
          <span className="stat__value">{stats.races}</span>
          <span className="stat__label">Races</span>
        </div>
        <div className="stat">
          <span className="stat__value">{stats.cards.toLocaleString()}</span>
          <span className="stat__label">Cards</span>
        </div>
        <div className="stat">
          <span className="stat__value">
            {stats.cards === 0 ? "—" : percent(stats.accuracy)}
          </span>
          <span className="stat__label">Correct</span>
        </div>
        <div className="stat">
          <span className="stat__value">{masteredCount}</span>
          <span className="stat__label">Facts mastered</span>
        </div>
        <div className="stat">
          <span className="stat__value">{duration(stats.totalMs)}</span>
          <span className="stat__label">Time practising</span>
        </div>
      </section>

      {isWords ? (
        <WordMap
          label={spec.label}
          // The shipped list when it's still shipped; otherwise whatever of it
          // survives in this player's own history.
          words={
            // A shipped spelling list in full; for a typing level or a deleted
            // list, whatever of it survives in this player's own history.
            (!isTypingMode
              ? WORD_LISTS_BY_ID.get(listIdOf(mode))?.words
              : undefined) ?? [...grid.keys()].sort()
          }
          grid={grid}
          switcher={switcher}
        />
      ) : (
        <FactMap
          spec={OPERATIONS[mode as keyof typeof OPERATIONS]}
          grid={grid}
          switcher={switcher}
        />
      )}

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Trouble spots</h2>
          {trouble.length > 0 &&
            (isTypingMode ? (
              // The record book lives in this island; the typing game is
              // another one. Handing a built config across a page load would
              // need somewhere to put it, and a link to the game is worth more
              // than that machinery — the words are listed right below.
              <a className="btn btn--accent btn--sm" href="/typing">
                Open the typing game
              </a>
            ) : (
              <Button
                variant="accent"
                size="sm"
                onClick={() => {
                  sfx.select();
                  navigate(`/p/${profile.id}/race`, {
                    state: {
                      config: buildDrill(
                        trouble.map((fact) => fact.factId),
                        mode,
                        {
                          inputMode: profile.age <= 6 ? "choose" : "type",
                          timeLimitMs: timeLimitForAge(profile.age),
                        },
                      ),
                    },
                  });
                }}
              >
                Drill these
              </Button>
            ))}
        </div>
        {trouble.length === 0 ? (
          <p className="muted">
            Nothing standing out in {spec.label.toLowerCase()}. Facts land here
            when the clock beats them, when they come out wrong, or when they
            take longer than recall should.
          </p>
        ) : (
          <>
            <p className="muted">
              Worst first. Answering one quickly and correctly takes it back off
              the list.
            </p>
            <ul className="trouble">
              {trouble.map((fact) => (
                <li key={fact.factId} className="trouble__item">
                  <span className="trouble__fact u-mono">
                    {spec.factLabel(fact.factId)}
                  </span>
                  <span className="trouble__why">
                    {fact.timeouts > 0 && (
                      <span className="chip chip--late">
                        ⏳ {fact.timeouts} out of time
                      </span>
                    )}
                    {fact.wrong > 0 && (
                      <span className="chip chip--wrong">
                        ✕ {fact.wrong} wrong
                      </span>
                    )}
                    {fact.slow > 0 && (
                      <span className="chip">🐢 {fact.slow} slow</span>
                    )}
                  </span>
                  <span className="trouble__avg u-mono">
                    {(fact.avgMs / 1000).toFixed(1)}s
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <div className="progress__columns">
        {/* Times tables only — a spelling list has no twelve of anything. */}
        {!isWords && (
          <section className="panel anim-rise">
            <div className="panel__head">
              <h2 className="panel__title">Table trophies</h2>
              <span className="chip">
                {tables.filter((t) => t.complete).length} / 12
              </span>
            </div>
            <ul className="trophies">
              {tables.map((table) => (
                <li
                  key={table.table}
                  className={`trophy${table.complete ? " is-complete" : ""}`}
                  title={`${table.mastered} of ${table.total} facts mastered`}
                >
                  <span className="trophy__num u-display">{table.table}</span>
                  <span className="trophy__bar">
                    <span
                      className="trophy__fill"
                      style={{
                        width: `${(table.mastered / table.total) * 100}%`,
                      }}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Badges</h2>
            <span className="chip">
              {profile.badges.length} / {BADGES.length}
            </span>
          </div>
          <ul className="badgegrid">
            {BADGES.map((badge) => {
              const held = profile.badges.includes(badge.id);
              return (
                <li
                  key={badge.id}
                  className={`badge${held ? "" : " badge--locked"}`}
                >
                  <span className="badge__icon" aria-hidden="true">
                    {badge.icon}
                  </span>
                  <span>
                    <span className="badge__name">{badge.name}</span>
                    <span className="badge__how">{badge.how}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <RecordBook records={records} profileId={profile.id} />

      <RunList sessions={mine} />
    </main>
  );
}
