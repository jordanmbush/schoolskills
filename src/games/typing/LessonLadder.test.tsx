import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ladderProgress, type LadderProgress } from "@/engine/typing/ladder";
import { LESSONS, lessonNumbered } from "@/engine/typing/lessons";

import { LessonLadder } from "./LessonLadder";
import { tileState } from "./LessonTile";

/**
 * The map, and which of its hundred doors are open (docs/typing.md §6.6, §9).
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
 * `next` is passed in rather than computed, because carrying the pointer over
 * a Hailstorm level is `ladder.ts`'s rule and is pinned there — what is under
 * test here is what the ladder draws for a given pointer, storms included.
 */
const at = (best: number, next: number): LadderProgress => ({
  cleared: new Set(Array.from({ length: best }, (_, i) => i + 1)),
  best,
  next,
});

const CHECKPOINTS = LESSONS.filter((lesson) => lesson.checkpoint);
const STORMS = LESSONS.filter((lesson) => lesson.kind.type === "storm");

type Tile = { classes: string; label: string; shut: boolean };

/** Every tile the ladder drew, in the order it drew them. */
const tiles = (progress: LadderProgress): Tile[] =>
  renderToStaticMarkup(<LessonLadder progress={progress} onOpen={() => {}} />)
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
   * Decision 16, and the one this whole file exists for. All ten, at `next`
   * of 1 — a nine-year-old who already types opens checkpoint 40, passes it,
   * and starts at 41 rather than spending a week on `fff jjj`.
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
   * §8.8: the pointer is carried over a storm rather than made to jump it, so
   * the storm it stepped past stays at or below `next` and stays open.
   * Skippable is not the same as skipped.
   */
  it("leaves a skipped storm open behind the pointer", () => {
    // Lessons 1–3 cleared; 4 is a storm, so the pointer is carried to 5.
    const progress = at(3, 5);
    expect(tileState(lessonNumbered(4)!, progress)).toBe("open");
    expect(tileState(lessonNumbered(5)!, progress)).toBe("next");
  });

  it("counts a cleared checkpoint as cleared, not as an open one", () => {
    // Passing checkpoint 10 clears 1–10 with it, by `max`.
    expect(tileState(lessonNumbered(10)!, at(10, 11))).toBe("cleared");
  });
});

describe("LessonLadder", () => {
  it("draws the hundred as ten rows of ten, named", () => {
    const html = renderToStaticMarkup(
      <LessonLadder progress={FRESH} onOpen={() => {}} />,
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
    expect(drawn[8].label).toBe(
      "Lesson 9, Hailstorm · Home row. Hailstorm — worth playing, never required. Coming soon.",
    );
  });

  it("says a checkpoint is always open, on the tile and in the copy", () => {
    const html = renderToStaticMarkup(
      <LessonLadder progress={FRESH} onOpen={() => {}} />,
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
      <LessonLadder progress={FRESH} onOpen={() => {}} />,
    );
    expect(html).not.toContain('disabled=""');
    expect(tiles(FRESH).filter((tile) => tile.shut).length).toBeGreaterThan(0);
  });

  /**
   * A storm level has no passage and no wave until #159 builds one, so its
   * tile is drawn — the map is wrong without lesson 4 on it — and cannot be
   * entered. Same stand-down the lesson results screen makes.
   */
  it("draws the storms as diamonds that cannot be entered yet", () => {
    const drawn = tiles(at(99, 100));
    const storms = drawn.filter((tile) => tile.classes.includes("is-storm"));
    expect(storms).toHaveLength(STORMS.length);
    for (const storm of storms) expect(storm.shut).toBe(true);
  });
});
