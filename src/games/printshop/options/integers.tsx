/**
 * Positive and negative whole numbers, the order of operations, and powers.
 *
 * `negatives` is on by default here and it is still worth being able to turn
 * off: an order-of-operations sheet without a minus sign on it is a real lesson,
 * and it is the one a year younger. `powers` is the same argument again — the
 * rule is taught as "brackets, powers, then × and ÷", but a child meets the rule
 * a term before they meet exponents, and a sheet that asked for both would be an
 * impossible page rather than a hard one.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type {
  IntegerConfig,
  IntegerOperation,
  IntegerStyle,
} from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<IntegerStyle>("arithmetic", "Arithmetic"),
  opt<IntegerStyle>("order", "Order of operations"),
  opt<IntegerStyle>("powers", "Powers and roots"),
];

const OPERATIONS = [
  opt<IntegerOperation>("add", "Add"),
  opt<IntegerOperation>("subtract", "Subtract"),
  opt<IntegerOperation>("multiply", "Multiply"),
  opt<IntegerOperation>("divide", "Divide"),
  opt<IntegerOperation>("both", "All four"),
];

export function IntegersPanel({ config, set }: PanelProps<IntegerConfig>) {
  const order = config.style === "order";

  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {config.style === "arithmetic" && (
        <Choice
          label="Operation"
          value={config.operation}
          onChange={(operation) => set({ operation })}
          options={OPERATIONS}
        />
      )}
      {order && (
        <FieldSet
          legend="Operations in each expression"
          hint="How long the sentence is that has to be worked in the right order."
        >
          <NumberStepper
            label="Operations in each expression"
            value={config.terms ?? 3}
            min={2}
            max={5}
            onChange={(terms) => set({ terms })}
          />
        </FieldSet>
      )}
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={200}
        hint="How big the numbers get, sign aside."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />
      <Checkbox
        label="Negative numbers"
        checked={config.negatives !== false}
        onChange={(negatives) => set({ negatives })}
      />
      {order && (
        <Checkbox
          label="Squares in the expression"
          hint="Turn off for the same lesson a year earlier — the printed instruction follows the switch."
          checked={config.powers !== false}
          onChange={(powers) => set({ powers })}
        />
      )}
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
