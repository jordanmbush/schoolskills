import { useCallback, useEffect, useRef } from "react";
import { sfx } from "@/services/sound";

/**
 * Where the rival is, and how far ahead or behind that puts the player.
 *
 * A ghost is a previous run replayed as split times, so "their position" is
 * just how many of those splits the current elapsed time has passed. The
 * overtake sound fires on the transition from behind to ahead, not on the
 * state — which is why the previous side is remembered here rather than
 * recomputed.
 *
 * `maxDeficitMs` is the furthest behind the player ever fell. It's a badge
 * input, so it has to survive the whole run even though nothing renders it.
 */
export function useGhostGap({
  splits,
  raceElapsed,
  index,
  total,
}: {
  /** Cumulative finish time per card for the ghost, or null with no rival. */
  splits: number[] | null;
  raceElapsed: number;
  index: number;
  total: number;
}) {
  const maxDeficit = useRef(0);
  const wasBehind = useRef(false);

  const cardsDone = splits ? splits.filter((t) => t <= raceElapsed).length : 0;
  const checkpoint = splits ? splits[Math.min(index, splits.length - 1)] : null;
  const gap = checkpoint === null ? null : raceElapsed - checkpoint;

  useEffect(() => {
    if (gap === null) return;
    maxDeficit.current = Math.max(maxDeficit.current, gap);
    const behind = gap > 0;
    if (wasBehind.current && !behind) sfx.overtake();
    wasBehind.current = behind;
  }, [gap]);

  return {
    gap,
    position: splits ? Math.min(cardsDone / total, 1) : null,
    /** Stable, so callers that must not re-render can hold onto it. */
    maxDeficitMs: useCallback(() => maxDeficit.current, []),
  };
}
