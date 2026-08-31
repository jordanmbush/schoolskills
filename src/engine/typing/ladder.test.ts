import { describe, expect, it } from "vitest";

import type { CardResult, Session } from "@/engine/types";

import { buildDrill } from "@/engine/decks";
import { typingMode } from "@/engine/decks/typing";
import { ladderProgress } from "./ladder";
import { LESSONS } from "./lessons";
import type { Lesson } from "./lessons";

/**
 * What deriving progress has to prove (§6.5, §6.6, §8.8).
 *
 * The runs below are built against the shipped ladder on purpose — unlike
 * `verdict.test.ts`, which dictates its own criteria because what it tests is
 * the gate. What is under test here is which door a set of saved runs opens,
 * and the doors are the hundred.
 */

const byN = new Map(LESSONS.map((l) => [l.n, l]));
const lesson = (n: number): Lesson => {
  const found = byN.get(n);
  if (!found) throw new Error(`no lesson ${n}`);
  return found;
};

const card = (answer: string, given: string | null): CardResult => ({
  prompt: answer,
  answer,
  given,
  ok: given === answer,
  ms: 400,
  factId: answer,
});

let saved = 0;

/**
 * A run of `lesson`, filed exactly as the island files one. `durationMs` is
 * worked back from the words per minute asked for, so a test can sit a run
 * exactly on a lesson's speed bar or exactly one under it.
 */
function run(
  of: Lesson,
  cards: CardResult[],
  { wpm, wordCount = cards.length }: { wpm?: number; wordCount?: number } = {},
): Session {
  const correct = cards.filter((c) => c.ok).length;
  // The same five-characters-is-a-word the deck family counts in, plus the
  // space that committed each one.
  const characters = cards.reduce((sum, c) => sum + c.answer.length + 1, 0);
  return {
    id: `s${(saved += 1)}`,
    profileId: "p1",
    game: "flashcards",
    mode: typingMode(of.id),
    configKey: `typing|${of.id}|${of.wordCount}`,
    config: {
      kind: "typing",
      levelId: of.id,
      lessonId: of.id,
      wordCount,
    },
    seed: 7,
    finishedAt: "2026-08-19T10:00:00.000Z",
    durationMs: wpm ? (characters / 5) * (60_000 / wpm) : 60_000,
    correct,
    incorrect: cards.length - correct,
    bestStreak: correct,
    xpEarned: 0,
    ghostSessionId: null,
    beatGhost: null,
    cards,
  };
}

/** The words a clean run of a lesson is made of: each new key, struck often
 * enough that the gate is satisfied, or home-row words where none arrive. */
const wordsFor = (of: Lesson) =>
  of.introduces.length
    ? of.introduces.map((key) =>
        key.repeat(of.pass.kind === "lesson" ? of.pass.keyStrikes : 1),
      )
    : ["all", "flask", "glad"];

/** Every word typed right, at exactly the speed the lesson asks for. */
const passing = (of: Lesson, wpm?: number) =>
  run(
    of,
    wordsFor(of).map((word) => card(word, word)),
    { wpm: of.pass.kind === "lesson" ? (wpm ?? of.pass.wpm) : undefined },
  );

/** A wave that ended early — eighteen letters of a forty-letter storm (§8.7). */
const diedInTheStorm = (of: Lesson) =>
  run(
    of,
    ["a", "s", "d"].map((letter) => card(letter, letter)),
    { wordCount: 40 },
  );

/**
 * Re-tune a lesson's speed bar for the length of one test, and put it back:
 * the deploy that lowers lesson 41 from 18 wpm to 17. Nothing else changes —
 * least of all the sessions, which is the point.
 */
function retuned(n: number, wpm: number, body: () => void) {
  const pass = lesson(n).pass;
  if (pass.kind !== "lesson") throw new Error(`lesson ${n} has no speed bar`);
  const was = pass.wpm;
  pass.wpm = wpm;
  try {
    body();
  } finally {
    pass.wpm = was;
  }
}

describe("a child who has done nothing", () => {
  it("has cleared nothing and is pointed at lesson 1", () => {
    const progress = ladderProgress([]);
    expect(progress.cleared.size).toBe(0);
    expect(progress.best).toBe(0);
    expect(progress.next).toBe(1);
  });

  /**
   * Everything shares one record book, and `typing:home-row` is one `typing:`
   * prefix away from a lesson — which is the mistake worth pinning.
   */
  it("is not advanced by runs that are not lessons", () => {
    const notALesson = (mode: string): Session => ({
      ...passing(lesson(30)),
      mode,
    });
    const progress = ladderProgress([
      notALesson("typing:home-row"),
      notALesson("words:dolch-1"),
      notALesson("×"),
    ]);
    expect(progress.best).toBe(0);
    expect(progress.next).toBe(1);
  });

  /**
   * A drill carries the mode it was offered from and **no `lessonId`** (§8.5).
   * Filed by mode alone it would clear the lesson without the lesson ever
   * being run — the ladder filling in behind a child who only ever practised.
   * `progress.ts` reads its badges off `config.lessonId` for the same reason.
   */
  it("is not advanced by a drill filed under a lesson's mode", () => {
    const drill = {
      ...passing(lesson(41)),
      config: buildDrill(["all", "glad"], typingMode("L41"), {
        inputMode: "type" as const,
        timeLimitMs: null,
      }),
    };
    expect(drill.mode).toBe("typing:L41");
    expect(drill.config).not.toHaveProperty("lessonId");
    expect(ladderProgress([drill]).cleared.has(41)).toBe(false);
    // And the lesson itself still clears it, so this is a discriminator and
    // not a wall.
    expect(ladderProgress([passing(lesson(41))]).cleared.has(41)).toBe(true);
  });

  /** Fast enough, and half of it wrong. Lesson 41 asks 95%. */
  it("is not advanced by a run that missed a bar", () => {
    const sloppy = run(lesson(41), [card("all", "all"), card("glad", "glaf")], {
      wpm: 30,
    });
    expect(ladderProgress([sloppy]).cleared.has(41)).toBe(false);
  });
});

describe("unlocking", () => {
  it("clears a lesson passed and opens the one after it", () => {
    const progress = ladderProgress([passing(lesson(1))]);
    expect(progress.cleared.has(1)).toBe(true);
    expect(progress.best).toBe(1);
    expect(progress.next).toBe(2);
  });

  /**
   * §6.6's placement test. Note what `cleared` does *not* say: 1–29 are not in
   * it, because nothing was ever run at them and this set is proof rather than
   * permission. They are behind the child all the same, because `best` is what
   * the ladder locks against and `best` is a maximum.
   */
  it("carries a child to the checkpoint they passed", () => {
    const progress = ladderProgress([passing(lesson(30))]);
    expect(progress.cleared.has(30)).toBe(true);
    expect(progress.cleared.has(29)).toBe(false);
    expect(progress.best).toBe(30);
    expect(progress.next).toBe(31);
  });

  /** A maximum, not the latest: a child revisiting lesson 5 keeps their place. */
  it("takes the highest pass, whatever order the runs are in", () => {
    const progress = ladderProgress([
      passing(lesson(60)),
      passing(lesson(5)),
      passing(lesson(6)),
    ]);
    expect(progress.best).toBe(60);
    expect(progress.next).toBe(61);
  });

  it("stops at the top of the ladder", () => {
    const progress = ladderProgress([passing(lesson(100))]);
    expect(progress.best).toBe(100);
    expect(progress.next).toBe(100);
  });

  /**
   * §6.6's reason for `max` over `count`: `MAX_SESSIONS_PER_PROFILE` prunes
   * the *oldest* runs, so the first thing a child 2000 runs in loses is the
   * proof that they ever passed lesson 1.
   */
  it("does not re-lock anything when the oldest session is pruned", () => {
    const runs = [
      passing(lesson(1)),
      passing(lesson(5)),
      passing(lesson(6)),
      passing(lesson(7)),
    ];
    const whole = ladderProgress(runs);
    const pruned = ladderProgress(runs.slice(1));

    expect(pruned.cleared.has(1)).toBe(false);
    expect(pruned.cleared.size).toBe(whole.cleared.size - 1);
    // A count would have moved; the maximum does not.
    expect(pruned.best).toBe(whole.best);
    expect(pruned.next).toBe(whole.next);
    expect(pruned.next).toBe(8);
  });
});

describe("Hailstorm never gates the ladder", () => {
  it("opens lesson 46 when 44 is cleared, whatever happened at 45", () => {
    const failed = ladderProgress([
      passing(lesson(44)),
      diedInTheStorm(lesson(45)),
    ]);
    expect(failed.cleared.has(45)).toBe(false);
    expect(failed.best).toBe(44);
    expect(failed.open).toBe(46);

    // And the same for a child who never opened the storm at all: 46 is open
    // on `open` alone, with nothing at 45 to show for it.
    expect(ladderProgress([passing(lesson(44))]).open).toBe(46);
  });

  /**
   * Decision 72, and the other half of the rule above. `open` is what keeps a
   * wave optional; the pointer is what stops it being invisible. Carrying both
   * — which is what shipped first — meant a child passed 44, was sent to 46,
   * and never learnt there was a game at 45 to turn down.
   */
  it("points at the storm rather than over it", () => {
    const progress = ladderProgress([passing(lesson(44))]);
    expect(progress.next).toBe(45);
    expect(lesson(45).kind.type).toBe("storm");
  });

  /**
   * All twenty, not only the one §8.8 uses as its example: a table re-cut so
   * that two storms sat side by side would break this and nothing else.
   */
  it("is offered and stepped past at every one of the twenty rungs", () => {
    const storms = LESSONS.filter((l) => l.kind.type === "storm");
    expect(storms).toHaveLength(20);

    for (const storm of storms) {
      const below = lesson(storm.n - 1);
      expect(below.kind.type, `lesson ${below.n}`).not.toBe("storm");
      const progress = ladderProgress([passing(below)]);
      expect(progress.best, `after lesson ${below.n}`).toBe(below.n);
      expect(progress.next, `at storm ${storm.n}`).toBe(storm.n);
      expect(progress.open, `past storm ${storm.n}`).toBe(storm.n + 1);
    }
  });

  /**
   * A storm level is a `Session` like any other (§8.7), so surviving one is a
   * pass like any other — one more run that can hold a child's place after the
   * older ones are pruned.
   */
  it("still clears a wave that was survived", () => {
    const progress = ladderProgress([passing(lesson(45))]);
    expect(progress.cleared.has(45)).toBe(true);
    expect(progress.best).toBe(45);
    expect(progress.next).toBe(46);
    expect(progress.open).toBe(46);
  });

  /** Nothing to step past on the ninety-nine rungs that are not a wave. */
  it("leaves the pointer and the frontier together off a storm", () => {
    const progress = ladderProgress([passing(lesson(7))]);
    expect(progress.next).toBe(8);
    expect(progress.open).toBe(8);
  });
});

describe("criteria that change", () => {
  /**
   * §6.5's second claim: tune lesson 41's speed bar down and every child who
   * was one wpm short is through, with nothing written back to a record book
   * that holds the only copy there is.
   */
  it("clears a run that was one wpm short, without touching it", () => {
    const asked = lesson(41).pass;
    if (asked.kind !== "lesson") throw new Error("lesson 41 has no speed bar");
    const runs = [passing(lesson(41), asked.wpm - 1)];
    const asSaved = structuredClone(runs[0]);

    expect(ladderProgress(runs).cleared.has(41)).toBe(false);

    retuned(41, asked.wpm - 1, () => {
      // A fresh array only because the memo is keyed on identity; in the app
      // the criteria change with a deploy and the sessions are read back out
      // of IndexedDB on the next load.
      expect(ladderProgress([...runs]).cleared.has(41)).toBe(true);
    });

    // The backfill that never happened.
    expect(runs[0]).toEqual(asSaved);
  });
});

describe("the memo", () => {
  it("answers the same array with the same object", () => {
    const runs = [passing(lesson(1))];
    expect(ladderProgress(runs)).toBe(ladderProgress(runs));
  });

  it("re-derives for a different array", () => {
    const runs = [passing(lesson(1))];
    const copy = [...runs];
    expect(ladderProgress(copy)).not.toBe(ladderProgress(runs));
    expect(ladderProgress(copy)).toEqual(ladderProgress(runs));
  });
});
