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
import {
  along,
  arrowhead,
  parseStroke,
  pathOf,
  placeStroke,
  strokeLength,
  type Segment,
} from "./glyphs";
import type { SheetMetrics } from "./metrics";
import { letterInk, type StrokeInk } from "./strokes";
import { inch } from "./units";

export type WrittenCell = {
  text: string;
  style: TraceStyle;
  /** Start dots, arrows and stroke numbers — for the model, not the trace. */
  guides?: boolean;
};

/** How far along a stroke its arrow sits, as a share of the writing space. */
const ARROW_AT = 0.3;

/** The middle of a letter's ink, for placing its stroke numbers outside it. */
function centreOf(strokes: Segment[][]): { x: number; y: number } {
  const points = strokes.flat().flatMap((segment) => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < segment.points.length; i += 2) {
      out.push([segment.points[i], segment.points[i + 1]]);
    }
    return out;
  });
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

function Guides({
  strokes,
  ink,
  writing,
}: {
  strokes: string[];
  ink: StrokeInk;
  writing: number;
}) {
  const dot = ink.width * 1.3;
  const head = { length: ink.width * 4.5, width: ink.width * 4 };
  const numeral = Math.round(writing * 0.16);
  // Already on the paper: these are the placed paths, in mil.
  const parsed = strokes.map(parseStroke);
  const centre = centreOf(parsed);
  // The number sits on the far side of the dot from the letter's middle:
  // outside the letter, where there is no ink for it to land on. Two strokes
  // that start close together — the bowl and the stem of an `a` — would put
  // their numbers on top of each other, so a number that lands within a
  // numeral of an earlier one, or of any stroke's start dot, is pushed a
  // numeral further out.
  const starts = parsed.map((segments) => along(segments, 0));
  const numbers: Array<{ x: number; y: number }> = [];
  for (const start of starts) {
    const away = Math.atan2(start.y - centre.y, start.x - centre.x);
    let back = numeral * 0.8;
    let at = { x: 0, y: 0 };
    for (let tries = 0; tries < 4; tries += 1) {
      at = {
        x: start.x + back * Math.cos(away),
        y: start.y + back * Math.sin(away),
      };
      const clear = [...numbers, ...starts.filter((s) => s !== start)].every(
        (other) => Math.hypot(other.x - at.x, other.y - at.y) >= numeral * 0.8,
      );
      if (clear) break;
      back += numeral * 0.8;
    }
    numbers.push(at);
  }
  return (
    <>
      {parsed.map((segments, index) => {
        const start = along(segments, 0);
        // The head sits a little way in from the start, clear of the dot; a
        // stroke too short to hold both gets the dot alone.
        const reach = Math.min(
          writing * ARROW_AT,
          strokeLength(segments) * 0.45,
        );
        const tip = along(segments, reach);
        return (
          <g key={index} className="sheet__guide">
            <circle cx={start.x} cy={start.y} r={dot} />
            {reach >= dot + head.length && (
              <path
                className="sheet__guide-arrow"
                d={arrowhead(tip.x, tip.y, tip.angle, head.length, head.width)}
              />
            )}
            <text
              className="sheet__guide-number"
              x={numbers[index].x}
              y={numbers[index].y}
              fontSize={numeral}
              textAnchor="middle"
              dominantBaseline="central"
            >
              {index + 1}
            </text>
          </g>
        );
      })}
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
  const inset = ink.width * 2;

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
