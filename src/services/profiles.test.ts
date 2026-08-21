import { afterEach, describe, expect, it, vi } from "vitest";

import type { NewProfile } from "./profiles";
import { freshIndexedDB, loadDb } from "./storage/fakedb";

/**
 * Profile CRUD, against a real (fake) IndexedDB rather than a mocked store.
 *
 * The validation could be exercised as pure functions, but half of what this
 * service does is only true of the write: a name clash is a question about what
 * is already in the database, `update` reads the record back before patching
 * it, and deleting a player has to take their races with them. Mocking the
 * store would leave every one of those asserting against the mock.
 *
 * There is no server to defend, so none of this is a security boundary — it is
 * the one place a typo becomes a readable sentence instead of a corrupt record,
 * and the messages are asserted because a parent reads them.
 */

/** A player as the "add a player" form would hand them over. */
const ada: NewProfile = {
  name: "Ada",
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
};

// Only the persistence cases stub `navigator`, and a stub that outlived a
// failing one would silently answer for the rest of the file.
afterEach(() => vi.unstubAllGlobals());

/** The service and the store under it, on a device with nothing saved. */
async function fresh() {
  freshIndexedDB();
  const store = await loadDb();
  const profiles = await import("./profiles");
  return { profiles, store };
}

describe("creating a player", () => {
  it("writes a player who starts at nothing", async () => {
    const { profiles, store } = await fresh();

    const created = await profiles.create(ada);
    expect(created).toMatchObject({ name: "Ada", emoji: "🚀", age: 7 });
    // The starting state, which nothing else sets: a new player has no XP, no
    // badges and their sound on. A missing default here is a child who opens
    // the game to a silent screen or a level counter that never moves.
    expect(created).toMatchObject({ xp: 0, badges: [], soundOn: true });
    expect(created.id.startsWith("p_")).toBe(true);
    expect(Date.parse(created.createdAt)).not.toBeNaN();

    // Read back from storage rather than trusted from the return value — the
    // whole point of the service is that the record landed.
    expect(await store.allProfiles()).toEqual([created]);
  });

  it("trims what was typed", async () => {
    const { profiles } = await fresh();
    const created = await profiles.create({ ...ada, name: "  Ada  " });
    // Leading space is invisible on the picker and would make "Ada" and " Ada"
    // two players — and the clash check below would never see it coming.
    expect(created.name).toBe("Ada");
  });

  it.each([
    [{ name: "" }, /empty/i],
    [{ name: "   " }, /empty/i],
    [{ name: "x".repeat(25) }, /24 characters/],
    [{ name: 42 as unknown as string }, /must be text/],
    [{ emoji: "" }, /empty/i],
    [{ color: "purple" }, /hex/i],
    [{ color: "#7c3ae" }, /hex/i],
    [{ age: 2 }, /between 3 and 18/],
    [{ age: 19 }, /between 3 and 18/],
    [{ age: 7.5 }, /whole number/],
    [{ age: "seven" as unknown as number }, /whole number/],
  ])("refuses %o", async (bad, message) => {
    const { profiles, store } = await fresh();

    const refusal = await profiles
      .create({ ...ada, ...bad })
      .catch((err: unknown) => err);
    // The class, because the form catches it to decide whether the message is
    // showable; and the message, because a parent reads it.
    expect(refusal).toBeInstanceOf(profiles.InvalidInput);
    expect((refusal as Error).message).toMatch(message);

    // And nothing was written on the way to the refusal. A half-made profile
    // would show up on the picker as a player who cannot be raced.
    expect(await store.allProfiles()).toEqual([]);
  });

  it("won't let two players share a name, however it is capitalised", async () => {
    const { profiles } = await fresh();
    await profiles.create(ada);

    // The name is the only thing on the picker, so two of them is two children
    // tapping the same-looking card and one of them losing their record book.
    await expect(profiles.create({ ...ada, name: "ada" })).rejects.toThrow(
      /already a player called Ada/,
    );
    // Named, not just refused: "there's already a player called Ada" is what
    // tells a parent which card on the picker is the one they meant.
    expect(await profiles.create({ ...ada, name: "Ada B" })).toMatchObject({
      name: "Ada B",
    });
  });

  it("asks to keep the data only once there is data to keep", async () => {
    const { profiles } = await fresh();
    const persist = vi.fn().mockResolvedValue(true);
    // Chrome grants persistence silently, Firefox prompts. Asking on page load
    // would be a prompt about nothing; asking here is asking at the moment a
    // child's progress starts to exist.
    vi.stubGlobal("navigator", {
      storage: { persist, persisted: () => Promise.resolve(false) },
    });

    const created = await profiles.create(ada);
    await vi.waitFor(() => expect(persist).toHaveBeenCalledTimes(1));

    // Editing one isn't the moment — the ask already happened.
    await profiles.update(created.id, { name: "Ada B" });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("keeps the player when the browser refuses to keep the data", async () => {
    const { profiles, store } = await fresh();
    // Safari effectively ignores the request and applies its 7-day cap anyway.
    // Whatever the answer, it is advisory — a profile that failed to save
    // because a permission was declined would be a bug about nothing.
    vi.stubGlobal("navigator", {
      storage: {
        persisted: () => Promise.reject(new Error("no")),
        persist: () => Promise.reject(new Error("no")),
      },
    });

    const created = await profiles.create(ada);
    expect(await store.allProfiles()).toEqual([created]);
  });
});

describe("editing a player", () => {
  it("patches the field it was given and leaves the rest alone", async () => {
    const { profiles, store } = await fresh();
    const created = await profiles.create(ada);

    const grown = await profiles.update(created.id, { age: 8 });
    expect(grown).toEqual({ ...created, age: 8 });
    expect(await store.allProfiles()).toEqual([grown]);
  });

  it("still validates the fields the patch does carry", async () => {
    const { profiles } = await fresh();
    const created = await profiles.create(ada);

    // Partial means "the absent fields are not being changed", not "the rules
    // are off" — a patch is the only way a bad value could reach the record.
    await expect(profiles.update(created.id, { age: 99 })).rejects.toThrow(
      /between 3 and 18/,
    );
    await expect(
      profiles.update(created.id, { color: "nope" }),
    ).rejects.toThrow(/hex/i);
  });

  it("lets a player keep their own name", async () => {
    const { profiles } = await fresh();
    const created = await profiles.create(ada);
    // Saving the editor without touching the name resubmits it, so a clash
    // check that didn't exclude the player being edited would make every
    // profile uneditable the moment it was saved once.
    expect(await profiles.update(created.id, { name: "Ada" })).toMatchObject({
      name: "Ada",
    });
  });

  it("won't rename a player onto another player's name", async () => {
    const { profiles } = await fresh();
    await profiles.create(ada);
    const bob = await profiles.create({ ...ada, name: "Bob" });

    await expect(profiles.update(bob.id, { name: "ADA" })).rejects.toThrow(
      /already a player called Ada/,
    );
  });

  it("refuses a player who isn't there", async () => {
    const { profiles } = await fresh();
    // Two tabs, one holding the editor for a profile the other just deleted.
    await expect(profiles.update("p_gone", { age: 8 })).rejects.toThrow(
      /No player with that id/,
    );
  });

  it("takes settings as settings, not as text", async () => {
    const { profiles } = await fresh();
    const created = await profiles.create(ada);

    // `soundOn` is a toggle: whatever the control sent, what lands is a boolean.
    expect(
      await profiles.update(created.id, {
        soundOn: 0 as unknown as boolean,
      }),
    ).toMatchObject({ soundOn: false });

    expect(
      await profiles.update(created.id, { keyboard: "keys" }),
    ).toMatchObject({ keyboard: "keys" });
    // Only the three modes are written. Anything else leaves the profile on
    // whatever it was on, rather than parking a value in storage that the
    // typing game would have to resolve every time it reads it.
    expect(
      await profiles.update(created.id, {
        keyboard: "sideways" as unknown as "keys",
      }),
    ).toMatchObject({ keyboard: "keys" });
  });
});

describe("deleting a player", () => {
  it("takes their races with them", async () => {
    const { profiles, store } = await fresh();
    const created = await profiles.create(ada);
    const other = await profiles.create({ ...ada, name: "Bob" });
    const run = (id: string, profileId: string) => ({
      id,
      profileId,
      game: "flashcards" as const,
      mode: "multiply",
      configKey: "multiply|7|1-12|20|type",
      config: {
        operation: "multiply" as const,
        tables: [7],
        others: [8],
        cardCount: 1,
        inputMode: "type" as const,
      },
      seed: 1,
      finishedAt: "2026-03-02T09:00:00.000Z",
      durationMs: 1000,
      correct: 1,
      incorrect: 0,
      bestStreak: 1,
      xpEarned: 10,
      ghostSessionId: null,
      beatGhost: null,
      cards: [],
    });
    await store.putSession(run("s_1", created.id));
    await store.putSession(run("s_2", other.id));

    await profiles.remove(created.id);

    expect(await store.allProfiles()).toEqual([other]);
    // Their runs go, and only theirs. A session left pointing at a profile id
    // that no longer resolves renders as a ghost player in every screen that
    // groups by profile.
    expect((await store.allSessions()).map((s) => s.id)).toEqual(["s_2"]);
  });
});
