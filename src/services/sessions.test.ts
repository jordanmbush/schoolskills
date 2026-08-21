import { describe, expect, it, vi } from "vitest";

import type { CardResult, Profile, Session } from "@/engine/types";

import type { SessionDraft } from "./sessions";
import { freshIndexedDB, loadDb } from "./storage/fakedb";

/**
 * Banking a finished race.
 *
 * The one write that touches two records at once — the run, plus the XP and
 * badges it earned on the player — so it is exercised against a real (fake)
 * IndexedDB: what "atomic" means here is a property of the transaction, and a
 * mocked store would only ever prove that two functions were called.
 *
 * `summariseRun` (engine/run.ts) decides what a run is worth; this decides what
 * is kept. The split matters to the assertions below: everything derived is
 * asserted there, and everything written is asserted here.
 */

const ada: Profile = {
  id: "kid-1",
  name: "Ada",
  emoji: "🚀",
  color: "#7c3aed",
  age: 7,
  soundOn: true,
  xp: 340,
  badges: ["green-light"],
  createdAt: "2026-03-01T09:00:00.000Z",
};

const card: CardResult = {
  prompt: "7 × 8",
  answer: "56",
  given: "56",
  ok: true,
  ms: 1900,
  factId: "7:8",
};

const run: Omit<Session, "id" | "finishedAt"> = {
  profileId: ada.id,
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
  durationMs: 1900,
  correct: 1,
  incorrect: 0,
  bestStreak: 1,
  xpEarned: 55,
  ghostSessionId: null,
  beatGhost: null,
  cards: [card],
};

/** A run as `summariseRun` hands it over: no id, no finish time, badges named. */
const draft = (over: Partial<SessionDraft> = {}): SessionDraft => ({
  ...run,
  earnedBadges: [],
  ...over,
});

/** A run already in the record book, banked `at` milliseconds into 2026. */
const stored = (
  id: string,
  at: number,
  over: Partial<Session> = {},
): Session => ({
  ...run,
  id,
  finishedAt: new Date(Date.UTC(2026, 0, 1) + at).toISOString(),
  ...over,
});

/** The service and the store under it, with Ada already on the picker. */
async function fresh(profile: Profile = ada) {
  freshIndexedDB();
  const store = await loadDb();
  await store.putProfile(profile);
  const sessions = await import("./sessions");
  return { sessions, store };
}

describe("recording a run", () => {
  it("banks the run and the XP it earned together", async () => {
    const { sessions, store } = await fresh();

    const { session, profile } = await sessions.record(
      draft({ earnedBadges: ["green-light", "clean-sheet"] }),
    );

    expect(session.id.startsWith("s_")).toBe(true);
    // The service stamps the finish time, not the caller: a clock the race loop
    // passed in would let a paused tab file a run under when it started.
    expect(Date.parse(session.finishedAt)).not.toBeNaN();
    expect(await store.allSessions()).toEqual([session]);

    // XP adds up and badges are a set — "green-light" was already held, and a
    // second copy would show as a duplicate on the badge shelf forever.
    expect(profile.xp).toBe(340 + 55);
    expect(profile.badges).toEqual(["green-light", "clean-sheet"]);
    // Both halves landed. Splitting them would let a crash bank the run and
    // lose the XP it paid for.
    expect(await store.allProfiles()).toEqual([profile]);
  });

  it("starts a player who predates XP at zero rather than at NaN", async () => {
    // A profile written before XP and badges existed has neither field. One
    // `undefined + 55` here and a child's level reads NaN from then on.
    const { sessions } = await fresh({
      ...ada,
      xp: undefined as unknown as number,
      badges: undefined as unknown as string[],
    });

    const { profile } = await sessions.record(
      draft({ earnedBadges: ["green-light"] }),
    );
    expect(profile.xp).toBe(55);
    expect(profile.badges).toEqual(["green-light"]);
  });

  it("stores a whole number of milliseconds", async () => {
    const { sessions } = await fresh();
    // Times are summed from `performance.now()`, which is fractional. Every
    // comparison the record book makes is on this number.
    const { session } = await sessions.record(draft({ durationMs: 1900.6 }));
    expect(session.durationMs).toBe(1901);
  });

  it("caps how much card history one run can carry", async () => {
    const { sessions } = await fresh();
    const { session } = await sessions.record(
      draft({ cards: Array.from({ length: 600 }, () => card) }),
    );
    // A malformed deck must not be able to grow a single record without bound —
    // this is the only copy of the record book there is, and it is all read at
    // boot.
    expect(session.cards).toHaveLength(500);
  });

  it("refuses a run for a player who is gone, and writes nothing", async () => {
    const { sessions, store } = await fresh();
    // Two tabs: one finishes a race for a player the other has just deleted.
    await expect(
      sessions.record(draft({ profileId: "p_gone" })),
    ).rejects.toThrow(/no longer exists/i);
    expect(await store.allSessions()).toEqual([]);
    // And the run didn't pay its XP to somebody else on the way past.
    expect(await store.allProfiles()).toEqual([ada]);
  });

  it("drops the oldest run when a player is at the cap, and only theirs", async () => {
    const { sessions, store } = await fresh();
    // Ada is filled to the cap exactly, so the run recorded below is the one
    // that pushes her over. Seeded through the store rather than through
    // `record`: what is being tested is the trim, not two thousand round trips.
    for (let i = 0; i < store.MAX_SESSIONS_PER_PROFILE; i++) {
      await store.putSession(stored(`s_ada${i}`, i * 1000));
    }
    await store.putProfile({ ...ada, id: "kid-2", name: "Bob" });
    for (let i = 0; i < 3; i++) {
      await store.putSession(
        stored(`s_bob${i}`, i * 1000, {
          profileId: "kid-2",
        }),
      );
    }

    const { session } = await sessions.record(draft());

    // Trimming happens after the commit rather than inside it, so the run is
    // already safe by the time this settles — hence the wait. Ada being back at
    // the cap is also what says the trim has run at all, which is what makes
    // the assertion about Bob below a real one rather than a race won early.
    await vi.waitFor(async () => {
      const kept = await store.allSessions();
      const mine = kept.filter((s) => s.profileId === ada.id);
      expect(mine).toHaveLength(store.MAX_SESSIONS_PER_PROFILE);
      const ids = mine.map((s) => s.id);
      // The oldest went and the new one stayed. Trimming the wrong end would
      // quietly delete a run a child had just finished.
      expect(ids).not.toContain("s_ada0");
      expect(ids).toContain("s_ada1");
      expect(ids).toContain(session.id);

      // The cap is per player. A sibling filling their own record book must not
      // cost this one a single race, in either direction.
      expect(
        kept.filter((s) => s.profileId === "kid-2").map((s) => s.id),
      ).toEqual(["s_bob0", "s_bob1", "s_bob2"]);
    });
  });
});
