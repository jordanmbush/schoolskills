import type { Profile, Session } from "@/engine/types";

import * as store from "./storage/db";
import { InvalidInput } from "./profiles";

/**
 * Recording a finished run.
 *
 * This is the one write that touches two records at once — the session itself,
 * plus the XP and badges it earned on the profile — which is why it goes
 * through `commitRun`'s single transaction rather than two puts.
 */

export type SessionDraft = Omit<Session, "id" | "finishedAt"> & {
  earnedBadges: string[];
};

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export async function record(
  draft: SessionDraft,
): Promise<{ session: Session; profile: Profile }> {
  const profile = (await store.allProfiles()).find(
    (p) => p.id === draft.profileId,
  );
  if (!profile) throw new InvalidInput("That player no longer exists");

  const { earnedBadges, ...rest } = draft;
  const session: Session = {
    ...rest,
    id: nextId("s"),
    finishedAt: new Date().toISOString(),
    durationMs: Math.round(rest.durationMs),
    // Cap the stored card list the way the server did. A malformed deck
    // shouldn't be able to grow one record without bound.
    cards: rest.cards.slice(0, 500),
  };

  const updated: Profile = {
    ...profile,
    xp: (profile.xp ?? 0) + session.xpEarned,
    badges: [...new Set([...(profile.badges ?? []), ...earnedBadges])],
  };

  await store.commitRun(session, updated);
  // Trimming after the fact rather than inside the commit: it's housekeeping,
  // and a failure here must not cost the player the run they just finished.
  void store.trimSessions(profile.id);

  return { session, profile: updated };
}
