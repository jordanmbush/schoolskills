/**
 * Measurement.
 *
 * Two systems and no conversion between them, which is why the system is a
 * choice rather than a pool: a child converting metres into feet is doing a
 * different lesson — an approximate one — and everything in this family is
 * exact.
 */
import { Checkbox } from "@/components/ui/kit";
import type {
  MeasureConfig,
  MeasureStyle,
  Quantity,
  UnitSystem,
} from "@/engine/sheets/types";

import { Choice, Pool, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<MeasureStyle>("convert", "Convert"),
  opt<MeasureStyle>("compare", "Compare"),
];

const SYSTEMS = [
  opt<UnitSystem>("metric", "Metric"),
  opt<UnitSystem>("imperial", "Imperial"),
];

const QUANTITIES: Quantity[] = ["length", "mass", "capacity"];

const QUANTITY_NAME: Record<Quantity, string> = {
  length: "Length",
  mass: "Weight",
  capacity: "Capacity",
};

export function MeasurePanel({ config, set }: PanelProps<MeasureConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      <Choice
        label="System"
        value={config.system}
        onChange={(system) => set({ system })}
        options={SYSTEMS}
      />
      <Pool
        label="Measuring"
        values={QUANTITIES}
        chosen={config.quantities}
        onChange={(quantities) => set({ quantities })}
        labelOf={(quantity) => QUANTITY_NAME[quantity]}
      />
      <Span
        label="Amounts"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={500}
        hint="How many of the unit written on the left."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
