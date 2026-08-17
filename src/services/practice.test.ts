import { describe, expect, it } from "vitest";

import type { CardResult, Profile, Session } from "@/engine/types";

import { practiceFrom } from "./practice";

/**
 * The half of the practice service that decides anything.
 *
 * Loading needs IndexedDB and is covered against a fake one in
 * `storage/db.test.ts`; what is worth pinning here is the judgement — whose
 * facts, from which deck, in what order, and what a player with no history
 * gets — because every one of those is a way the headline feature could be
 * subtly wrong while looking right.
 */

const profile = (id: string, name: string): Profile => ({
  id,
  name,
  emoji: "🦊",
  color: "#fff",
  age: 8,
  soundOn: true,
  xp: 0,
  badges: [],
  createdAt: `2026-01-0${id.slice(-1)}T00:00:00.000Z`,
});

const card = (over: Partial<CardResult> = {}): CardResult => ({
  prompt: "7 × 8",
  answer: "56",
  given: "56",
  ok: true,
  ms: 1200,
  factId: "7:8",
  ...over,
});

let runs = 0;
const session = (
  profileId: string,
  mode: string,
  cards: CardResult[],
): Session => ({
  id: `s${(runs += 1)}`,
  profileId,
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
  durationMs: cards.reduce((total, c) => total + c.ms, 0),
  correct: cards.filter((c) => c.ok).length,
  incorrect: cards.filter((c) => !c.ok).length,
  bestStreak: 0,
  xpEarned: 0,
  ghostSessionId: null,
  beatGhost: null,
  cards,
});

/** Wrong three times over is a fact that lands near the top of the list. */
const missed = (factId: string) => card({ factId, ok: false, given: "" });

describe("what the record book knows they keep missing", () => {
  it("gives every player their own facts and nobody else's", () => {
    const players = practiceFrom(
      [profile("p1", "Ada"), profile("p2", "Bo")],
      [
        session("p1", "multiply", [missed("7:8"), missed("7:8")]),
        session("p2", "multiply", [missed("3:4"), missed("3:4")]),
      ],
    );
    expect(players.map((p) => p.name)).toEqual(["Ada", "Bo"]);
    expect(players[0].sets[0].facts).toEqual(["7:8"]);
    expect(players[1].sets[0].facts).toEqual(["3:4"]);
  });

  it("names the facts the way the deck names them", () => {
    // Through `DeckSpec.factLabel`, so the chips a parent reads before pressing
    // print say exactly what the record book's trouble panel says.
    const [player] = practiceFrom(
      [profile("p1", "Ada")],
      [session("p1", "divide", [missed("3:7"), missed("3:7")])],
    );
    expect(player.sets[0]).toMatchObject({
      mode: "divide",
      label: "Division",
      facts: ["3:7"],
      labels: ["21 ÷ 3"],
    });
  });

  it("offers only the decks they have actually raced, worst first", () => {
    const players = practiceFrom(
      [profile("p1", "Ada")],
      [
        session("p1", "add", [missed("1:2"), missed("1:2")]),
        session("p1", "multiply", [
          missed("7:8"),
          missed("7:8"),
          missed("7:8"),
          missed("6:9"),
        ]),
      ],
    );
    // Not the four operations and every shipped list: a switcher offering
    // everything would bury the deck they are struggling with.
    expect(players[0].sets.map((set) => set.mode)).toEqual(["multiply", "add"]);
  });

  it("leaves out a deck with nothing standing out in it", () => {
    // A clean, quick run is not a trouble spot, and a set of no facts would be
    // a button that printed an empty page.
    const [player] = practiceFrom(
      [profile("p1", "Ada")],
      [session("p1", "multiply", [card(), card(), card()])],
    );
    expect(player.sets).toEqual([]);
  });

  it("keeps a player who has never raced in the list", () => {
    // The commonest case on a family machine. Leaving them out would leave a
    // parent with no way to pick the child they came to print for; the empty
    // `sets` is what the bench turns into a sheet of the whole table.
    expect(practiceFrom([profile("p1", "Ada")], [])).toEqual([
      { id: "p1", name: "Ada", sets: [] },
    ]);
  });

  it("folds a fact the deck folds, and splits one it splits", () => {
    // Nothing here re-decides what a fact is: 7 × 8 and 8 × 7 are one practice
    // and 21 ÷ 3 and 21 ÷ 7 are two, which is `DeckSpec.drillKey` and not this
    // module's opinion.
    const [player] = practiceFrom(
      [profile("p1", "Ada")],
      [
        session("p1", "multiply", [missed("7:8"), missed("8:7")]),
        session("p1", "divide", [missed("3:7"), missed("7:3")]),
      ],
    );
    const facts = (mode: string) =>
      player.sets.find((set) => set.mode === mode)?.facts;
    expect(facts("multiply")).toEqual(["7:8"]);
    expect(facts("divide")?.sort()).toEqual(["3:7", "7:3"]);
  });
});
