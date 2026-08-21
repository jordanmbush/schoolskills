import { configKey } from "@/engine/decks";
import { generate } from "@/engine/typing/generate";
import type { Lesson } from "@/engine/typing/lessons";
import type { KeyboardMode, TypingConfig } from "@/engine/types";

/**
 * A lesson, as a config the race loop can be handed (§5.3, §5.4).
 *
 * The passage is generated **here, inside the island**, and travels in
 * `config.words`: a corpus reachable from `decks/index.ts` is a corpus every
 * island on the site downloads (§5.3), and `local/no-corpus-in-decks` is what
 * keeps that true.
 *
 * `levelId` carries the lesson's own id (§5.4): `modeOf` and `configKey` both
 * prefer `lessonId`, so the level field is inert on a ladder run and setting it
 * to anything else would only invite a screen to read it.
 *
 * `wordCount` is the lesson's, not the generated array's: it is half of
 * `configKey` (`typing|L07|25`), and a key that moved with the passage would
 * file every attempt in a bucket of one and never show a child their own best.
 *
 * Fresh words every time, which is why this takes a seed rather than caching:
 * the same words back on every attempt would be a memory test by the third one.
 * The seed is saved with the run, so the passage is still reproducible after
 * the fact.
 */
export function lessonConfig(
  lesson: Lesson,
  seed: number,
  /**
   * What the child chose in the brief, when they chose anything (§4.2).
   *
   * Absent on a locked lesson and on every route that starts a run without a
   * brief in front of it, and absent is the right answer for both: the run then
   * reads the lesson's own mode, which is what it would have been shown.
   */
  keyboard?: KeyboardMode,
): TypingConfig {
  return {
    ...identity(lesson),
    words: generate(lesson, seed),
    ...(keyboard ? { keyboard } : {}),
  };
}

/**
 * Everything about a lesson's config that the record book keys on, which is
 * everything except the passage and the choice made in the brief.
 *
 * Split out so that `lessonKey` below is built from the same three fields
 * `lessonConfig` sets rather than from a second opinion about them. A brief
 * showing a best from one bucket over a Start that files into another would be
 * wrong in the direction nobody checks: both halves look right on their own.
 */
const identity = (lesson: Lesson): TypingConfig => ({
  kind: "typing",
  levelId: lesson.id,
  lessonId: lesson.id,
  wordCount: lesson.wordCount,
});

/**
 * Where this lesson's runs are filed, without generating a passage to ask.
 *
 * `configKey` leaves the words out whenever a `lessonId` stands in for them
 * (§5.4), so this is the same string `lessonConfig`'s output produces — and the
 * brief can look up a best without paying for a passage it would throw away.
 */
export const lessonKey = (lesson: Lesson) => configKey(identity(lesson));
