import { describe, expect, it } from "vitest";

import type { JoinFamily } from "../types";

import { JOIN_FAMILIES, joinFamily, joinPairs } from "./joins";

/**
 * The join families, held to the two things that make them teachable.
 *
 * **A join needs two letters.** Every entry is a pair, because the stroke this
 * table exists to practise only exists between one letter and the next — a
 * single letter with an exit stroke is not a join, and a family that contained
 * one would be a family teaching the wrong thing.
 *
 * **The families are disjoint and in order.** A pair that appeared twice would
 * be a pair a child writes twice on the same page under two different names,
 * and a shuffled order would be a page that teaches the horizontal join before
 * the diagonal one.
 *
 * What is deliberately *not* asserted here is whether any given pair joins.
 * That is the font's answer and not the engine's (`faces.ts`): the looped and
 * fully joined models join out of every letter, the unlooped one lifts the
 * pencil after `b f g j p q s y`, and the same table is correct in all three.
 */

describe("the families of join", () => {
  it("is six families of five pairs, in teaching order", () => {
    expect(JOIN_FAMILIES.map((family) => family.id)).toEqual([
      "diagonal",
      "diagonal-tall",
      "horizontal",
      "horizontal-tall",
      "round",
      "breaks",
    ]);
    for (const family of JOIN_FAMILIES) {
      expect(family.pairs, family.id).toHaveLength(5);
    }
  });

  it("is pairs of small letters, and nothing else", () => {
    // Two letters, both lower case: a capital does not join out of itself in
    // every model, and a three-letter run is a word rather than a join.
    for (const family of JOIN_FAMILIES) {
      for (const pair of family.pairs) {
        expect(pair, family.id).toMatch(/^[a-z]{2}$/);
      }
    }
  });

  it("never writes the same pair twice", () => {
    const all = joinPairs();
    expect(new Set(all).size).toBe(all.length);
  });

  it("says what it teaches, in a line somebody can read", () => {
    for (const family of JOIN_FAMILIES) {
      expect(family.label, family.id).not.toBe("");
      expect(family.blurb.length, family.id).toBeGreaterThan(40);
    }
    const labels = JOIN_FAMILIES.map((family) => family.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("covers the letters the joins are actually taught on", () => {
    const pairs = joinPairs();
    // The four classic joins are named for where the stroke starts, so each
    // family has to start on the letters that produce that stroke: the
    // horizontal ones leave from the top of an o, r, v or w, and the diagonal
    // ones climb from a letter that finishes on the baseline.
    for (const id of ["horizontal", "horizontal-tall"] as JoinFamily[]) {
      for (const pair of joinFamily(id).pairs) {
        expect("orvwf", `${id}: ${pair}`).toContain(pair[0]);
      }
    }
    // And the round family arrives at the anticlockwise letters, which is the
    // whole of what makes it a family.
    for (const pair of joinFamily("round").pairs) {
      expect("acdgoq", pair).toContain(pair[1]);
    }
    // The breaks are the letters a model may not join out of.
    for (const pair of joinFamily("breaks").pairs) {
      expect("bgjpqsyxz", pair).toContain(pair[0]);
    }
    expect(pairs.length).toBe(30);
  });
});

describe("asking for a family", () => {
  it("answers with all of them when nothing was asked for", () => {
    expect(joinPairs()).toEqual(JOIN_FAMILIES.flatMap((one) => one.pairs));
    expect(joinPairs(undefined)).toEqual(joinPairs());
  });

  it("answers with one of them when one was", () => {
    for (const family of JOIN_FAMILIES) {
      expect(joinPairs(family.id)).toEqual(family.pairs);
      expect(joinFamily(family.id)).toBe(family);
    }
  });

  it("survives a config that says something this build has never heard of", () => {
    // A saved sheet outlives the build that wrote it, and a family renamed or
    // dropped must print the first one rather than throw four modules later.
    // `toString` is the shape of that hazard `own` exists for.
    expect(joinFamily("elaborate" as JoinFamily).id).toBe("diagonal");
    expect(joinFamily("toString" as JoinFamily).id).toBe("diagonal");
    expect(joinPairs("constructor" as JoinFamily)).toEqual(
      JOIN_FAMILIES[0].pairs,
    );
  });
});
