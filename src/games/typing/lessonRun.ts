import { generate } from "@/engine/typing/generate";
import type { Lesson } from "@/engine/typing/lessons";
import type { TypingConfig } from "@/engine/types";

/**
 * A lesson, as a config the race loop can be handed
 * (docs/typing.md §5.3, §5.4).
 *
 * The passage is generated **here, inside the island**, and travels in
 * `config.words`. That is the whole of §5.3's bargain: `decks/index.ts` is the
 * front door for every island on the site, so a corpus reachable from it is a
 * corpus every island downloads — 222 KB, the last time it was got wrong. The
 * deck layer builds the run from the words it is given and never learns where
 * they came from, and `local/no-corpus-in-decks` is what keeps that true.
 *
 * `levelId` carries the lesson's own id, exactly as §5.4 says: `modeOf` and
 * `configKey` both prefer `lessonId`, so the level field is inert on a ladder
 * run and setting it to anything else would only invite a screen to read it.
 *
 * `wordCount` is the lesson's, not the generated array's — it is half of
 * `configKey` (`typing|L07|25`), and a key that moved with the passage would
 * file every attempt in a bucket of one and never show a child their own best.
 *
 * Fresh words every time, which is why this takes a seed rather than caching:
 * lesson 7 is a lesson, not a passage, and a child handed the same words back
 * on every attempt would be sitting a memory test by the third one. The seed
 * is saved with the run, so the passage is still reproducible after the fact.
 */
export function lessonConfig(lesson: Lesson, seed: number): TypingConfig {
  return {
    kind: "typing",
    levelId: lesson.id,
    lessonId: lesson.id,
    words: generate(lesson, seed),
    wordCount: lesson.wordCount,
  };
}
