import { describe, expect, it } from "vitest";

import { generate } from "./generate";
import { oneHanded } from "./hands";
import { canType, unlockedAt } from "./keys";
import { HELD_KEY_LESSONS, LESSONS, isHeldKeyLesson } from "./lessons";
import type { HeldKeyLesson, Lesson } from "./lessons";
import { LEFT_HAND, RIGHT_HAND, WORDS } from "./lexicon";

/**
 * The three invariants that make a hundred generated lessons safe (§5.2, §12):
 * reachability, `pass.keyStrikes` met at every seed, and new keys at 15–35% of
 * the characters.
 *
 * Each is asserted over all hundred lessons crossed with a spread of seeds,
 * because a generator is a distribution and one seed is an anecdote. Failures
 * are collected rather than thrown at the first one: "lessons 71, 73 and 77
 * are short of strikes" is a finding about the ladder, where "lesson 71 is" is
 * a bug report you have to fix three times.
 *
 * At lesson 1 the unlocked alphabet is `f`, `j` and the space bar, so the
 * 15–35% band is arithmetically impossible there. The band is asserted
 * wherever the ladder has anything to review, and a stronger claim — every
 * character is a new key — where it has not. Both halves are derived from
 * `unlockedAt` rather than from a list of excused lesson numbers, so a
 * re-ordered ladder that leaves lesson 46 with nothing to review is reported
 * by the same line rather than covered by it.
 */

/** §5.2's band. Not a knob — see the note above before touching either end. */
const MIN_NEW_SHARE = 0.15;
const MAX_NEW_SHARE = 0.35;

/**
 * Enough seeds that a rare draw is not a lucky pass. Sixteen crossed with a
 * hundred lessons runs in under a second, because the corpus is filtered once
 * per lesson. Spread rather than 0–15: `mulberry32` is well-behaved over
 * neighboring seeds, but the numbers a run actually uses come from
 * `randomSeed()` and look nothing like a counter.
 */
const SEEDS = [
  0, 1, 2, 7, 42, 99, 128, 1000, 4242, 65535, 123456, 999983, 2147483647,
  16777216, 31337, 8675309,
];

/**
 * Every lesson that has text — the storms have a wave instead (§8.3). Read off
 * the *kind* and not off `wordCount`: a storm level's `wordCount` is its
 * wave's `count` (§5.6), so "has a length" is true of all hundred and "has
 * words" of eighty.
 */
const WITH_TEXT = LESSONS.filter((lesson) => lesson.kind.type !== "storm");

/** The lessons the new-key invariants are about. */
/**
 * Every lesson with new keys to strike — minus the held-key drills, whose
 * "review" is the pinned hand's half of the alphabet and so is not review
 * at all. They are held to the band against the free hand's alphabet in
 * their own describe below.
 */
const INTRODUCING = WITH_TEXT.filter(
  (lesson) => lesson.introduces.length > 0 && !isHeldKeyLesson(lesson),
);

/** A lesson's text as a child meets it: the words, and the spaces between. */
const textOf = (lesson: Lesson, seed: number) =>
  generate(lesson, seed).join(" ");

/** What the ladder has given this lesson that it did not give it today. */
const reviewAt = (lesson: Lesson) =>
  [...unlockedAt(lesson.n)].filter(
    (ch) => ch !== " " && !lesson.introduces.includes(ch),
  );

/** How many of `text`'s characters are in `chars`. */
const countOf = (text: string, chars: readonly string[]) => {
  const wanted = new Set(chars);
  return [...text].filter((ch) => wanted.has(ch)).length;
};

describe("the reachability invariant", () => {
  /**
   * `canType` is asked per character rather than per word so the report names
   * the character: "L27 needs 'q'" is a curriculum bug you can act on.
   */
  it("never asks for a key the lesson has not taught", () => {
    const offenders: string[] = [];
    for (const lesson of WITH_TEXT)
      for (const seed of SEEDS) {
        const unreachable = new Set(
          [...textOf(lesson, seed)].filter((ch) => !canType(ch, lesson.n)),
        );
        for (const ch of unreachable)
          offenders.push(`${lesson.id} seed ${seed}: ${JSON.stringify(ch)}`);
      }
    expect(offenders).toEqual([]);
  });

  /**
   * A lesson asks for `wordCount` words because that is what its wpm bar is
   * computed against (§6.3): one that quietly ran nine words short would
   * report a speed nobody typed. Storms are excluded here and asked the
   * question they do have an answer to — no text at all — three tests down.
   */
  it("produces exactly the number of words the lesson asks for", () => {
    const offenders: string[] = [];
    for (const lesson of WITH_TEXT)
      for (const seed of SEEDS) {
        const words = generate(lesson, seed);
        if (words.length !== lesson.wordCount)
          offenders.push(
            `${lesson.id} seed ${seed}: ${words.length} of ${lesson.wordCount}`,
          );
        if (words.some((word) => word === "" || word.includes(" ")))
          offenders.push(`${lesson.id} seed ${seed}: a word holds a space`);
      }
    expect(offenders).toEqual([]);
  });
});

describe("the new-key invariant", () => {
  /**
   * §6.4's gate will not judge a key until `keyStrikes` strikes of it. Text
   * short of that is a lesson that cannot be passed however well it is typed,
   * with nothing on screen to say why.
   */
  it("strikes every new key at least as often as its gate demands", () => {
    const offenders: string[] = [];
    for (const lesson of INTRODUCING) {
      const strikes =
        lesson.pass.kind === "lesson" ? lesson.pass.keyStrikes : 0;
      for (const seed of SEEDS) {
        const text = textOf(lesson, seed);
        for (const ch of lesson.introduces) {
          const struck = countOf(text, [ch]);
          if (struck < strikes)
            offenders.push(
              `${lesson.id} seed ${seed}: ${ch} × ${struck}, needs ${strikes}`,
            );
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the new keys between 15% and 35% of the characters", () => {
    const offenders: string[] = [];
    for (const lesson of INTRODUCING) {
      if (reviewAt(lesson).length === 0) continue;
      for (const seed of SEEDS) {
        const text = textOf(lesson, seed);
        const share = countOf(text, lesson.introduces) / text.length;
        if (share < MIN_NEW_SHARE || share > MAX_NEW_SHARE)
          offenders.push(
            `${lesson.id} seed ${seed}: ${(share * 100).toFixed(1)}%`,
          );
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The exception the header describes, asserted rather than assumed: pinning
   * the list to `L01` is what stops "nothing to review" becoming a silent
   * excuse the day somebody moves a lesson.
   */
  it("spends a lesson with nothing to review entirely on its new keys", () => {
    const nothingToReview = INTRODUCING.filter(
      (lesson) => reviewAt(lesson).length === 0,
    );
    expect(nothingToReview.map((lesson) => lesson.id)).toEqual(["L01"]);

    for (const lesson of nothingToReview)
      for (const seed of SEEDS) {
        const text = textOf(lesson, seed);
        const letters = text.replace(/ /g, "");
        expect(countOf(letters, lesson.introduces), lesson.id).toBe(
          letters.length,
        );
      }
  });
});

describe("generate", () => {
  /**
   * Not a nicety: a lesson is re-rendered on every mount of the results screen
   * and re-read out of the record book months later, and a run whose text
   * changed underneath it would show a child a passage they never typed.
   */
  it("gives the same text for the same lesson and seed", () => {
    for (const lesson of WITH_TEXT)
      expect(generate(lesson, 4242)).toEqual(generate(lesson, 4242));
  });

  /**
   * Counted across the ladder rather than asserted per lesson: lesson 10 draws
   * from ten words and lesson 1 from two keys, so a handful of collisions is
   * the pool being small rather than the seed being ignored.
   */
  it("gives different text for different seeds", () => {
    const same = WITH_TEXT.filter(
      (lesson) => textOf(lesson, 1) === textOf(lesson, 2),
    );
    expect(same.length).toBeLessThan(WITH_TEXT.length / 10);
  });

  /** A storm level has a wave, not a passage (§8.3). */
  it("gives a storm level no text at all", () => {
    for (const lesson of LESSONS.filter((l) => l.kind.type === "storm"))
      expect(generate(lesson, 7)).toEqual([]);
  });
});

describe("a lesson's kind decides its text", () => {
  const kindOf = (n: number) =>
    LESSONS.find((lesson) => lesson.n === n) as Lesson;

  /**
   * A drill is groups of one length, so the lesson is as long in characters as
   * `strikesFor` assumed when it sized the gate — five to a word, the space
   * included.
   */
  it("keys · lays the new keys into even letter groups", () => {
    for (const lesson of LESSONS.filter((l) => l.kind.type === "keys"))
      for (const word of generate(lesson, 99))
        expect(word.length, `${lesson.id}: ${word}`).toBe(4);
  });

  /**
   * Lesson 10's focus is `ll`, `ss` and `dd` at nine unlocked letters, where
   * `ss` has exactly one word in the corpus. Round-robin over the sequences is
   * what gets that word drilled at all, so the assertion is that every focus
   * turns up — not that the words are evenly spread.
   */
  it("bigrams · chooses words for the sequences they contain", () => {
    for (const lesson of LESSONS) {
      if (lesson.kind.type !== "bigrams") continue;
      const words = generate(lesson, 7);
      for (const focus of lesson.kind.focus)
        expect(
          words.some((word) => word.includes(focus)),
          `${lesson.id} · ${focus}`,
        ).toBe(true);
      for (const word of words)
        expect(
          lesson.kind.focus.some((focus) => word.includes(focus)),
          `${lesson.id}: ${word}`,
        ).toBe(true);
    }
  });

  /**
   * Whole sentences, split on spaces and never on meaning. The last one may be
   * cut short by the lesson's length; the ones before it arrive entire, which
   * is what the first word being a sentence's first word tests for.
   */
  it("sentences · splits English rather than assembling it", () => {
    const words = generate(kindOf(42), 11);
    expect(words[0]).toMatch(/^[A-Z]/);
    const stops = words.filter((word) => /[.?!]$/.test(word));
    expect(stops.length).toBeGreaterThan(2);
  });

  /** Real prose from the library, long enough to be a paragraph (§5.6, 71–100). */
  it("passage · draws whole paragraphs", () => {
    const words = generate(kindOf(110), 3);
    expect(words.length).toBe(150);
    expect(words.join(" ")).toContain(". ");
  });

  /**
   * Ages, dates, scores and prices — figures with a shape, not digits at
   * random. Lesson 67 is the one that asks, and the hyphen has not arrived
   * yet, so a score is absent there rather than rewritten into something a
   * child cannot type.
   */
  it("numbers · gives every token a figure in it", () => {
    for (const word of generate(kindOf(67), 5)) expect(word).toMatch(/[0-9]/);
  });

  /** Prose with numbers in it — both halves, in every lesson that asks. */
  it("mixed · puts figures inside sentences", () => {
    for (const n of [68, 70, 102, 105]) {
      const words = generate(kindOf(n), 13);
      expect(
        words.some((word) => /[0-9]/.test(word)),
        `lesson ${n}`,
      ).toBe(true);
      expect(
        words.filter((word) => /^[a-z]+$/.test(word)).length,
        `lesson ${n}`,
      ).toBeGreaterThan(words.length / 3);
    }
  });

  /** Short words at pace (§5.6, block 9). */
  it("sprint · keeps the words short", () => {
    const words = generate(kindOf(91), 21);
    const long = words.filter((word) => word.length > 4);
    expect(long).toEqual([]);
  });

  /**
   * The lessons §5.6 names by their pool: "The twenty-five" is the twenty-five
   * commonest words, and "Names, and the word I" is the names.
   */
  it("words · uses the pool the lesson is named after", () => {
    const twentyFive = new Set(WORDS.slice(0, 25));
    for (const word of generate(kindOf(47), 6))
      expect(twentyFive).toContain(word);
    for (const word of generate(kindOf(39), 6))
      expect(word, `L33: ${word}`).toMatch(/^[A-Z]/);
  });
});

describe("a bag is exhausted before it repeats", () => {
  /**
   * The rule the other decks follow: a run does not ask for one word four
   * times while another never comes up. Lesson 33 draws thirty-five words from
   * a pool of hundreds, so every one of them should be different.
   */
  it("never repeats a word while the pool has one left", () => {
    const words = generate(
      LESSONS.find((lesson) => lesson.n === 33) as Lesson,
      55,
    );
    expect(new Set(words).size).toBe(words.length);
  });

  /**
   * Lesson 10 is the smallest pool on the ladder: `ll`, `ss` and `dd` at nine
   * unlocked letters is ten words in the whole corpus. Its twenty-five slots
   * therefore have to repeat, and what the bag rule buys is that every one of
   * the ten is met before any comes round a third time.
   */
  it("empties a small pool before drawing from it again", () => {
    const lesson = LESSONS.find((l) => l.n === 10) as Lesson;
    const focus = lesson.kind.type === "bigrams" ? lesson.kind.focus : [];
    const pool = focus.flatMap((pair) =>
      WORDS.filter((word) => word.includes(pair) && canType(word, lesson.n)),
    );
    expect(pool.length).toBeGreaterThan(0);

    const words = generate(lesson, 12);
    expect(words.every((word) => /(.)\1/.test(word))).toBe(true);
    for (const word of pool) expect(words, word).toContain(word);
  });
});

describe("a held-key lesson", () => {
  /**
   * The same three invariants, over the ten (§5.8), plus the one only they
   * carry: nothing for the pinned hand. The review here is the free hand's
   * half of the rung's alphabet, which is why `reviewAt` is not reused — a
   * right-hand lesson at rung 6 has the whole home row unlocked and nothing on
   * its own hand left over to review.
   */
  const freeReview = (lesson: HeldKeyLesson) =>
    [...unlockedAt(lesson.n)].filter(
      (ch) =>
        ch !== " " &&
        oneHanded(ch, lesson.hold) &&
        !lesson.introduces.includes(ch),
    );

  it("never asks the pinned hand for a character", () => {
    const offenders: string[] = [];
    for (const lesson of HELD_KEY_LESSONS)
      for (const seed of SEEDS) {
        const wrongHand = new Set(
          [...textOf(lesson, seed)].filter(
            (ch) => ch !== " " && !oneHanded(ch, lesson.hold),
          ),
        );
        for (const ch of wrongHand)
          offenders.push(`${lesson.id} seed ${seed}: ${JSON.stringify(ch)}`);
      }
    expect(offenders).toEqual([]);
  });

  it("stays inside the rung's alphabet, at the length asked for", () => {
    for (const lesson of HELD_KEY_LESSONS)
      for (const seed of SEEDS) {
        const words = generate(lesson, seed);
        expect(words, `${lesson.id} seed ${seed}`).toHaveLength(
          lesson.wordCount,
        );
        for (const ch of words.join(" "))
          expect(canType(ch, lesson.n), `${lesson.id} ${ch}`).toBe(true);
      }
  });

  it("strikes every drilled key at least as often as its gate demands", () => {
    const offenders: string[] = [];
    for (const lesson of HELD_KEY_LESSONS) {
      const strikes =
        lesson.pass.kind === "lesson" ? lesson.pass.keyStrikes : 0;
      for (const seed of SEEDS) {
        const text = textOf(lesson, seed);
        for (const ch of lesson.introduces)
          if (countOf(text, [ch]) < strikes)
            offenders.push(`${lesson.id} seed ${seed}: ${ch}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keeps the drilled keys inside §5.2's band wherever there is review", () => {
    const offenders: string[] = [];
    for (const lesson of HELD_KEY_LESSONS) {
      if (lesson.introduces.length === 0 || freeReview(lesson).length === 0)
        continue;
      for (const seed of SEEDS) {
        const text = textOf(lesson, seed);
        const share = countOf(text, lesson.introduces) / text.length;
        if (share < MIN_NEW_SHARE || share > MAX_NEW_SHARE)
          offenders.push(
            `${lesson.id} seed ${seed}: ${(share * 100).toFixed(1)}%`,
          );
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * The home-row pair is lesson 1's case with a hand taken away: one hand's
   * half of the home row is exactly the five keys drilled, so there is
   * nothing to review and the whole drill is those five.
   */
  it("spends the home-row pair entirely on the keys it drills", () => {
    const nothingToReview = HELD_KEY_LESSONS.filter(
      (lesson) => freeReview(lesson).length === 0,
    );
    expect(nothingToReview.map((lesson) => lesson.id)).toEqual(["H01", "H02"]);
    for (const lesson of nothingToReview)
      for (const seed of SEEDS) {
        const letters = textOf(lesson, seed).replace(/ /g, "");
        expect(countOf(letters, lesson.introduces)).toBe(letters.length);
      }
  });

  /** The word pair draws from the one-hand list, each hand its own half. */
  it("gives the word pair real one-hand words", () => {
    const right = new Set(RIGHT_HAND);
    const left = new Set(LEFT_HAND);
    for (const lesson of HELD_KEY_LESSONS.filter(
      (l) => l.kind.type === "words",
    )) {
      const pool = lesson.hold === "f" ? right : left;
      for (const word of generate(lesson, 21))
        expect(pool.has(word), `${lesson.id}: ${word}`).toBe(true);
    }
  });
});
