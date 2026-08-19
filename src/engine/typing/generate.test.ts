import { describe, expect, it } from "vitest";

import { generate } from "./generate";
import { canType, unlockedAt } from "./keys";
import { LESSONS } from "./lessons";
import type { Lesson } from "./lessons";
import { WORDS } from "./lexicon";

/**
 * The three invariants that make a hundred generated lessons safe
 * (docs/typing.md §5.2, §12).
 *
 * This is the test the three stories before it were for. The hundred specs
 * gave it something to walk, `unlockedAt` gave it the question to ask of every
 * character, and the corpus gave the generator something to answer with — and
 * what it buys is the ladder being *editable*: move a lesson, re-order a
 * block, hand a key over two lessons earlier, and the text follows or this
 * file says which lesson it stopped following at.
 *
 *   1. **Reachability.** Every character of every lesson, at every seed, is
 *      producible on the board and unlocked by that lesson.
 *   2. **The new key shows up enough.** Every introduced character occurs at
 *      least `pass.keyStrikes` times, at every seed, so the new-key gate
 *      (§6.4) can never be unpassable through bad luck.
 *   3. **A lesson is mostly review.** New keys are 15–35% of the characters:
 *      below that it is not a lesson about them, above it a memory test.
 *
 * Each is asserted over all hundred lessons crossed with a spread of seeds,
 * because a generator is a distribution and one seed is an anecdote. Failures
 * are collected rather than thrown at the first one: "lessons 61, 63 and 67
 * are short of strikes" is a finding about the ladder, where "lesson 61 is"
 * is a bug report you have to fix three times.
 *
 * ── The one lesson invariant 3 cannot cover, and why that is not a licence ───
 * At lesson 1 the unlocked alphabet is `f`, `j` and the space bar. There is no
 * review to be had, so a lesson that is 15–35% new keys is not merely
 * undesirable there, it is arithmetically impossible — and §5.5 asks for
 * exactly what the ladder does instead: "three lessons of `fff jjj fjf` is
 * standard and correct". So the band is asserted wherever the ladder has
 * anything to review and a *stronger* claim — every character is a new key —
 * where it has not. Both halves are derived from `unlockedAt`, never from a
 * list of excused lesson numbers, which is what keeps the exception honest: a
 * re-ordered ladder that leaves lesson 40 with nothing to review is reported
 * by the same line rather than covered by it.
 */

/** §5.2's band. Not a knob — see the note above before touching either end. */
const MIN_NEW_SHARE = 0.15;
const MAX_NEW_SHARE = 0.35;

/**
 * Enough seeds that a rare draw is not a lucky pass.
 *
 * Sixteen crossed with a hundred lessons is sixteen hundred generations, which
 * runs in under a second because the corpus is filtered once per lesson. The
 * seeds are spread rather than 0–15: `mulberry32` is well-behaved over
 * neighbouring seeds, but the numbers a run actually uses come from
 * `randomSeed()` and look nothing like a counter.
 */
const SEEDS = [
  0, 1, 2, 7, 42, 99, 128, 1000, 4242, 65535, 123456, 999983, 2147483647,
  16777216, 31337, 8675309,
];

/** Every lesson that has text — the storms have a wave instead (§8.3). */
const WITH_TEXT = LESSONS.filter((lesson) => lesson.wordCount > 0);

/** The lessons the new-key invariants are about. */
const INTRODUCING = WITH_TEXT.filter((lesson) => lesson.introduces.length > 0);

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
   * The one §5.2 calls "the test that makes the ladder editable", and the only
   * one whose failure a child would meet as a key they have never been shown.
   *
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
   * Reachability is about characters; this is about the words they make.
   *
   * A lesson asks for `wordCount` words because that is what its wpm bar is
   * computed against (§6.3): a lesson that quietly ran nine words short would
   * report a speed nobody typed. Storm levels are the exception the type
   * already carries — `wordCount` is 0 and the wave decides the length.
   */
  it("produces exactly the number of words the lesson asks for", () => {
    const offenders: string[] = [];
    for (const lesson of LESSONS)
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
   * The gate in §6.4 waits for `keyStrikes` strikes of each new character
   * before it will judge that key at all. If the text does not contain that
   * many, the lesson cannot be passed however well it is typed — and the child
   * has no way of knowing why, because everything they typed was right.
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

  /**
   * §5.2's band, everywhere the ladder has review to give.
   *
   * The floor and the ceiling fail differently and both matter: under 15% the
   * lesson is not about the keys it claims to introduce, and over 35% it has
   * stopped being typing practice and become a memory test of two keys.
   */
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
   * The other side of that exception, asserted rather than assumed.
   *
   * Lesson 1 is the whole of it today: `f`, `j` and the space bar, so every
   * character that is not a space is a new key by necessity. Writing it down
   * as its own expectation is what stops "the ladder had nothing to review" —
   * true and unavoidable at lesson 1 — from becoming a silent excuse the day
   * somebody moves a lesson into a place where it is neither.
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
   * Deterministic in `(lesson, seed)`, like every other deck on this site.
   *
   * Not a nicety: a lesson is re-rendered on every mount of the results screen
   * and re-read out of the record book months later, and a run whose text
   * changed underneath it would show a child a passage they never typed.
   */
  it("gives the same text for the same lesson and seed", () => {
    for (const lesson of WITH_TEXT)
      expect(generate(lesson, 4242)).toEqual(generate(lesson, 4242));
  });

  /**
   * …and a different one for a different seed, or the ladder is a hundred
   * fixed passages a child could learn by heart.
   *
   * Counted across the ladder rather than asserted per lesson: lesson 8 draws
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
   * `strikesFor` assumed when it sized the gate (five to a word, the space
   * included). It is also what a drill looks like on the page.
   */
  it("keys · lays the new keys into even letter groups", () => {
    for (const lesson of LESSONS.filter((l) => l.kind.type === "keys"))
      for (const word of generate(lesson, 99))
        expect(word.length, `${lesson.id}: ${word}`).toBe(4);
  });

  /**
   * Lesson 8's focus is `ll`, `ss` and `dd` at nine unlocked letters, where
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
    const words = generate(kindOf(36), 11);
    expect(words[0]).toMatch(/^[A-Z]/);
    const stops = words.filter((word) => /[.?!]$/.test(word));
    expect(stops.length).toBeGreaterThan(2);
  });

  /** Real prose from the library, long enough to be a paragraph (§5.6, 71–100). */
  it("passage · draws whole paragraphs", () => {
    const words = generate(kindOf(100), 3);
    expect(words.length).toBe(150);
    expect(words.join(" ")).toContain(". ");
  });

  /**
   * Ages, dates, scores and prices — figures with a shape, not digits at
   * random. Lesson 57 is the one that asks, and the hyphen has not arrived
   * yet, so a score is absent there rather than rewritten into something a
   * child cannot type.
   */
  it("numbers · gives every token a figure in it", () => {
    for (const word of generate(kindOf(57), 5)) expect(word).toMatch(/[0-9]/);
  });

  /** Prose with numbers in it — both halves, in every lesson that asks. */
  it("mixed · puts figures inside sentences", () => {
    for (const n of [58, 60, 92, 95]) {
      const words = generate(kindOf(n), 13);
      expect(
        words.some((word) => /[0-9]/.test(word)),
        `L${n}`,
      ).toBe(true);
      expect(
        words.filter((word) => /^[a-z]+$/.test(word)).length,
        `L${n}`,
      ).toBeGreaterThan(words.length / 3);
    }
  });

  /** Short words at pace (§5.6, block 9). */
  it("sprint · keeps the words short", () => {
    const words = generate(kindOf(81), 21);
    const long = words.filter((word) => word.length > 4);
    expect(long).toEqual([]);
  });

  /**
   * The lessons §5.6 names by their pool: "The twenty-five" is the twenty-five
   * commonest words, and "Names, and the word I" is the names.
   */
  it("words · uses the pool the lesson is named after", () => {
    const twentyFive = new Set(WORDS.slice(0, 25));
    for (const word of generate(kindOf(41), 6))
      expect(twentyFive).toContain(word);
    for (const word of generate(kindOf(33), 6))
      expect(word, `L33: ${word}`).toMatch(/^[A-Z]/);
  });
});

describe("a bag is exhausted before it repeats", () => {
  /**
   * The rule the other decks follow: a run does not ask for one word four
   * times while another never comes up. Lesson 27 draws thirty-five words from
   * a pool of hundreds, so every one of them should be different.
   */
  it("never repeats a word while the pool has one left", () => {
    const words = generate(
      LESSONS.find((lesson) => lesson.n === 27) as Lesson,
      55,
    );
    expect(new Set(words).size).toBe(words.length);
  });

  /**
   * And where the pool is smaller than the lesson it is emptied before it is
   * refilled, which is the only reason a tiny bag is usable at all.
   *
   * Lesson 8 is the smallest on the ladder: `ll`, `ss` and `dd` at nine
   * unlocked letters is ten words in the whole corpus, one of them for `ss`.
   * Its twenty-five slots therefore *have* to repeat — repetition is what a
   * pairs lesson is — and what the bag rule buys is that every one of the ten
   * is met before any of them comes round a third time.
   */
  it("empties a small pool before drawing from it again", () => {
    const lesson = LESSONS.find((l) => l.n === 8) as Lesson;
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
