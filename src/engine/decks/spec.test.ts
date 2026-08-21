import { describe, expect, it } from "vitest";

import { THEME_COLOUR } from "@/engine/worlds";

import { UNKNOWN_DECK } from "./spec";

/**
 * The stand-in for a deck that isn't in the registry.
 *
 * `DeckSpec` is otherwise a type, and the type checker holds the families to
 * it. The one value in this file is the one a family never wrote: what the
 * record book gets when a parent deletes the spelling list from three months
 * ago and every race played on it is still there.
 *
 * Its whole job is to be uneventful. Each expectation below is really "and it
 * does nothing", because the alternative to nothing is a screen that reshapes a
 * child's history on the way out of storage — folding two facts together, or
 * renaming one — with no deck left to say whether that was right.
 */

describe("a retired deck", () => {
  it("hands facts back exactly as they were stored", () => {
    // No folding, in either key. Whether 7×8 and 8×7 are one fact is a
    // judgement only the family that built them can make, and it is gone.
    for (const factId of ["7:8", "8:7", "because", "The", ""]) {
      expect(UNKNOWN_DECK.masteryKey(factId)).toBe(factId);
      expect(UNKNOWN_DECK.drillKey(factId)).toBe(factId);
      expect(UNKNOWN_DECK.factLabel(factId)).toBe(factId);
    }
  });

  it("forgives nothing but the spaces round an answer", () => {
    // Case is not forgiven here, though the jungle forgives it: "Because" was
    // marked by a deck whose rule this is not, and quietly re-marking a run
    // that has already been scored would rewrite history rather than read it.
    expect(UNKNOWN_DECK.normalise("  56 ")).toBe("56");
    expect(UNKNOWN_DECK.normalise("Because")).toBe("Because");
  });

  it("says what it is, in the words a record book can print", () => {
    // The label is rendered next to a real run with a real time on it, so it
    // has to read as an explanation rather than as a missing value.
    expect(UNKNOWN_DECK.label).toBe("Retired deck");
  });

  it("has a world the site actually themes", () => {
    // A deck from no family has no scenery of its own, and a record-book row is
    // not the place for a child to find that out. Checked against the registry
    // rather than written twice: a world id nothing themes leaves the page on
    // whatever the last one set.
    expect(Object.keys(THEME_COLOUR)).toContain(UNKNOWN_DECK.world);
  });
});
