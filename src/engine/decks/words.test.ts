import { describe, expect, it } from "vitest";

import {
  CLUE_SLOT,
  buildWordDeck,
  buildWordDrill,
  clueParts,
  describeWordConfig,
  fillClue,
  normaliseWord,
  setCustomLists,
  utteranceFor,
  wordConfigKey,
  wordDeckSpec,
  wordMode,
} from "./words";
import {
  WORD_LISTS,
  WORD_LISTS_BY_ID,
  listWords,
  wordListForAge,
} from "./wordlists";
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
      const words = listWords(list);
      expect(new Set(words).size).toBe(words.length);
    }
  });

  it("has no blank or multi-word entries", () => {
    // A spelling card can't tell a child that a space is expected, and the
    // splits table would render a stray one invisibly.
    for (const list of WORD_LISTS) {
      for (const word of listWords(list)) {
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
      for (const word of listWords(list)) {
        if (word === "I") continue;
        expect(word).toBe(word.toLowerCase());
      }
    }
  });

  it("gives every age a list", () => {
    for (const age of [3, 4, 5, 6, 7, 8, 9, 10, 11, 14]) {
      expect(wordListForAge(age).entries.length).toBeGreaterThan(0);
    }
  });
});

/**
 * The sentences are three hundred hand-written strings, which is exactly the
 * kind of content that rots one careless edit at a time. These check the
 * mechanical half of the house rules in wordlists.ts — the half a machine can
 * see. Whether a sentence actually settles which homophone is meant is a
 * judgement, and stays a human's.
 */
describe("the sentence on every word", () => {
  it("gives every word exactly one slot to fill", () => {
    for (const list of WORD_LISTS) {
      for (const { word, clue } of list.entries) {
        expect(clue.split(CLUE_SLOT), `${list.id} · ${word}`).toHaveLength(2);
      }
    }
  });

  it("never spells the word out in its own sentence", () => {
    // The sentence is shown on screen with the slot blank. A clue that also
    // contains the word somewhere else would print the answer next to the gap.
    for (const list of WORD_LISTS) {
      for (const { word, clue } of list.entries) {
        const rest = clue.replace(CLUE_SLOT, " ").toLowerCase();
        const words = rest.split(/[^a-z']+/).filter(Boolean);
        expect(words, `${list.id} · ${word}`).not.toContain(word.toLowerCase());
      }
    }
  });

  it("gives every word a sentence of its own", () => {
    // Four sentences were doing double duty when this was written, including
    // "It is _ hot today." for both "too" and "very" — which is the file's own
    // showcase example of a clue that settles a homophone, quietly settling
    // nothing. Across all six lists, not within one: a child works through
    // them in order and remembers.
    const seen = new Map<string, string>();
    for (const list of WORD_LISTS) {
      for (const { word, clue } of list.entries) {
        const key = clue.toLowerCase();
        const owner = seen.get(key);
        expect(owner, `"${clue}" is also ${owner}'s`).toBeUndefined();
        seen.set(key, `${list.id}:${word}`);
      }
    }
  });

  it("keeps them short enough to read out on a clock", () => {
    for (const list of WORD_LISTS) {
      for (const { word, clue } of list.entries) {
        const length = fillClue(clue, word).split(/\s+/).length;
        expect(length, `${list.id} · ${word}`).toBeLessThanOrEqual(8);
      }
    }
  });

  it("speaks the word first, then the word in its sentence", () => {
    // Word first so a child can start typing while the context arrives — see
    // `utteranceFor`.
    expect(utteranceFor({ word: "sleep", clue: "Time to go to _." })).toBe(
      "sleep. Time to go to sleep.",
    );
  });

  it("says only the word for a deck that has no sentences", () => {
    expect(utteranceFor({ word: "photosynthesis" })).toBe("photosynthesis");
  });

  it("splits a clue either side of its slot, for rendering the gap", () => {
    expect(clueParts("This is _ house.")).toEqual(["This is ", " house."]);
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

  it("speaks the word rather than showing it, and leads with the word", () => {
    for (const card of buildWordDeck(config(), 5)) {
      expect(card.speak).toBeTruthy();
      expect(card.speak!.startsWith(`${card.answer}.`)).toBe(true);
    }
  });

  it("carries the sentence for the card to show with a blank in it", () => {
    for (const card of buildWordDeck(config(), 5)) {
      expect(card.clue).toContain(CLUE_SLOT);
      // What's spoken is the word, then that same sentence filled in.
      expect(card.speak).toBe(
        `${card.answer}. ${fillClue(card.clue!, card.answer)}`,
      );
    }
  });

  it("still builds a deck from a list with no sentences", () => {
    // A parent's list is plain words. Those cards say the word and show dots,
    // exactly as every word card did before sentences existed.
    setCustomLists([{ id: "mine", name: "Week 3", words: ["stegosaurus"] }]);
    const [card] = buildWordDeck(config({ listId: "mine", cardCount: 1 }), 1);
    expect(card.speak).toBe("stegosaurus");
    expect(card.clue).toBeUndefined();
    setCustomLists([]);
  });

  it("keys each card on the normalised word", () => {
    for (const card of buildWordDeck(config(), 5)) {
      expect(card.factId).toBe(normaliseWord(card.answer));
    }
  });

  it("draws only from its list", () => {
    const list = WORD_LISTS_BY_ID.get("dolch-4")!;
    for (const card of buildWordDeck(config({ listId: "dolch-4" }), 9)) {
      expect(listWords(list)).toContain(card.answer);
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

  it("reunites a drill's words with their sentences", () => {
    // A drill carries plain strings, so the clues have to be looked up again
    // from the list it came from. Getting this wrong would strip the context
    // from the one deck that needs it most: the words already going wrong.
    const deck = buildWordDeck(
      config({ listId: "dolch-4", words: ["their"], cardCount: 2 }),
      7,
    );
    expect(deck[0].clue).toBe("This is _ house.");
  });

  it("leaves a drilled word clueless if its list no longer has it", () => {
    const deck = buildWordDeck(
      config({ listId: "dolch-4", words: ["zzz"], cardCount: 1 }),
      7,
    );
    expect(deck[0].clue).toBeUndefined();
    expect(deck[0].speak).toBe("zzz");
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
