import type { Profile, Session } from "@/engine/types";

import * as store from "./storage/db";

export type HubSnapshot = {
  profiles: Profile[];
  sessions: Session[];
};

/**
 * Everything the app needs at boot, in one call.
 *
 * The whole dataset is loaded up front rather than queried per screen, and
 * that's a deliberate choice rather than laziness: the record book computes
 * across every run a player has ever done (fact maps, trouble spots, house
 * bests), so a per-screen query would fetch most of it anyway. At the cap of
 * 2000 sessions per profile this is a few megabytes read once.
 */
export async function loadHub(): Promise<HubSnapshot> {
  const [profiles, sessions] = await Promise.all([
    store.allProfiles(),
    store.allSessions(),
  ]);
  return {
    profiles: profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    sessions: sessions.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)),
  };
}

export { exportAll, importAll, requestPersistence } from "./storage/db";
export type { Backup } from "./storage/db";
