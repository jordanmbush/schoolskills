/**
 * Mean, median, mode and range.
 *
 * The size of the set is not really a difficulty dial, and the hint says so: an
 * even-sized set has its median between two numbers, which is the lesson a
 * five-number set cannot teach at any level.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type { StatisticStyle, StatisticsConfig } from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<StatisticStyle>("mean", "Mean"),
  opt<StatisticStyle>("median", "Median"),
  opt<StatisticStyle>("mode", "Mode"),
  opt<StatisticStyle>("range", "Range"),
  opt<StatisticStyle>("all", "All four"),
];

export function StatisticsPanel({ config, set }: PanelProps<StatisticsConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      <FieldSet
        legend="Numbers in each set"
        hint="An even-sized set puts the median between two numbers, which is its own lesson."
      >
        <NumberStepper
          label="Numbers in each set"
          value={config.size}
          min={3}
          max={12}
          onChange={(size) => set({ size })}
        />
      </FieldSet>
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={0}
        max={200}
        hint="What the sets are drawn from."
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
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
