import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import {
  homeMode,
  ownsMode,
  useSubject,
} from "@/components/state/SubjectContext";
import TopBar from "@/components/TopBar";
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
import { WORD_LISTS_BY_ID, listWords } from "@/engine/decks/wordlists";
import { practiceSheet } from "@/engine/sheets/practice";
import { WORLDS } from "@/engine/worlds";
import { sfx } from "@/services/sound";
import { DeckSwitch, type DeckChoice } from "./progress/DeckSwitch";
import { FactMap } from "./progress/FactMap";
import { WordMap } from "./progress/WordMap";
import { RecordBook, RunList } from "./progress/RecordBook";
import { TroubleSpots } from "./progress/TroubleSpots";
import { duration, percent } from "@/engine/format";

export default function Progress() {
  const { profileId } = useParams();
  const { profiles, sessions } = useHub();
  const profile = usePlayer(profileId);
  const subject = useSubject();
  const navigate = useNavigate();

  const mine = useMemo(
    () => (profile ? sessionsFor(sessions, profile.id) : []),
    [sessions, profile],
  );

  // Opens on this app's own deck. The record book still covers everything the
  // player has ever raced — it is their book, not this world's — but the panel
  // you land on should be the one you came in through.
  const [mode, setMode] = useState<string>(() =>
    homeMode(
      subject,
      mine.map((s) => s.mode),
      profile?.age ?? 8,
    ),
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

  /**
   * Best time per configuration, with whoever in the house holds it.
   *
   * A configuration with no ranked run of mine gets no row at all. That is not
   * an empty group — I have run it — it is a group of runs that may not hold a
   * record, which today means Hailstorm: a storm ends when the shield does, so
   * ranking it on time would put the child who died first at the top of both
   * columns (`isRanked`, docs/typing.md §8.7). Those runs are still in the
   * history below; they just set nothing. Once `myBest` exists the house best
   * does too, because mine is one of the runs it is chosen from.
   */
  const records = useMemo(() => {
    if (!profile) return [];
    const keys = [...new Set(mine.map((s) => s.configKey))];
    return keys
      .map((key) => {
        const myBest = bestRun(sessionsFor(sessions, profile.id, key));
        if (!myBest) return null;
        const houseBest = bestRun(sessions.filter((s) => s.configKey === key))!;
        const holder = profiles.find((p) => p.id === houseBest.profileId);
        return { key, myBest, houseBest, holder };
      })
      .filter((row) => row !== null)
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
  /** Undefined for a typing level, and for a list a parent has since deleted. */
  const shippedList = isTypingMode
    ? undefined
    : WORD_LISTS_BY_ID.get(listIdOf(mode));
  const spec = deckSpec(mode);
  /** Which world this deck is played in — and so where a drill of it starts. */
  const owner = WORLDS.find((w) => w.id === spec.world);
  /**
   * The same facts as a worksheet, or null where this build has no sheet for
   * them — a typing passage is not a page of problems (docs/printables.md
   * §14).
   */
  const printable = practiceSheet(
    mode,
    trouble.map((fact) => fact.factId),
  );
  /**
   * Race the same facts, where this app is the one they are played in. Built
   * here beside `switcher` rather than inline in the panel below, because both
   * are a piece of behaviour the screen hands down rather than markup.
   */
  const drill = ownsMode(subject, mode)
    ? () => {
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
      }
    : null;
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
          // A shipped spelling list in full; for a typing level or a deleted
          // list, whatever of it survives in this player's own history.
          words={shippedList ? listWords(shippedList) : [...grid.keys()].sort()}
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

      <TroubleSpots
        trouble={trouble}
        spec={spec}
        drill={drill}
        elsewhere={owner}
        printable={printable}
      />

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
