import { useCallback, useRef, useState } from "react";
import { levelFromXp } from "@/engine/progress";
import { summariseRun, type RunTally } from "@/engine/run";
import { sfx } from "@/services/sound";
import type { useHub } from "@/components/state/HubContext";
import type { useRace } from "@/components/state/RaceContext";
import type { useNavigate } from "react-router-dom";
import type { Ghost, Profile, RaceConfig, Session } from "@/engine/types";

/**
 * The end of a run: score it, write it, and hand off to the results screen.
 *
 * Separate from the race loop because it fails differently. Everything before
 * this point is in memory and can't really go wrong; this step talks to
 * IndexedDB, which can refuse — a full disk, private browsing, a revoked
 * quota. When it does, the answers are still here, so the failure is
 * recoverable and `retry` is the whole point of holding the error in state
 * rather than throwing it away.
 *
 * The scoring itself lives in `@/engine/run` — no React, no storage, just the
 * rules for what a run was worth.
 */
export function useRaceFinish({
  profile,
  config,
  seed,
  ghost,
  history,
  previousBest,
  readTally,
  saveSession,
  finish,
  notify,
  navigate,
  resultsPath,
  onSaving,
  fanfare = sfx.finish,
}: {
  profile: Profile;
  config: RaceConfig;
  seed: number;
  ghost: Ghost | null;
  history: Session[];
  previousBest: Session | null;
  /** Read at save time so the loop can keep counting into plain refs. */
  readTally: () => RunTally;
  saveSession: ReturnType<typeof useHub>["saveSession"];
  finish: ReturnType<typeof useRace>["finish"];
  notify: ReturnType<typeof useHub>["notify"];
  navigate: ReturnType<typeof useNavigate>;
  /** Where the finished run is shown. Each game has its own results screen. */
  resultsPath: string;
  onSaving: () => void;
  /**
   * What a finished run sounds like. `sfx.finish` unless a game says
   * otherwise, which is every race: reaching the end of a deck is good news
   * whatever the time on the clock.
   *
   * Hailstorm is the one that says otherwise, because it is the one run that
   * can end by being LOST — a wave gets through the shield and the storm
   * stops there. A major triad over a broken shield is the game congratulating
   * a child for dying, so the storm passes a fanfare that does nothing and
   * announces its own ending from the frame that stamped it, where the
   * difference between clearing the wave and being breached is still in hand
   * (`stormSounds.ts`).
   *
   * It is here and not at the call site of `complete()` because this hook owns
   * the once-per-run guard: a sound played beside a call that may be refused
   * is a sound that can play twice.
   */
  fanfare?: () => void;
}) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const finishing = useRef(false);

  async function save() {
    const summary = summariseRun({
      profile,
      config,
      seed,
      ghost,
      history,
      previousBest,
      tally: readTally(),
    });

    try {
      const saved = await saveSession({
        ...summary.draft,
        earnedBadges: summary.earnedBadges,
      });
      const levelBefore = levelFromXp(profile.xp).level;
      const levelAfter = levelFromXp(saved.profile.xp).level;
      finish({
        session: saved.session,
        profileAfter: saved.profile,
        ghost,
        personalRecord: summary.personalRecord,
        previousBest,
        newBadges: summary.newBadges,
        bonuses: summary.bonuses,
        levelledUpTo: levelAfter > levelBefore ? levelAfter : null,
      });
      navigate(resultsPath, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not save this race";
      setSaveError(message);
      notify(message, "bad");
    }
  }

  return {
    saveError,
    /** Called once, when the last card lands. Guards against a double finish. */
    async complete() {
      if (finishing.current) return;
      finishing.current = true;
      onSaving();
      fanfare();
      await save();
    },
    retry() {
      setSaveError(null);
      void save();
    },
    /**
     * Stable, so the answer handler can check it without losing the identity
     * the per-card timer depends on. True once the run has been handed off —
     * a late keystroke must not record another card.
     */
    hasFinished: useCallback(() => finishing.current, []),
  };
}
