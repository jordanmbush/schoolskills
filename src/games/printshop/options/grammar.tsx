/**
 * Which lesson about sentences, and how the question is put.
 *
 * The same two controls the word-study panel has, and the second depends on the
 * first for the same reason: a topic states which shapes it can honestly be
 * asked in (`grammarStyles`), so the row of shapes is built from the topic
 * rather than being a fixed pair with one of them greyed out. Three of the five
 * topics have no closed list of answers to circle — an end mark, a capitalised
 * word and a sentence cut in half are none of them a multiple choice — so those
 * three show no shape control at all.
 *
 * Switching to a topic that cannot do the style already chosen sets the style as
 * well, in the same patch. The engine resolves it either way (`styleOf` never
 * throws), but a panel showing "Circle one" over a sheet that plainly writes the
 * answer out is the panel disagreeing with the paper.
 */
import type { GrammarConfig, GrammarStyle } from "@/engine/sheets/types";
import {
  GRAMMAR_TOPICS,
  grammarColumns,
  grammarStyles,
  grammarTopicLabel,
} from "@/engine/sheets/grammar/grammar";

import { Choice, Sizing, opt, type PanelProps } from "./parts";

/** The five topics, in the order the engine lists them — roughly by age. */
const TOPICS = GRAMMAR_TOPICS.map((topic) =>
  opt(topic, grammarTopicLabel(topic)),
);

const STYLE_LABELS: Record<GrammarStyle, string> = {
  write: "Write it",
  choose: "Circle one",
};

export function GrammarPanel({ config, set }: PanelProps<GrammarConfig>) {
  const styles = grammarStyles(config.topic);
  const style = styles.includes(config.style) ? config.style : styles[0];
  const across = grammarColumns(config.topic);

  return (
    <>
      <Choice
        label="Topic"
        value={config.topic}
        onChange={(topic) =>
          set(
            grammarStyles(topic).includes(style)
              ? { topic }
              : { topic, style: grammarStyles(topic)[0] },
          )
        }
        options={TOPICS}
        hint="One topic to a sheet. The instruction line at the top of the page can only say one thing."
      />

      {styles.length > 1 && (
        <Choice
          label="How it is asked"
          value={style}
          onChange={(next) => set({ style: next })}
          options={styles.map((one) => opt(one, STYLE_LABELS[one]))}
        />
      )}

      {/* Columns only where a sentence and a slot share a line. A row of
          options is the width of the paper, and so are the two ruled lines a
          subject-and-predicate sheet writes its answer on — which is why both
          the offer and the cap are `grammarColumns` rather than a topic named
          here: the engine already decides this, and a second copy of the rule
          is a stepper that moves a number the paper ignores. */}
      <Sizing
        label="Sentences"
        count={config.count}
        columns={style === "write" && across > 1 ? config.columns : undefined}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={across}
      />
    </>
  );
}
