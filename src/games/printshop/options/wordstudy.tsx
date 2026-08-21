/**
 * Which lesson about words, and how the question is put.
 *
 * Two controls, and the second depends on the first: a topic states the styles
 * it can honestly be asked in (`studyStyles`). "Write a word that rhymes with
 * cat" is a fine thing to ask a child and cannot be printed with an answer key,
 * so rhyming does not offer it.
 *
 * Switching to a topic that cannot do the style already chosen sets the style as
 * well, in the same patch. The engine resolves it either way (`styleOf` never
 * throws), but a panel showing "Join them up" over a sheet that plainly writes
 * them out is the panel disagreeing with the paper.
 */
import type { WordStudyConfig, WordStudyStyle } from "@/engine/sheets/types";
import {
  STUDY_TOPICS,
  studyStyles,
  studyTopicLabel,
} from "@/engine/sheets/words/study";

import { Choice, Sizing, opt, type PanelProps } from "./parts";

/** The ten topics, in the order the engine lists them — roughly by age. */
const TOPICS = STUDY_TOPICS.map((topic) => opt(topic, studyTopicLabel(topic)));

const STYLE_LABELS: Record<WordStudyStyle, string> = {
  write: "Write it",
  choose: "Circle one",
  match: "Join them up",
};

export function WordStudyPanel({ config, set }: PanelProps<WordStudyConfig>) {
  const styles = studyStyles(config.topic);
  const style = styles.includes(config.style) ? config.style : styles[0];

  return (
    <>
      <Choice
        label="Topic"
        value={config.topic}
        onChange={(topic) =>
          set(
            studyStyles(topic).includes(style)
              ? { topic }
              : { topic, style: studyStyles(topic)[0] },
          )
        }
        options={TOPICS}
        hint="One topic to a sheet. These are separate weeks in every scheme there is, and the instruction line can only say one thing."
      />

      {styles.length > 1 && (
        <Choice
          label="How it is asked"
          value={style}
          onChange={(next) => set({ style: next })}
          options={styles.map((one) => opt(one, STYLE_LABELS[one]))}
        />
      )}

      {/* Only the written topics lay their questions out across the page: a row
          of options and a matching column are both the width of the paper. */}
      <Sizing
        label="Questions"
        count={config.count}
        columns={style === "write" ? config.columns : undefined}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={3}
      />
    </>
  );
}
