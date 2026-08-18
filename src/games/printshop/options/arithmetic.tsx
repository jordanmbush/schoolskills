/**
 * Adding and taking away.
 *
 * Regrouping is the difficulty dial here and it is worth naming as one: it is
 * the line between the week a child learns to add and the week they learn to
 * carry, and it is the single most-asked-for switch on an arithmetic sheet.
 */
import { Checkbox } from "@/components/ui/kit";
import type {
  ArithmeticConfig,
  ArithmeticForm,
  ArithmeticOperation,
  ArithmeticStyle,
  Regrouping,
} from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const OPERATIONS = [
  opt<ArithmeticOperation>("add", "Add"),
  opt<ArithmeticOperation>("subtract", "Subtract"),
  opt<ArithmeticOperation>("both", "Both"),
];

const STYLES = [
  opt<ArithmeticStyle>("standard", "Standard"),
  opt<ArithmeticStyle>("missing", "Missing number"),
  opt<ArithmeticStyle>("fact-family", "Fact family"),
];

const FORMS = [
  opt<ArithmeticForm>("horizontal", "Along a line"),
  opt<ArithmeticForm>("vertical", "In columns"),
];

const REGROUPING = [
  opt<Regrouping>("either", "Either"),
  opt<Regrouping>("never", "Never"),
  opt<Regrouping>("always", "Always"),
];

export function ArithmeticPanel({ config, set }: PanelProps<ArithmeticConfig>) {
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
      <Choice
        label="Written"
        value={config.form}
        onChange={(form) => set({ form })}
        options={FORMS}
      />
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={0}
        max={999}
        hint="The numbers a child sees, not the answers they reach — a sum of two numbers up to 20 can run past 20, and that is what carrying is."
      />
      <Choice
        label="Regrouping"
        value={config.regrouping}
        onChange={(regrouping) => set({ regrouping })}
        options={REGROUPING}
        hint="Whether a column may carry or borrow."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />
      <Checkbox
        label="Answers may go below zero"
        hint="Off unless asked for — a child who has not met negative numbers should not find one in question nine."
        checked={config.negatives === true}
        onChange={(negatives) => set({ negatives })}
      />
      <Checkbox
        label="Number line under every problem"
        checked={config.numberLine === true}
        onChange={(numberLine) => set({ numberLine })}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
