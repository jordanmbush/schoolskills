import { verdictFor } from "@/engine/typing/verdict";
import type { Lesson } from "@/engine/typing/lessons";
import type { CardResult, RaceConfig } from "@/engine/types";
import { PassBars } from "./PassBars";

/**
 * What the lesson is asking for, filling as the child does it (§7, §6.1).
 *
 * The bars are the SAME ones the results screen draws — literally `PassBars`,
 * off the same `verdictFor` over the run so far: cards in, elapsed in, three
 * bars out. A HUD that counted accuracy its own way would drift from the
 * verdict by a rounding rule and tell a child they had it a word before they
 * did. What is only true here is the run-so-far half: the run being marked is
 * still going, so this module builds it, and `PassBars` never has to know
 * whether the clock has stopped.
 */

/**
 * The verdict is recomputed every clock tick — about sixteen times a second —
 * so it walks the cards that often: at most `lesson.wordCount` (150 at the top
 * of the ladder) character compares, beside a screen already re-rendering the
 * passage at that rate. Microseconds, and it buys the one thing worth having —
 * no second definition of "how it is going" to disagree with the one that
 * decides whether the lesson was passed.
 */
export function LessonBars({
  lesson,
  config,
  cards,
  elapsedMs,
}: {
  lesson: Lesson;
  /** The run's own config, which is all `verdictFor` reads it for. */
  config: RaceConfig;
  /** The words committed so far, in order. */
  cards: CardResult[];
  /** The stopwatch, so speed is speed *now* and not speed at the last word. */
  elapsedMs: number;
}) {
  const correct = cards.filter((card) => card.ok).length;
  const verdict = verdictFor(
    {
      cards,
      config,
      correct,
      incorrect: cards.length - correct,
      durationMs: elapsedMs,
    },
    lesson,
  );

  return <PassBars lesson={lesson} verdict={verdict} />;
}
