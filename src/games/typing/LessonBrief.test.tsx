import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ladderProgress, type LadderProgress } from "@/engine/typing/ladder";
import { lessonById } from "@/engine/typing/lessons";
import type { Run } from "@/engine/typing/verdict";
import type { CardResult, KeyboardMode } from "@/engine/types";

import { LessonBrief } from "./LessonBrief";

/**
 * What is written on the door (docs/typing.md §9, §4.2).
 *
 * Three things are on trial here and only one of them is copy:
 *
 *   - **The keyboard is seeded, not imposed.** An unlocked lesson opens on its
 *     own suggestion with three pills a child may press; a locked one shows the
 *     same three, disabled, with the reason. That distinction is the whole of
 *     #145's folded-in half, and before it `keyboardLocked` marked nothing.
 *   - **What starts, and what cannot.** A locked lesson has no Start, and
 *     **every checkpoint is startable at any time** — the express lane (§6.6)
 *     runs through this screen now, and a brief that gated on `n <= next` would
 *     take it out with nothing on the ladder looking broken.
 *   - **What it says it wants**, which is the three bars, in §6.1's order.
 */

/** Lesson 1: `f` and `j`, `guide` and locked. Open on a fresh profile. */
const L01 = lessonById("L01")!;
/** Lesson 7: home-row words, `guide` and only suggesting it. */
const L07 = lessonById("L07")!;
/** Checkpoint 10: `off`, locked, and open at every value of `next`. */
const L10 = lessonById("L10")!;

/** A profile that has never run anything: `{ cleared: {}, best: 0, next: 1 }`. */
const FRESH = ladderProgress([]);

const render = (
  lesson = L07,
  {
    progress = FRESH,
    best = null,
    profileKeyboard,
  }: {
    progress?: LadderProgress;
    best?: Run | null;
    profileKeyboard?: KeyboardMode;
  } = {},
) =>
  renderToStaticMarkup(
    <LessonBrief
      lesson={lesson}
      progress={progress}
      best={best}
      profileKeyboard={profileKeyboard}
      onStart={() => {}}
      onClose={() => {}}
    />,
  );

/** Which pill is selected, and whether the row can be pressed at all. */
const pills = (html: string) =>
  html
    .split("<input")
    .slice(1)
    .map((chunk) => ({
      value: /value="([^"]+)"/.exec(chunk)![1],
      on: chunk.includes("checked"),
      shut: chunk.includes("disabled"),
    }));

const started = (html: string) => html.includes(">Start</button>");

describe("LessonBrief", () => {
  it("says what the lesson is and which keys are new", () => {
    const html = render(L01);

    expect(html).toContain("Lesson 1");
    expect(html).toContain("Two keys");
    expect(html).toContain("New keys");
    // Its own two, as keys rather than as a list in a sentence.
    expect(html).toContain(">f</kbd>");
    expect(html).toContain(">j</kbd>");
  });

  it("says a review lesson has nothing new, rather than saying nothing", () => {
    expect(L07.introduces).toHaveLength(0);
    expect(render(L07)).toContain("No new keys");
  });

  /**
   * The three bars as targets. In §6.1's order, and the new-key row absent
   * exactly where its bar is — a lesson that introduces nothing is not being
   * asked a third thing, and a row for it could never be met or missed.
   */
  it("asks for the three bars, in the order they matter", () => {
    const html = render(L01);

    expect(html).toContain("Accuracy");
    expect(html).toContain("New keys</b>");
    expect(html).toContain("Speed");
    expect(html.indexOf("Accuracy")).toBeLessThan(html.indexOf("Speed"));
    // Lesson 1's own row of §5.6: 95%, 8 wpm, 12 strikes a key.
    expect(html).toContain("95%");
    expect(html).toContain("8 words a minute");
    expect(html).toContain("12 goes");

    // No new keys, no third ask.
    expect(render(L07)).not.toContain("New keys</b>");
  });

  it("says there is no best yet, and quotes one when there is", () => {
    expect(render(L07)).toContain("run this one yet");

    const html = render(L07, { best: run(L07.wordCount, 60000) });
    expect(html).toContain("Your best here");
    expect(html).toContain("100% right");
  });

  // ── The keyboard (§4.2) ────────────────────────────────────────────────────

  it("opens on the lesson's mode, with the choice left open", () => {
    // The lesson suggests `guide`; the child's own setting is `off`. Seeded
    // from the lesson, and every pill still pressable — which is the half that
    // was missing: before #145 the lesson's mode was simply imposed.
    const html = render(L07, { profileKeyboard: "off" });

    expect(pills(html).filter((pill) => pill.on)).toEqual([
      { value: "guide", on: true, shut: false },
    ]);
    expect(pills(html).some((pill) => pill.shut)).toBe(false);
  });

  it("shows a locked keyboard disabled, and says why", () => {
    const html = render(L01);

    expect(pills(html)).toHaveLength(3);
    expect(pills(html).every((pill) => pill.shut)).toBe(true);
    expect(html).toContain("new keys");

    // The checkpoint's reason is the other one worth giving, and it is why a
    // checkpoint means anything at all.
    expect(render(L10)).toContain("Checkpoints are typed without the keyboard");
  });

  it("falls through to the player's own setting where a lesson defers", () => {
    // No lesson in the shipped hundred defers, which is exactly why the chain
    // read as an override for so long. Free play is the live caller of this
    // arm; this pins that the arm still exists for a lesson that ever does.
    const html = render({ ...L07, keyboard: null }, { profileKeyboard: "off" });

    expect(pills(html).find((pill) => pill.on)?.value).toBe("off");
  });

  // ── What may be started (§6.6) ────────────────────────────────────────────

  it("starts an open lesson", () => {
    expect(started(render(L01))).toBe(true);
  });

  it("will not start a locked lesson, and says what would open it", () => {
    // Lesson 7 on a profile that has never run anything: locked, and the rung
    // below it is 6 — not 5, and the storm at 4 is not in the way of either.
    const html = render(L07);

    expect(started(html)).toBe(false);
    expect(html).toContain("Pass lesson 6 to open this one.");
    expect(html).toContain("try a checkpoint");
  });

  /**
   * Decision 16, through the brief. A nine-year-old who already types opens
   * checkpoint 40 from a standing start, passes it, and begins at 41 — and
   * that only works if this screen offers them Start.
   */
  it("starts any checkpoint, on a profile with no runs at all", () => {
    expect(started(render(L10))).toBe(true);
  });
});

/** A run of `words` perfect words in `ms`, as the loop would have recorded it. */
function run(words: number, ms: number): Run {
  const cards: CardResult[] = Array.from({ length: words }, () => ({
    prompt: "dad",
    answer: "dad",
    given: "dad",
    ok: true,
    ms: ms / words,
    factId: "dad",
  }));

  return {
    cards,
    config: { kind: "typing", levelId: "L07", lessonId: "L07", wordCount: 25 },
    correct: words,
    incorrect: 0,
    durationMs: ms,
  };
}
