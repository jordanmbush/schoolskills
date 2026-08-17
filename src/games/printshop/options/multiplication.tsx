/**
 * Times tables, division, and the two written methods.
 *
 * Two of the controls below are shown conditionally, and neither is a nicety.
 * "Written" has nothing to decide on a multiplication square or a long form —
 * one is a grid and the other is always stacked — and the digit pair means
 * nothing at all to a fact sheet, which draws from the tables instead. An
 * option that does nothing is worse than a missing one: it teaches a parent
 * that the panel doesn't do what it says.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type {
  MultiplicationConfig,
  MultiplicationForm,
  MultiplicationOperation,
  MultiplicationStyle,
} from "@/engine/sheets/types";

import { Choice, Pool, Sizing, Span, opt, type PanelProps } from "./parts";

const TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const OPERATIONS = [
  opt<MultiplicationOperation>("multiply", "Multiply"),
  opt<MultiplicationOperation>("divide", "Divide"),
  opt<MultiplicationOperation>("both", "Both"),
];

const STYLES = [
  opt<MultiplicationStyle>("standard", "Standard"),
  opt<MultiplicationStyle>("missing", "Missing number"),
  opt<MultiplicationStyle>("grid", "Grid"),
  opt<MultiplicationStyle>("long", "Long method"),
];

const FORMS = [
  opt<MultiplicationForm>("horizontal", "Along a line"),
  opt<MultiplicationForm>("vertical", "In columns"),
];

export function MultiplicationPanel({
  config,
  set,
}: PanelProps<MultiplicationConfig>) {
  const long = config.style === "long";
  const digits = config.digits ?? { into: 3, by: 2 };

  return (
    <>
      <Choice
        label="Operation"
        value={config.operation}
        onChange={(operation) => set({ operation })}
        options={OPERATIONS}
      />
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {config.style !== "grid" && !long && (
        <Choice
          label="Written"
          value={config.form}
          onChange={(form) => set({ form })}
          options={FORMS}
        />
      )}

      {long ? (
        <FieldSet
          legend="Digits"
          hint="How many digits the number being worked on has, and how many the one doing the working has."
        >
          <span className="span">
            <NumberStepper
              label="Digits in the number being worked on"
              value={digits.into}
              min={1}
              max={5}
              onChange={(into) => set({ digits: { ...digits, into } })}
            />
            <span className="span__to" aria-hidden="true">
              by
            </span>
            <NumberStepper
              label="Digits in the number doing the working"
              value={digits.by}
              min={1}
              max={3}
              onChange={(by) => set({ digits: { ...digits, by } })}
            />
          </span>
        </FieldSet>
      ) : (
        <>
          <Pool
            label="Tables"
            values={TABLES}
            chosen={config.tables}
            onChange={(tables) => set({ tables })}
            hint="One is a table to learn; several is a mixed set, which is the difference between learning a table and knowing them."
          />
          <Span
            label="Multiplied by"
            value={config.factors}
            onChange={(factors) => set({ factors })}
            min={0}
            max={12}
          />
        </>
      )}

      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />

      {long && config.operation !== "multiply" && (
        <Checkbox
          label="Divisions may leave a remainder"
          hint="Off unless asked for — a remainder is a different question, not a harder one."
          checked={config.remainders === true}
          onChange={(remainders) => set({ remainders })}
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
