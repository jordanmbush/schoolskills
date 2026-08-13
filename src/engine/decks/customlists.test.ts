import { afterEach, describe, expect, it } from "vitest";

import {
  buildWordDeck,
  setCustomLists,
  wordDeckSpec,
  wordMode,
  wordsOf,
} from "./words";
import { deckSpec } from "./index";
import type { WordConfig } from "@/engine/types";

/**
 * The engine's mirror of the lists a parent typed in.
 *
 * Mutable module state, which is worth testing precisely because it is: it's
 * the one place in the engine where the answer to a question changes over the
 * life of the page.
 */

const config = (over: Partial<WordConfig> = {}): WordConfig => ({
  kind: "words",
  listId: "custom-abc",
  cardCount: 6,
  inputMode: "type",
  ...over,
});

const MINE = [
  {
    id: "custom-abc",
    name: "Week 12",
    words: ["because", "thought", "friend"],
  },
];

afterEach(() => setCustomLists([]));

describe("a list a parent typed in", () => {
  it("builds a deck once mirrored", () => {
    expect(buildWordDeck(config(), 1)).toEqual([]);
    setCustomLists(MINE);
    expect(buildWordDeck(config(), 1)).toHaveLength(6);
  });

  it("names itself in the record book", () => {
    setCustomLists(MINE);
    expect(deckSpec(wordMode("custom-abc")).label).toBe("Week 12");
  });

  it("marks the same way a shipped list does", () => {
    setCustomLists(MINE);
    const spec = wordDeckSpec(wordMode("custom-abc"));
    expect(spec.normalise("Because")).toBe("because");
    expect(spec.masteryKey("THOUGHT")).toBe("thought");
  });

  it("cannot shadow a shipped list", () => {
    // A custom id is always prefixed `custom-`, but the mirror is fed from
    // storage and storage is a file a user could hand-edit. Shipped lists win.
    setCustomLists([{ id: "dolch-1", name: "Hijacked", words: ["nope"] }]);
    expect(deckSpec(wordMode("dolch-1")).label).toBe("First words");
    expect(wordsOf(config({ listId: "dolch-1" }))).toContain("away");
  });

  it("reads as a retired deck once it's gone", () => {
    // Deleting a list must leave every race played on it readable. The name
    // is what's lost, not the record.
    setCustomLists(MINE);
    setCustomLists([]);
    const spec = deckSpec(wordMode("custom-abc"));
    expect(spec.label).toBe("Words");
    expect(spec.masteryKey("Because")).toBe("because");
  });

  it("picks up a rename without a reload", () => {
    setCustomLists(MINE);
    setCustomLists([{ ...MINE[0], name: "Week 13" }]);
    expect(deckSpec(wordMode("custom-abc")).label).toBe("Week 13");
  });
});
