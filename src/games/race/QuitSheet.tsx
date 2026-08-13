import { Button, Scrim } from "@/components/ui/kit";

/**
 * Confirmation before abandoning a run.
 *
 * While this is up the race clock is paused — see `useRaceClock`. Backing out
 * neither costs the player time nor buys them any.
 */
export function QuitSheet({
  onQuit,
  onKeepRacing,
}: {
  onQuit: () => void;
  onKeepRacing: () => void;
}) {
  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="Quit the race"
    >
      <Scrim onClose={onKeepRacing} label="Keep racing" />
      <div className="sheet__panel panel anim-pop">
        <h2 className="panel__title">Quit this race?</h2>
        <p className="muted">It won&apos;t be saved and no XP is earned.</p>
        <div className="sheet__actions">
          <Button variant="danger" size="sm" onClick={onQuit}>
            Quit
          </Button>
          <Button variant="accent" onClick={onKeepRacing}>
            Keep racing
          </Button>
        </div>
      </div>
    </div>
  );
}
