import { describe, expect, it } from "vitest";

import { buildDeck, configKey, modeOf } from "@/engine/decks";
import { canType } from "@/engine/typing/keys";
import { lessonById } from "@/engine/typing/lessons";

import { lessonConfig, lessonKey } from "./lessonRun";

/**
 * Starting a lesson from inside the island (§5.3, §5.4).
 *
 * Two things have to hold of the config this hands back, and both of them are
 * about runs that already exist rather than about the one about to start: the
 * key a run is filed under must not move with its passage, and the deck layer
 * must be able to build the run without ever meeting the generator.
 */

/** Lesson 1: `f` and `j`. Its word count is read off the lesson, not here. */
const L01 = lessonById("L01")!;

describe("lessonConfig", () => {
  it("files every attempt under one key, whatever the passage", () => {
    // §5.4, and the reason `configKey` leaves the words out when a lesson id
    // is there to stand in for them: lesson 7 generates a fresh passage every
    // run, so folding them in would put each attempt in a bucket of one and a
    // child would never be shown their own best.
    const first = lessonConfig(L01, 1);
    const second = lessonConfig(L01, 2);

    expect(first.words).not.toEqual(second.words);
    expect(configKey(first)).toBe(configKey(second));
    expect(configKey(first)).toBe(`typing|L01|${L01.wordCount}`);
    // And the run names the lesson, not the level field beside it.
    expect(modeOf(first)).toBe("typing:L01");
  });

  it("carries the whole passage, so the deck never meets the generator", () => {
    const config = lessonConfig(L01, 7);
    const deck = buildDeck(config, 7);

    expect(deck).toHaveLength(L01.wordCount);
    // Every character reachable at lesson 1, which is the generator's first
    // invariant (§5.2) and the thing a config that lost its words would break
    // silently — `passageFor` would fall through to a level id that is really
    // a lesson id and hand back nothing at all.
    expect(deck.every((card) => canType(card.answer, L01.n))).toBe(true);
  });

  /**
   * The choice made in the brief, travelling with the run (§4.2). In the
   * config rather than in memory because the run outlives the navigation that
   * starts it, and because `eyes-up` (§6.7) is a badge for what the run was
   * typed under. Absent when nobody chose: a locked lesson, or a route with no
   * brief.
   */
  it("carries the keyboard the child chose, and nothing when they didn't", () => {
    expect(lessonConfig(L01, 1, "off").keyboard).toBe("off");
    expect(lessonConfig(L01, 1).keyboard).toBeUndefined();
  });

  it("leaves the record book's key alone whatever was chosen", () => {
    // `configKey` must not see it: a child's best at lesson 1 is their best at
    // lesson 1, and splitting the book by how much help was on screen would
    // hide their own record from them the moment they turned the guide off.
    expect(configKey(lessonConfig(L01, 1, "off"))).toBe(
      configKey(lessonConfig(L01, 1, "guide")),
    );
  });
});

describe("lessonKey", () => {
  it("is the key a run of that lesson files under, without a passage", () => {
    // The brief looks up a best on a lesson a child may never start, so it must
    // not pay for a passage to ask — and the two must not drift, or the best
    // shown would come from a different bucket than Start writes into.
    expect(lessonKey(L01)).toBe(configKey(lessonConfig(L01, 3)));
    expect(lessonKey(L01)).toBe(`typing|L01|${L01.wordCount}`);
  });
});
