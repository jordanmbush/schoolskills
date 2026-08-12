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
  onSaving,
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
  onSaving: () => void;
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
      navigate(`/p/${profile.id}/race/results`, { replace: true });
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
      sfx.finish();
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
