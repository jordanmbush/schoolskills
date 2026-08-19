import { describe, expect, it } from "vitest";

import {
  ALTERNATING,
  BIGRAMS,
  DOUBLES,
  HARD_PAIRS,
  LEFT_HAND,
  PASSAGES,
  RIGHT_HAND,
  SENTENCES,
  TRIGRAMS,
  WORDS,
} from "./lexicon";
import { canType } from "./keys";
import { LESSONS } from "./lessons";
import { strokeFor } from "../keyboard";

/**
 * The corpus, checked against the board it will be typed on.
 *
 * One assertion here matters more than the rest: **every character of every
 * word, sentence and passage has a `strokeFor`**. Typing marks exactly, so a
 * curly quotation mark, an accent or an em dash that reached this file by way
 * of a copy-paste is not a typo — it is a lesson a child cannot pass, however
 * well they type it, and they will be the one who finds it. `decks/typing.ts`
 * had to hand-exclude exactly that from the Scripture pool; here it is a test
 * instead of a reading rule.
 *
 * The rest of the suite is about the ladder actually being able to use what is
 * here — a bigram lesson with no words in it, or a first words lesson whose
 * alphabet leaves an empty bag, fails silently in front of a five-year-old.
 */

/** Every string this file offers, in one place, so nothing escapes the check. */
const EVERY_POOL: [name: string, entries: readonly string[]][] = [
  ["WORDS", WORDS],
  ["BIGRAMS", BIGRAMS],
  ["DOUBLES", DOUBLES],
  ["HARD_PAIRS", HARD_PAIRS],
  ["TRIGRAMS", TRIGRAMS],
  ["ALTERNATING", ALTERNATING],
  ["LEFT_HAND", LEFT_HAND],
  ["RIGHT_HAND", RIGHT_HAND],
  ["SENTENCES", SENTENCES],
  ["PASSAGES", PASSAGES],
];

/** The characters of `text` this layout cannot produce. Empty is the pass. */
const untypeable = (text: string) => [...text].filter((ch) => !strokeFor(ch));

/** `"l"` or `"r"`, or null for the space bar — which is neither hand's. */
const handOf = (ch: string): "l" | "r" | null => {
  const finger = strokeFor(ch)?.finger;
  if (!finger) return null;
  return finger.startsWith("l-") ? "l" : finger.startsWith("r-") ? "r" : null;
};

const WORD_SET = new Set(WORDS);

/** Every sequence the ladder actually drills, with the lesson that drills it. */
const FOCUSES = LESSONS.flatMap((lesson) =>
  lesson.kind.type === "bigrams"
    ? lesson.kind.focus.map((focus) => ({ n: lesson.n, focus }))
    : [],
);

describe("the whole file, as characters", () => {
  it.each(EVERY_POOL)("%s is producible on this keyboard", (_name, pool) => {
    const bad = pool.flatMap((entry) => untypeable(entry));
    expect(bad).toEqual([]);
  });

  /**
   * The three that get in without being obviously foreign, so they are named
   * rather than left to the check above: a curly apostrophe reads as an
   * apostrophe at a glance, an en dash reads as a hyphen, and an accented
   * letter reads as a letter. All three would pass a review and fail a child.
   */
  it("has no smart quotes, dashes or accents anywhere", () => {
    const smuggled = /[‘’“”–—À-ɏ]/;
    for (const [, pool] of EVERY_POOL)
      for (const entry of pool) expect(entry).not.toMatch(smuggled);
  });
});

describe("WORDS", () => {
  /**
   * Big enough to survive the filter is the whole reason this file exists
   * (§5.3). The number is a floor rather than a target: two thousand is what
   * it takes for the home row, the one-hand lessons and the bigram lessons to
   * each come back with a choice rather than with whatever survived.
   */
  it("is a few thousand words", () => {
    expect(WORDS.length).toBeGreaterThanOrEqual(2000);
  });

  it("holds no word twice", () => {
    expect(WORDS.length).toBe(new Set(WORDS).size);
  });

  /**
   * Letters and the apostrophe, and capitals only where English insists on
   * them: `I`, and the days and months. Anything else with a capital in it is
   * a proper noun that has wandered in from the sentence pool, where names
   * belong.
   */
  it("is lowercase but for I, the days and the months", () => {
    const shape = /^[a-z']+$/;
    const allowed = /^(I|I'[a-z]+|[A-Z][a-z]+day|[A-Z][a-z]+)$/;
    const capitalised = WORDS.filter((word) => !shape.test(word));
    expect(capitalised.every((word) => allowed.test(word))).toBe(true);
    expect(capitalised).toContain("I");
    expect(capitalised).toContain("March");
    expect(WORDS.filter((word) => /[^A-Za-z']/.test(word))).toEqual([]);
  });

  /**
   * Lesson 7 is where words start, and its alphabet is `a s d f g h j k l ;`
   * — nine letters, in which English has barely two dozen words (§5.5). This
   * is the assertion the "words the home row needs" band exists for, and the
   * one a corpus assembled purely by frequency would fail.
   */
  it("still has words when the alphabet is the home row", () => {
    const home = WORDS.filter((word) => word.length >= 2 && canType(word, 7));
    expect(home.length).toBeGreaterThanOrEqual(20);
  });

  /** The two lessons that are a `slice` of this array, and nothing else. */
  it("opens with the words lessons 41 and 48 ask for", () => {
    expect(WORDS.slice(0, 25)).toContain("the");
    expect(WORDS.slice(0, 25).every((word) => word.length <= 5)).toBe(true);
    expect(new Set(WORDS.slice(0, 100)).size).toBe(100);
  });
});

describe("the focus sets", () => {
  it("are pairs, doubles and triples of the length they claim", () => {
    expect(BIGRAMS.every((pair) => pair.length === 2)).toBe(true);
    expect(HARD_PAIRS.every((pair) => pair.length === 2)).toBe(true);
    expect(TRIGRAMS.every((triple) => triple.length === 3)).toBe(true);
    expect(DOUBLES.every(([a, b]) => a === b)).toBe(true);
  });

  /**
   * The claim `HARD_PAIRS` is built on: both letters live under one finger, so
   * the hand cannot roll through them. It is checked rather than trusted
   * because it is a fact about the *layout* — a second board would rearrange
   * which pairs are hard, and this is what would say so (§3.4).
   */
  it("makes HARD_PAIRS one finger, twice", () => {
    for (const pair of HARD_PAIRS) {
      const [first, second] = [...pair].map((ch) => strokeFor(ch)?.finger);
      expect(first).toBeDefined();
      expect(first).toBe(second);
    }
  });

  /**
   * The cross-check that keeps the ladder and the corpus in step: every
   * sequence a bigram lesson names is one of the sets here, and the corpus can
   * offer at least one word containing it *at that lesson's alphabet*. Both
   * halves are needed — a focus nobody stocked and a focus whose only words
   * use a letter the child has not met fail identically, as a lesson that
   * cannot be generated.
   */
  it.each(FOCUSES)("stocks lesson $n's $focus", ({ n, focus }) => {
    const known = new Set([...BIGRAMS, ...DOUBLES, ...HARD_PAIRS, ...TRIGRAMS]);
    expect(known).toContain(focus);

    const usable = WORDS.filter(
      (word) => word.includes(focus) && canType(word, n),
    );
    expect(usable.length).toBeGreaterThan(0);
  });
});

describe("the hand sets", () => {
  it("are all words the corpus knows", () => {
    for (const word of [...ALTERNATING, ...LEFT_HAND, ...RIGHT_HAND])
      expect(WORD_SET).toContain(word);
  });

  it("really do alternate hands, letter by letter", () => {
    for (const word of ALTERNATING) {
      const hands = [...word].map(handOf);
      expect(hands.every((hand) => hand !== null)).toBe(true);
      for (let i = 1; i < hands.length; i++)
        expect(hands[i]).not.toBe(hands[i - 1]);
    }
  });

  it.each([
    ["LEFT_HAND", LEFT_HAND, "l"],
    ["RIGHT_HAND", RIGHT_HAND, "r"],
  ] as const)("keeps %s on one hand", (_name, pool, hand) => {
    for (const word of pool)
      expect([...word].map(handOf).every((h) => h === hand)).toBe(true);
  });

  /** Lesson 47 runs forty words. Below this it is one word four times. */
  it("has enough of each to fill a lesson", () => {
    expect(ALTERNATING.length).toBeGreaterThanOrEqual(50);
    expect(LEFT_HAND.length).toBeGreaterThanOrEqual(40);
    expect(RIGHT_HAND.length).toBeGreaterThanOrEqual(30);
  });
});

describe("SENTENCES", () => {
  it("are sentences — a capital in, a stop out", () => {
    for (const sentence of SENTENCES) {
      expect(sentence).toMatch(/^["A-Z]/);
      expect(sentence).toMatch(/[.!?"]$/);
      expect(sentence).not.toMatch(/\s{2}|^\s|\s$/);
    }
  });

  it("holds no sentence twice", () => {
    expect(SENTENCES.length).toBe(new Set(SENTENCES).size);
  });

  /**
   * Lessons 30 and 36 are sentence lessons with no punctuation past the full
   * stop unlocked, so the pool has to hold enough of the plain kind for them
   * to be generated out of. Case is the generator's to fold (§5.3) — what is
   * being counted here is the *punctuation*, not the capitals.
   */
  it("has plain ones for the lessons that have nothing else yet", () => {
    const plain = SENTENCES.filter((sentence) =>
      /^[A-Za-z ]+\.$/.test(sentence),
    );
    expect(plain.length).toBeGreaterThanOrEqual(25);
  });
});

describe("PASSAGES", () => {
  it("are the length the endurance blocks ask for", () => {
    for (const passage of PASSAGES) {
      const words = passage.split(/\s+/).length;
      expect(words).toBeGreaterThanOrEqual(50);
      expect(words).toBeLessThanOrEqual(160);
    }
  });

  it("holds no passage twice", () => {
    expect(PASSAGES.length).toBe(new Set(PASSAGES).size);
  });

  /**
   * Lesson 76 is "Someone speaking" and lesson 78 is "Numbers in prose", and
   * neither can be generated out of a pool of plain paragraphs. One of each is
   * the floor, not the intent.
   */
  it("includes speech and includes numbers", () => {
    expect(PASSAGES.filter((p) => p.includes('"')).length).toBeGreaterThan(0);
    expect(PASSAGES.filter((p) => /\d/.test(p)).length).toBeGreaterThan(0);
  });

  /** Lesson 100 asks for a hundred and fifty words; nothing may be a fragment. */
  it("ends every passage on a stop", () => {
    for (const passage of PASSAGES) expect(passage).toMatch(/[.!?"]$/);
  });
});

/**
 * The bundle rule, from the corpus's side.
 *
 * `eslint.config.mjs` bans the import and `eslint.config.test.mjs` proves the
 * ban fires; this is the other half — that nothing here needs the deck layer
 * either, so the wall has no reason to be climbed from this direction. A
 * corpus that imported `decks/wordlists.ts` for its sight words would put the
 * two modules in one graph again, from the end nobody is watching.
 */
describe("the layer it must not reach into", () => {
  it("imports nothing from the deck layer", async () => {
    const { readFile } = await import("node:fs/promises");
    const source = await readFile(
      new URL("./lexicon.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/from\s+["'][^"']*decks/);
  });
});
