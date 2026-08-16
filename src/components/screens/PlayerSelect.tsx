import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHub } from "@/components/state/HubContext";
import { Avatar, Button, LevelRing } from "@/components/ui/kit";
import PlayerEditor from "@/components/PlayerEditor";
import BackupPanel from "@/components/BackupPanel";
import { lifetimeStats, sessionsFor } from "@/engine/records";
import { levelFromXp } from "@/engine/progress";
import { percent } from "@/engine/format";
import { sfx } from "@/services/sound";
import type { Profile } from "@/engine/types";

export default function PlayerSelect() {
  const { profiles, sessions } = useHub();
  const navigate = useNavigate();
  const [editing, setEditing] = useState<Profile | null | undefined>(undefined);

  const totals = lifetimeStats(sessions);

  function enter(profile: Profile) {
    sfx.select();
    navigate(`/p/${profile.id}`);
  }

  return (
    <main className="select">
      {/*
        The way out. A real <a> rather than a router link: this leaves the
        island entirely and goes back to the site, which the HashRouter knows
        nothing about. It's the only exit from the entry screen — every screen
        past this one has the same door in its top bar.
      */}
      <a className="exit" href="/">
        <span aria-hidden="true">🗺</span> Back to the map
      </a>

      <header className="select__head">
        <p className="u-eyebrow">School Skills · saved on this device</p>
        <h1 className="u-display select__title">
          Who&apos;s
          <br />
          racing?
        </h1>
        {profiles.length > 0 && (
          <p className="select__totals u-mono">
            {profiles.length} players · {totals.races} races ·{" "}
            {totals.cards.toLocaleString()} cards answered
          </p>
        )}
      </header>

      {profiles.length === 0 ? (
        <div className="select__empty panel">
          <span className="select__empty-icon" aria-hidden="true">
            🏁
          </span>
          <h2 className="panel__title">Add the first player</h2>
          <p>
            Every player gets their own times, records and badges. Nothing
            leaves this device.
          </p>
          <Button variant="go" onClick={() => setEditing(null)}>
            Add a player
          </Button>
        </div>
      ) : (
        <ul className="select__grid">
          {profiles.map((profile, index) => {
            const mine = sessionsFor(sessions, profile.id);
            const stats = lifetimeStats(mine);
            return (
              <li
                key={profile.id}
                className="anim-rise"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div
                  className="driver"
                  style={
                    {
                      "--tint": profile.color,
                      "--lean": `${(index % 2 ? 1 : -1) * 0.7}deg`,
                    } as React.CSSProperties
                  }
                >
                  <Button
                    variant="bare"
                    className="driver__enter"
                    onClick={() => enter(profile)}
                  >
                    <span className="u-sr">Play as {profile.name}</span>
                  </Button>
                  <div className="driver__top">
                    <Avatar profile={profile} size="4.25rem" />
                    <LevelRing
                      {...levelFromXp(profile.xp)}
                      tint={profile.color}
                      size="3.4rem"
                    />
                  </div>
                  <p className="driver__name u-display">{profile.name}</p>
                  <dl className="driver__stats u-mono">
                    <div>
                      <dt>Races</dt>
                      <dd>{stats.races}</dd>
                    </div>
                    <div>
                      <dt>Cards</dt>
                      <dd>{stats.cards}</dd>
                    </div>
                    <div>
                      <dt>Right</dt>
                      <dd>
                        {stats.cards === 0 ? "—" : percent(stats.accuracy)}
                      </dd>
                    </div>
                  </dl>
                  <Button
                    variant="bare"
                    className="driver__edit"
                    onClick={() => setEditing(profile)}
                  >
                    Edit<span className="u-sr"> {profile.name}</span>
                  </Button>
                </div>
              </li>
            );
          })}
          <li
            className="anim-rise"
            style={{ animationDelay: `${profiles.length * 70}ms` }}
          >
            <Button
              variant="bare"
              className="driver driver--add"
              onClick={() => setEditing(null)}
            >
              <span className="driver__plus" aria-hidden="true">
                +
              </span>
              <span className="driver__name u-display">Add player</span>
            </Button>
          </li>
        </ul>
      )}

      {editing !== undefined && (
        <PlayerEditor profile={editing} onClose={() => setEditing(undefined)} />
      )}
      <BackupPanel />
    </main>
  );
}
