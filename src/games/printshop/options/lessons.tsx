/**
 * Which lesson, and whether the problems to try come with it.
 *
 * Two controls, because a lesson has two halves and nothing else to choose:
 * the words and pictures are authored, and the only thing a parent decides
 * about them is which lesson it is. The problems are the half that can be
 * left off — a lesson pinned up is read, not marked.
 */
import { Checkbox } from "@/components/ui/kit";
import {
  LESSON_TOPICS,
  lessonTopicLabel,
} from "@/engine/sheets/lessons/lesson";
import type { LessonConfig } from "@/engine/sheets/types";

import { Choice, opt, type PanelProps } from "./parts";

/** The topics, in the order the engine lists them — the order a child meets them. */
const TOPICS = LESSON_TOPICS.map((topic) =>
  opt(topic, lessonTopicLabel(topic)),
);

export function LessonsPanel({ config, set }: PanelProps<LessonConfig>) {
  return (
    <>
      <Choice
        label="Lesson"
        value={config.topic}
        onChange={(topic) => set({ topic })}
        options={TOPICS}
        hint="One idea to a page, in the order a child meets them: sharing, grouping and arrays; leftovers and the two written methods; then decimals."
      />
      <Checkbox
        label="Problems to try"
        hint="A few at the foot of the page with the same picture as the lesson. Off prints the lesson alone."
        checked={config.practice !== false}
        onChange={(practice) => set({ practice })}
      />
    </>
  );
}
