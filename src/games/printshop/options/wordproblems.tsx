/**
 * Word problems.
 *
 * The topics are a pool because a page that mixes them is the point: a child who
 * knows which sum to do when the question says so is not yet doing word
 * problems. Work space is on by default here and nowhere else — a story
 * problem is worked out on the page, not in the margin.
 */
import { Checkbox } from "@/components/ui/kit";
import type { WordProblemConfig, WordTopic } from "@/engine/sheets/types";

import { Pool, Sizing, Span, type PanelProps } from "./parts";

const TOPICS: WordTopic[] = [
  "integers",
  "rate",
  "percent",
  "equation",
  "average",
];

const TOPIC_NAME: Record<WordTopic, string> = {
  integers: "Adding and taking away",
  rate: "Rate",
  percent: "Percentages",
  equation: "Equations",
  average: "Averages",
};

export function WordProblemsPanel({
  config,
  set,
}: PanelProps<WordProblemConfig>) {
  return (
    <>
      <Pool
        label="Topics"
        values={TOPICS}
        chosen={config.topics}
        onChange={(topics) => set({ topics })}
        labelOf={(topic) => TOPIC_NAME[topic]}
        hint="Several at once is the exercise: knowing which sum to do is most of it."
      />
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={500}
        hint="How big the numbers in a story get."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={2}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace !== false}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
