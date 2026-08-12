import type { CustomDeck, Profile, Session } from "@/engine/types";

import * as deckService from "./decks";
import * as store from "./storage/db";

export type HubSnapshot = {
  profiles: Profile[];
  sessions: Session[];
  decks: CustomDeck[];
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
  const [profiles, sessions, decks] = await Promise.all([
    store.allProfiles(),
    store.allSessions(),
    // Goes through the service rather than the store: loading is also what
    // populates the engine's custom-list mirror, and that must happen before
    // anything tries to name or build a custom deck.
    deckService.all(),
  ]);
  return {
    profiles: profiles.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    sessions: sessions.sort((a, b) => a.finishedAt.localeCompare(b.finishedAt)),
    decks,
  };
}

export { exportAll, importAll, requestPersistence } from "./storage/db";
export type { Backup } from "./storage/db";
