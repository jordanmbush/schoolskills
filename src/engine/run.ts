import { compareRuns } from "./records";
import { evaluateBadges, finishBonuses } from "./progress";
import { configKey } from "./decks/flashcards";
import type { CardResult, FlashConfig, Ghost, Profile, Session } from "./types";

/**
 * Turning a finished race into the record of it.
 *
 * This was inline in RaceTrack, which made a component the authority on what
 * a run is worth — scoring, personal records, bonuses and badges all decided
 * in the middle of a render tree. None of it needs React, a browser, or
 * storage: it's the same class of rule as `compareRuns` and belongs with it.
 *
 * Everything here is derived. Nothing is written; the caller hands the draft
 * to the session service, which owns persistence.
 */

/** What the race loop counted while it was running. */
export type RunTally = {
  cards: CardResult[];
  /** XP from the cards themselves, before finish bonuses. */
  cardXp: number;
  bestStreak: number;
  /** Furthest behind the ghost the player ever fell, in ms. */
  maxDeficitMs: number;
};

export type RunSummary = {
  /** Ready for the session service; add nothing but `earnedBadges`. */
  draft: Omit<Session, "id" | "finishedAt">;
  earnedBadges: string[];
  /** Badges the player didn't already hold — what the results screen crows about. */
  newBadges: string[];
  bonuses: ReturnType<typeof finishBonuses>;
  personalRecord: boolean;
  /** null when there was no ghost to race. */
  beatGhost: boolean | null;
};

export function summariseRun({
  profile,
  config,
  seed,
  ghost,
  history,
  previousBest,
  tally,
}: {
  profile: Profile;
  config: FlashConfig;
  seed: number;
  ghost: Ghost | null;
  /** The player's earlier runs, snapshotted before this one existed. */
  history: Session[];
  /** Their best at these exact settings, or null if this is the first. */
  previousBest: Session | null;
  tally: RunTally;
}): RunSummary {
  const cards = tally.cards;
  const correct = cards.filter((c) => c.ok).length;
  const incorrect = cards.length - correct;
  const durationMs = cards.reduce((sum, c) => sum + c.ms, 0);

  // Timed runs are ranked on cards beaten before time, untimed ones on the
  // clock — `compareRuns` owns that rule so the record book and the results
  // screen can never disagree about what "better" means.
  const scored = { durationMs, correct, incorrect, config };
  const personalRecord =
    previousBest !== null && compareRuns(scored, previousBest) < 0;
  const beatGhost = ghost ? compareRuns(scored, ghost.session) < 0 : null;

  const bonuses = finishBonuses({
    perfect: incorrect === 0 && correct > 0,
    personalRecord,
    beatGhost: beatGhost === true,
    cardCount: cards.length,
  });
  const xpEarned = tally.cardXp + bonuses.reduce((sum, b) => sum + b.xp, 0);

  const draft = {
    profileId: profile.id,
    game: "flashcards" as const,
    mode: config.operation,
    configKey: configKey(config),
    config,
    seed,
    durationMs,
    correct,
    incorrect,
    bestStreak: tally.bestStreak,
    xpEarned,
    ghostSessionId: ghost?.session.id ?? null,
    beatGhost,
    cards,
  };

  const earnedBadges = evaluateBadges({
    session: draft,
    history,
    personalRecord,
    maxDeficitMs: tally.maxDeficitMs,
    xpAfter: profile.xp + xpEarned,
  });

  return {
    draft,
    earnedBadges,
    newBadges: earnedBadges.filter((id) => !profile.badges.includes(id)),
    bonuses,
    personalRecord,
    beatGhost,
  };
}
