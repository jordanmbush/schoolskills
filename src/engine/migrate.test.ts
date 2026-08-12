import { describe, expect, it } from "vitest";

import { readCard, readSession, readSessions } from "./migrate";
import type { CardResult, LegacyCardResult, LegacySession } from "./types";

/**
 * The one piece of this codebase that reads data it did not write.
 *
 * Every race a child has ever run is in IndexedDB and nowhere else — there is
 * no server holding a copy — so a mistake here is not a bug that gets fixed in
 * the next deploy, it is a record book that silently stops adding up.
 */

const legacyCard = (
  over: Partial<LegacyCardResult> = {},
): LegacyCardResult => ({
  prompt: "7 × 8",
  answer: 56,
  given: 56,
  ok: true,
  ms: 1200,
  facts: [7, 8],
  ...over,
});

const legacySession = (cards: LegacyCardResult[]): LegacySession => ({
  id: "s1",
  profileId: "p1",
  game: "flashcards",
  mode: "multiply",
  configKey: "multiply|7|1.2|2|type",
  config: {
    operation: "multiply",
    tables: [7],
    others: [1, 2],
    cardCount: 2,
    inputMode: "type",
  },
  seed: 42,
  finishedAt: "2026-08-01T10:00:00.000Z",
  durationMs: 2400,
  correct: 2,
  incorrect: 0,
  bestStreak: 2,
  xpEarned: 30,
  ghostSessionId: null,
  beatGhost: null,
  cards,
});

describe("readCard", () => {
  it("widens a numeric answer and given to text", () => {
    expect(readCard(legacyCard())).toMatchObject({ answer: "56", given: "56" });
  });

  it("keeps a timed-out card's missing answer as null, not the string 'null'", () => {
    // `String(null)` is "null", which would render as a wrong answer of
    // literally "null" on the splits table and never compare equal to anything.
    const card = readCard(
      legacyCard({ given: null, ok: false, timedOut: true }),
    );
    expect(card.given).toBeNull();
  });

  it("turns the ordered pair into a fact id and drops the old key", () => {
    const card = readCard(legacyCard({ facts: [3, 7] }));
    expect(card.factId).toBe("3:7");
    expect("facts" in card).toBe(false);
  });

  it("preserves the pair's order, because division depends on it", () => {
    // 21 ÷ 3 was built as focus 3, other 7. Folding it here would make it
    // indistinguishable from 21 ÷ 7 and merge two separate drills.
    expect(readCard(legacyCard({ facts: [3, 7] })).factId).toBe("3:7");
    expect(readCard(legacyCard({ facts: [7, 3] })).factId).toBe("7:3");
  });

  it("returns an already-widened card by identity", () => {
    // Not just equal — the same object. A normal load runs this over every
    // card of every run, and re-allocating them all would be pure waste.
    const current: CardResult = {
      prompt: "7 × 8",
      answer: "56",
      given: "56",
      ok: true,
      ms: 1200,
      factId: "7:8",
    };
    expect(readCard(current)).toBe(current);
  });

  it("is idempotent", () => {
    const once = readCard(legacyCard());
    expect(readCard(once)).toEqual(once);
  });
});

describe("readSession", () => {
  it("returns a session that needs nothing by identity", () => {
    const current = readSession(legacySession([legacyCard()]));
    expect(readSession(current)).toBe(current);
  });

  it("widens every card in a session", () => {
    const migrated = readSession(
      legacySession([
        legacyCard(),
        legacyCard({ facts: [7, 9], answer: 63, given: 62, ok: false }),
      ]),
    );
    expect(migrated.cards.map((c) => c.answer)).toEqual(["56", "63"]);
    expect(migrated.cards.map((c) => c.factId)).toEqual(["7:8", "7:9"]);
  });

  it("leaves everything that isn't a card alone", () => {
    const before = legacySession([legacyCard()]);
    const after = readSession(before);
    expect(after.durationMs).toBe(before.durationMs);
    expect(after.xpEarned).toBe(before.xpEarned);
    expect(after.configKey).toBe(before.configKey);
    expect(after.seed).toBe(before.seed);
  });

  it("survives a card with no fact information at all", () => {
    // Not a shape we ever wrote, but a hand-edited backup could carry it, and
    // a thrown exception here fails the whole hub's initial load.
    const orphan = { ...legacyCard(), facts: undefined };
    expect(() => readSessions([legacySession([orphan])])).not.toThrow();
  });
});
