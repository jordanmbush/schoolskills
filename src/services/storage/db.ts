import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { readSession, readSessions } from "@/engine/migrate";
import type { LegacySession, Profile, Session } from "@/engine/types";

/**
 * The only module in the codebase allowed to touch browser storage.
 *
 * It replaces the Express + JSON-file store the local-only version used. The
 * shape is deliberately the same — profiles and sessions as two flat
 * collections — so the engine and the screens didn't have to change when the
 * backend went away.
 *
 * IndexedDB rather than localStorage, for two reasons that both bite in
 * practice: a session carries its full card-by-card history (30 cards × a few
 * hundred runs per kid), which runs at localStorage's ~5 MB ceiling sooner
 * than you'd guess; and localStorage is synchronous, so a big read blocks the
 * frame that the race loop is trying to render at 60fps.
 */

const DB_NAME = "schoolskills";
const DB_VERSION = 1;

/** Oldest sessions past this count are dropped so a profile stays fast to load. */
export const MAX_SESSIONS_PER_PROFILE = 2000;

interface HubDB extends DBSchema {
  profiles: { key: string; value: Profile };
  sessions: {
    key: string;
    /**
     * Typed as the wider shape because that is honestly what's in there: runs
     * saved before the card widened are still on disk in their original form.
     * Reads go through `readSession`, which is where they become `Session`.
     */
    value: LegacySession;
    indexes: { byProfile: string };
  };
}

let handle: Promise<IDBPDatabase<HubDB>> | null = null;

function db() {
  // Opened lazily and memoised: the island is `client:only`, but a stray import
  // from a build-time script must not try to open IndexedDB in Node.
  handle ??= openDB<HubDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      database.createObjectStore("profiles", { keyPath: "id" });
      const sessions = database.createObjectStore("sessions", {
        keyPath: "id",
      });
      sessions.createIndex("byProfile", "profileId");
    },
  });
  return handle;
}

/**
 * Ask the browser not to evict this origin's storage under pressure.
 *
 * Chrome grants it silently based on engagement; Firefox prompts; Safari
 * effectively ignores it and applies ITP's 7-day cap regardless, which is why
 * the install-to-Home-Screen path matters on iOS. Never throws — losing the
 * request is not worth failing a page load over, and the answer is advisory.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function allProfiles(): Promise<Profile[]> {
  return (await db()).getAll("profiles");
}

export async function allSessions(): Promise<Session[]> {
  return readSessions(await (await db()).getAll("sessions"));
}

export async function putProfile(profile: Profile): Promise<void> {
  await (await db()).put("profiles", profile);
}

export async function putSession(session: Session): Promise<void> {
  await (await db()).put("sessions", session);
}

/**
 * Removes a profile and everything it owns in ONE transaction. Two separate
 * writes could leave sessions orphaned against a profile id that no longer
 * resolves, and every screen that groups by profile would then render a ghost.
 */
export async function removeProfileCascade(id: string): Promise<void> {
  const database = await db();
  const tx = database.transaction(["profiles", "sessions"], "readwrite");
  const owned = await tx
    .objectStore("sessions")
    .index("byProfile")
    .getAllKeys(id);
  await Promise.all([
    tx.objectStore("profiles").delete(id),
    ...owned.map((key) => tx.objectStore("sessions").delete(key)),
  ]);
  await tx.done;
}

/**
 * Writes a session and its profile's XP/badge update atomically. The old
 * server did both inside one file write; splitting them here would let a
 * crash bank the run but lose the XP it earned.
 */
export async function commitRun(
  session: Session,
  profile: Profile,
): Promise<void> {
  const database = await db();
  const tx = database.transaction(["profiles", "sessions"], "readwrite");
  await Promise.all([
    tx.objectStore("sessions").put(session),
    tx.objectStore("profiles").put(profile),
  ]);
  await tx.done;
}

/** Drops the oldest sessions for a profile beyond the cap. Returns how many went. */
export async function trimSessions(profileId: string): Promise<number> {
  const database = await db();
  const mine = await database.getAllFromIndex(
    "sessions",
    "byProfile",
    profileId,
  );
  if (mine.length <= MAX_SESSIONS_PER_PROFILE) return 0;
  const doomed = [...mine]
    .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt))
    .slice(0, mine.length - MAX_SESSIONS_PER_PROFILE);
  const tx = database.transaction("sessions", "readwrite");
  await Promise.all(doomed.map((s) => tx.store.delete(s.id)));
  await tx.done;
  return doomed.length;
}

export type Backup = {
  version: 1;
  exportedAt: string;
  profiles: Profile[];
  /**
   * Written current, read wide. A file exported today holds widened cards, but
   * one exported last week — or produced by `scripts/convert-legacy-hub.mjs`
   * — does not, and restoring an old backup is the whole point of having one.
   */
  sessions: Array<LegacySession | Session>;
};

export async function exportAll(): Promise<Backup> {
  const [profiles, sessions] = await Promise.all([
    allProfiles(),
    allSessions(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    profiles,
    sessions,
  };
}

/**
 * Restores a backup.
 *
 * `merge` keeps whatever is already here and adds what's missing, which is the
 * safe default for "I'm moving to a new laptop". `replace` wipes first, for
 * "this device is wrong, make it match the file". Ids are preserved either way
 * so a merged session still points at its profile.
 */
export async function importAll(
  backup: Backup,
  mode: "merge" | "replace" = "merge",
): Promise<{ profiles: number; sessions: number }> {
  const database = await db();
  const tx = database.transaction(["profiles", "sessions"], "readwrite");
  if (mode === "replace") {
    await Promise.all([
      tx.objectStore("profiles").clear(),
      tx.objectStore("sessions").clear(),
    ]);
  }
  await Promise.all([
    ...backup.profiles.map((p) => tx.objectStore("profiles").put(p)),
    // Widened on the way in, so a restored run is stored in the shape a fresh
    // one would be. Reads migrate anyway; this just stops the file's age from
    // outliving the import.
    ...backup.sessions.map((s) =>
      tx.objectStore("sessions").put(readSession(s)),
    ),
  ]);
  await tx.done;
  return {
    profiles: backup.profiles.length,
    sessions: backup.sessions.length,
  };
}
