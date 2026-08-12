import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import TopBar from "@/components/TopBar";
import { Avatar } from "@/components/ui/kit";
import { BADGES } from "@/engine/progress";
import {
  bestRun,
  factKey,
  factStats,
  lifetimeStats,
  masteryOf,
  raceTimeMs,
  sessionsFor,
  tableProgress,
  troubleFacts,
  type Mastery,
} from "@/engine/records";
import {
  OPERATIONS,
  OPERATION_ORDER,
  buildDrill,
  describeConfig,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { sfx } from "@/services/sound";
import { clock, duration, percent, shortDate } from "@/engine/format";
import type { Operation } from "@/engine/types";

const AXIS = Array.from({ length: 12 }, (_, i) => i + 1);

const MASTERY_LABEL: Record<Mastery, string> = {
  untried: "Not tried yet",
  learning: "Still learning",
  solid: "Getting there",
  mastered: "Mastered",
};

export default function Progress() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const navigate = useNavigate();
  const [operation, setOperation] = useState<Operation>("multiply");

  const mine = useMemo(
    () => (profile ? sessionsFor(sessions, profile.id) : []),
    [sessions, profile],
  );
  const grid = useMemo(() => factStats(mine, operation), [mine, operation]);
  const tables = useMemo(() => tableProgress(grid), [grid]);
  const trouble = useMemo(
    () => troubleFacts(mine, operation),
    [mine, operation],
  );

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
  const spec = OPERATIONS[operation];

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

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Fact map</h2>
          <div className="segmented segmented--slim">
            {OPERATION_ORDER.map((op) => (
              <button
                key={op}
                className={`segmented__btn${operation === op ? " is-on" : ""}`}
                onClick={() => setOperation(op)}
                aria-pressed={operation === op}
              >
                {OPERATIONS[op].symbol}
              </button>
            ))}
          </div>
        </div>
        <p className="muted">
          Every {spec.label.toLowerCase()} fact from 1 to 12. A square turns
          green once it&apos;s answered right three times running and under four
          seconds — that&apos;s recall, not counting.
        </p>

        <div className="factmap__wrap">
          <table className="factmap">
            <caption className="u-sr">{spec.label} facts by mastery</caption>
            <thead>
              <tr>
                <th scope="col" className="factmap__corner u-mono">
                  {spec.symbol}
                </th>
                {AXIS.map((n) => (
                  <th key={n} scope="col" className="u-mono factmap__axis">
                    {n}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AXIS.map((row) => (
                <tr key={row}>
                  <th scope="row" className="u-mono factmap__axis">
                    {row}
                  </th>
                  {AXIS.map((col) => {
                    const stat = grid.get(factKey(row, col));
                    const level = masteryOf(stat);
                    const avg = stat
                      ? stat.totalMs / stat.attempts / 1000
                      : null;
                    return (
                      <td key={col} className={`factmap__cell is-${level}`}>
                        <span className="u-sr">
                          {row} {spec.symbol} {col}: {MASTERY_LABEL[level]}
                        </span>
                        <span className="factmap__tip" aria-hidden="true">
                          {row} {spec.symbol} {col}
                          {stat
                            ? ` · ${stat.correct}/${stat.attempts} · ${avg!.toFixed(1)}s`
                            : " · not tried"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="legend">
          {(["untried", "learning", "solid", "mastered"] as Mastery[]).map(
            (level) => (
              <li key={level} className="legend__item">
                <span
                  className={`legend__swatch is-${level}`}
                  aria-hidden="true"
                />
                {MASTERY_LABEL[level]}
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Trouble spots</h2>
          {trouble.length > 0 && (
            <button
              className="btn btn--accent btn--sm"
              onClick={() => {
                sfx.select();
                navigate(`/p/${profile.id}/race`, {
                  state: {
                    config: buildDrill(
                      trouble.map((fact) => fact.facts),
                      {
                        operation,
                        inputMode: profile.age <= 6 ? "choose" : "type",
                        timeLimitMs: timeLimitForAge(profile.age),
                      },
                    ),
                  },
                });
              }}
            >
              Drill these
            </button>
          )}
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
                <li key={fact.key} className="trouble__item">
                  <span className="trouble__fact u-mono">
                    {fact.facts[0]} {spec.symbol} {fact.facts[1]}
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

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Records</h2>
        </div>
        {records.length === 0 ? (
          <p className="muted">Race something and your best times land here.</p>
        ) : (
          <div className="splits__scroll">
            <table className="splits">
              <thead>
                <tr>
                  <th scope="col">Race</th>
                  <th scope="col">Your best</th>
                  <th scope="col">House best</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const isMine = record.houseBest.profileId === profile.id;
                  return (
                    <tr key={record.key}>
                      <td className="splits__card">
                        {describeConfig(record.myBest.config)}
                      </td>
                      <td className="u-mono">
                        {clock(raceTimeMs(record.myBest))}
                      </td>
                      <td className="u-mono splits__holder">
                        {clock(raceTimeMs(record.houseBest))}
                        {record.holder && (
                          <span
                            className={`splits__who${isMine ? " is-ahead" : ""}`}
                          >
                            <Avatar profile={record.holder} size="1.1rem" />
                            {isMine ? "you" : record.holder.name}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel anim-rise">
        <div className="panel__head">
          <h2 className="panel__title">Every race</h2>
        </div>
        {mine.length === 0 ? (
          <p className="muted">No races yet.</p>
        ) : (
          <ul className="runlist">
            {[...mine]
              .reverse()
              .slice(0, 40)
              .map((session) => (
                <li key={session.id} className="runlist__row">
                  <span className="runlist__when u-mono">
                    {shortDate(session.finishedAt)}
                  </span>
                  <span className="runlist__what">
                    {describeConfig(session.config)}
                  </span>
                  <span className="runlist__acc u-mono">
                    {percent(
                      session.correct /
                        Math.max(1, session.correct + session.incorrect),
                    )}
                  </span>
                  <span className="runlist__time u-mono">
                    {clock(raceTimeMs(session))}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </main>
  );
}
