import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { lessonById } from "@/engine/typing/lessons";
import type { Verdict } from "@/engine/typing/verdict";

import { PassBars } from "./PassBars";

/**
 * The bars, drawn (docs/typing.md §6.1).
 *
 * The lesson arm is exercised end to end next door in `LessonBars.test.tsx`,
 * over a real `verdictFor` — three bars, their order, and a bar that cannot
 * report more than full. What is only true here is the arm that has no live
 * screen to test it through: a Hailstorm level, whose verdict carries a speed
 * bar it was never asked for.
 */

/** Lesson 4 is a Hailstorm level: no passage, so no words per minute. */
const STORM = lessonById("L04")!;
/** Lesson 7 is the first words lesson, and introduces nothing. */
const L07 = lessonById("L07")!;

const labels = (verdict: Verdict, lesson = STORM) =>
  [
    ...renderToStaticMarkup(
      <PassBars lesson={lesson} verdict={verdict} />,
    ).matchAll(/passbar__label">([^<]*)</g),
  ].map((match) => match[1]);

/** Exactly what `verdictFor` hands back for a run that died in the wave. */
const deadInTheStorm: Verdict = {
  passed: false,
  accuracy: { got: 0.96, need: 0.9, ok: true },
  wpm: { got: 0, need: 0, ok: true },
  keys: [],
};

describe("PassBars", () => {
  /**
   * The bug this arm exists to avoid. §6.1's verdict gives a storm `wpm: {
   * got: 0, need: 0, ok: true }` — a bar a storm cannot fail — and a `need` of
   * zero draws as a full one. Three full bars over the word "failed" is a
   * child being shown a screen that contradicts itself, so the column a storm
   * was never asked for is not drawn at all and `missNote` says what the wave
   * did instead.
   */
  it("draws no speed bar on a Hailstorm level", () => {
    expect(labels(deadInTheStorm)).toEqual(["Accuracy"]);
  });

  it("keeps the speed bar on a lesson that introduces nothing", () => {
    // The neighbouring case, and the one that says the rule above is about
    // storms rather than about an empty `keys` array: a review lesson has no
    // key bar and is still marked on speed.
    expect(
      labels({ ...deadInTheStorm, wpm: { got: 9, need: 8, ok: true } }, L07),
    ).toEqual(["Accuracy", "Speed"]);
  });
});
