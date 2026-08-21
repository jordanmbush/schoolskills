import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { lessonById } from "@/engine/typing/lessons";
import type { CardResult, TypingConfig } from "@/engine/types";

import { LessonBars } from "./LessonBars";

/**
 * The bars a lesson is run against, while it is being run (§7, §6.1).
 *
 * What the numbers mean is pinned next door in `verdict.test.ts`, and this
 * file deliberately does not re-test it: these bars come from `verdictFor`
 * precisely so that the HUD and the results screen cannot drift apart by a
 * rounding rule. What is only true here is the three decisions this component
 * makes on top of it — which bars are shown, which of many keys is worth a
 * bar, and that a bar cannot report more than full.
 */

/** Lesson 1: `f` and `j`, at 95% accuracy, 8 wpm, and 12 strikes a key. */
const L01 = lessonById("L01")!;
/** Lesson 7: the first words, and it introduces nothing — so no key bar. */
const L07 = lessonById("L07")!;

const config: TypingConfig = {
  kind: "typing",
  levelId: "L01",
  lessonId: "L01",
  wordCount: 24,
};

/** A word as the loop records it: right when what was given matches. */
const card = (answer: string, given = answer): CardResult => ({
  prompt: answer,
  answer,
  given,
  ok: given === answer,
  ms: 2500,
  factId: answer,
});

const times = (n: number, make: () => CardResult) =>
  Array.from({ length: n }, make);

type Row = { label: string; ok: boolean; width: string; value: string };

/** The bars as drawn, in the order they were drawn. */
const rows = (html: string): Row[] =>
  html
    .split('<div class="passbar')
    .slice(1)
    .map((chunk) => ({
      ok: /^[^>]*is-ok/.test(chunk),
      label: /passbar__label">([^<]*)</.exec(chunk)![1],
      width: /style="width:([^"]*)"/.exec(chunk)![1],
      value: /passbar__value u-mono">([^<]*)</.exec(chunk)![1],
    }));

const render = (lesson = L01, cards: CardResult[] = [], elapsedMs = 60000) =>
  rows(
    renderToStaticMarkup(
      <LessonBars
        lesson={lesson}
        config={config}
        cards={cards}
        elapsedMs={elapsedMs}
      />,
    ),
  );

describe("LessonBars", () => {
  it("shows accuracy, then the new key, then speed", () => {
    // §6.1's order, which is the order they matter.
    expect(render().map((row) => row.label)).toEqual([
      "Accuracy",
      "New key f",
      "Speed",
    ]);
  });

  it("draws an empty bar for a run that hasn't started", () => {
    // The first frame, behind the 3·2·1: no cards, and a clock that is already
    // running. Nothing divides by nothing, and no bar claims to be full.
    expect(render().map((row) => row.width)).toEqual(["0%", "0%", "0%"]);
    expect(render().every((row) => !row.ok)).toBe(true);
  });

  it("fills and marks each bar the run has met", () => {
    // Twenty-four four-letter words in a minute: 24 wpm against a bar of 8,
    // every word right, and both new keys struck 48 times apiece.
    const done = [
      ...times(12, () => card("ffff")),
      ...times(12, () => card("jjjj")),
    ];
    expect(render(L01, done)).toEqual([
      { label: "Accuracy", ok: true, width: "100%", value: "100%" },
      { label: "New key f", ok: true, width: "100%", value: "100%" },
      { label: "Speed", ok: true, width: "100%", value: "24" },
    ]);
  });

  /**
   * A lesson can introduce fifteen keys and the gate is every one of them at
   * once (§6.4), so the one bar worth the room is the key holding you up.
   */
  it("names the key that is holding the run up", () => {
    const drill = [
      ...times(12, () => card("ffff")),
      // Every `j` word ends on an `f`: three strikes of `j` land, one misses.
      ...times(12, () => card("jjjj", "jjjf")),
    ];
    const [accuracy, key] = render(L01, drill);

    expect(key).toMatchObject({ label: "New key j", ok: false, value: "75%" });
    // 75% of a bar that wants 90%: most of the way along it, and not there.
    expect(Number.parseFloat(key.width)).toBeCloseTo(83.3, 1);
    // Half the words wrong, so the bar it is really failing on is the first.
    expect(accuracy).toMatchObject({ ok: false, value: "50%" });
  });

  it("has no key bar on a lesson that introduces nothing", () => {
    // Every review lesson and every checkpoint. There is no third thing being
    // asked, and a bar for it would be one that can never move.
    expect(render(L07, [card("dad")]).map((row) => row.label)).toEqual([
      "Accuracy",
      "Speed",
    ]);
  });
});
