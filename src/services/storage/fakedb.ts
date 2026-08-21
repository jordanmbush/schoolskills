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
import { vi } from "vitest";

/**
 * A browser's IndexedDB, for the suites that have to write to one.
 *
 * Test-only, and never in a bundle — nothing outside a `.test.ts` imports it.
 * Not named `.test.ts` because it holds no tests, and vitest fails a test file
 * that defines none. It lives in `storage/` rather than beside the suites
 * because what it fakes is this directory's dependency: `db.ts` is the only
 * module allowed to open a database, so it is the only module that needs one
 * faked out from under it.
 *
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
export function freshIndexedDB(): void {
  globalThis.indexedDB = new IDBFactory();
}

/**
 * `db.ts` as the browser would load it on that device.
 *
 * The module registry is dropped first because `db.ts` memoises its connection
 * and exports no way to let go of it — which is right for the app, and means a
 * suite that reused the module could only ever see whatever database the first
 * case happened to open. Anything imported *after* this resolves binds to the
 * fresh copy, which is how a service above the store is exercised against it:
 * `freshIndexedDB(); await loadDb(); const profiles = await import("../profiles")`.
 */
export async function loadDb(): Promise<typeof import("./db")> {
  vi.resetModules();
  return import("./db");
}

/**
 * The database exactly as version 2 shipped it, and nothing in it.
 *
 * The schema is written out by hand rather than built by an older copy of
 * `db.ts`, because what an upgrade has to survive is what is *on disk* — not
 * what this build would have created. Version 2 is the shape every existing
 * browser is upgrading from, so it is also the stale tab: a connection at the
 * old version blocks the new one, and the caller decides when to let go.
 */
export async function openVersion2(): Promise<IDBPDatabase> {
  return openDB("schoolskills", 2, {
    upgrade(database) {
      database.createObjectStore("profiles", { keyPath: "id" });
      const sessions = database.createObjectStore("sessions", {
        keyPath: "id",
      });
      sessions.createIndex("byProfile", "profileId");
      database.createObjectStore("decks", { keyPath: "id" });
    },
  });
}
