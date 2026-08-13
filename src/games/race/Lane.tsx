import type { Ghost, Profile } from "@/engine/types";
import { delta as formatDelta } from "@/engine/format";

/* ── The signature element: a rally split against a ghost ──────────────── */

export function Lane({
  profile,
  ghost,
  mePos,
  ghostPos,
  gap,
  note,
}: {
  profile: Profile;
  ghost: Ghost | null;
  mePos: number;
  ghostPos: number | null;
  gap: number | null;
  note: string;
}) {
  const ahead = gap !== null && gap < 0;
  return (
    <div className="lane">
      <div className="lane__track">
        <span className="lane__finish" aria-hidden="true">
          🏁
        </span>
        {ghostPos !== null && ghost && (
          <span
            className="lane__puck lane__puck--ghost"
            style={
              {
                "--p": ghostPos,
                "--tint": ghost.profile.color,
              } as React.CSSProperties
            }
            title={ghost.isSelf ? "Your best run" : ghost.profile.name}
          >
            {ghost.profile.emoji}
          </span>
        )}
        <span
          className="lane__puck lane__puck--me"
          style={
            {
              "--p": mePos,
              "--tint": profile.color,
            } as React.CSSProperties
          }
        >
          {profile.emoji}
        </span>
      </div>

      {gap === null ? (
        <p className="lane__note u-mono">{note}</p>
      ) : (
        <p
          className={`lane__gap u-mono${ahead ? " is-ahead" : " is-behind"}`}
          aria-live="off"
        >
          <span className="lane__gap-num">{formatDelta(gap)}</span>
          <span className="lane__gap-word">{ahead ? "ahead" : "behind"}</span>
        </p>
      )}
    </div>
  );
}
