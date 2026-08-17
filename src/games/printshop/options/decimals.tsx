/**
 * Decimals and percentages.
 *
 * Places is the difficulty dial, and column form is worth more on this sheet
 * than anywhere else in the shop: every value prints to the same number of
 * places, so stacking them right-aligned puts the points in a column — which is
 * the one thing a child lining up a decimal sum has to get right.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type {
  DecimalConfig,
  DecimalForm,
  DecimalOperation,
  DecimalStyle,
} from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<DecimalStyle>("standard", "Arithmetic"),
  opt<DecimalStyle>("percent", "Percentages"),
  opt<DecimalStyle>("convert", "Convert"),
];

const OPERATIONS = [
  opt<DecimalOperation>("add", "Add"),
  opt<DecimalOperation>("subtract", "Subtract"),
  opt<DecimalOperation>("multiply", "Multiply"),
  opt<DecimalOperation>("both", "Add and subtract"),
];

const FORMS = [
  opt<DecimalForm>("horizontal", "Along a line"),
  opt<DecimalForm>("vertical", "In columns"),
];

export function DecimalsPanel({ config, set }: PanelProps<DecimalConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {config.style === "standard" && (
        <>
          <Choice
            label="Operation"
            value={config.operation}
            onChange={(operation) => set({ operation })}
            options={OPERATIONS}
          />
          <Choice
            label="Written"
            value={config.form}
            onChange={(form) => set({ form })}
            options={FORMS}
          />
        </>
      )}
      <FieldSet
        legend="Decimal places"
        hint="How many digits after the point — the whole of what makes one of these easy or hard."
      >
        <NumberStepper
          label="Decimal places"
          value={config.places}
          min={1}
          max={3}
          onChange={(places) => set({ places })}
        />
      </FieldSet>
      <Span
        label="Whole numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={0}
        max={999}
        hint="The whole numbers the values sit between."
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
