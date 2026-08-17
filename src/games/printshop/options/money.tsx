/**
 * Money.
 *
 * The currency is a switch rather than a build-time constant for the reason A4
 * is (§4): a British child counting dollars is being asked a question about a
 * foreign country, and the sheet is otherwise identical.
 */
import { Checkbox } from "@/components/ui/kit";
import type {
  Currency,
  DecimalForm,
  MoneyConfig,
  MoneyOperation,
} from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const CURRENCIES = [
  opt<Currency>("usd", "Dollars"),
  opt<Currency>("gbp", "Pounds"),
  opt<Currency>("eur", "Euros"),
];

const OPERATIONS = [
  opt<MoneyOperation>("add", "Add"),
  opt<MoneyOperation>("subtract", "Subtract"),
  opt<MoneyOperation>("multiply", "Multiply"),
  opt<MoneyOperation>("both", "Add and subtract"),
];

const FORMS = [
  opt<DecimalForm>("horizontal", "Along a line"),
  opt<DecimalForm>("vertical", "In columns"),
];

export function MoneyPanel({ config, set }: PanelProps<MoneyConfig>) {
  return (
    <>
      <Choice
        label="Currency"
        value={config.currency}
        onChange={(currency) => set({ currency })}
        options={CURRENCIES}
      />
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
      <Span
        label="Amounts"
        value={config.range}
        onChange={(range) => set({ range })}
        min={0}
        max={999}
        hint="The whole units the amounts sit between — dollars, pounds or euros."
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
