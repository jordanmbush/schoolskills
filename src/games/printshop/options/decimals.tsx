/**
 * Decimals and percentages.
 *
 * Places is the difficulty dial, and column form is worth more on this sheet
 * than anywhere else in the shop: every value prints to the same number of
 * places, so stacking them right-aligned puts the points in a column — which is
 * the one thing a child lining up a decimal sum has to get right.
 *
 * Each style shows only the controls that change it. "In columns" goes when
 * the divisor is a decimal, because that sheet is only ever written along a
 * line (§22); the work-space box goes when the divisions are in the bracket,
 * because its squares are the working space.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import { stoppingDivisors } from "@/engine/sheets/maths/decimal-division";
import type {
  DecimalConfig,
  DecimalForm,
  DecimalOperation,
  DecimalStyle,
  RoundTo,
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
  opt<DecimalStyle>("place", "Place value"),
  opt<DecimalStyle>("compare", "Compare"),
  opt<DecimalStyle>("order", "Order"),
  opt<DecimalStyle>("round", "Round"),
  opt<DecimalStyle>("powers", "Multiply and divide by 10, 100, 1000"),
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

type By = NonNullable<DecimalConfig["by"]>;

const BY = [
  opt<By>("whole", "A whole number"),
  opt<By>("decimal", "A decimal"),
];

const ROUND_TO = [
  opt<RoundTo>("whole", "Whole number"),
  opt<RoundTo>("tenth", "Tenth"),
  opt<RoundTo>("hundredth", "Hundredth"),
];

/** What a division divides by until the panel is told otherwise. */
const DIVISOR = { min: 2, max: 9 };

export function DecimalsPanel({ config, set }: PanelProps<DecimalConfig>) {
  const standard = config.style === "standard";
  const dividing = standard && config.operation === "divide";
  const multiplying = standard && config.operation === "multiply";
  const byDecimal = config.by === "decimal";
  const bracketed = dividing && !byDecimal && config.form === "vertical";
  // Whether any divisor in the span can give a decimal answer that stops. A
  // span of 3 to 3 cannot, and a box that turned on a sheet with nothing on
  // it would be an option that does nothing, so the box goes gray and the
  // span's own change clears it.
  const stops = stoppingDivisors(config).length > 0;

  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {standard && (
        <>
          <Choice
            label="Operation"
            value={config.operation}
            onChange={(operation) => set({ operation })}
            options={OPERATIONS}
          />
          {!(dividing && byDecimal) && (
            <Choice
              label="Written"
              value={config.form}
              onChange={(form) => set({ form })}
              options={FORMS}
            />
          )}
        </>
      )}
      {(dividing || multiplying) && (
        <Choice
          label={dividing ? "Dividing by" : "Multiplying by"}
          value={config.by ?? "whole"}
          onChange={(by) =>
            set(
              dividing && by === "decimal"
                ? { by, form: "horizontal" }
                : { by },
            )
          }
          options={BY}
          hint={
            dividing
              ? "Dividing by a decimal is rewritten first — 8.4 ÷ 0.2 is 84 ÷ 2 — so it is always written along a line."
              : "A decimal times a decimal — 3.7 × 2.4. The answer has as many places as the two numbers together, so the places are counted rather than lined up."
          }
        />
      )}
      {dividing && (
        <>
          <Span
            label="Divisors"
            value={config.divisor ?? DIVISOR}
            onChange={(divisor) =>
              set(
                stoppingDivisors({ ...config, divisor }).length > 0
                  ? { divisor }
                  : { divisor, wholeDividend: false },
              )
            }
            min={2}
            max={99}
            hint="The whole numbers to divide by. Two digits is the harder sheet; a decimal divisor is one of these with a point in it."
          />
          {!byDecimal && (
            <Checkbox
              label="Whole numbers in, decimal answers out"
              hint={
                stops
                  ? "7 ÷ 4 = 1.75. Only divisors with a factor of 2 or 5 give an answer that stops, so 3, 7 and 9 are left out. In columns the zeros are written in after the point, so there is something to keep dividing into."
                  : "No divisor in this span has a factor of 2 or 5, so no answer would stop. Widen the span to turn this on."
              }
              checked={config.wholeDividend === true}
              disabled={!stops}
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
      {config.style === "round" ? (
        <Choice
          label="Round to the nearest"
          value={config.to ?? "whole"}
          onChange={(to) => set({ to })}
          options={ROUND_TO}
          hint="The numbers carry one place more than this — 2.97 to the nearest tenth — so the last digit is the one that decides."
        />
      ) : (
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
      )}
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
      {!bracketed && config.style !== "order" && (
        <Checkbox
          label="Work space under every problem"
          checked={config.workspace === true}
          onChange={(workspace) => set({ workspace })}
        />
      )}
    </>
  );
}
