/**
 * A stroke pattern on one repeat of a ruling.
 *
 * The other row a sheet writes on: `TracedRow` puts letterforms on the
 * ruling, this puts the strokes they are made of (§24). The same width, the
 * same one-repeat height and the same `Ruling` under it, so a page of the two
 * kinds of row lines up.
 *
 * The cells walk the trace → copy → write progression as cells of text do,
 * and the pattern's phase carries across them: the path in each cell starts
 * at that cell's edge, on the line the pattern begins on, so a dotted cell
 * picks up exactly where the solid model left off.
 */
import { ruledLines } from "@/engine/sheets/layout";
import { rulePitch } from "@/engine/sheets/paper";
import type { Rule, StrokePattern, TraceStyle } from "@/engine/sheets/types";
import { strokePattern } from "@/engine/sheets/writing/strokes";

import { Ruling } from "./Ruling";
import type { SheetMetrics } from "./metrics";
import { strokeInk, strokePath, strokeUnit, type StrokeZones } from "./strokes";
import { inch } from "./units";

/**
 * Where the pattern's lines sit inside the repeat: a handwriting rule states
 * all three, a notebook rule states only the line it is written on, and a
 * grid states none — so what is missing is taken from what is there. The
 * foot of the repeat is where a tail may reach.
 */
function zonesOf(rule: Rule, width: number): StrokeZones {
  const pitch = rulePitch(rule);
  const lines = ruledLines({ x: 0, y: 0, width, height: pitch }, rule);
  const at = (role: string) => lines.find((line) => line.role === role)?.y;
  const top = at("top") ?? 0;
  const base = at("base") ?? at("line") ?? pitch;
  const mid = at("mid") ?? Math.round((top + base) / 2);
  return { top, mid, base, bottom: pitch };
}

export function StrokedRow({
  rule,
  metrics,
  pattern,
  cells,
}: {
  rule: Rule;
  metrics: SheetMetrics;
  pattern: StrokePattern;
  cells: TraceStyle[];
}) {
  const pitch = rulePitch(rule);
  const width = metrics.box.width;
  const zones = zonesOf(rule, width);
  const cell = cells.length > 0 ? Math.floor(width / cells.length) : width;
  const { unit, count } = strokeUnit(pattern, zones, cell);
  const ink = strokeInk(zones.base - zones.top);
  const drawn = cells.some((style) => style !== "none");
  const label = strokePattern(pattern).label;

  return (
    <svg
      className="sheet__ink"
      width={inch(width)}
      height={inch(pitch)}
      viewBox={`0 0 ${width} ${pitch}`}
      role="img"
      aria-label={drawn ? label : `${label}: a line to carry on`}
    >
      <Ruling rule={rule} box={metrics.box} sets={1} />
      {cells.map((style, index) =>
        style === "none" ? null : (
          <path
            key={index}
            className={`sheet__stroke sheet__stroke--${style}`}
            d={strokePath(pattern, zones, index * cell, unit, count)}
            // Hollow has no inside to be empty of on a line, so it is the
            // pattern drawn thin — still a model, and still the lightest one.
            strokeWidth={style === "hollow" ? ink.width / 2 : ink.width}
            strokeDasharray={
              style === "dotted"
                ? ink.dotted
                : style === "dashed"
                  ? ink.dashed
                  : undefined
            }
          />
        ),
      )}
    </svg>
  );
}
