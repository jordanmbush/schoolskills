import { useCallback, useMemo } from "react";
import { count, deckLabel } from "@/services/analytics";
import { modeOf } from "@/engine/decks";
import type { CardConfig } from "@/engine/types";

/**
 * The two facts a race contributes to the counts, and nothing else.
 *
 * Kept apart from the race loop so that everything this site measures about
 * gameplay is one short file someone can read in full. The loop calls
 * `started` and `ended`; what those turn into is decided here and constrained
 * by the `Beacon` union in src/services/analytics.ts.
 *
 * The deck label is resolved once, through `deckLabel`, which collapses a
 * parent's own deck to the string "custom" — a household's generated deck id
 * appearing in an access log week after week would be a tracking identifier
 * whatever we called it.
 */
export function useRaceCount(config: CardConfig) {
  const deck = useMemo(() => deckLabel(modeOf(config)), [config]);
  const input = config.inputMode;

  return {
    /**
     * Called on the 3·2·1, not on mount: a setup screen someone opened and
     * backed out of is not a race, and counting it would quietly inflate every
     * completion rate derived from these two events.
     */
    started: useCallback(
      () => count({ event: "race_start", deck, input }),
      [deck, input],
    ),
    ended: useCallback(
      (outcome: "finished" | "quit") =>
        count({ event: "race_end", deck, outcome }),
      [deck],
    ),
  };
}
