/**
 * Ratio, proportion and rate — three names for one idea.
 *
 * The shortest panel in the shop, and honestly so: what makes one of these
 * harder is how big the numbers are and nothing else. A style and a range is the
 * whole of it, and inventing a fourth control to make the panel look busier
 * would be inventing a choice that changes nothing on the paper.
 */
import { Checkbox } from "@/components/ui/kit";
import type { RatioConfig, RatioStyle } from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<RatioStyle>("simplify", "Simplify"),
  opt<RatioStyle>("proportion", "Proportion"),
  opt<RatioStyle>("rate", "Rate"),
];

export function RatioPanel({ config, set }: PanelProps<RatioConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      <Span
        label="Numbers"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={200}
      />
      <Sizing
        count={config.count}
        columns={config.columns}
        onCount={(count) => set({ count })}
        onColumns={(columns) => set({ columns })}
        maxColumns={4}
      />
      <Checkbox
        label="Work space under every problem"
        checked={config.workspace === true}
        onChange={(workspace) => set({ workspace })}
      />
    </>
  );
}
