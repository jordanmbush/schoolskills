import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ladderProgress, type LadderProgress } from "@/engine/typing/ladder";
import { LESSONS, lessonNumbered } from "@/engine/typing/lessons";

import { LessonLadder } from "./LessonLadder";
import { tileState } from "./LessonTile";

/**
 * The map, and which of its hundred doors are open (§6.6, §9).
 *
 * What progress *is* is pinned next door in `ladder.test.ts`; what this file
 * is for is the half of the unlock rule that lives on the screen. `next` is a
 * pointer and not the rule (its own docstring says so), and a ladder that
 * opened a tile on `n <= next` alone would pass a suite that only ever checked
 * the frontier — while silently deleting the placement test, because the thing
 * it removes is not on screen to look broken. So the checkpoints are asserted
 * on a profile with no runs at all, which is exactly where a `next`-only rule
 * would lock all ten.
 */

/** A profile that has never run anything: `{ cleared: {}, best: 0, next: 1 }`. */
const FRESH = ladderProgress([]);

/**
 * Progress as the engine would derive it, without a hundred sessions to build.
 *
 * `next` and `open` are passed in rather than computed, because where the
 * pointer stands and how far the rule reaches past it are `ladder.ts`'s to
 * decide and are pinned there — what is under test here is what the ladder
 * draws for a given pair.
 */
const at = (best: number, next: number, open = next): LadderProgress => ({
  cleared: new Set(Array.from({ length: best }, (_, i) => i + 1)),
  best,
  next,
  open,
});

const CHECKPOINTS = LESSONS.filter((lesson) => lesson.checkpoint);
const STORMS = LESSONS.filter((lesson) => lesson.kind.type === "storm");

type Tile = { classes: string; label: string; shut: boolean };

/**
 * Every tile the ladder drew, in the order it drew them.
 *
 * `hasKeyboard` defaults to true because that is what every device this suite
 * is not about reports, and what the hook answers when it cannot tell
 * (`useKeyboardPresence`). The tablet is a case, not the baseline.
 */
const tiles = (progress: LadderProgress, hasKeyboard = true): Tile[] =>
  renderToStaticMarkup(
    <LessonLadder
      progress={progress}
      hasKeyboard={hasKeyboard}
      onOpen={() => {}}
    />,
  )
    .split("<button")
    .slice(1)
    .map((chunk) => ({
      classes: /class="([^"]*)"/.exec(chunk)![1],
      label: /<span class="u-sr">([^<]*)</.exec(chunk)![1],
      shut: /aria-disabled="true"/.test(chunk),
    }));

describe("tileState", () => {
  it("points at the first lesson on a profile with no runs", () => {
    expect(tileState(lessonNumbered(1)!, FRESH)).toBe("next");
    expect(tileState(lessonNumbered(2)!, FRESH)).toBe("locked");
  });

  /**
   * Decision 16, and the one this whole file exists for: all ten, at `next`
   * of 1 (§6.6).
   */
  it("opens every checkpoint on a brand-new profile", () => {
    expect(CHECKPOINTS).toHaveLength(10);
    for (const checkpoint of CHECKPOINTS)
      expect(tileState(checkpoint, FRESH)).toBe("open");
  });

  it("fills what has been cleared and lights what is next", () => {
    const progress = at(7, 8);
    expect(tileState(lessonNumbered(7)!, progress)).toBe("cleared");
    expect(tileState(lessonNumbered(8)!, progress)).toBe("next");
    expect(tileState(lessonNumbered(9)!, progress)).toBe("locked");
  });

  /**
   * The pointer stands on the storm and the rung past it opens anyway (§8.8,
   * decision 72). A ladder that drew 5 as locked would have turned a wave a
   * child may skip into one they must beat.
   */
  it("points at a storm and opens the rung behind it", () => {
    // Lessons 1–3 cleared; 4 is a storm, and 5 opens with it.
    const progress = at(3, 4, 5);
    expect(tileState(lessonNumbered(4)!, progress)).toBe("next");
    expect(tileState(lessonNumbered(5)!, progress)).toBe("open");
    expect(tileState(lessonNumbered(6)!, progress)).toBe("locked");
  });

  /**
   * And a storm left behind stays enterable, which is the other half of it.
   * Written out rather than built with `at`, because the child this is about
   * is the one who passed lesson 5 without ever clearing the wave at 4.
   */
  it("leaves a storm the child walked past open", () => {
    const walkedPast: LadderProgress = {
      cleared: new Set([5]),
      best: 5,
      next: 6,
      open: 6,
    };
    expect(tileState(lessonNumbered(4)!, walkedPast)).toBe("open");
  });

  it("counts a cleared checkpoint as cleared, not as an open one", () => {
    // Passing checkpoint 10 clears 1–10 with it, by `max`.
    expect(tileState(lessonNumbered(10)!, at(10, 11))).toBe("cleared");
  });
});

describe("LessonLadder", () => {
  it("draws the hundred as ten rows of ten, named", () => {
    const html = renderToStaticMarkup(
      <LessonLadder progress={FRESH} hasKeyboard onOpen={() => {}} />,
    );
    expect(tiles(FRESH)).toHaveLength(LESSONS.length);
    expect(html.match(/class="ladder__row"/g)).toHaveLength(10);
    // The first block and the last, so the names are read off §5.5 in order.
    expect(html).toContain("Home row");
    expect(html).toContain("Everything");
  });

  /**
   * The state has to be in the accessible name and not only in the colour.
   * Some of the children reading this screen are five and using a screen
   * reader, and a hundred buttons called "7" is not a map.
   */
  it("says every tile's state out loud", () => {
    const drawn = tiles(at(7, 8));
    expect(drawn[0].label).toBe("Lesson 1, Two keys. Passed.");
    expect(drawn[7].label).toBe("Lesson 8, Pairs that repeat. Start here.");
    expect(drawn[9].label).toBe(
      "Lesson 10, Checkpoint · Home row. Checkpoint — always open, whatever you have passed. Open.",
    );
    // A storm says its own sentence first and then the same state every other
    // tile says out loud — here a rung this child has not reached, so it
    // carries what would open it as well.
    expect(drawn[8].label).toBe(
      "Lesson 9, Hailstorm · Home row. Hailstorm — worth playing, never required. Locked. Pass lesson 8 to open this one.",
    );
    // And a storm this child has played fills like any other rung: `at(7, 8)`
    // clears the first seven, lesson 4 among them.
    expect(drawn[3].label).toBe(
      "Lesson 4, Hailstorm · First ice. Hailstorm — worth playing, never required. Passed.",
    );
  });

  it("says a checkpoint is always open, on the tile and in the copy", () => {
    const html = renderToStaticMarkup(
      <LessonLadder progress={FRESH} hasKeyboard onOpen={() => {}} />,
    );
    expect(html).toContain("every checkpoint is open from the start");
    for (const tile of tiles(FRESH).filter((t) =>
      t.classes.includes("is-checkpoint"),
    )) {
      expect(tile.label).toContain("always open");
      expect(tile.shut).toBe(false);
    }
  });

  /**
   * `aria-disabled`, never `disabled`: a disabled button leaves the tab order,
   * and a child moving through the ladder on a keyboard would hear the rungs
   * they have reached and nothing about the ninety they have not.
   */
  it("keeps every tile in the tab order, locked ones included", () => {
    const html = renderToStaticMarkup(
      <LessonLadder progress={FRESH} hasKeyboard onOpen={() => {}} />,
    );
    expect(html).not.toContain('disabled=""');
    expect(tiles(FRESH).filter((tile) => tile.shut).length).toBeGreaterThan(0);
  });

  /**
   * The twenty are drawn at the top of the ladder, where every rung is behind
   * the child — so a shut tile here could only be a storm that had stopped
   * being playable.
   */
  it("draws the storms as diamonds a child can enter", () => {
    const drawn = tiles(at(99, 100));
    const storms = drawn.filter((tile) => tile.classes.includes("is-storm"));
    expect(storms).toHaveLength(STORMS.length);
    for (const storm of storms) {
      expect(storm.shut).toBe(false);
      expect(storm.label).toContain("worth playing, never required");
    }
  });

  /**
   * The rung it names is never the storm's own neighbour: `lockNote` walks
   * down past any storm in the way, so lesson 9's tile asks for lesson 8 and
   * never for a wave a tablet cannot play (§8.8).
   */
  it("locks a storm a child has not reached, and says what opens it", () => {
    const storm = tiles(FRESH).find((tile) =>
      tile.classes.includes("is-storm"),
    )!;
    expect(storm.shut).toBe(true);
    expect(storm.label).toContain("Locked. Pass lesson 3 to open this one.");
  });

  /**
   * The tablet (§8.8). Every other rung being unaffected is half the claim: a
   * passage is typed on the software keyboard like anything else, so a child
   * on an iPad still has the whole course.
   */
  it("says why a storm tile is shut on a device with no keyboard", () => {
    const drawn = tiles(at(99, 100), false);
    const storms = drawn.filter((tile) => tile.classes.includes("is-storm"));

    expect(storms).toHaveLength(STORMS.length);
    for (const storm of storms) {
      expect(storm.shut).toBe(true);
      expect(storm.label).toContain("Hailstorm needs a keyboard");
    }

    const lessons = drawn.filter((tile) => !tile.classes.includes("is-storm"));
    expect(lessons).toHaveLength(LESSONS.length - STORMS.length);
    for (const lesson of lessons) {
      expect(lesson.shut).toBe(false);
      expect(lesson.label).not.toContain("keyboard");
    }
  });

  /**
   * Detection is a guess (`useKeyboardPresence`), so the legend carries the
   * instruction that overturns it: a child in a keyboard folio presses a key
   * and the ladder redraws with no reload.
   */
  it("offers the keystroke that overturns the guess, in the legend only", () => {
    const shut = renderToStaticMarkup(
      <LessonLadder progress={FRESH} hasKeyboard={false} onOpen={() => {}} />,
    );
    expect(shut).toContain("Press any key if you have one");
    // Once, in the legend — not on each of the twenty tiles.
    expect(shut.match(/Press any key if you have one/g)).toHaveLength(1);

    const open = renderToStaticMarkup(
      <LessonLadder progress={FRESH} hasKeyboard onOpen={() => {}} />,
    );
    expect(open).not.toContain("Press any key");
    // What the legend says instead, on a device that can play them: the one
    // fact about a storm a child needs before pressing one (§8.8).
    expect(open).toContain("Nothing on the ladder waits on one");
  });
});
