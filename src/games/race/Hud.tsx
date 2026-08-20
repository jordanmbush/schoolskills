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
  penalty = true,
}: {
  elapsedMs: number;
  misses: number;
  answered: number;
  total: number;
  onQuit: () => void;
  /**
   * Whether a wrong answer costs time, which is a thing about the run rather
   * than about this header. True in a race, and default because a race is what
   * this header was built for. False on a typing lesson: three seconds a miss
   * is a race mechanic, and on a lesson it double-counts accuracy — which has a
   * bar of its own there — and makes the wpm figure a lie, because the number
   * stops being words per minute of anything (docs/typing.md §7).
   *
   * The miss count still comes in, because it is still true; what changes is
   * whether it is charged for.
   */
  penalty?: boolean;
}) {
  return (
    <header className="race__hud">
      <Button variant="bare" className="race__quit" onClick={onQuit}>
        Quit
      </Button>

      <div className="race__clock u-mono">
        <span className="race__clock-time">{clock(elapsedMs)}</span>
        {penalty && misses > 0 && (
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
