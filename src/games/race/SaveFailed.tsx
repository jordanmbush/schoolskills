import { Button } from "@/components/ui/kit";

/**
 * The run finished but couldn't be written to IndexedDB — a full disk, a
 * browser refusing storage in private mode, a revoked quota.
 *
 * Retrying is the primary action because the answers are still in memory:
 * nothing is lost until the player navigates away, which is why the other
 * button says so plainly rather than "Cancel".
 */
export function SaveFailed({
  message,
  onRetry,
  onDiscard,
}: {
  message: string;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  return (
    <main className="boot">
      <p className="u-eyebrow">Race finished</p>
      <h1 className="u-display boot__title">Couldn&apos;t save this race</h1>
      <p className="boot__msg">{message}</p>
      <p className="boot__hint">
        Your answers are still here. Try saving again — nothing is lost until
        you leave this screen.
      </p>
      <div className="boot__actions">
        <Button variant="go" onClick={onRetry}>
          Save again
        </Button>
        <Button variant="ghost" onClick={onDiscard}>
          Discard and go back
        </Button>
      </div>
    </main>
  );
}
