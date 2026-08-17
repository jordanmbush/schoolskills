/**
 * Fractions.
 *
 * `pairing` is this family's difficulty dial, the way regrouping is
 * arithmetic's: adding quarters to quarters and adding halves to quarters are a
 * week apart in the year rather than the same question twice. It only means
 * something once there are two fractions in a problem, which is why it and the
 * operation appear on the arithmetic style alone.
 */
import { Checkbox } from "@/components/ui/kit";
import type {
  Denominators,
  FractionConfig,
  FractionModel,
  FractionOperation,
  FractionStyle,
} from "@/engine/sheets/types";

import { Choice, Pool, Sizing, opt, type PanelProps } from "./parts";

/** Halves through twelfths, skipping the ones a primary child never meets. */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

const STYLES = [
  opt<FractionStyle>("identify", "Name it"),
  opt<FractionStyle>("equivalent", "Equivalent"),
  opt<FractionStyle>("simplify", "Simplify"),
  opt<FractionStyle>("arithmetic", "Arithmetic"),
];

const OPERATIONS = [
  opt<FractionOperation>("add", "Add"),
  opt<FractionOperation>("subtract", "Subtract"),
  opt<FractionOperation>("multiply", "Multiply"),
  opt<FractionOperation>("divide", "Divide"),
  opt<FractionOperation>("both", "Add and subtract"),
];

const PAIRING = [
  opt<Denominators>("like", "Same"),
  opt<Denominators>("unlike", "Different"),
  opt<Denominators>("either", "Either"),
];

const MODELS = [
  opt<FractionModel>("bar", "Bars"),
  opt<FractionModel>("circle", "Circles"),
  opt<FractionModel>("both", "Both"),
];

export function FractionsPanel({ config, set }: PanelProps<FractionConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {config.style === "arithmetic" && (
        <>
          <Choice
            label="Operation"
            value={config.operation}
            onChange={(operation) => set({ operation })}
            options={OPERATIONS}
          />
          <Choice
            label="Denominators"
            value={config.pairing}
            onChange={(pairing) => set({ pairing })}
            options={PAIRING}
            hint="Whether the two fractions in a problem share a bottom number."
          />
        </>
      )}
      {config.style === "identify" && (
        <Choice
          label="Picture"
          value={config.model ?? "both"}
          onChange={(model) => set({ model })}
          options={MODELS}
        />
      )}
      <Pool
        label="Bottom numbers"
        values={DENOMINATORS}
        chosen={config.denominators}
        onChange={(denominators) => set({ denominators })}
        hint="The denominators the sheet draws from."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
      />
      <Checkbox
        label="Whole numbers alongside"
        hint="2 1/4 rather than 1/4, on the page and in the answer."
        checked={config.mixed === true}
        onChange={(mixed) => set({ mixed })}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
