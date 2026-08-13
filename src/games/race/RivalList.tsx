import { Avatar, Button } from "@/components/ui/kit";
import { accuracyOf, raceTimeMs } from "@/engine/records";
import { clock, percent, shortDate } from "@/engine/format";
import type { Ghost } from "@/engine/types";

/**
 * Who the player is racing.
 *
 * Only runs at the exact same settings appear, because a ghost is a replay of
 * a specific deck — racing one built from different cards wouldn't be a race.
 * That filtering happens upstream in `ghostsFor`; this only has to render what
 * survived it, and say why the list might be empty.
 */
export function RivalList({
  rivals,
  chosenId,
  onChoose,
  onStart,
}: {
  rivals: Ghost[];
  /** null means "just the clock" — no ghost. */
  chosenId: string | null;
  onChoose: (id: string | null) => void;
  onStart: () => void;
}) {
  return (
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
          <Button
            variant="bare"
            className={`rival${chosenId === null ? " is-chosen" : ""}`}
            onClick={() => onChoose(null)}
            pressed={chosenId === null}
          >
            <span className="rival__icon" aria-hidden="true">
              🕐
            </span>
            <span className="rival__body">
              <span className="rival__name u-display">Just the clock</span>
              <span className="rival__meta">No ghost — set a time to beat</span>
            </span>
          </Button>
        </li>
        {rivals.map((ghost) => (
          <li key={ghost.session.id}>
            <Button
              variant="bare"
              className={`rival${chosenId === ghost.session.id ? " is-chosen" : ""}`}
              style={{ "--tint": ghost.profile.color } as React.CSSProperties}
              onClick={() => onChoose(ghost.session.id)}
              pressed={chosenId === ghost.session.id}
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
            </Button>
          </li>
        ))}
      </ul>

      <Button variant="go" className="setup__go" onClick={onStart}>
        Start race
      </Button>
    </section>
  );
}
