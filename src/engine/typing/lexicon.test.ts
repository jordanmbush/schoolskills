import { describe, expect, it } from "vitest";

import {
  ALTERNATING,
  BIGRAMS,
  DOUBLES,
  HARD_PAIRS,
  LEFT_HAND,
  NAMES,
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
  ["NAMES", NAMES],
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

/** Every lesson that asks for a passage, and the length it asks for. */
const PASSAGE_LESSONS = LESSONS.flatMap((lesson) =>
  lesson.kind.type === "passage"
    ? [{ n: lesson.n, title: lesson.title, wordCount: lesson.wordCount }]
    : [],
);

/** How the ladder will count a passage: whitespace-separated tokens. */
const wordsIn = (passage: string) => passage.split(/\s+/).length;

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
   * a proper noun that has wandered in from `NAMES` or the sentence pool,
   * where names belong.
   *
   * The permitted set is enumerated rather than described by a shape. A regex
   * ending in `[A-Z][a-z]+` — which is what this test used to carry — admits
   * "London", "Ravi" and "England" while claiming to admit only the calendar,
   * and it also cannot see the failure in the other direction: eleven of the
   * twelve months, with the missing one noticed by whichever child types the
   * year out.
   */
  it("is lowercase but for I, the days and the months", () => {
    const days = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const months = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const pronoun = ["I", "I'm", "I've", "I'll", "I'd"];

    const capitalised = WORDS.filter((word) => !/^[a-z']+$/.test(word));
    expect(new Set(capitalised)).toEqual(
      new Set([...pronoun, ...days, ...months]),
    );
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

/**
 * Lesson 33, "Names, and the word I", is a **words** lesson — it hands over a
 * list, not prose — and its entire subject is the one thing `WORDS` is
 * deliberately empty of. Without a pool of its own it is a lesson about names
 * with no name in anything it can reach, which is what these cases are here to
 * stop coming back.
 */
describe("NAMES", () => {
  const LESSON_33 = LESSONS.find((lesson) => lesson.n === 33);

  it("is the pool a names lesson can be built out of", () => {
    expect(LESSON_33?.kind.type).toBe("words");
    expect(NAMES.length).toBeGreaterThanOrEqual(LESSON_33?.wordCount ?? 0);
    expect(NAMES.length).toBe(new Set(NAMES).size);
  });

  it("is names — a capital in, letters only", () => {
    for (const name of NAMES) expect(name).toMatch(/^[A-Z][a-z]+$/);
  });

  /**
   * The apostrophe does not arrive until lesson 35 and the shifts land at 31
   * and 32, so lesson 33 is the first place a capital is typeable at all. A
   * name here that needed a key the child has not met would fail exactly as a
   * word does (§5.2) — as a lesson that cannot be generated.
   */
  it("is typeable at the lesson that asks for it", () => {
    for (const name of NAMES) expect(canType(name, 33)).toBe(true);
  });

  /**
   * And they stay out of `WORDS`. A proper noun in the corpus is a capitalised
   * noun in every draw that is not about names, and there are two thousand of
   * those — the reason the corpus holds no name to begin with.
   */
  it("keeps its names out of the corpus", () => {
    for (const name of NAMES) expect(WORD_SET).not.toContain(name);
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
   * to be generated out of. Case is the generator's to fold — see the
   * `SENTENCES` doc block in `lexicon.ts`, which is where that is written down
   * — so what is being counted here is the *punctuation*, not the capitals.
   */
  it("has plain ones for the lessons that have nothing else yet", () => {
    const plain = SENTENCES.filter((sentence) =>
      /^[A-Za-z ]+\.$/.test(sentence),
    );
    expect(plain.length).toBeGreaterThanOrEqual(25);
  });
});

describe("PASSAGES", () => {
  /**
   * Counted against the ladder, not against a constant. The window this used to
   * assert — fifty to a hundred and sixty — was one no lesson had asked for
   * since the ladder was written, and a pool that topped out at ninety-six
   * passed it while lessons 80, 94, 96 and 100 (a hundred, a hundred, a hundred
   * and twenty, a hundred and fifty) had nothing they could be generated from.
   * A number in a test is a claim about the curriculum, and this is the same
   * mistake the FOCUSES cases above exist to avoid: drive the case off LESSONS
   * and the assertion cannot drift away from what the ladder wants.
   */
  it.each(PASSAGE_LESSONS)(
    "is long enough for lesson $n, $title ($wordCount words)",
    ({ wordCount }) => {
      const long = PASSAGES.filter((p) => wordsIn(p) >= wordCount);
      expect(long.length).toBeGreaterThan(0);
    },
  );

  /**
   * And the exam is not a pool of one. Lesson 100 is the longest ask on the
   * ladder, so a single passage clearing it would mean every child's Ice Exam
   * is the same text, every attempt — which §5.4 does not require and nobody
   * would enjoy.
   */
  it("gives the longest lesson on the ladder a choice", () => {
    const longest = Math.max(...PASSAGE_LESSONS.map((l) => l.wordCount));
    const usable = PASSAGES.filter((p) => wordsIn(p) >= longest);
    expect(usable.length).toBeGreaterThanOrEqual(2);
  });

  /** The other end: a passage is prose, not one of the SENTENCES with a fringe. */
  it("holds nothing short enough to be a sentence", () => {
    for (const passage of PASSAGES)
      expect(wordsIn(passage)).toBeGreaterThan(50);
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

  /**
   * A passage is copied whole, so one that trails off mid-clause reads as a
   * mistake in the lesson rather than as prose. Nothing here may be a fragment.
   */
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
