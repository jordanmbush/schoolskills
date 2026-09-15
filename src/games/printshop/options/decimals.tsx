/**
 * Decimals and percentages.
 *
 * Places is the difficulty dial, and column form is worth more on this sheet
 * than anywhere else in the shop: every value prints to the same number of
 * places, so stacking them right-aligned puts the points in a column — which is
 * the one thing a child lining up a decimal sum has to get right.
 *
 * Division shows three controls the other operations never see, and hides two
 * of its own as they stop meaning anything: "In columns" goes when the divisor
 * is a decimal, because that sheet is rewritten before it is worked and is
 * only ever written along a line, and the work-space box goes when the
 * divisions are in the bracket, whose squares are the working space.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type {
  DecimalConfig,
  DecimalForm,
  DecimalOperation,
  DecimalStyle,
} from "@/engine/sheets/types";

import {
  Choice,
  HELP_HINT,
  HELP_LEVELS,
  Sizing,
  Span,
  opt,
  type PanelProps,
} from "./parts";

const STYLES = [
  opt<DecimalStyle>("standard", "Arithmetic"),
  opt<DecimalStyle>("percent", "Percentages"),
  opt<DecimalStyle>("convert", "Convert"),
];

const OPERATIONS = [
  opt<DecimalOperation>("add", "Add"),
  opt<DecimalOperation>("subtract", "Subtract"),
  opt<DecimalOperation>("multiply", "Multiply"),
  opt<DecimalOperation>("divide", "Divide"),
  opt<DecimalOperation>("both", "Add and subtract"),
];

const FORMS = [
  opt<DecimalForm>("horizontal", "Along a line"),
  opt<DecimalForm>("vertical", "In columns"),
];

type DividingBy = NonNullable<DecimalConfig["by"]>;

const DIVIDING_BY = [
  opt<DividingBy>("whole", "A whole number"),
  opt<DividingBy>("decimal", "A decimal"),
];

/** What a division divides by until the panel is told otherwise. */
const DIVISOR = { min: 2, max: 9 };

export function DecimalsPanel({ config, set }: PanelProps<DecimalConfig>) {
  const dividing = config.style === "standard" && config.operation === "divide";
  const byDecimal = dividing && config.by === "decimal";
  const bracketed = dividing && !byDecimal && config.form === "vertical";

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
          {!byDecimal && (
            <Choice
              label="Written"
              value={config.form}
              onChange={(form) => set({ form })}
              options={FORMS}
            />
          )}
        </>
      )}
      {dividing && (
        <>
          <Choice
            label="Dividing by"
            value={config.by ?? "whole"}
            onChange={(by) =>
              set(by === "decimal" ? { by, form: "horizontal" } : { by })
            }
            options={DIVIDING_BY}
            hint="Dividing by a decimal is rewritten first — 8.4 ÷ 0.2 is 84 ÷ 2 — so it is always written along a line."
          />
          <Span
            label="Divisors"
            value={config.divisor ?? DIVISOR}
            onChange={(divisor) => set({ divisor })}
            min={2}
            max={99}
            hint="The whole numbers to divide by. Two digits is the harder sheet; a decimal divisor is one of these with a point in it."
          />
          {!byDecimal && (
            <Checkbox
              label="Whole numbers in, decimal answers out"
              hint="7 ÷ 4 = 1.75. Only divisors with a factor of 2 or 5 give an answer that stops, so 3, 7 and 9 draw nothing. In columns the zeros are written in after the point, so there is something to keep dividing into."
              checked={config.wholeDividend === true}
              onChange={(wholeDividend) => set({ wholeDividend })}
            />
          )}
          {bracketed && (
            <Choice
              label="Help under the bracket"
              value={config.help ?? "none"}
              onChange={(help) => set({ help })}
              options={HELP_LEVELS}
              hint={HELP_HINT}
            />
          )}
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
        hint={
          dividing
            ? "The whole numbers the answers sit between. Each number divided is made from its answer, so every division comes out exactly."
            : "The whole numbers the values sit between."
        }
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />
      {!bracketed && (
        <Checkbox
          label="Work space under every problem"
          checked={config.workspace === true}
          onChange={(workspace) => set({ workspace })}
        />
      )}
    </>
  );
}
