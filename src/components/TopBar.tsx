import { Link } from "react-router-dom";
import { Avatar, Button } from "@/components/ui/kit";
import { levelFromXp } from "@/engine/progress";
import { useHub } from "@/components/state/HubContext";
import { setSoundEnabled } from "@/services/sound";
import type { Profile } from "@/engine/types";

type Props = {
  profile: Profile;
  back?: { to: string; label: string };
  children?: React.ReactNode;
};

export default function TopBar({
  profile,
  back = { to: "/", label: "Players" },
  children,
}: Props) {
  const { updateProfile, notify } = useHub();
  const { level, intoLevel, levelSpan, progress } = levelFromXp(profile.xp);
  const soundOn = profile.soundOn !== false;

  async function toggleSound() {
    const next = !soundOn;
    setSoundEnabled(next);
    try {
      await updateProfile(profile.id, { soundOn: next });
    } catch {
      setSoundEnabled(soundOn);
      notify("Could not save the sound setting", "bad");
    }
  }

  return (
    <header className="topbar">
      <Link className="topbar__back" to={back.to}>
        <span aria-hidden="true">←</span> {back.label}
      </Link>

      <div className="topbar__player">
        <Avatar profile={profile} size="2.6rem" />
        <div className="topbar__meta">
          <p className="topbar__name u-display">{profile.name}</p>
          <div
            className="topbar__xp"
            title={`${intoLevel} / ${levelSpan} XP to level ${level + 1}`}
          >
            <span className="topbar__level u-mono">LV {level}</span>
            <span className="topbar__bar">
              <span
                className="topbar__fill"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </span>
            <span className="topbar__xpnum u-mono">
              {profile.xp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>

      <div className="topbar__actions">
        {children}
        {/*
          The way out of the island. A real <a>, not a router <Link> — "/" here
          means the site's map page, which the HashRouter doesn't own. Sits with
          the sound toggle because it's the same kind of control: chrome, not
          part of the game.
        */}
        <a className="topbar__icon" href="/" title="Back to the map">
          <span aria-hidden="true">🗺</span>
          <span className="u-sr">Leave the game, back to the map</span>
        </a>
        <Button
          variant="bare"
          className="topbar__icon"
          onClick={() => void toggleSound()}
          pressed={soundOn}
          title={soundOn ? "Turn sound off" : "Turn sound on"}
        >
          <span aria-hidden="true">{soundOn ? "🔊" : "🔇"}</span>
          <span className="u-sr">Sound {soundOn ? "on" : "off"}</span>
        </Button>
      </div>
    </header>
  );
}
