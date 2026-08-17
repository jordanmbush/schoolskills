import {
  IDBCursor,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBRequest,
  IDBTransaction,
} from "fake-indexeddb";
import { openDB, type IDBPDatabase } from "idb";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "@/engine/sheets/paper";
import type { SavedSheet } from "@/engine/sheets/types";
import type { CustomDeck, Profile, Session } from "@/engine/types";

/**
 * The store itself, against a fake IndexedDB.
 *
 * The one file in the suite that opens a database, and it exists because this
 * layer holds the only copy of a child's record book there is. An upgrade that
 * dropped a store, an index that came back missing, or a backup that restored
 * three of four collections cannot be caught by reading the diff — the failure
 * is in what the browser did with the data, not in what the code says.
 *
 * `fake-indexeddb` rather than the browser suite: the interesting case is a
 * database that already has data in it *at the old version*, which means
 * building version 2 by hand before the app ever opens it. There is no way to
 * arrange that from a page that has already booted.
 *
 * Every case starts from a brand-new `IDBFactory` and a fresh module registry,
 * because `db.ts` memoises its connection and exports no way to drop it — which
 * is right for the app and means a test that reused it could only ever see
 * whatever version the first case happened to open.
 */

const profile: Profile = {
  id: "kid-1",
  name: "Ada",
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
  soundOn: true,
  xp: 340,
  badges: ["first-race"],
  createdAt: "2026-03-01T09:00:00.000Z",
};

const session: Session = {
  id: "run-1",
  profileId: "kid-1",
  game: "flashcards",
  mode: "multiply",
  configKey: "multiply|7|1-12|20|type",
  config: {
    operation: "multiply",
    tables: [7],
    others: [1, 2, 3],
    cardCount: 20,
    inputMode: "type",
  },
  seed: 42,
  finishedAt: "2026-03-02T09:00:00.000Z",
  durationMs: 41_000,
  correct: 19,
  incorrect: 1,
  bestStreak: 12,
  xpEarned: 55,
  ghostSessionId: null,
  beatGhost: null,
  cards: [
    {
      prompt: "7 × 8",
      answer: "56",
      given: "56",
      ok: true,
      ms: 1900,
      factId: "7:8",
    },
  ],
};

const deck: CustomDeck = {
  id: "custom-abc",
  name: "Week 4 spellings",
  emoji: "📝",
  words: ["because", "thought"],
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

const sheet: SavedSheet = {
  id: "sheet-abc",
  name: "Monday handwriting",
  config: {
    kind: "paper",
    paper: DEFAULT_PAPER,
    fontPt: DEFAULT_FONT_PT,
    fields: ["name", "date"],
    rule: { style: "hand-5-8" },
  },
  seed: 12,
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

const EXPORTED_AT = "2026-03-03T09:00:00.000Z";

/**
 * Node has no IndexedDB at all, so the whole family goes on the global object
 * rather than only the factory: `idb` unwraps what a request hands back by
 * asking `instanceof IDBDatabase`, `instanceof IDBCursor` and so on, and a fake
 * factory whose results fail every one of those checks is worse than none.
 */
Object.assign(globalThis, {
  IDBCursor,
  IDBDatabase,
  IDBFactory,
  IDBIndex,
  IDBKeyRange,
  IDBObjectStore,
  IDBRequest,
  IDBTransaction,
});

/** A device nobody has ever run School Skills on. */
function freshIndexedDB(): void {
  globalThis.indexedDB = new IDBFactory();
}

/** `db.ts` as the browser would load it on that device. */
async function loadDb() {
  vi.resetModules();
  return import("./db");
}

/**
 * The database exactly as version 2 shipped it, with a kid's data already in
 * it — written by hand rather than by an older copy of `db.ts`, because the
 * point is to upgrade *from what is on disk*, not from what this build would
 * have created. The connection is left open for the caller to close: a tab
 * that never lets go is one of the cases below.
 */
async function seedVersion2(): Promise<IDBPDatabase> {
  const old = await openDB("schoolskills", 2, {
    upgrade(database) {
      database.createObjectStore("profiles", { keyPath: "id" });
      const sessions = database.createObjectStore("sessions", {
        keyPath: "id",
      });
      sessions.createIndex("byProfile", "profileId");
      database.createObjectStore("decks", { keyPath: "id" });
    },
  });
  await old.put("profiles", profile);
  await old.put("sessions", session);
  await old.put("decks", deck);
  return old;
}

describe("upgrading to version 3", () => {
  it("adds the sheets store and leaves everything else exactly as it was", async () => {
    freshIndexedDB();
    (await seedVersion2()).close();

    const db = await loadDb();

    // Byte-identical, all three. An upgrade block that recreated a store would
    // pass a type check and silently empty somebody's record book.
    expect(await db.allProfiles()).toEqual([profile]);
    expect(await db.allSessions()).toEqual([session]);
    expect(await db.allDecks()).toEqual([deck]);

    // The new store is there and has nothing in it.
    expect(await db.allSheets()).toEqual([]);

    // And `sessions` kept its index. Losing it is the quiet failure: every read
    // above still works, and profile deletion and the ghost list stop.
    const raw = await openDB("schoolskills", 3);
    expect(await raw.getAllFromIndex("sessions", "byProfile", "kid-1")).toEqual(
      [session],
    );
    raw.close();
  });

  it("tells a parent to close the other tab instead of hanging on it", async () => {
    freshIndexedDB();
    // A tab opened before this deploy: version 2, and no `blocking` handler,
    // because the build it is running was written before there was anything to
    // block. The upgrade cannot start while it is there.
    const stale = await seedVersion2();

    const db = await loadDb();
    await expect(db.allProfiles()).rejects.toThrow(/another tab/i);

    // And once it does go, the boot screen's retry actually retries — the
    // failure was not memoised.
    stale.close();
    expect(await db.allProfiles()).toEqual([profile]);
  });
});

describe("backing up and restoring", () => {
  it("carries every store to a new device and back", async () => {
    freshIndexedDB();
    const source = await loadDb();
    await source.putProfile(profile);
    await source.putSession(session);
    await source.putDeck(deck);
    await source.putSheet(sheet);

    const backup = await source.exportAll();
    expect(backup.version).toBe(3);
    expect(backup.sheets).toEqual([sheet]);

    // The new laptop: a fresh database, and the file is all it has.
    freshIndexedDB();
    const moved = await loadDb();
    expect(await moved.importAll(backup)).toEqual({
      profiles: 1,
      sessions: 1,
      decks: 1,
      sheets: 1,
    });
    expect(await moved.allProfiles()).toEqual([profile]);
    expect(await moved.allSessions()).toEqual([session]);
    expect(await moved.allDecks()).toEqual([deck]);
    expect(await moved.allSheets()).toEqual([sheet]);
  });

  it("restores a file written before decks and before sheets existed", async () => {
    freshIndexedDB();
    const db = await loadDb();

    // A backup a parent has been keeping since before either store arrived
    // still has to restore — it may be the only copy left.
    expect(
      await db.importAll({
        version: 1,
        exportedAt: EXPORTED_AT,
        profiles: [profile],
        sessions: [session],
      }),
    ).toEqual({ profiles: 1, sessions: 1, decks: 0, sheets: 0 });
    expect(await db.allProfiles()).toEqual([profile]);
    expect(await db.allSheets()).toEqual([]);

    expect(
      await db.importAll({
        version: 2,
        exportedAt: EXPORTED_AT,
        profiles: [profile],
        decks: [deck],
        sessions: [session],
      }),
    ).toEqual({ profiles: 1, sessions: 1, decks: 1, sheets: 0 });
    expect(await db.allDecks()).toEqual([deck]);
  });

  it("wipes the sheets too when a restore says replace", async () => {
    freshIndexedDB();
    const db = await loadDb();
    await db.putSheet(sheet);
    await db.putDeck(deck);

    // "This device is wrong, make it match the file" has to mean every store,
    // or a restore reports that it replaced everything and quietly keeps the
    // old copy of whichever one was forgotten.
    await db.importAll(
      {
        version: 3,
        exportedAt: EXPORTED_AT,
        profiles: [profile],
        sessions: [],
      },
      "replace",
    );
    expect(await db.allSheets()).toEqual([]);
    expect(await db.allDecks()).toEqual([]);
    expect(await db.allProfiles()).toEqual([profile]);
  });
});

describe("what the sheet service writes", () => {
  it("gives a saved sheet an id that cannot collide with a deck's", async () => {
    // The writing half of `services/sheets.ts`, exercised here rather than in
    // its own suite because this is the file that owns a fake IndexedDB. It is
    // imported after the reset so it binds to the same fresh `db.ts`.
    freshIndexedDB();
    await loadDb();
    const sheets = await import("../sheets");

    const saved = await sheets.create({
      name: "Monday handwriting",
      config: sheet.config,
      seed: 12,
    });
    expect(saved.id.startsWith("sheet-")).toBe(true);
    expect(await sheets.all()).toEqual([saved]);
  });
});
