import { describe, expect, it } from "vitest";

import type {
  CustomDeck,
  LegacySession,
  Profile,
  Session,
} from "@/engine/types";

import { freshIndexedDB, loadDb, openVersion2 } from "./storage/fakedb";

/**
 * The one call every island makes before it can draw anything.
 *
 * `loadHub` is three reads and two sorts, which sounds like nothing to test —
 * except that the whole app is downstream of it. The order it returns decides
 * the order of the player picker and the record book; the deck read has to go
 * through the deck *service* rather than the store, because loading is also
 * what fills the engine's custom-list mirror; and a failure has to arrive as a
 * message a parent can act on, since `HubContext` renders `err.message` as the
 * whole of the boot error screen.
 */

const profile = (id: string, name: string, createdAt: string): Profile => ({
  id,
  name,
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
  soundOn: true,
  xp: 0,
  badges: [],
  createdAt,
});

const run = (id: string, finishedAt: string): Session => ({
  id,
  profileId: "kid-1",
  game: "flashcards",
  mode: "multiply",
  configKey: "multiply|7|1-12|20|type",
  config: {
    operation: "multiply",
    tables: [7],
    others: [8],
    cardCount: 1,
    inputMode: "type",
  },
  seed: 42,
  finishedAt,
  durationMs: 1900,
  correct: 1,
  incorrect: 0,
  bestStreak: 1,
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
});

const deck: CustomDeck = {
  id: "custom-abc",
  name: "Week 4 spellings",
  emoji: "📝",
  words: ["because", "thought"],
  createdAt: "2026-03-01T09:00:00.000Z",
  updatedAt: "2026-03-01T09:00:00.000Z",
};

/** The hub service and the store under it, on a device with nothing saved. */
async function fresh() {
  freshIndexedDB();
  const store = await loadDb();
  const hub = await import("./hub");
  return { hub, store };
}

describe("loading the hub", () => {
  it("hands back everything at boot, in the order the screens read it", async () => {
    const { hub, store } = await fresh();
    // Written newest-first, and with ids that sort the opposite way to the
    // dates on them. `getAll` hands records back in key order, so an id that
    // happened to agree with the date would let a sort on the wrong field —
    // or no sort at all — look exactly like this one.
    await store.putProfile(profile("p_a", "Bob", "2026-03-02T09:00:00.000Z"));
    await store.putProfile(profile("p_z", "Ada", "2026-03-01T09:00:00.000Z"));
    await store.putSession(run("s_a", "2026-03-05T09:00:00.000Z"));
    await store.putSession(run("s_z", "2026-03-04T09:00:00.000Z"));
    await store.putDeck(deck);

    const state = await hub.loadHub();

    // Oldest first, both times. The picker shows players in the order they
    // joined, and every "your last run" in the app is the end of this list.
    expect(state.profiles.map((p) => p.name)).toEqual(["Ada", "Bob"]);
    expect(state.sessions.map((s) => s.id)).toEqual(["s_z", "s_a"]);
    expect(state.decks).toEqual([deck]);
  });

  it("reads a run saved before answers became text", async () => {
    const { hub, store } = await fresh();
    // Cards from before the widening, put in as they sit on disk today. The
    // hub is what the record book reads through, so a load that skipped the
    // migration would hand every screen a numeric answer it no longer types.
    const legacy: LegacySession = {
      ...run("s_old", "2026-03-04T09:00:00.000Z"),
      cards: [
        {
          prompt: "7 × 8",
          answer: 56,
          given: 56,
          ok: true,
          ms: 1900,
          facts: [7, 8],
        },
      ],
    };
    await store.putSession(legacy as unknown as Session);

    const [read] = (await hub.loadHub()).sessions;
    expect(read.cards[0]).toMatchObject({
      answer: "56",
      given: "56",
      factId: "7:8",
    });
  });

  it("mirrors a parent's lists into the engine before anything can name one", async () => {
    const { hub, store } = await fresh();
    await store.putDeck(deck);
    const { deckSpec } = await import("@/engine/decks");
    const { wordMode } = await import("@/engine/decks/words");

    // Before the load the engine has never heard of the list, so a run played
    // on it reads as the generic "Words" — this is the state the assertion
    // below has to move away from, and asserting it is what stops that
    // assertion from being true for some other reason.
    expect(deckSpec(wordMode(deck.id)).label).toBe("Words");

    await hub.loadHub();

    // The reason `loadHub` calls the deck service rather than the store: the
    // record book can name a run on a parent's list without the engine ever
    // learning that storage exists.
    expect(deckSpec(wordMode(deck.id)).label).toBe("Week 4 spellings");
  });

  it("gives a device with nothing on it three empty lists", async () => {
    const { hub } = await fresh();
    // The first-ever page load. An empty database is the normal state, not an
    // error state — the app opens on "add a player" from here.
    expect(await hub.loadHub()).toEqual({
      profiles: [],
      sessions: [],
      decks: [],
    });
  });

  it("says why when the database can't be opened", async () => {
    const { hub } = await fresh();
    // A tab left open from before this deploy, holding the old version. The
    // upgrade cannot start while it is there, and the sentence below is the
    // whole of what a parent sees on the boot screen.
    const stale = await openVersion2();

    // Rejecting, not resolving empty. A hub that swallowed this would show a
    // parent an empty player picker over a record book that is still there —
    // and the obvious next move from that screen is to make a new profile.
    await expect(hub.loadHub()).rejects.toThrow(/another tab/i);
    stale.close();
  });
});
