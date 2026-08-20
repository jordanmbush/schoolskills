import { Button, Scrim } from "@/components/ui/kit";

/**
 * Confirmation before abandoning a run.
 *
 * While this is up the run's clock is paused — `useRaceClock` for a race,
 * `useStormClock`'s `paused` for a hailstorm. Backing out neither costs the
 * player time nor buys them any, and in the storm's case it also disarms the
 * gun, which is what leaves `Space` and `Enter` free to press the two buttons
 * below.
 *
 * ── Three words are the caller's ─────────────────────────────────────────────
 * The sheet itself is the same in every game — the same pause, the same
 * warning, the same pair of buttons — and only the noun changes. That is worth
 * a prop rather than a second component: "Keep racing" over a hailstorm is a
 * sentence about a screen the child is not on, and a copy of this file to fix
 * it would be a second place for "it won't be saved" to stop being true.
 *
 * The body copy is not a prop, deliberately. "It won't be saved and no XP is
 * earned" is the same promise everywhere it is shown, and it is the one thing
 * on this sheet a child is being asked to weigh.
 */
export function QuitSheet({
  onQuit,
  onKeepRacing,
  title = "Quit this race?",
  keep = "Keep racing",
  label = "Quit the race",
}: {
  onQuit: () => void;
  onKeepRacing: () => void;
  /** The question, as a heading. */
  title?: string;
  /** The way back into the run — the button label and the scrim's name. */
  keep?: string;
  /** The dialog's own accessible name. */
  label?: string;
}) {
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label}>
      <Scrim onClose={onKeepRacing} label={keep} />
      <div className="modal__panel panel anim-pop">
        <h2 className="panel__title">{title}</h2>
        <p className="muted">It won&apos;t be saved and no XP is earned.</p>
        <div className="modal__actions">
          <Button variant="danger" size="sm" onClick={onQuit}>
            Quit
          </Button>
          <Button variant="accent" onClick={onKeepRacing}>
            {keep}
          </Button>
        </div>
      </div>
    </div>
  );
}
