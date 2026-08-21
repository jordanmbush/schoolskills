import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useHub, usePlayer } from "@/components/state/HubContext";
import { homeMode, useSubject } from "@/components/state/SubjectContext";
import TopBar from "@/components/TopBar";
import { Button, Stat } from "@/components/ui/kit";
import {
  bestRun,
  lifetimeStats,
  raceTimeMs,
  sessionsFor,
  troubleFacts,
} from "@/engine/records";
import { timeLimitForAge } from "@/engine/decks/flashcards";
import { buildDrill, describeConfig } from "@/engine/decks";
import { clock, percent, plural, shortDate } from "@/engine/format";
import { BADGES_BY_ID } from "@/engine/progress";
import { WORLDS } from "@/engine/worlds";
import { sfx } from "@/services/sound";

/**
 * A player's home on the card island: what they have done, and the way into
 * the next race.
 *
 * Subject-agnostic on purpose. The eyebrow, the title and the blurb all come
 * from `useSubject()`, so this one screen is The Grid at `/flash-cards` and
 * Word Jungle at `/spelling/play`, and nothing in it names a deck family.
 *
 * The typing island has no equivalent: with one game there is nothing to
 * choose between, so `/typing#/p/:id` is its setup screen instead.
 */
export default function PlayerHub() {
  const { profileId } = useParams();
  const { sessions } = useHub();
  const profile = usePlayer(profileId);
  const subject = useSubject();
  const navigate = useNavigate();

  if (!profile) return <Navigate to="/" replace />;

  const mine = sessionsFor(sessions, profile.id);
  const stats = lifetimeStats(mine);
  // `loadHub` sorts sessions oldest-first and every write appends to the end,
  // so the newest four are a reverse and a slice rather than a sort.
  const recent = [...mine].reverse().slice(0, 4);
  const flagship = bestRun(mine);
  // A badge id outlives the table it was earned from: `Profile.badges` is the
  // only copy there is, so an id this build no longer ships simply doesn't
  // resolve (`engine/progress.ts`). Dropping the miss is what keeps an older
  // profile rendering at all — and is why the `!`s below are safe.
  const badges = profile.badges
    .map((id) => BADGES_BY_ID.get(id))
    .filter(Boolean);
  // The deck this app opens on — whichever of its own the player raced last.
  // The hub only ever offers to drill a deck it can actually run: a spelling
  // trouble list belongs to Word Jungle, and the record book is where you go
  // to see across both.
  const drillMode = homeMode(
    subject,
    mine.map((s) => s.mode),
    profile.age,
  );
  // Six at most, and the button below is offered from three up. `buildDrill`
  // runs two passes at each fact and never builds fewer than six cards, so a
  // shorter list would only come round again.
  const trouble = troubleFacts(mine, drillMode, 6);
  // Everywhere else you could be. The world you're standing in isn't offered.
  const elsewhere = WORLDS.filter((w) => w.id !== subject.world);

  return (
    <main className="hub">
      <TopBar profile={profile}>
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

      <section className="hub__hero anim-rise">
        <div className="hub__hero-copy">
          <p className="u-eyebrow">{subject.eyebrow}</p>
          <h1 className="u-display hub__title">
            {subject.title[0]}
            <br />
            {subject.title[1]}
          </h1>
          <p className="hub__blurb">{subject.blurb}</p>
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
                      drillMode,
                      {
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
            <span className="u-eyebrow">Everywhere counts</span> Badges, XP and
            your level are yours, not this world&apos;s — spelling and typing
            earn them the same way, and the record book covers all three.
          </p>
        </section>
      </div>
    </main>
  );
}
