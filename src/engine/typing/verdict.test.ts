import { describe, expect, it } from "vitest";

import type { CardResult } from "@/engine/types";

import { LESSONS } from "./lessons";
import type { Lesson } from "./lessons";
import { verdictFor } from "./verdict";
import type { Run } from "./verdict";

/**
 * What the three bars have to prove (§6.1, §6.4).
 *
 * The criteria are built here rather than taken from the ladder, because what
 * is under test is the gate and not lesson 25's tuning — a test that read
 * `keyStrikes` off the table would go green the day someone lowered it. The
 * shipped hundred get their own describe at the end, asserting only what the
 * verdict promises about any of them.
 */

/**
 * A typed word. `ok` follows from the two strings unless it is forced, which
 * is what the "marked right" case below needs.
 */
const card = (
  answer: string,
  given: string | null,
  ok = given === answer,
): CardResult => ({
  prompt: answer,
  answer,
  given,
  ok,
  ms: 400,
  factId: answer,
});

const times = (n: number, make: () => CardResult) =>
  Array.from({ length: n }, make);

/** `n` copies of a word, typed correctly. */
const right = (n: number, word: string) => times(n, () => card(word, word));

/** `n` copies of a word, typed as `given` instead. */
const wrong = (n: number, word: string, given: string) =>
  times(n, () => card(word, given));

/**
 * A run, with `correct` and `incorrect` following its cards exactly as a saved
 * session's do. `wordCount` is the run's own copy of how long the passage — or,
 * for a storm, the wave — was, which is what survival is measured against.
 */
const run = (
  cards: CardResult[],
  { ms = 60_000, wordCount = cards.length } = {},
): Run => ({
  cards,
  config: { kind: "typing", levelId: "home-row", lessonId: "L25", wordCount },
  correct: cards.filter((c) => c.ok).length,
  incorrect: cards.filter((c) => !c.ok).length,
  durationMs: ms,
});

/** A lesson that introduces `z`, with criteria the test can dictate. */
const lessonWith = (over: Partial<Lesson> = {}): Lesson => ({
  n: 25,
  id: "L25",
  block: 3,
  title: "The last corner",
  introduces: ["z"],
  kind: { type: "keys" },
  wordCount: 26,
  keyboard: "guide",
  pass: {
    kind: "lesson",
    accuracy: 0.95,
    wpm: 12,
    keyAccuracy: 0.9,
    keyStrikes: 12,
  },
  ...over,
});

/**
 * A storm level, dictated like the lesson above rather than read off the
 * ladder. `wordCount` is the wave's length (§8.3), which is what `survived`
 * reads back off a run's own config.
 */
const stormWith = (over: Partial<Lesson> = {}): Lesson => ({
  n: 4,
  id: "L04",
  block: 1,
  title: "Hailstorm · First ice",
  introduces: [],
  kind: {
    type: "storm",
    wave: {
      count: 12,
      gap: [1500, 1900],
      fall: [900, 1200],
      shield: 4,
      repairAt: 4,
      seed: 6,
    },
  },
  wordCount: 12,
  keyboard: "guide",
  pass: { kind: "storm", survive: true, accuracy: 0.9 },
  ...over,
});

describe("the new-key gate", () => {
  /**
   * §6.4, in one test: two wrong words out of forty-two is 5% of the run and
   * 50% of the letter, so the run passes on accuracy and on speed and fails on
   * the only thing lesson 25 was for.
   */
  it("fails a run that was fast and accurate but fumbled the new key", () => {
    const lesson = lessonWith({
      pass: {
        kind: "lesson",
        accuracy: 0.95,
        wpm: 12,
        keyAccuracy: 0.9,
        keyStrikes: 4,
      },
    });
    const verdict = verdictFor(
      run([...right(38, "as"), ...right(2, "zip"), ...wrong(2, "zip", "sip")]),
      lesson,
    );

    expect(verdict.accuracy.ok).toBe(true);
    expect(verdict.wpm.ok).toBe(true);
    expect(verdict.keys).toEqual([
      { key: "z", got: 0.5, need: 0.9, ok: false },
    ]);
    expect(verdict.passed).toBe(false);
  });

  /**
   * The strike floor is the half of the gate a fraction cannot carry. Eleven
   * strikes of `z` all landed reads as 100%, and `ok` still has to be false —
   * otherwise a lesson that happened to serve the new key twice would be
   * passed on a lucky guess.
   */
  it("fails a key one strike short, rather than passing it silently", () => {
    const lesson = lessonWith();
    const short = verdictFor(
      run([...right(11, "zip"), ...right(20, "as")]),
      lesson,
    );

    expect(short.accuracy.ok).toBe(true);
    expect(short.wpm.ok).toBe(true);
    expect(short.keys).toEqual([{ key: "z", got: 1, need: 0.9, ok: false }]);
    expect(short.passed).toBe(false);

    // The same run with the twelfth strike, to pin that it was the floor and
    // nothing else standing between this child and the next lesson.
    const met = verdictFor(
      run([...right(12, "zip"), ...right(20, "as")]),
      lesson,
    );
    expect(met.keys).toEqual([{ key: "z", got: 1, need: 0.9, ok: true }]);
    expect(met.passed).toBe(true);
  });

  /**
   * The other half of the same boundary: `keyAccuracy` is a floor to reach,
   * not one to clear. Nine `z` out of ten is exactly 90%, and a child who hits
   * the bar on the nose has met it — a `>` where `>=` belongs would send them
   * round again for landing precisely what was asked.
   */
  it("passes a key struck exactly at the accuracy bar", () => {
    const lesson = lessonWith({
      pass: {
        kind: "lesson",
        accuracy: 0,
        wpm: 0,
        keyAccuracy: 0.9,
        keyStrikes: 10,
      },
    });
    const verdict = verdictFor(
      run([...right(9, "zip"), ...wrong(1, "zip", "sip")]),
      lesson,
    );

    expect(verdict.keys).toEqual([{ key: "z", got: 0.9, need: 0.9, ok: true }]);
    expect(verdict.passed).toBe(true);
  });

  it("marks only the characters that differ on a word typed wrong", () => {
    const lesson = lessonWith({
      introduces: ["z", "i", "p"],
      pass: {
        kind: "lesson",
        accuracy: 0,
        wpm: 0,
        keyAccuracy: 0.9,
        keyStrikes: 1,
      },
    });
    // "zip" typed as "zap": the `i` is the only character that differs.
    const verdict = verdictFor(run(wrong(1, "zip", "zap")), lesson);

    expect(verdict.keys).toEqual([
      { key: "z", got: 1, need: 0.9, ok: true },
      { key: "i", got: 0, need: 0.9, ok: false },
      { key: "p", got: 1, need: 0.9, ok: true },
    ]);
  });

  /**
   * The run mixes one `p` that *was* struck with two that were not, so what is
   * asserted is the fraction and not just a bar that reads empty. An
   * implementation that skipped past the end of `given` — counting neither a
   * strike nor a hit — would leave `p` at 1/1 rather than 1/3, and a bar
   * asserted only as `got: 0, ok: false` would go green for both. That is the
   * lenient direction: abandoned words containing the new key would stop
   * counting against it.
   */
  it("counts a character that was never reached as a miss", () => {
    const lesson = lessonWith({
      introduces: ["p"],
      pass: {
        kind: "lesson",
        accuracy: 0,
        wpm: 0,
        keyAccuracy: 0.9,
        keyStrikes: 3,
      },
    });
    // "zip" typed out, "zip" abandoned after two letters, and "zip" with
    // nothing typed at all — the two shapes a `given` short of its answer can
    // take. The `p` was offered a keystroke once out of three.
    const verdict = verdictFor(
      run([card("zip", "zip"), card("zip", "zi"), card("zip", null)]),
      lesson,
    );

    expect(verdict.keys).toEqual([
      { key: "p", got: 1 / 3, need: 0.9, ok: false },
    ]);
  });

  /**
   * §6.4's documented approximation: a key struck wrong and backspaced away is
   * invisible here, because the card records the word and not the keystrokes.
   * What can be asserted is the rule that makes it true — a word marked right
   * is a hit in every character, whatever `given` reads.
   */
  it("counts every character of a word marked right as a hit", () => {
    const lesson = lessonWith({
      introduces: ["i"],
      pass: {
        kind: "lesson",
        accuracy: 0,
        wpm: 0,
        keyAccuracy: 0.9,
        keyStrikes: 1,
      },
    });
    // `given` disagrees with the answer *at the introduced key itself*, and
    // the run marked the card right anyway. Reading `given` regardless of the
    // mark would score `i` at 0 and fail the gate; the mark wins, which is
    // what forgiving a correction means in practice.
    const verdict = verdictFor(run([card("zip", "zap", true)]), lesson);

    expect(verdict.keys).toEqual([{ key: "i", got: 1, need: 0.9, ok: true }]);
  });

  it("has no key bars on a lesson that introduces nothing", () => {
    const verdict = verdictFor(
      run(right(30, "the")),
      lessonWith({ introduces: [] }),
    );

    expect(verdict.keys).toEqual([]);
    expect(verdict.passed).toBe(true);
  });
});

describe("accuracy and speed", () => {
  it("fails the speed bar alone when the typing was accurate but slow", () => {
    // Twelve perfect words in two minutes: 48 characters is under 10 wpm.
    const verdict = verdictFor(
      run(right(12, "zip"), { ms: 120_000 }),
      lessonWith(),
    );

    expect(verdict.accuracy).toEqual({ got: 1, need: 0.95, ok: true });
    expect(verdict.keys[0].ok).toBe(true);
    expect(verdict.wpm.ok).toBe(false);
    expect(verdict.wpm.need).toBe(12);
    expect(verdict.passed).toBe(false);
  });

  /**
   * The two runs typed the same characters in the same time, so they type at
   * the same speed; what separates them is the accuracy bar, which a blended
   * net figure would hide (§6.1).
   */
  it("reports speed gross, and accuracy separately", () => {
    const lesson = lessonWith();
    const clean = verdictFor(run(right(30, "zip")), lesson);
    const sloppy = verdictFor(
      run([...right(15, "zip"), ...wrong(15, "zip", "zap")]),
      lesson,
    );

    expect(sloppy.wpm.got).toBe(clean.wpm.got);
    expect(clean.accuracy.got).toBe(1);
    expect(sloppy.accuracy.got).toBe(0.5);
    expect(sloppy.accuracy.ok).toBe(false);
  });

  /**
   * A run that never started — quit at the 3·2·1, or a save that arrived with
   * nothing in it. Every bar is a division, and all three denominators are
   * zero here.
   */
  it("does not divide by zero on a run with no cards", () => {
    const verdict = verdictFor(run([], { ms: 0 }), lessonWith());

    expect(verdict.accuracy.got).toBe(0);
    expect(verdict.wpm.got).toBe(0);
    expect(verdict.keys).toEqual([{ key: "z", got: 0, need: 0.9, ok: false }]);
    expect(verdict.passed).toBe(false);
  });
});

describe("a storm level", () => {
  /** Twenty letters faced, nineteen shot: survive plus accuracy, both met. */
  const wave = [...right(19, "f"), ...wrong(1, "j", "k")];

  it("passes a wave survived at the accuracy bar", () => {
    const verdict = verdictFor(run(wave), stormWith());

    expect(verdict.accuracy).toEqual({ got: 0.95, need: 0.9, ok: true });
    expect(verdict.passed).toBe(true);
  });

  /**
   * §8.7: dying at letter 18 of 40 saves a session with eighteen cards. Every
   * one of them can be a hit and the run still has not survived.
   */
  it("fails a run that ended early, however accurate it was", () => {
    const verdict = verdictFor(
      run(right(18, "f"), { wordCount: 40 }),
      stormWith(),
    );

    expect(verdict.accuracy.ok).toBe(true);
    expect(verdict.passed).toBe(false);
  });

  it("has no speed bar to clear and no keys to gate", () => {
    const verdict = verdictFor(run(wave), stormWith());

    expect(verdict.wpm).toEqual({ got: 0, need: 0, ok: true });
    expect(verdict.keys).toEqual([]);
  });
});

describe("against the shipped ladder", () => {
  const lesson = (id: string): Lesson => {
    const found = LESSONS.find((l) => l.id === id);
    if (!found) throw new Error(`no lesson ${id}`);
    return found;
  };

  it("gives one bar per character the lesson introduces", () => {
    // Lesson 25 hands over `z` and `/` together.
    const verdict = verdictFor(run(right(26, "zip")), lesson("L25"));

    expect(verdict.keys.map((k) => k.key)).toEqual(["z", "/"]);
    // A key the passage never served is short of strikes, not merely inaccurate.
    expect(verdict.keys[1]).toEqual({ key: "/", got: 0, need: 0.9, ok: false });
  });

  it("leaves the keys empty on a review lesson", () => {
    expect(verdictFor(run(right(40, "the")), lesson("L41")).keys).toEqual([]);
  });
});
