import { describe, expect, it } from "vitest";

import {
  bestRun,
  factStats,
  factsToDrill,
  ghostsFor,
  masteryOf,
  troubleFacts,
} from "./records";
import type { CardResult, Profile, Session } from "./types";

/**
 * What counts as "the same fact" is now the deck's answer, not this module's.
 * These pin the two rules that used to be a hard-coded table here, because
 * getting either one wrong is invisible: the record book still renders, it
 * just quietly merges or splits facts that shouldn't be.
 */

const card = (over: Partial<CardResult> = {}): CardResult => ({
  prompt: "7 × 8",
  answer: "56",
  given: "56",
  ok: true,
  ms: 1200,
  factId: "7:8",
  ...over,
});

const session = (mode: string, cards: CardResult[]): Session => ({
  id: `s-${mode}-${cards.length}`,
  profileId: "p1",
  game: "flashcards",
  mode,
  configKey: "k",
  config: {
    operation: "multiply",
    tables: [7],
    others: [8],
    cardCount: cards.length,
    inputMode: "type",
  },
  seed: 1,
  finishedAt: "2026-08-01T10:00:00.000Z",
  durationMs: cards.reduce((sum, c) => sum + c.ms, 0),
  correct: cards.filter((c) => c.ok).length,
  incorrect: cards.filter((c) => !c.ok).length,
  bestStreak: 0,
  xpEarned: 0,
  ghostSessionId: null,
  beatGhost: null,
  cards,
});

describe("bestRun", () => {
  /**
   * A run that may not hold a record is dropped before anything is compared.
   *
   * `isRanked` is the judgement and this is the only place it is enforced, so
   * these two cases are what every "best" on the site inherits: the record
   * book's columns, the `previousBest` a personal-best bonus is paid on, and
   * `ghostsFor` below it. Today only a Hailstorm answers false — it ends when
   * the shield does, so ranking it on time gives the record to whoever quit
   * first (docs/typing.md §8.7, decision 50).
   */
  const typing = (over: Partial<Session>): Session => ({
    ...session("typing:L39", [card()]),
    configKey: "typing|L39|12",
    config: { kind: "typing", levelId: "L39", lessonId: "L39", wordCount: 12 },
    ...over,
  });

  const PLAYER: Profile = {
    id: "p1",
    name: "Ada",
    emoji: "🦊",
    color: "#4ade80",
    age: 8,
    soundOn: false,
    xp: 0,
    badges: [],
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("returns null when every run is one that may not be ranked", () => {
    const storm = typing({
      id: "storm",
      config: {
        kind: "typing",
        levelId: "L39",
        lessonId: "L39",
        storm: true,
        wordCount: 12,
      },
      durationMs: 1000,
    });

    // Not the empty-list null: there is a run here, and it is still a run in
    // every other way. It just sets no record.
    expect(bestRun([storm])).toBeNull();
    expect(ghostsFor([storm], [PLAYER], storm.configKey, PLAYER.id)).toEqual(
      [],
    );
  });

  it("picks the slowest ranked run over a faster unranked one", () => {
    const storm = typing({
      id: "storm",
      config: {
        kind: "typing",
        levelId: "L39",
        lessonId: "L39",
        storm: true,
        wordCount: 12,
      },
      durationMs: 1000,
    });
    const lesson = typing({ id: "lesson", durationMs: 90_000 });

    expect(bestRun([storm, lesson])?.id).toBe("lesson");
  });

  it("still ranks two ordinary runs on time", () => {
    const slow = { ...session("multiply", [card()]), id: "slow" };
    const fast = { ...session("multiply", [card()]), id: "fast" };
    slow.durationMs = 9000;
    fast.durationMs = 4000;

    expect(bestRun([slow, fast])?.id).toBe("fast");
    expect(bestRun([])).toBeNull();
  });
});

describe("factStats", () => {
  it("folds a commutative pair onto one square", () => {
    const grid = factStats(
      [session("multiply", [card({ factId: "7:8" }), card({ factId: "8:7" })])],
      "multiply",
    );
    expect(grid.size).toBe(1);
    expect(grid.get("7:8")?.attempts).toBe(2);
  });

  it("folds division too, because the map is deliberately symmetric", () => {
    // 21 ÷ 3 and 21 ÷ 7 share a square on the fact map. That is a choice, not
    // an oversight — the map is a 12×12 grid of number pairs for every
    // operation. `drillKey` is what keeps the two questions apart.
    const grid = factStats(
      [session("divide", [card({ factId: "3:7" }), card({ factId: "7:3" })])],
      "divide",
    );
    expect(grid.size).toBe(1);
  });

  it("ignores runs from another deck", () => {
    const grid = factStats(
      [
        session("multiply", [card()]),
        session("divide", [card({ factId: "3:7" })]),
      ],
      "multiply",
    );
    expect(grid.size).toBe(1);
    expect(grid.get("7:8")?.attempts).toBe(1);
  });

  it("accumulates attempts, hits and time", () => {
    const grid = factStats(
      [
        session("multiply", [
          card({ ms: 1000 }),
          card({ ms: 3000, ok: false, given: "54" }),
        ]),
      ],
      "multiply",
    );
    expect(grid.get("7:8")).toEqual({
      attempts: 2,
      correct: 1,
      totalMs: 4000,
    });
  });
});

describe("troubleFacts", () => {
  const missed = (factId: string) =>
    card({ factId, ok: false, given: "1", ms: 5000 });

  it("folds a commutative pair into one entry", () => {
    const trouble = troubleFacts(
      [session("multiply", [missed("7:8"), missed("8:7")])],
      "multiply",
    );
    expect(trouble).toHaveLength(1);
    expect(trouble[0].attempts).toBe(2);
  });

  it("keeps division's two questions apart", () => {
    // 21 ÷ 3 = 7 and 21 ÷ 7 = 3 are different things to practise, so a kid who
    // only misses one must not be drilled on both.
    const trouble = troubleFacts(
      [session("divide", [missed("3:7"), missed("7:3")])],
      "divide",
    );
    expect(trouble).toHaveLength(2);
    expect(trouble.map((t) => t.factId).sort()).toEqual(["3:7", "7:3"]);
  });

  it("drops a fact once it's being answered quickly and correctly", () => {
    const quick = Array.from({ length: 6 }, () => card({ ms: 900 }));
    const trouble = troubleFacts(
      [session("multiply", [missed("7:8"), ...quick])],
      "multiply",
    );
    expect(trouble).toHaveLength(0);
  });

  it("ranks by how much trouble, worst first", () => {
    const trouble = troubleFacts(
      [
        session("multiply", [
          missed("7:8"),
          missed("7:8"),
          card({ factId: "6:6", ms: 9000 }),
        ]),
      ],
      "multiply",
    );
    expect(trouble[0].factId).toBe("7:8");
  });
});

describe("factsToDrill", () => {
  it("de-duplicates through the deck's drill key", () => {
    expect(
      factsToDrill(
        [card({ factId: "7:8" }), card({ factId: "8:7" })],
        "multiply",
      ),
    ).toEqual(["7:8"]);
  });

  it("leaves division's pairs alone", () => {
    expect(
      factsToDrill(
        [card({ factId: "3:7" }), card({ factId: "7:3" })],
        "divide",
      ),
    ).toEqual(["3:7", "7:3"]);
  });
});

describe("a deck that no longer exists", () => {
  // A parent deletes last term's spelling list; every race on it stays in the
  // record book. Throwing here would take down the whole Progress screen.
  it("still reports stats, keyed by the raw fact id", () => {
    const runs = [session("week-12-spellings", [card({ factId: "because" })])];
    expect(() => factStats(runs, "week-12-spellings")).not.toThrow();
    expect([...factStats(runs, "week-12-spellings").keys()]).toEqual([
      "because",
    ]);
  });

  it("still ranks its trouble spots", () => {
    const runs = [
      session("week-12-spellings", [
        card({ factId: "because", ok: false, ms: 6000 }),
      ]),
    ];
    expect(troubleFacts(runs, "week-12-spellings")[0].factId).toBe("because");
  });
});

describe("masteryOf", () => {
  it("needs speed as well as accuracy", () => {
    // Right every time but worked out rather than recalled.
    expect(masteryOf({ attempts: 10, correct: 10, totalMs: 10 * 6000 })).toBe(
      "solid",
    );
    expect(masteryOf({ attempts: 10, correct: 10, totalMs: 10 * 1500 })).toBe(
      "mastered",
    );
  });

  it("calls an untouched fact untried, not wrong", () => {
    expect(masteryOf(undefined)).toBe("untried");
  });
});
