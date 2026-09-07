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

/**
 * The chrome around a game: who is playing, how far along they are, and the
 * ways out.
 *
 * **It must never sit over a running race.** Every screen either side of one
 * has it — the hub, the setup screen, the results, the record book — and the
 * track itself puts `race/Hud` there instead: quit, clock, count, nothing
 * else. A map link or a sound toggle a thumb's width from the answer field is
 * a run thrown away by accident, and the single way out of a live run goes
 * through `QuitSheet`, which pauses the clock and says what abandoning it
 * costs. So don't mount this on a track, and don't add anything to it that
 * would be unsafe to press at any moment.
 *
 * `children` renders before the map and sound icons, which is what keeps those
 * two together at the end of the row on every screen while a screen adds its
 * own beside them.
 */
export default function TopBar({
  profile,
  back = { to: "/", label: "Players" },
  children,
}: Props) {
  const { updateProfile, notify } = useHub();
  const { level, intoLevel, levelSpan, progress } = levelFromXp(profile.xp);
  // Missing reads as on. The type says every profile carries `soundOn`, but a
  // backup is restored into the store whole, so that is a promise about the
  // records this build wrote rather than about every record in the store.
  const soundOn = profile.soundOn !== false;

  // The sound service is flipped before the write rather than after it: a
  // child taps the speaker because they want the next sound gone now, and
  // waiting on IndexedDB first would let one more through. A failed write puts
  // the service back, so what is heard on this page always matches what the
  // profile will say on the next one.
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
        <svg
          className="topbar__arrow"
          viewBox="0 0 24 24"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M19 12H6M12.5 5.5 6 12l6.5 6.5" />
        </svg>
        {back.label}
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
