/**
 * Pre-algebra.
 *
 * Steps is the dial: `x + 7 = 12` is undone by one move and `3x + 4 = 19` by
 * two, and they are a term apart rather than a harder version of the same
 * question. Negatives matter more here than anywhere else in the shop —
 * dividing an inequality by a negative turns it round, which is the single
 * most-missed step in the whole topic.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import type { AlgebraStyle, PreAlgebraConfig } from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<AlgebraStyle>("expression", "Expressions"),
  opt<AlgebraStyle>("equation", "Equations"),
  opt<AlgebraStyle>("inequality", "Inequalities"),
  opt<AlgebraStyle>("slope", "Slope"),
  opt<AlgebraStyle>("graph", "From a graph"),
];

const QUADRANTS = [
  opt("1", "One", "no negatives"),
  opt("4", "Four", "all four"),
];

export function PreAlgebraPanel({ config, set }: PanelProps<PreAlgebraConfig>) {
  const solving = config.style === "equation" || config.style === "inequality";

  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {solving && (
        <FieldSet
          legend="Steps to solve"
          hint="One move, or two. A term apart in the year."
        >
          <NumberStepper
            label="Steps to solve"
            value={config.steps ?? 1}
            min={1}
            max={2}
            onChange={(steps) => set({ steps })}
          />
        </FieldSet>
      )}
      {config.style === "graph" && (
        <Choice
          label="Quadrants"
          value={String(config.quadrants ?? 1)}
          onChange={(quadrants) => set({ quadrants: Number(quadrants) })}
          options={QUADRANTS}
        />
      )}
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={100}
        hint="How big the numbers get, sign aside."
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={4}
      />
      <Checkbox
        label="Negative numbers"
        hint="In the question or in the answer."
        checked={config.negatives === true}
        onChange={(negatives) => set({ negatives })}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
