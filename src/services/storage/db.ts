import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { readSession, readSessions } from "@/engine/migrate";
import type { SavedInventory } from "@/engine/sheets/phonics";
import type { SavedSheet } from "@/engine/sheets/types";
import type {
  CustomDeck,
  LegacySession,
  Profile,
  Session,
} from "@/engine/types";

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
/**
 * 2 added `decks` — parent-authored word lists.
 * 3 added `sheets` — worksheets a parent configured in the print shop.
 * 4 added `inventories` — the sounds a parent has taught, for phonics sheets.
 */
const DB_VERSION = 4;

/** Oldest sessions past this count are dropped so a profile stays fast to load. */
export const MAX_SESSIONS_PER_PROFILE = 2000;

interface HubDB extends DBSchema {
  profiles: { key: string; value: Profile };
  decks: { key: string; value: CustomDeck };
  /**
   * Keyed by id and nothing else — no `byProfile` index to match the one on
   * `sessions`, because a saved sheet has no profile to be indexed by. A
   * worksheet belongs to the household rather than to a child; see `SavedSheet`
   * for why that is the shape rather than an oversight.
   */
  sheets: { key: string; value: SavedSheet };
  /**
   * Keyed by id and nothing else, for the reason `sheets` is: a phonics
   * programme belongs to the household rather than to a child. See
   * `services/phonics.ts` for why it is a store rather than a field of a sheet.
   */
  inventories: { key: string; value: SavedInventory };
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

/**
 * What a parent is told when another tab is holding the old version open.
 *
 * The one storage failure with an instruction attached, which is why it is a
 * sentence rather than a code: every screen renders `err.message` straight out
 * of the hub's error state, so this is the whole of what somebody sees.
 */
const BLOCKED_MSG =
  "School Skills is open in another tab from before this update. Close the other tabs, then reload this page.";

function db() {
  // Opened lazily and memoised: the island is `client:only`, but a stray import
  // from a build-time script must not try to open IndexedDB in Node.
  handle ??= open().catch((err: unknown) => {
    // A failure is never memoised. The commonest one is a stale tab, which the
    // parent fixes by closing it — and the retry button on the boot screen has
    // to be able to actually retry rather than re-await the same dead promise.
    handle = null;
    throw err;
  });
  return handle;
}

/**
 * Opens the database, refusing to hang when another tab blocks the upgrade.
 *
 * A version bump cannot start while a connection to the older version is still
 * open somewhere, and `openDB`'s promise simply never settles while that is
 * true — so without the race below every service read awaits `db()` forever and
 * the app sits on its loading state with nothing to say. The epic's own premise
 * is a parent in the print shop with a kid's game open in another tab, so this
 * is reachable rather than theoretical.
 */
function open(): Promise<IDBPDatabase<HubDB>> {
  let stall: (reason: Error) => void = () => {};
  const stalled = new Promise<never>((_, reject) => {
    stall = reject;
  });

  const opening = openDB<HubDB>(DB_NAME, DB_VERSION, {
    // Each version's block is additive and guarded by the version it arrived
    // in, so a browser two versions behind runs both and a fresh one runs both
    // in order. Nothing here ever rewrites or drops existing data — this is
    // the only copy of a child's record book that exists anywhere.
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        database.createObjectStore("profiles", { keyPath: "id" });
        const sessions = database.createObjectStore("sessions", {
          keyPath: "id",
        });
        sessions.createIndex("byProfile", "profileId");
      }
      if (oldVersion < 2) {
        database.createObjectStore("decks", { keyPath: "id" });
      }
      if (oldVersion < 3) {
        database.createObjectStore("sheets", { keyPath: "id" });
      }
      if (oldVersion < 4) {
        database.createObjectStore("inventories", { keyPath: "id" });
      }
    },
    // We are the tab asking for the new version and somebody else won't let go.
    blocked() {
      stall(new Error(BLOCKED_MSG));
    },
    // The mirror image: we are the old tab, and another one wants to upgrade.
    // Letting go is the only way that upgrade ever runs. The handle is dropped
    // before the close so this tab's next read opens a fresh connection at
    // whatever version is current by then, rather than being handed back the
    // one we just closed.
    blocking() {
      const stale = handle;
      handle = null;
      void stale?.then((database) => database.close()).catch(() => {});
    },
  });

  return Promise.race([opening, stalled]).catch((err: unknown) => {
    // The open we walked away from can still succeed later, once the other tab
    // goes. Close it rather than strand a connection nobody holds a reference
    // to — that one would block the *next* version bump exactly as this one was
    // blocked, and there would be no tab to close to clear it.
    void opening.then((database) => database.close()).catch(() => {});
    throw err;
  });
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

export async function allDecks(): Promise<CustomDeck[]> {
  return (await db()).getAll("decks");
}

export async function putDeck(deck: CustomDeck): Promise<void> {
  await (await db()).put("decks", deck);
}

/**
 * Removes a deck but NOT the races played on it. Those stay in the record
 * book keyed by their own mode, which `deckSpec` still resolves — deleting a
 * list a child has been practising must not delete the practice.
 */
export async function removeDeck(id: string): Promise<void> {
  await (await db()).delete("decks", id);
}

export async function allSheets(): Promise<SavedSheet[]> {
  return (await db()).getAll("sheets");
}

export async function putSheet(sheet: SavedSheet): Promise<void> {
  await (await db()).put("sheets", sheet);
}

export async function removeSheet(id: string): Promise<void> {
  await (await db()).delete("sheets", id);
}

export async function allInventories(): Promise<SavedInventory[]> {
  return (await db()).getAll("inventories");
}

export async function putInventory(saved: SavedInventory): Promise<void> {
  await (await db()).put("inventories", saved);
}

export async function removeInventory(id: string): Promise<void> {
  await (await db()).delete("inventories", id);
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

/**
 * Every store a backup covers, written once.
 *
 * The transaction and the `replace` wipe both read it, so a store added to one
 * can't be missing from the other — which would be a restore that says it
 * replaced everything and quietly kept the old copy of whatever was forgotten.
 */
const BACKUP_STORES = [
  "profiles",
  "sessions",
  "decks",
  "sheets",
  "inventories",
] as const;

export type Backup = {
  /**
   * 2 added `decks`, 3 added `sheets`, 4 added `inventories`. Files at any of
   * the four restore.
   */
  version: 1 | 2 | 3 | 4;
  exportedAt: string;
  profiles: Profile[];
  decks?: CustomDeck[];
  /**
   * Optional for the same reason `decks` is: a file written before the print
   * shop existed simply has none, and a backup a parent has been keeping since
   * the spring must not stop restoring because a later version added a store.
   */
  sheets?: SavedSheet[];
  /** Optional for the same reason, and for one release longer. */
  inventories?: SavedInventory[];
  /**
   * Written current, read wide. A file exported today holds widened cards, but
   * one exported last week — or produced by `scripts/convert-legacy-hub.mjs`
   * — does not, and restoring an old backup is the whole point of having one.
   */
  sessions: Array<LegacySession | Session>;
};

export async function exportAll(): Promise<Backup> {
  const [profiles, sessions, decks, sheets, inventories] = await Promise.all([
    allProfiles(),
    allSessions(),
    allDecks(),
    allSheets(),
    allInventories(),
  ]);
  return {
    version: 4,
    exportedAt: new Date().toISOString(),
    profiles,
    decks,
    sheets,
    inventories,
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
): Promise<{
  profiles: number;
  sessions: number;
  decks: number;
  sheets: number;
  inventories: number;
}> {
  const database = await db();
  const tx = database.transaction(BACKUP_STORES, "readwrite");
  if (mode === "replace") {
    await Promise.all(BACKUP_STORES.map((s) => tx.objectStore(s).clear()));
  }
  await Promise.all([
    ...backup.profiles.map((p) => tx.objectStore("profiles").put(p)),
    // Absent from a version 1 file, which is fine — there were none.
    ...(backup.decks ?? []).map((d) => tx.objectStore("decks").put(d)),
    // Likewise absent from anything written before version 3. Restored as
    // they were saved and not re-validated: the sheet service refuses a family
    // this build doesn't have, and a backup is the one place that would be the
    // wrong answer — a file is the only copy there is, so a sheet whose family
    // was retired has to come back rather than be dropped on the way in.
    ...(backup.sheets ?? []).map((s) => tx.objectStore("sheets").put(s)),
    // Likewise, and likewise not re-validated: a list of sounds a parent spent
    // a term ticking out is theirs to get back exactly as they left it.
    ...(backup.inventories ?? []).map((i) =>
      tx.objectStore("inventories").put(i),
    ),
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
    decks: backup.decks?.length ?? 0,
    sheets: backup.sheets?.length ?? 0,
    inventories: backup.inventories?.length ?? 0,
  };
}
