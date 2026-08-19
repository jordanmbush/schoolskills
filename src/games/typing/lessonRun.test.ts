import { describe, expect, it } from "vitest";

import { buildDeck, configKey, modeOf } from "@/engine/decks";
import { canType } from "@/engine/typing/keys";
import { lessonById } from "@/engine/typing/lessons";

import { lessonConfig } from "./lessonRun";

/**
 * Starting a lesson from inside the island (docs/typing.md §5.3, §5.4).
 *
 * Two things have to hold of the config this hands back, and both of them are
 * about runs that already exist rather than about the one about to start: the
 * key a run is filed under must not move with its passage, and the deck layer
 * must be able to build the run without ever meeting the generator.
 */

/** Lesson 1: `f` and `j`, 24 words. */
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
});
