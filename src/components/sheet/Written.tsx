/**
 * Letters written in a hand, on one repeat of a ruling (§25).
 *
 * The third row a sheet writes on. `TracedRow` sets an outline face and
 * strokes its edge; `StrokedRow` draws the patterns letters are made of;
 * this draws the letters themselves as the strokes that make them, so a
 * dotted letter is one thin dotted line down the middle of every stroke —
 * the thing the outline row cannot do and the reason a hand exists.
 *
 * Same width, same one-repeat height, same `Ruling` under it, and the same
 * six styles the other two rows take, with the same meaning: `hollow` is
 * the thin line, as it is on a pattern. What is new is `guides`: on a model
 * cell a dot marks where each stroke starts, an arrow says which way it
 * goes, and a number says which stroke it is.
 *
 * Sized by setting the hand's `ascent` on the writing space, so the tallest
 * letter reaches the top line and, because the hand is drawn to a ruling,
 * the small letters reach the midline as well. A cell whose text is wider
 * than the cell shrinks to fit rather than running into its neighbour, as a
 * traced cell does.
 */
import { glyphOf, measure, type Hand } from "@/engine/sheets/hands/hand";
import { ruledLines } from "@/engine/sheets/layout";
import { rulePitch, writingSpace } from "@/engine/sheets/paper";
import type { Rule, TraceStyle } from "@/engine/sheets/types";

import { Ruling } from "./Ruling";
import { parseStroke, pathOf, placeStroke } from "./glyphs";
import { guidesOf } from "./guides";
import type { SheetMetrics } from "./metrics";
import { letterInk, type StrokeInk } from "./strokes";
import { inch } from "./units";

export type WrittenCell = {
  text: string;
  style: TraceStyle;
  /** Start dots, arrows and stroke numbers — for the model, not the trace. */
  guides?: boolean;
};

function Guides({
  strokes,
  ink,
  writing,
}: {
  strokes: string[];
  ink: StrokeInk;
  writing: number;
}) {
  // Already on the paper: these are the placed paths, in mil.
  const set = guidesOf(strokes.map(parseStroke), writing, ink);
  return (
    <>
      {set.guides.map((guide, index) => (
        <g key={index} className="sheet__guide">
          <circle cx={guide.start.x} cy={guide.start.y} r={set.dot} />
          {guide.head !== null && (
            <>
              <path
                className="sheet__guide-line"
                d={guide.line
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
                  .join(" ")}
                strokeWidth={set.shaft}
              />
              <path className="sheet__guide-arrow" d={guide.head} />
            </>
          )}
          <text
            className="sheet__guide-number"
            x={guide.number.x}
            y={guide.number.y}
            fontSize={set.numeral}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </>
  );
}

export function WrittenRow({
  rule,
  metrics,
  hand,
  cells,
}: {
  rule: Rule;
  metrics: SheetMetrics;
  hand: Hand;
  cells: WrittenCell[];
}) {
  const pitch = rulePitch(rule);
  const width = metrics.box.width;
  const lines = ruledLines({ x: 0, y: 0, width, height: pitch }, rule);
  const baseline =
    lines.find((line) => line.role === "base")?.y ??
    lines.find((line) => line.role === "line")?.y ??
    pitch;
  const writing = writingSpace(rule);
  const scale = writing / hand.ascent;
  const ink = letterInk(writing);
  const cell = cells.length > 0 ? Math.floor(width / cells.length) : width;
  // A model with guides needs room beside its ink for an arrow and a number;
  // any other cell only needs its letters off the cell's edge.
  const insetOf = (entry: WrittenCell) =>
    entry.guides ? Math.max(ink.width * 2, writing * 0.22) : ink.width * 2;

  const said = [...new Set(cells.map((entry) => entry.text))]
    .filter((text) => text !== "")
    .join(" ");

  return (
    <svg
      className="sheet__ink sheet__ink--trace"
      width={inch(width)}
      height={inch(pitch)}
      viewBox={`0 0 ${width} ${pitch}`}
      role="img"
      aria-label={said === "" ? "A line to write on" : said}
    >
      <Ruling rule={rule} box={metrics.box} sets={1} />
      {cells.map((entry, index) => {
        if (entry.style === "none" || entry.text === "") return null;
        const units = measure(hand, entry.text);
        const inset = insetOf(entry);
        const fitted =
          units > 0 ? Math.min(scale, (cell - 2 * inset) / units) : scale;
        let x = index * cell + inset;
        const dash =
          entry.style === "dotted"
            ? ink.dotted
            : entry.style === "dashed"
              ? ink.dashed
              : undefined;
        const weight = entry.style === "hollow" ? ink.width / 2 : ink.width;
        return (
          <g key={`${index}-${entry.text}`}>
            {[...entry.text].map((character, at) => {
              const glyph = glyphOf(hand, character);
              const origin = x;
              x += (glyph?.advance ?? hand.space) * fitted;
              if (glyph === undefined || glyph.strokes.length === 0)
                return null;
              const placed = glyph.strokes.map((stroke) =>
                pathOf(placeStroke(stroke, origin, baseline, fitted)),
              );
              return (
                <g key={at}>
                  {placed.map((d, stroke) => (
                    <path
                      key={stroke}
                      className={`sheet__stroke sheet__stroke--${entry.style}`}
                      d={d}
                      strokeWidth={weight}
                      strokeDasharray={dash}
                    />
                  ))}
                  {entry.guides && (
                    <Guides strokes={placed} ink={ink} writing={writing} />
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
