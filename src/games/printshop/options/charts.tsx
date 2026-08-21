/**
 * The blank references, and the four questions they are chosen by.
 *
 * The one panel in the directory where the four styles share almost nothing: a
 * hundred chart is a range, a number line is a range and an interval, a
 * coordinate grid is how far the axes run, and a place-value chart is which
 * powers of ten it holds. So the controls under the style are the style's own.
 *
 * Every number here is a request the engine clamps: `charts.ts` completes a
 * chart to whole rows, moves a line's end out to the next tick, and caps the
 * rows and strips at what the paper holds. The hints say so where the number a
 * parent types is one that visibly moves.
 */
import { Checkbox, FieldSet, NumberStepper } from "@/components/ui/kit";
import { placeName } from "@/engine/sheets/templates/charts";
import type { ChartConfig, ChartStyle } from "@/engine/sheets/types";

import { Choice, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<ChartStyle>("hundred", "Hundred chart"),
  opt<ChartStyle>("number-line", "Number line"),
  opt<ChartStyle>("coordinate", "Coordinate grid"),
  opt<ChartStyle>("place-value", "Place value"),
];

const QUADRANTS = [
  opt("1", "One", "no negatives"),
  opt("4", "Four", "all four"),
];

/**
 * The places, offered as the words rather than as the exponents they are. A
 * config holds the power of ten because that is what keeps the columns
 * consecutive (see `ChartConfig.places`), and nobody chooses a column called
 * "10²".
 */
const POWERS = [6, 5, 4, 3, 2, 1, 0, -1, -2, -3];
const PLACES = POWERS.map((power) => opt(String(power), placeName(power)));

export function ChartsPanel({ config, set }: PanelProps<ChartConfig>) {
  const places = config.places ?? { largest: 2, smallest: 0 };

  return (
    <>
      <Choice
        label="Which reference"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />

      {(config.style === "hundred" || config.style === "number-line") && (
        <Span
          label={config.style === "hundred" ? "Numbers" : "From and to"}
          value={config.range ?? rangeFor(config.style)}
          onChange={(range) => set({ range })}
          min={config.style === "hundred" ? 0 : -999}
          max={999}
          hint={
            config.style === "hundred"
              ? "Rounded up to a whole row of ten."
              : "Rounded up to a whole number of intervals."
          }
        />
      )}

      {config.style === "hundred" && (
        <Checkbox
          label="Print the numbers in"
          checked={config.filled === true}
          onChange={(filled) => set({ filled })}
        />
      )}

      {config.style === "number-line" && (
        <>
          <FieldSet
            legend="Interval"
            hint="A tick this far apart. The numbers under them thin out to what fits."
          >
            <NumberStepper
              label="Interval"
              value={config.step ?? 1}
              min={1}
              max={100}
              onChange={(step) => set({ step })}
            />
          </FieldSet>
          <FieldSet legend="Strips" hint="Capped at what fits on the page.">
            <NumberStepper
              label="Strips"
              value={config.strips ?? 1}
              min={1}
              max={12}
              onChange={(strips) => set({ strips })}
            />
          </FieldSet>
        </>
      )}

      {config.style === "coordinate" && (
        <>
          <Choice
            label="Quadrants"
            value={String(config.quadrants ?? 1)}
            onChange={(quadrants) => set({ quadrants: Number(quadrants) })}
            options={QUADRANTS}
          />
          <FieldSet
            legend="Axes run to"
            hint="How far out the numbers go, in both directions."
          >
            <NumberStepper
              label="Axes run to"
              value={config.span ?? 10}
              min={4}
              max={20}
              onChange={(span) => set({ span })}
            />
          </FieldSet>
        </>
      )}

      {config.style === "place-value" && (
        <>
          <Choice
            label="Largest place"
            value={String(places.largest)}
            onChange={(power) =>
              set({ places: withLargest(places, Number(power)) })
            }
            options={PLACES}
          />
          <Choice
            label="Smallest place"
            value={String(places.smallest)}
            onChange={(power) =>
              set({ places: withSmallest(places, Number(power)) })
            }
            options={PLACES}
          />
          <FieldSet legend="Rows" hint="Capped at what fits on the page.">
            <NumberStepper
              label="Rows"
              value={config.rows ?? 8}
              min={1}
              max={20}
              onChange={(rows) => set({ rows })}
            />
          </FieldSet>
        </>
      )}
    </>
  );
}

/** What the two range styles open on when a config has not said. */
const rangeFor = (style: ChartStyle) =>
  style === "hundred" ? { min: 1, max: 100 } : { min: 0, max: 20 };

/**
 * The two ends of a place-value chart, each dragging the other where it must —
 * the same move `Span` makes with a low and a high. Picking a largest place
 * below the smallest one would be a chart with no columns, so the other end
 * follows rather than the control refusing.
 */
const withLargest = (
  places: { largest: number; smallest: number },
  largest: number,
) => ({ largest, smallest: Math.min(largest, places.smallest) });

const withSmallest = (
  places: { largest: number; smallest: number },
  smallest: number,
) => ({ largest: Math.max(smallest, places.largest), smallest });
