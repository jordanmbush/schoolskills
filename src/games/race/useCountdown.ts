import { useEffect, useState } from "react";
import { sfx } from "@/services/sound";

/** "GO" holds for less time than a number — it's a starting gun, not a beat. */
const NUMBER_MS = 680;
const GO_MS = 420;

/**
 * The 3 · 2 · 1 · GO before a race starts.
 *
 * Each step schedules the next rather than running off an interval, so the
 * sound and the digit can never drift apart, and unmounting mid-countdown
 * leaves nothing pending.
 */
export function useCountdown({
  active,
  from = 3,
  onGo,
}: {
  active: boolean;
  from?: number;
  /** Must be stable — it's a dependency of the timer below. */
  onGo: () => void;
}) {
  const [count, setCount] = useState(from);

  useEffect(() => {
    if (!active) return;
    sfx.countdown(count);
    const timer = window.setTimeout(
      () => {
        if (count === 0) onGo();
        else setCount((n) => n - 1);
      },
      count === 0 ? GO_MS : NUMBER_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, count, onGo]);

  return count;
}
