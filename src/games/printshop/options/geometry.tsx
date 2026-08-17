/**
 * Shapes, and the plane they are plotted on.
 *
 * Quadrants is the switch the coordinate style turns on, and it is a change of
 * question rather than a harder version of one: a plane that runs from nought is
 * counting, and a plane with four quadrants is the week negative numbers arrive.
 * Which is why it only appears on the style that has a plane on it.
 */
import { Checkbox } from "@/components/ui/kit";
import type {
  GeometryConfig,
  GeometryStyle,
  UnitSystem,
} from "@/engine/sheets/types";

import { Choice, Sizing, Span, opt, type PanelProps } from "./parts";

const STYLES = [
  opt<GeometryStyle>("area", "Area"),
  opt<GeometryStyle>("perimeter", "Perimeter"),
  opt<GeometryStyle>("volume", "Volume"),
  opt<GeometryStyle>("angles", "Angles"),
  opt<GeometryStyle>("identify", "Name the shape"),
  opt<GeometryStyle>("coordinates", "Coordinates"),
];

const SYSTEMS = [
  opt<UnitSystem>("metric", "Metric"),
  opt<UnitSystem>("imperial", "Imperial"),
];

const QUADRANTS = [
  opt("1", "One", "no negatives"),
  opt("4", "Four", "all four"),
];

export function GeometryPanel({ config, set }: PanelProps<GeometryConfig>) {
  return (
    <>
      <Choice
        label="What it asks for"
        value={config.style}
        onChange={(style) => set({ style })}
        options={STYLES}
      />
      {config.style === "coordinates" ? (
        <Choice
          label="Quadrants"
          value={String(config.quadrants ?? 1)}
          onChange={(quadrants) => set({ quadrants: Number(quadrants) })}
          options={QUADRANTS}
        />
      ) : (
        <Choice
          label="Units"
          value={config.system}
          onChange={(system) => set({ system })}
          options={SYSTEMS}
        />
      )}
      <Span
        label="Sides"
        value={config.range}
        onChange={(range) => set({ range })}
        min={1}
        max={100}
        hint="How big the measurements on a shape get."
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
