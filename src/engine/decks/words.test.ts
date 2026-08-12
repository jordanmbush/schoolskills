import { describe, expect, it } from "vitest";

import {
  buildWordDeck,
  buildWordDrill,
  describeWordConfig,
  normaliseWord,
  wordConfigKey,
  wordDeckSpec,
  wordMode,
} from "./words";
import { WORD_LISTS, WORD_LISTS_BY_ID, wordListForAge } from "./wordlists";
import {
  buildDeck,
  configKey,
  deckSpec,
  describeConfig,
  modeOf,
} from "./index";
import type { WordConfig } from "@/engine/types";

const config = (over: Partial<WordConfig> = {}): WordConfig => ({
  kind: "words",
  listId: "dolch-1",
  cardCount: 8,
  inputMode: "type",
  ...over,
});

describe("the word lists", () => {
  it("has no duplicates within a list", () => {
    for (const list of WORD_LISTS) {
      expect(new Set(list.words).size).toBe(list.words.length);
    }
  });

  it("has no blank or multi-word entries", () => {
    // A spelling card can't tell a child that a space is expected, and the
    // splits table would render a stray one invisibly.
    for (const list of WORD_LISTS) {
      for (const word of list.words) {
        expect(word.trim()).toBe(word);
        expect(word).not.toBe("");
        expect(word).not.toContain(" ");
      }
    }
  });

  it("has no capitals a speller would be marked down for", () => {
    // "I" is the one word that is genuinely always capitalised. Anything else
    // with a capital is a proper noun that doesn't belong in a spelling list,
    // because nothing on the card signals that a capital is required.
    for (const list of WORD_LISTS) {
      for (const word of list.words) {
        if (word === "I") continue;
        expect(word).toBe(word.toLowerCase());
      }
    }
  });

  it("gives every age a list", () => {
    for (const age of [3, 4, 5, 6, 7, 8, 9, 10, 11, 14]) {
      expect(wordListForAge(age).words.length).toBeGreaterThan(0);
    }
  });
});

describe("the marking rule", () => {
  it("doesn't care about case", () => {
    expect(normaliseWord("Because")).toBe(normaliseWord("because"));
  });

  it("doesn't care which apostrophe the keyboard produced", () => {
    // iOS substitutes a curly ’ for the straight ' that "don't" is stored
    // with. Failing a child for their phone's typography is indefensible.
    expect(normaliseWord("don’t")).toBe(normaliseWord("don't"));
    expect(normaliseWord("donʼt")).toBe(normaliseWord("don't"));
  });

  it("forgives surrounding and doubled spaces", () => {
    expect(normaliseWord("  because ")).toBe("because");
  });

  it("still fails an actual misspelling", () => {
    expect(normaliseWord("becuase")).not.toBe(normaliseWord("because"));
  });
});

describe("buildWordDeck", () => {
  it("is a pure function of its config and seed", () => {
    expect(buildWordDeck(config(), 4242)).toEqual(
      buildWordDeck(config(), 4242),
    );
    expect(buildWordDeck(config(), 4243)).not.toEqual(
      buildWordDeck(config(), 4242),
    );
  });

  it("speaks the word rather than showing it", () => {
    for (const card of buildWordDeck(config(), 5)) {
      expect(card.speak).toBe(card.answer);
    }
  });

  it("keys each card on the normalised word", () => {
    for (const card of buildWordDeck(config(), 5)) {
      expect(card.factId).toBe(normaliseWord(card.answer));
    }
  });

  it("draws only from its list", () => {
    const list = WORD_LISTS_BY_ID.get("dolch-4")!;
    for (const card of buildWordDeck(config({ listId: "dolch-4" }), 9)) {
      expect(list.words).toContain(card.answer);
    }
  });

  it("exhausts the list before repeating a word", () => {
    const deck = buildWordDeck(config({ listId: "dolch-1", cardCount: 20 }), 3);
    expect(new Set(deck.map((c) => c.answer)).size).toBe(20);
  });

  it("uses an explicit word set in place of the list", () => {
    const deck = buildWordDeck(
      config({ words: ["cat", "dog"], cardCount: 6 }),
      2,
    );
    expect(new Set(deck.map((c) => c.answer))).toEqual(new Set(["cat", "dog"]));
  });

  it("offers four distinct choices including the answer", () => {
    for (const card of buildWordDeck(config({ inputMode: "choose" }), 8)) {
      expect(card.choices).toHaveLength(4);
      expect(new Set(card.choices).size).toBe(4);
      expect(card.choices).toContain(card.answer);
    }
  });

  it("survives a word set too small to fill four choices", () => {
    // A parent's list of three spellings. Fewer buttons is fine; a repeated
    // option or a crash is not.
    const deck = buildWordDeck(
      config({ words: ["cat", "dog"], cardCount: 4, inputMode: "choose" }),
      1,
    );
    for (const card of deck) {
      expect(new Set(card.choices).size).toBe(card.choices!.length);
      expect(card.choices).toContain(card.answer);
    }
  });

  it("returns nothing rather than throwing for a list that doesn't exist", () => {
    expect(buildWordDeck(config({ listId: "no-such-list" }), 1)).toEqual([]);
  });
});

describe("wordConfigKey", () => {
  it("is stable", () => {
    expect(wordConfigKey(config())).toBe("words|dolch-1|8|type");
  });

  it("separates the clock and the input mode", () => {
    expect(wordConfigKey(config({ timeLimitMs: 6000 }))).toBe(
      "words|dolch-1|8|type|t6000",
    );
    expect(wordConfigKey(config({ inputMode: "choose" }))).toBe(
      "words|dolch-1|8|choose",
    );
  });

  it("matches the same custom words typed in a different order", () => {
    // Otherwise a parent re-entering this week's spellings would race nobody,
    // including last week's self.
    expect(wordConfigKey(config({ words: ["cat", "dog"] }))).toBe(
      wordConfigKey(config({ words: ["Dog", "cat"] })),
    );
  });

  it("never collides with an arithmetic key", () => {
    expect(wordConfigKey(config())).toMatch(/^words\|/);
  });
});

describe("buildWordDrill", () => {
  it("asks each word twice, within bounds", () => {
    expect(
      buildWordDrill(["cat"], { listId: "dolch-1", inputMode: "type" }),
    ).toMatchObject({ cardCount: 6, words: ["cat"] });
  });

  it("de-duplicates case-insensitively", () => {
    expect(
      buildWordDrill(["Cat", "cat"], { listId: "dolch-1", inputMode: "type" })
        .words,
    ).toEqual(["cat"]);
  });
});

describe("the deck registry", () => {
  it("routes a word mode to a word spec", () => {
    const spec = deckSpec(wordMode("dolch-1"));
    expect(spec.label).toBe("First words");
    expect(spec.normalise("Because")).toBe("because");
  });

  it("still answers for a list this build has never heard of", () => {
    // What a parent-authored deck looks like from a different device, and what
    // every deck looks like after it's deleted.
    const spec = deckSpec(wordMode("week-12"));
    expect(spec.label).toBe("Words");
    expect(spec.masteryKey("Because")).toBe("because");
  });

  it("dispatches build, key and description on the config's shape", () => {
    const words = config();
    const sums = {
      operation: "multiply" as const,
      tables: [7],
      others: [8],
      cardCount: 4,
      inputMode: "type" as const,
    };
    expect(buildDeck(words, 1)[0].speak).toBeDefined();
    expect(buildDeck(sums, 1)[0].speak).toBeUndefined();
    expect(configKey(words)).toBe(wordConfigKey(words));
    expect(configKey(sums)).toBe("multiply|7|8|4|type");
    expect(describeConfig(words)).toContain("First words");
  });

  it("files a word run under a prefixed mode", () => {
    expect(modeOf(config())).toBe("words:dolch-1");
    expect(
      modeOf({
        operation: "divide",
        tables: [3],
        others: [4],
        cardCount: 4,
        inputMode: "type",
      }),
    ).toBe("divide");
  });

  it("names a word list in the description", () => {
    expect(describeWordConfig(config())).toContain("First words");
    expect(describeWordConfig(config({ inputMode: "choose" }))).toContain(
      "spot it",
    );
  });

  it("labels a word fact as the word", () => {
    expect(wordDeckSpec(wordMode("dolch-1")).factLabel("because")).toBe(
      "because",
    );
  });
});
