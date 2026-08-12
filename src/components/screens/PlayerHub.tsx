import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import TopBar from "@/components/TopBar";
import { Button, Stat } from "@/components/ui/kit";
import {
  bestRun,
  lifetimeStats,
  raceTimeMs,
  sessionsFor,
  troubleFacts,
} from "@/engine/records";
import {
  buildDrill,
  describeConfig,
  timeLimitForAge,
} from "@/engine/decks/flashcards";
import { clock, percent, plural, shortDate } from "@/engine/format";
import { BADGES_BY_ID } from "@/engine/progress";
import { sfx } from "@/services/sound";

export default function PlayerHub() {
  const { profileId } = useParams();
  const { sessions } = useHub();
  const profile = usePlayer(profileId);
  const navigate = useNavigate();

  if (!profile) return <Navigate to="/" replace />;

  const mine = sessionsFor(sessions, profile.id);
  const stats = lifetimeStats(mine);
  const recent = [...mine].reverse().slice(0, 4);
  const flagship = bestRun(mine);
  const badges = profile.badges
    .map((id) => BADGES_BY_ID.get(id))
    .filter(Boolean);
  // Multiplication is the game's headline deck, so that's what the hub offers
  // to drill; the record book covers the other three.
  const trouble = troubleFacts(mine, "multiply", 6);

  return (
    <main className="hub">
      <TopBar profile={profile}>
        <Link
          className="topbar__icon"
          to={`/p/${profile.id}/progress`}
          title="Progress"
        >
          <span aria-hidden="true">📈</span>
          <span className="u-sr">Progress</span>
        </Link>
      </TopBar>

      <section className="hub__hero anim-rise">
        <div className="hub__hero-copy">
          <p className="u-eyebrow">Game 01 · Flash cards</p>
          <h1 className="u-display hub__title">
            Times
            <br />
            Trial
          </h1>
          <p className="hub__blurb">
            Race a deck of multiplication cards against the clock — or against a
            ghost of your best run, or one of your siblings&apos;.
          </p>
          <Button
            variant="go"
            className="hub__cta"
            onClick={() => {
              sfx.select();
              navigate(`/p/${profile.id}/race`);
            }}
          >
            Set up a race →
          </Button>
          {trouble.length >= 3 && (
            <Button
              variant="bare"
              className="hub__drill"
              onClick={() => {
                sfx.select();
                navigate(`/p/${profile.id}/race`, {
                  state: {
                    config: buildDrill(
                      trouble.map((fact) => fact.factId),
                      {
                        operation: "multiply",
                        inputMode: profile.age <= 6 ? "choose" : "type",
                        timeLimitMs: timeLimitForAge(profile.age),
                      },
                    ),
                  },
                });
              }}
            >
              or practise {plural(trouble.length, "fact")} you keep missing →
            </Button>
          )}
        </div>

        <div className="hub__hero-card">
          {flagship ? (
            <>
              <p className="u-eyebrow">Your best run</p>
              <p className="hub__besttime u-mono">
                {clock(raceTimeMs(flagship))}
              </p>
              <p className="hub__bestmeta">
                {describeConfig(flagship.config)} ·{" "}
                {percent(
                  flagship.correct / (flagship.correct + flagship.incorrect),
                )}{" "}
                right
              </p>
            </>
          ) : (
            <>
              <p className="u-eyebrow">No runs yet</p>
              <p className="hub__besttime u-mono">--.--</p>
              <p className="hub__bestmeta">
                Your first race sets the record to beat.
              </p>
            </>
          )}
        </div>
      </section>

      <section className="hub__strip panel anim-rise">
        <Stat value={stats.races} label="Races" />
        <Stat value={stats.cards.toLocaleString()} label="Cards" />
        <Stat
          value={stats.cards === 0 ? "—" : percent(stats.accuracy)}
          label="Correct"
        />
        <Stat value={stats.bestStreak} label="Best streak" />
        <Stat
          value={
            stats.fastestCardMs === null
              ? "—"
              : `${(stats.fastestCardMs / 1000).toFixed(2)}s`
          }
          label="Fastest card"
        />
      </section>

      <div className="hub__columns">
        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Recent races</h2>
            <Link
              className="btn btn--ghost btn--sm"
              to={`/p/${profile.id}/progress`}
            >
              All progress
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="muted">
              Nothing here yet. Run a race and it&apos;ll show up.
            </p>
          ) : (
            <ul className="runlist">
              {recent.map((session) => (
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

        <section className="panel anim-rise">
          <div className="panel__head">
            <h2 className="panel__title">Badges</h2>
            <span className="chip">{badges.length} earned</span>
          </div>
          {badges.length === 0 ? (
            <p className="muted">Finish a race to earn your first one.</p>
          ) : (
            <ul className="badgerow">
              {badges.slice(0, 8).map((badge) => (
                <li
                  key={badge!.id}
                  className="badgerow__item"
                  title={badge!.how}
                >
                  <span aria-hidden="true">{badge!.icon}</span>
                  <span className="u-sr">{badge!.name}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="hub__soon">
            <span className="u-eyebrow">Next up</span> Spelling lists and
            parent-made decks plug into this same race engine — not built yet.
          </p>
        </section>
      </div>
    </main>
  );
}
