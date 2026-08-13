import { describe, expect, it } from "vitest";

import {
  TYPING_LEVELS,
  TYPING_LEVELS_BY_ID,
  buildTypingDeck,
  buildTypingDrill,
  describeTypingConfig,
  passageFor,
  typingConfigKey,
  typingDeckSpec,
  typingLevelForAge,
  typingMode,
  wordsPerMinute,
} from "./typing";
import { buildDeck, configKey, deckSpec, isTyping, modeOf } from "./index";
import type { TypingConfig } from "@/engine/types";

const config = (over: Partial<TypingConfig> = {}): TypingConfig => ({
  kind: "typing",
  levelId: "home-row",
  wordCount: 20,
  ...over,
});

const HOME_ROW_KEYS = new Set("asdfghjkl".split(""));

describe("the levels", () => {
  it("keeps the home row level on the home row", () => {
    // The whole promise of level one is that a five-year-old's fingers never
    // leave the row they were put on. One stray "b" breaks it silently.
    for (const word of TYPING_LEVELS_BY_ID.get("home-row")!.pool) {
      for (const letter of word) {
        expect(HOME_ROW_KEYS.has(letter)).toBe(true);
      }
    }
  });

  it("keeps the second level off the bottom row", () => {
    // Level two adds q–p above the home row and nothing below it, so a child
    // who has only been taught two rows can type every word here.
    for (const word of TYPING_LEVELS_BY_ID.get("top-row")!.pool) {
      expect(word).not.toMatch(/[zxcvbnm]/);
    }
  });

  it("gives every level something to type", () => {
    for (const level of TYPING_LEVELS) {
      expect(level.pool.length).toBeGreaterThan(8);
      expect(new Set(level.pool).size).toBe(level.pool.length);
    }
  });

  it("only puts capitals and sentence punctuation in the level that teaches them", () => {
    for (const level of TYPING_LEVELS) {
      if (level.kind === "sentences") continue;
      for (const word of level.pool) {
        // "I" is the one word that is always capitalised, and it reaches the
        // "every letter" level from the sight-word lists. Everything else with
        // a capital would be teaching the shift key two levels early.
        if (word !== "I") expect(word).toBe(word.toLowerCase());
        expect(word).not.toMatch(/[.,?!]/);
      }
    }
  });

  it("gives every age a level", () => {
    for (const age of [4, 5, 6, 7, 8, 9, 10, 11, 14]) {
      expect(typingLevelForAge(age).pool.length).toBeGreaterThan(0);
    }
  });
});

describe("passageFor", () => {
  it("is a pure function of its config and seed", () => {
    // Ghost racing depends on it outright: a rival's run replays from a seed,
    // so a different passage would be a different race scored as the same one.
    expect(passageFor(config(), 77)).toEqual(passageFor(config(), 77));
    expect(passageFor(config(), 78)).not.toEqual(passageFor(config(), 77));
  });

  it("is exactly as long as asked", () => {
    for (const wordCount of [20, 30, 50, 80]) {
      expect(passageFor(config({ wordCount }), 3)).toHaveLength(wordCount);
    }
  });

  it("exhausts the pool before repeating", () => {
    const pool = TYPING_LEVELS_BY_ID.get("home-row")!.pool.length;
    expect(new Set(passageFor(config({ wordCount: pool }), 9)).size).toBe(pool);
  });

  it("builds sentence levels out of whole sentences", () => {
    // Splitting a bag of words would strip the capital off the start and leave
    // full stops floating mid-line.
    const words = passageFor(
      config({ levelId: "sentences", wordCount: 40 }),
      2,
    );
    expect(words[0][0]).toBe(words[0][0].toUpperCase());
    expect(words.some((w) => w.endsWith("."))).toBe(true);
    expect(words.every((w) => !w.includes(" "))).toBe(true);
  });

  it("uses an explicit word set in place of the level", () => {
    const words = passageFor(
      config({ words: ["ask", "add"], wordCount: 6 }),
      1,
    );
    expect(new Set(words)).toEqual(new Set(["ask", "add"]));
    expect(words).toHaveLength(6);
  });

  it("returns nothing rather than throwing for a level that doesn't exist", () => {
    expect(passageFor(config({ levelId: "no-such-level" }), 1)).toEqual([]);
  });
});

describe("buildTypingDeck", () => {
  it("makes one card per word, with nothing to speak", () => {
    const deck = buildTypingDeck(config({ wordCount: 5 }), 4);
    expect(deck).toHaveLength(5);
    for (const card of deck) {
      expect(card.prompt).toBe(card.answer);
      expect(card.factId).toBe(card.answer);
      expect(card.speak).toBeUndefined();
      expect(card.choices).toBeUndefined();
    }
  });
});

describe("the marking rule", () => {
  const { normalise } = typingDeckSpec(typingMode("sentences"));

  it("is exact about case, because the shift key is the exercise", () => {
    expect(normalise("The")).not.toBe(normalise("the"));
  });

  it("is exact about punctuation too", () => {
    expect(normalise("dog.")).not.toBe(normalise("dog"));
  });

  it("forgives only the whitespace a keyboard adds", () => {
    expect(normalise(" dog. ")).toBe(normalise("dog."));
  });
});

describe("wordsPerMinute", () => {
  it("counts five characters as a word, not one word as a word", () => {
    // 12 × ("asdf" plus the space that committed it) is 60 characters, which
    // is 12 standard words — the same number only by coincidence.
    const cards = Array.from({ length: 12 }, () => ({ answer: "asdf" }));
    expect(wordsPerMinute(cards, 60_000)).toBe(12);
    // Eight-letter words: 12 × 9 = 108 characters, or 21.6 standard words.
    const longer = Array.from({ length: 12 }, () => ({ answer: "together" }));
    expect(wordsPerMinute(longer, 60_000)).toBe(22);
  });

  it("doesn't let a passage of short words inflate the score", () => {
    const short = Array.from({ length: 20 }, () => ({ answer: "as" }));
    const long = Array.from({ length: 20 }, () => ({ answer: "together" }));
    expect(wordsPerMinute(short, 60_000)).toBeLessThan(
      wordsPerMinute(long, 60_000),
    );
  });

  it("is zero rather than Infinity for a run of no length", () => {
    expect(wordsPerMinute([{ answer: "as" }], 0)).toBe(0);
    expect(wordsPerMinute([], 60_000)).toBe(0);
  });
});

describe("configKey", () => {
  it("is stable", () => {
    expect(typingConfigKey(config())).toBe("typing|home-row|20");
  });

  it("separates levels and lengths", () => {
    expect(typingConfigKey(config({ wordCount: 50 }))).toBe(
      "typing|home-row|50",
    );
    expect(typingConfigKey(config({ levelId: "sentences" }))).toBe(
      "typing|sentences|20",
    );
  });

  it("never collides with a word or arithmetic key", () => {
    expect(typingConfigKey(config())).toMatch(/^typing\|/);
  });
});

describe("the deck registry", () => {
  it("routes a typing mode to a typing spec", () => {
    expect(deckSpec(typingMode("home-row")).label).toBe("Home row");
  });

  it("still answers for a level this build has never heard of", () => {
    expect(deckSpec(typingMode("retired")).label).toBe("Typing");
  });

  it("dispatches build, key and description on the config's shape", () => {
    expect(isTyping(config())).toBe(true);
    expect(buildDeck(config({ wordCount: 3 }), 1)).toHaveLength(3);
    expect(configKey(config())).toBe(typingConfigKey(config()));
    expect(describeTypingConfig(config())).toContain("Home row");
  });

  it("files a typing run under a prefixed mode", () => {
    expect(modeOf(config())).toBe("typing:home-row");
  });
});

describe("buildTypingDrill", () => {
  it("gives each fumbled word three goes, within bounds", () => {
    expect(buildTypingDrill(["ask"], "home-row")).toMatchObject({
      kind: "typing",
      levelId: "home-row",
      words: ["ask"],
      wordCount: 10,
    });
    const many = Array.from({ length: 30 }, (_, i) => `w${i}`);
    expect(buildTypingDrill(many, "home-row").wordCount).toBe(40);
  });

  it("de-duplicates without folding case", () => {
    // "The" and "the" are different things to practise here.
    expect(buildTypingDrill(["The", "the", "the"], "sentences").words).toEqual([
      "The",
      "the",
    ]);
  });
});
