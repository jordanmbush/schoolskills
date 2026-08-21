import { describe, expect, it } from "vitest";

import { LESSONS } from "@/engine/typing/lessons";
import type { RaceConfig } from "@/engine/types";
import type { World } from "@/engine/worlds";

import { OPERATIONS } from "./flashcards";
import { TYPING_LEVELS, typingMode } from "./typing";
import { SHIPPED_LISTS } from "./wordlists";
import { wordMode } from "./words";
import { UNKNOWN_DECK } from "./spec";
import { deckSpec, modeOf } from "./index";

/**
 * `deckSpec(mode)` answers for everything, because sessions outlive their decks.
 *
 * Each family's own suite spot-checks its routing; this is the sweep. Every mode
 * this build can file a run under is read out of the registry that owns it —
 * every operation, every shipped word list, every typing level and every lesson
 * — so a list, a level or a lesson added tomorrow is covered the day it lands
 * rather than the day somebody remembers to add it here.
 *
 * The other half is the modes that resolve to nothing: a list a parent deleted,
 * a level a build retired, a mode from no family at all. A record book is
 * rendered for every run a child has ever done, so one unresolvable mode is not
 * one missing row — it is the whole screen, and the runs behind it are the only
 * copy there is.
 */

type Family = {
  name: string;
  /** Where a run of this family opens. `DeckSpec.world`, keyed off the mode. */
  world: World;
  /** Every mode of this family, from the registry that owns them. */
  modes: string[];
  /** A run of this family, to prove those modes are what one is filed under. */
  config: RaceConfig;
};

/*
 * The `?? ""` on the ids below is deliberate: a registry that came back empty
 * should trip the named guard in the first test rather than fail the whole file
 * on `undefined.id`, which reads as a broken test rather than as a missing deck.
 */
const FAMILIES: Family[] = [
  {
    name: "arithmetic",
    world: "grid",
    modes: Object.keys(OPERATIONS),
    config: {
      operation: "multiply",
      tables: [7],
      others: [8],
      cardCount: 1,
      inputMode: "type",
    },
  },
  {
    name: "words",
    world: "jungle",
    modes: SHIPPED_LISTS.map((list) => wordMode(list.id)),
    config: {
      kind: "words",
      listId: SHIPPED_LISTS[0]?.id ?? "",
      cardCount: 1,
      inputMode: "type",
    },
  },
  {
    name: "typing",
    world: "ice",
    // Two namespaces behind one prefix: a run files itself under its lesson
    // where it has one and under its level otherwise, and both have to resolve.
    modes: [
      ...TYPING_LEVELS.map((level) => typingMode(level.id)),
      ...LESSONS.map((lesson) => typingMode(lesson.id)),
    ],
    config: {
      kind: "typing",
      levelId: TYPING_LEVELS[0]?.id ?? "",
      wordCount: 1,
    },
  },
];

/**
 * Fact ids a spec has to survive being handed.
 *
 * Half of them are ordinary and half are what a record book two years old
 * actually holds: `""` is what a card saved before fact ids existed migrates to
 * (`engine/migrate.ts`), and the rest are the shapes a restored backup can
 * carry, since a backup is put back exactly as it was written.
 */
const FACT_IDS = [
  "",
  "7:8",
  "12:12",
  "because",
  "Because",
  "The",
  "🙂",
  "constructor",
  "x".repeat(200),
];

describe("the modes this build can file a run under", () => {
  it.each(FAMILIES)(
    "$name has some, and they are what runs carry",
    (family) => {
      // Without this the sweep below could quietly loop zero times — a registry
      // that failed to load, or a family whose ids moved, would report green.
      expect(
        family.modes.length,
        `no ${family.name} modes were found, so the sweep below checked nothing`,
      ).toBeGreaterThan(0);

      // And they are the same strings `Session.mode` holds, not a parallel set
      // assembled for the test: `modeOf` is what writes one, so a family whose
      // ids were read the wrong way round would land here rather than in a
      // record book that has lost a year of runs.
      expect(family.modes).toContain(modeOf(family.config));
    },
  );
});

describe.each(FAMILIES)("a $name mode", ({ world, modes }) => {
  it.each(modes)("%s resolves to a deck that can name itself", (mode) => {
    const spec = deckSpec(mode);

    // `id` is what a saved run matches itself back to, so it has to be the mode
    // it was asked about rather than the family's own idea of an id.
    expect(spec.id).toBe(mode);
    expect(spec.label.length).toBeGreaterThan(0);
    // The one judgement that decides which mount a run belongs to: a race is on
    // this island only if `deckSpec(mode).world` is the island's world, so a
    // mode landing in the wrong world hides a child's runs from the game they
    // played them in.
    expect(spec.world).toBe(world);
  });

  it.each(modes)("%s marks and folds whatever fact id it is handed", (mode) => {
    const spec = deckSpec(mode);
    for (const factId of FACT_IDS) {
      const where = `${mode} on fact id ${JSON.stringify(factId)}`;
      // Total, all four. The mastery grid, the trouble list and the practice
      // deck are built by mapping these over fact ids stored years ago — an
      // empty one is what `readCard` writes for a card saved before fact ids
      // existed — and one throw takes the whole screen with it.
      expect(typeof spec.masteryKey(factId), where).toBe("string");
      expect(typeof spec.drillKey(factId), where).toBe("string");
      expect(typeof spec.factLabel(factId), where).toBe("string");

      // Fact ids are stored already normalised, so folding one again must land
      // on the same square a fresh card folds onto. A rule that changed its
      // answer on the second pass would split a child's mastery of a word
      // across two cells, one of which nothing can ever fill again.
      const once = spec.normalise(factId);
      expect(spec.normalise(once), where).toBe(once);
      expect(spec.masteryKey(spec.masteryKey(factId)), where).toBe(
        spec.masteryKey(factId),
      );
    }
  });
});

describe("a mode this build has no deck for", () => {
  it.each([
    ["nothing at all", ""],
    ["a word this build never shipped", "nonsense"],
    ["an operation with the wrong case", "MULTIPLY"],
    ["an operation with a stray space", "multiply "],
    // The prefixes without their separator: neither routes, and both are one
    // typo away from a mode that does.
    ["a bare words prefix", "words"],
    ["a bare typing prefix", "typing"],
    // A backup file is restored exactly as it was written, deliberately and
    // without validation (`importAll`), so any string at all can reach here.
    // These are the ones a plain object answers for: `OPERATIONS.constructor`
    // is a function, and handing one back as a deck crashes the record book on
    // the first `masteryKey` rather than at the lookup.
    ["a key every object has", "constructor"],
    ["another", "toString"],
    ["the prototype itself", "__proto__"],
  ])("%s reads as a retired deck", (_why, mode) => {
    expect(deckSpec(mode)).toBe(UNKNOWN_DECK);
  });

  it("keeps a run on a deleted list in its own world", () => {
    // A parent deletes this week's spellings; the races played on them stay in
    // the record book, keep their times, and still open in the jungle. The name
    // is what's lost, not the record.
    const spec = deckSpec(wordMode("week-12-gone"));
    expect(spec.world).toBe("jungle");
    expect(spec.label).toBe("Words");
    expect(spec.masteryKey("Because")).toBe("because");
  });

  it("keeps a run on a retired level in its own world", () => {
    const spec = deckSpec(typingMode("retired-level"));
    expect(spec.world).toBe("ice");
    expect(spec.label).toBe("Typing");
  });

  it.each(["words:", "typing:"])(
    "answers for %s with nothing after it",
    (mode) => {
      // The prefix routes, and then there is no id to look up. It must still
      // come back as a deck of that family rather than reaching for a list
      // called "".
      expect(() => deckSpec(mode)).not.toThrow();
      expect(deckSpec(mode).label.length).toBeGreaterThan(0);
    },
  );
});
