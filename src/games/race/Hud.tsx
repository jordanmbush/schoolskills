import { Button } from "@/components/ui/kit";
import { WRONG_ANSWER_PENALTY_MS } from "@/engine/records";
import { clock } from "@/engine/format";

/** Quit, the running stopwatch with its wrong-answer penalty, and the count. */
export function Hud({
  elapsedMs,
  misses,
  answered,
  total,
  onQuit,
}: {
  elapsedMs: number;
  misses: number;
  answered: number;
  total: number;
  onQuit: () => void;
}) {
  return (
    <header className="race__hud">
      <Button variant="bare" className="race__quit" onClick={onQuit}>
        Quit
      </Button>

      <div className="race__clock u-mono">
        <span className="race__clock-time">{clock(elapsedMs)}</span>
        {misses > 0 && (
          <span className="race__penalty">
            +{(misses * WRONG_ANSWER_PENALTY_MS) / 1000}s
          </span>
        )}
      </div>

      <div className="race__count u-mono">
        <span className="race__count-now">{Math.min(answered + 1, total)}</span>
        <span className="race__count-of">/ {total}</span>
      </div>
    </header>
  );
}
