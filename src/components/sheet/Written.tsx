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
 * goes, and a number says which stroke it is. And `forms`, which letters
 * the row writes the other way — a double-story `a`, a straight `t` — for
 * every cell alike, since a sheet teaches one shape of a letter at a time.
 *
 * Sized by setting the hand's `ascent` on the writing space, less the room
 * its ink needs to touch a line rather than lie on it, so the tallest
 * letter reaches the top line and, because the hand is drawn to a ruling,
 * the small letters reach the midline as well. A cell whose text is wider
 * than the cell shrinks to fit rather than running into its neighbor, as a
 * traced cell does.
 *
 * In a hand that joins, the letters of a word are one line for as long as
 * they join (`joined.ts`), so a dotted word is dotted through its joins and
 * a joined pair on a model carries one start dot, not two.
 *
 * A cell that sets finger spaces sets every space at `fingerSpace` instead
 * of the hand's own, and a marked one draws a filled dot in the middle of
 * each gap, at the middle of the small letters' height — where a finger
 * goes, and well above where a full stop sits.
 */
import {
  fingerSpace,
  glyphOf,
  measure,
  type Forms,
  type Hand,
} from "@/engine/sheets/hands/hand";
import { ruledLines } from "@/engine/sheets/layout";
import { rulePitch, writingSpace } from "@/engine/sheets/paper";
import type { Rule, TraceCell, TraceStyle } from "@/engine/sheets/types";

import { Ruling } from "./Ruling";
import { pathOf, placeStroke, type Placing } from "./glyphs";
import { wordGuides, type GuideSet } from "./guides";
import { joined, type Placed } from "./joined";
import type { SheetMetrics } from "./metrics";
import { letterInk } from "./strokes";
import { inch, RULE } from "./units";

export type WrittenCell = {
  text: string;
  style: TraceStyle;
  /** Start dots, arrows and stroke numbers — for the model, not the trace. */
  guides?: boolean;
  spaces?: TraceCell["spaces"];
};

function Guides({ set }: { set: GuideSet }) {
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
  forms = {},
  guided = false,
}: {
  rule: Rule;
  metrics: SheetMetrics;
  hand: Hand;
  cells: WrittenCell[];
  forms?: Forms;
  /**
   * Set every cell with a guided cell's room — the wider inset and the
   * spread between letters — whether or not it draws the marks, so a model
   * and the rows traced under it line up. On for a block whose every model
   * is guided (§25).
   */
  guided?: boolean;
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
  // A stroke lying along a line would be lost in it, so a letter is set with
  // its ink just inside the lines it reaches: a stroke on the top line, the
  // baseline or the line under the tail space is centered a rule's half-width
  // and an ink's half-width off it, and the two touch. The midline is dashed
  // and left where it is, so a crossbar still sits on it (§25).
  const inset = (RULE + ink.width) / 2;
  const floor = baseline - inset;
  const shortened = 1 - (2 * inset) / writing;
  const tailSpace = pitch - baseline;
  const stretched =
    tailSpace > 0
      ? (tailSpace * hand.ascent) / (-hand.descent * writing)
      : shortened;
  const cell = cells.length > 0 ? Math.floor(width / cells.length) : width;
  // A model with guides needs room beside its ink for an arrow and a number;
  // any other cell only needs its letters off the cell's edge.
  const roomy = (entry: WrittenCell) => guided || entry.guides === true;
  const insetOf = (entry: WrittenCell) =>
    roomy(entry) ? Math.max(ink.width * 2, writing * 0.26) : ink.width * 2;

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
        const space = entry.spaces ? fingerSpace(hand) : hand.space;
        const units = measure(hand, entry.text, forms, space);
        const inset = insetOf(entry);
        const room = cell - 2 * inset;
        const fitted = units > 0 ? Math.min(scale, room / units) : scale;
        // A guided word is set as wide as the cell's spare room allows, so
        // one letter's marks are not the next letter's problem — but only
        // from the spare room: a word is never shrunk to make it.
        const gaps = Math.max(1, entry.text.length - 1);
        const tracking = roomy(entry)
          ? Math.max(0, Math.min(writing * 0.3, (room - units * fitted) / gaps))
          : 0;
        let x = index * cell + inset;
        const dash =
          entry.style === "dotted"
            ? ink.dotted
            : entry.style === "dashed"
              ? ink.dashed
              : undefined;
        const weight = entry.style === "hollow" ? ink.width / 2 : ink.width;
        const placing: Placing = {
          across: fitted,
          up: fitted * shortened,
          down: fitted * stretched,
        };
        // Every letter is placed before any join is drawn or any guide laid
        // out: a join needs both its letters on the paper, and a letter's
        // guides keep off its neighbors' ink as well as its own.
        const marks: { x: number; y: number }[] = [];
        const placed: Placed[] = [...entry.text].map((character) => {
          const glyph = glyphOf(hand, character, forms);
          const origin = x;
          const advance =
            character === " " ? space : (glyph?.advance ?? hand.space);
          if (character === " " && entry.spaces === "marked") {
            marks.push({
              x: origin + (advance * fitted) / 2,
              y: floor - (hand.xHeight / 2) * placing.up,
            });
          }
          x += advance * fitted + tracking;
          return {
            strokes: (glyph?.strokes ?? []).map((stroke) =>
              placeStroke(stroke, origin, floor, placing),
            ),
            join: glyph?.join,
          };
        });
        const letters = joined(
          placed,
          floor,
          floor - hand.xHeight * placing.up,
        );
        const sets = entry.guides ? wordGuides(letters, writing, ink) : [];
        return (
          <g key={`${index}-${entry.text}`}>
            {letters.map((placed, at) => (
              <g key={at}>
                {placed.map((segments, stroke) => (
                  <path
                    key={stroke}
                    className={`sheet__stroke sheet__stroke--${entry.style}`}
                    d={pathOf(segments)}
                    strokeWidth={weight}
                    strokeDasharray={dash}
                  />
                ))}
                {sets[at] && <Guides set={sets[at]} />}
              </g>
            ))}
            {marks.map((mark, at) => (
              <circle
                key={`mark-${at}`}
                className="sheet__mark"
                cx={mark.x}
                cy={mark.y}
                r={hand.xHeight * 0.13 * fitted}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
