import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ladderProgress, type LadderProgress } from "@/engine/typing/ladder";
import { lessonById } from "@/engine/typing/lessons";
import { isStormLesson, type StormLesson } from "@/engine/typing/storms";

import { StormBrief } from "./StormBrief";

/**
 * What is written on a storm's door (docs/typing.md §8.1, §8.8, §9).
 *
 * A storm gets a brief of its own rather than an arm inside `LessonBrief`,
 * because the three things that screen is made of — the bars, the best and the
 * keyboard control — are three things a storm does not have. What this one has
 * to carry instead is on trial here:
 *
 *   - **How it is played**, for the child meeting a falling-letter game at
 *     lesson 4 who cannot guess §8.4's rule by watching.
 *   - **What THIS storm is**, so that "First ice" and "Whiteout" are not the
 *     same screen with different numbers behind them.
 *   - **That nothing waits on it** (§8.8, decision 24), which is the promise
 *     the tile can only carry as a phrase.
 */

const storm = (id: string): StormLesson => {
  const lesson = lessonById(id);
  if (!isStormLesson(lesson)) throw new Error(`${id} is not a storm`);
  return lesson;
};

/** Lesson 4 — the first storm, six keys, repairs on. */
const L04 = storm("L04");
/** Lesson 59 — digits, mid-ladder, repairs on. */
const L59 = storm("L59");
/** Lesson 79 — "No repairs", the level the block turns on. */
const L79 = storm("L79");

/** A profile that has never run anything: everything above rung 1 is locked. */
const FRESH = ladderProgress([]);

/** Progress with a pointer put where a test needs it. */
const at = (best: number, next: number): LadderProgress => ({
  cleared: new Set(Array.from({ length: best }, (_, i) => i + 1)),
  best,
  next,
});

const render = (lesson: StormLesson, progress: LadderProgress = at(99, 100)) =>
  renderToStaticMarkup(
    <StormBrief
      lesson={lesson}
      progress={progress}
      onStart={() => {}}
      onClose={() => {}}
    />,
  );

/** The panel's text, with the markup taken out. */
const words = (lesson: StormLesson, progress?: LadderProgress) =>
  render(lesson, progress)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ");

describe("StormBrief", () => {
  it("names the rung and says how a storm is played", () => {
    const text = words(L04);
    expect(text).toContain("Lesson 4");
    expect(text).toContain("Hailstorm · First ice");
    // §8.4's rule, which decides everything and is not guessable: any key but
    // the lowest letter's is a miss.
    expect(text).toContain("Shoot the lowest one");
  });

  it("says what this storm is, and no two the same", () => {
    const first = words(L04);
    const last = words(storm("L99"));

    expect(first).toContain(`${L04.kind.wave.count} letters`);
    expect(first).toContain(`${L04.kind.wave.shield} per finger`);
    expect(last).toContain(`${storm("L99").kind.wave.count} letters`);
    // The point of showing the numbers at all: the twenty are different levels
    // and the brief is where a child finds out how.
    expect(first).not.toBe(last);
  });

  it("says when the repairs stop, and does not promise them when they have", () => {
    expect(words(L59)).toContain(
      `every ${L59.kind.wave.repairAt} in a row mends`,
    );
    expect(words(L79)).toContain("No repairs");
    expect(words(L79)).toContain("what breaks stays broken");
    expect(words(L79)).not.toContain("in a row mends");
  });

  it("says what mostly falls, when the level is about something", () => {
    expect(words(L59)).toContain("mostly numbers");
    expect(words(storm("L34"))).toContain("mostly capital letters");
    expect(words(storm("L65"))).toContain("mostly punctuation");
    // And a level about everything says nothing, rather than "mostly letters".
    expect(words(storm("L49"))).not.toContain("mostly");
  });

  /**
   * §8.8, said in full on the one screen with room for it. The tile carries
   * "worth playing, never required" and this says what that MEANS: the rung
   * above opens off the rung below, so a storm can be skipped, failed or never
   * opened at no cost at all.
   */
  it("promises that nothing on the ladder waits on it", () => {
    expect(words(L04)).toContain("worth playing, never required");
    expect(words(L04)).toContain("Lesson 5 opens whether you play this or not");
    expect(words(storm("L99"))).toContain("Lesson 100 opens");
  });

  it("offers Play on a storm the child has reached", () => {
    expect(render(L04, at(3, 5))).toContain(">Play<");
    expect(render(L04, at(3, 5))).not.toContain("to open this one");
  });

  /**
   * And refuses on one they have not — the same `tileState` the tile is drawn
   * from, asked twice on purpose: a screen that can say "locked" must not also
   * be able to start the thing it just called locked.
   */
  it("refuses a storm above the pointer, and says what opens it", () => {
    const shut = render(L04, FRESH);
    expect(shut).not.toContain(">Play<");
    expect(words(L04, FRESH)).toContain("Pass lesson 3 to open this one");
    // The express lane is offered here as it is on every other locked rung.
    expect(words(L04, FRESH)).toContain("try a checkpoint");
  });

  it("is a dialog with a name, and a way out that is not Play", () => {
    const html = render(L04);
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("aria-labelledby");
    expect(html).toContain(">Not now<");
  });
});
