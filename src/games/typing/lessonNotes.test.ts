import { describe, expect, it } from "vitest";

import type { LadderProgress } from "@/engine/typing/ladder";
import { lessonById, lessonNumbered } from "@/engine/typing/lessons";
import type { Verdict } from "@/engine/typing/verdict";

import { lockNote, missNote, nextNote, weakestKey } from "./lessonNotes";

/**
 * The sentence a results screen says (docs/typing.md §6.1).
 *
 * What the numbers mean is `verdict.test.ts`'s, and which door a set of runs
 * opens is `ladder.test.ts`'s. What is only true here is the reading: given
 * three bars and a pass, which one is worth naming, which is worth praising,
 * and what a Hailstorm level says instead of a speed it was never asked for.
 *
 * The verdicts are built by hand rather than run through `verdictFor`, because
 * the point is the copy and not the arithmetic — a hand-built verdict can sit
 * a run exactly on the two-bars-met case that the wording turns on.
 */

/** Lesson 1: `f` and `j`, at 95% accuracy and 8 wpm. */
const L01 = lessonById("L01")!;
/** Lesson 4 is a Hailstorm level — the arm with no passage and no wpm. */
const STORM = lessonById("L04")!;

const bar = (got: number, need: number) => ({ got, need, ok: got >= need });

const verdict = (parts: Partial<Verdict> = {}): Verdict => ({
  passed: false,
  accuracy: bar(1, 0.95),
  wpm: bar(20, 8),
  keys: [],
  ...parts,
});

const key = (id: string, got: number, ok = got >= 0.9) => ({
  key: id,
  got,
  need: 0.9,
  ok,
});

describe("weakestKey", () => {
  it("prefers a key that has not passed over a lower fraction", () => {
    // A key struck right three times reads 100% and is still not `ok`: the
    // strike floor is the half of the gate a fraction cannot carry (§6.4). So
    // the bar worth naming is the failing one, however full it looks.
    const chosen = weakestKey([key("f", 0.95), key("j", 1, false)]);
    expect(chosen?.key).toBe("j");
  });

  it("takes the lowest of several that have all passed", () => {
    expect(weakestKey([key("f", 1), key("j", 0.95)])?.key).toBe("j");
  });

  it("has nothing to say about a lesson that introduces nothing", () => {
    expect(weakestKey([])).toBeNull();
  });
});

describe("missNote", () => {
  /**
   * The one the whole screen exists for. Three bars, one of them short, and
   * the sentence says which — plus the half that says *don't change that*,
   * without which a child fixes `j` by slowing under the speed bar.
   */
  it("names the key holding the run up, and says the speed was fine", () => {
    const note = missNote(
      L01,
      verdict({ keys: [key("f", 1), key("j", 0.75)] }),
    );
    expect(note).toBe("You were fast enough; the j key needs more practice.");
  });

  it("names accuracy first when accuracy and a key both missed", () => {
    // §6.1's order is the order they matter, which is also the order to fix
    // them in: a child failing accuracy is not helped by being sent after `j`.
    const note = missNote(
      L01,
      verdict({ accuracy: bar(0.5, 0.95), keys: [key("j", 0.4)] }),
    );
    expect(note).toBe(
      "You were fast enough; slow down — 95% of your words have to be right, and you were at 50%.",
    );
  });

  it("asks for speed when speed is all that is left, and praises the keys", () => {
    const note = missNote(
      L01,
      verdict({ wpm: bar(5, 8), keys: [key("f", 1), key("j", 1)] }),
    );
    expect(note).toBe(
      "Your new keys are there; a bit faster — 8 words a minute, and you were at 5.",
    );
  });

  it("praises accuracy when there are no new keys to praise", () => {
    // Every review lesson and every checkpoint: two bars, one of them short.
    const note = missNote(L01, verdict({ wpm: bar(5, 8) }));
    expect(note).toBe(
      "Your accuracy is there; a bit faster — 8 words a minute, and you were at 5.",
    );
  });

  it("praises nothing when nothing was met", () => {
    const note = missNote(
      L01,
      verdict({ accuracy: bar(0.4, 0.95), wpm: bar(3, 8) }),
    );
    expect(note).toBe(
      "Slow down — 95% of your words have to be right, and you were at 40%.",
    );
  });

  /**
   * The storm arm, and the reason it needed handling at all: §6.1's verdict
   * gives a dead wave a full speed bar and no key bars, so the bars alone say
   * "all met" over the word the child has just been told. Surviving is not a
   * bar, so it is a sentence.
   */
  it("says the wave got through when a storm run met its accuracy", () => {
    expect(
      missNote(STORM, verdict({ wpm: { got: 0, need: 0, ok: true } })),
    ).toBe("The wave got through — you have to face the whole storm.");
  });

  it("names the accuracy a storm wanted when that is what missed", () => {
    const note = missNote(
      STORM,
      verdict({
        accuracy: bar(0.6, 0.9),
        wpm: { got: 0, need: 0, ok: true },
      }),
    );
    expect(note).toBe("The storm wants 90% of the letters, and you hit 60%.");
  });
});

describe("nextNote", () => {
  const progress = (best: number, next: number): LadderProgress => ({
    cleared: new Set([best]),
    best,
    next,
  });

  it("says which lesson just opened when the run cleared the frontier", () => {
    const seven = lessonNumbered(7)!;
    const eight = lessonNumbered(8)!;
    const { next, text } = nextNote(seven, progress(7, 8));

    expect(next).toBe(eight);
    expect(text).toBe(`Lesson 8 just opened: ${eight.title}.`);
  });

  it("points at the pointer, and claims nothing, on a replayed lesson", () => {
    // A child at lesson 41 doing lesson 3 again opens nothing. Telling them it
    // did would be the one thing this screen must not do.
    const three = lessonNumbered(3)!;
    const forty = lessonNumbered(41)!;
    const { next, text } = nextNote(three, progress(40, 41));

    expect(next).toBe(forty);
    expect(text).toBe(`Next up is lesson 41: ${forty.title}.`);
  });

  it("has no next lesson at the top of the ladder", () => {
    // `next` is capped at the last rung, so clearing it points at itself.
    const hundred = lessonNumbered(100)!;
    const { next, text } = nextNote(hundred, progress(100, 100));

    expect(next).toBeNull();
    expect(text).toBe("That is the top of the ladder. Every lesson done.");
  });
});

describe("lockNote", () => {
  it("names the rung below", () => {
    expect(lockNote(lessonNumbered(8)!)).toBe(
      "Pass lesson 7 to open this one.",
    );
  });

  /**
   * §8.8: a Hailstorm level never gates, so the lesson that opens 10 is 8 —
   * and pointing a child at the storm at 9 would be sending them at a wave
   * they cannot play at all on a tablet.
   */
  it("looks past a Hailstorm level to the lesson that really opens it", () => {
    expect(lessonNumbered(9)!.kind.type).toBe("storm");
    expect(lockNote(lessonNumbered(10)!)).toBe(
      "Pass lesson 8 to open this one.",
    );
    // Two storms never sit together, but the loop walks rather than steps once
    // so that a re-cut ladder cannot make this the sentence that lies.
    expect(lessonNumbered(4)!.kind.type).toBe("storm");
    expect(lockNote(lessonNumbered(5)!)).toBe(
      "Pass lesson 3 to open this one.",
    );
  });

  it("says something sensible at the bottom of the ladder", () => {
    // Unreachable: lesson 1 is `next` on a profile with no runs at all, so it
    // is never locked. A sentence rather than a throw, because the ladder is
    // data and this is copy.
    expect(lockNote(lessonNumbered(1)!)).toBe("This one opens as you climb.");
  });
});
