/**
 * Telling the time.
 *
 * The step is the difficulty dial and it is the whole of it: o'clock, half past,
 * the quarters, the numerals a child counts round in fives, and any minute
 * there is. The names come from the engine rather than from here so the picker
 * and the printed title cannot disagree about what a sheet is set to.
 */
import { Checkbox } from "@/components/ui/kit";
import { STEP_NAME, TIME_STEPS } from "@/engine/sheets/maths/time";
import type { TimeConfig, TimeStyle } from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<TimeStyle>("read", "Read the clock"),
  opt<TimeStyle>("draw", "Draw the hands"),
  opt<TimeStyle>("elapsed", "Time between"),
];

const STEPS = TIME_STEPS.map((step) =>
  opt(String(step), STEP_NAME[step] ?? `to ${step} minutes`),
);

export function TimePanel({ config, set }: PanelProps<TimeConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      <Choice
        label="Times land"
        value={String(config.step)}
        onChange={(step) => set({ step: Number(step) })}
        options={STEPS}
      />
      {config.style === "elapsed" && (
        <Span
          label="Minutes apart"
          value={config.span ?? { min: 5, max: 120 }}
          onChange={(span) => set({ span })}
          min={1}
          max={720}
          hint="Half an hour to two hours is a different lesson from five minutes to twenty."
        />
      )}
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={4}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
