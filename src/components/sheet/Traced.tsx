/**
 * Letterforms to trace, without a tracing font.
 *
 * Dotted and dim letters are the point of a handwriting sheet, and every
 * commercial tracing font is licensed per seat. None is needed: SVG `<text>`
 * can be stroked instead of filled, and a dash pattern applies **along the
 * glyph outline** — so one ordinary font gives all five appearances in §6, the
 * dash pitch is a number rather than a purchase, and the same face the rest of
 * the sheet is set in is the one the child traces.
 *
 * Fill and opacity are CSS, because neither scales. Stroke width and dash
 * pattern are attributes in mil, because both do — see `units.ts`. Which
 * numbers they take is the face's business: `faces.ts` holds the proportions
 * measured out of each font file, and this only draws them.
 */
import {
  faceOf,
  fittedEm,
  glyphEm,
  traceInk,
  type TraceInk,
} from "@/engine/sheets/faces";
import { ruledLines } from "@/engine/sheets/layout";
import { rulePitch, writingSpace } from "@/engine/sheets/paper";
import type { Mil, Rule, TraceCell, TraceStyle } from "@/engine/sheets/types";

import { Ruling } from "./Ruling";
import { inch } from "./units";
import type { SheetMetrics } from "./metrics";

/**
 * The three styles that are an outline rather than a filled shape.
 *
 * Not the same set as `MODELLED` in the handwriting family, and named apart
 * from it for that reason: `dim` is a model to write over but it is drawn
 * filled, so it belongs to that set and not to this one.
 */
const STROKED: TraceStyle[] = ["hollow", "dotted", "dashed"];

export function Glyph({
  text,
  x,
  y,
  size,
  style,
  ink,
}: {
  text: string;
  x: Mil;
  /** The baseline the letters sit on. */
  y: Mil;
  size: Mil;
  style: TraceStyle;
  /** The weight and dash pattern this face wants at this size. */
  ink: TraceInk;
}) {
  // The empty space at the end of a trace → copy → write row, where the child
  // is on their own. Nothing is drawn, and the space is still reserved.
  if (style === "none" || text === "") return null;

  const outlined = STROKED.includes(style);
  // Solid and dim are filled shapes with no outline to break up, and hollow is
  // the outline unbroken — so only two of the five carry a pattern.
  const dashes: Partial<Record<TraceStyle, string>> = {
    dotted: ink.dotted,
    dashed: ink.dashed,
  };
  return (
    <text
      className={`sheet__glyph sheet__glyph--${style}`}
      x={x}
      y={y}
      fontSize={size}
      strokeWidth={outlined ? ink.width : undefined}
      strokeDasharray={dashes[style]}
      strokeLinecap={style === "dotted" ? "round" : undefined}
    >
      {text}
    </text>
  );
}

/**
 * The engine's own cell, not a second copy of it. A renderer that redeclared
 * the shape would be a second place to change when a cell learns to say
 * something new.
 */
export type TracedCell = TraceCell;

/**
 * One repeat of a ruling with letterforms written onto it.
 *
 * Both blocks that trace anything are this: a tracing row is several cells
 * across one repeat, and a line of copywork is one cell across one repeat.
 *
 * The type size is derived from the ruling rather than from the sheet's body
 * size, because on a handwriting sheet the ruling *is* the type size. How big
 * an em that takes is the face's own proportion and nothing else's: Playwrite's
 * tallest ascender is a whole em and Andika's 0.79 of one, so the same rule
 * holds two quite different type sizes (`faces.ts`).
 *
 * The rule fixed here is the top line: `glyphEm` sizes the em so the tallest
 * thing *on this row* stands on the baseline and reaches it. Which of the
 * face's heights that is depends on what is written — a row of capitals is set
 * off `capHeight` and a row with an `l` on it off `ascent`, because a capital
 * a tenth under the top line is a smaller error than an ascender through it
 * (`glyphHeight`). That leaves the midline as a consequence rather than a
 * second constraint, and letter bodies clear it — by 0.13 of the writing space
 * in Andika, 0.16 in OpenDyslexic, 0.01 in Playwrite (`Face.xHeight`, and a
 * test that bounds it). Two lines cannot both be exact unless the face was
 * drawn to that ruling, and a body that overshoots the midline is the right
 * way round to miss: the child still has a line to write up to, which they
 * would not if the model stopped below it.
 */
export function TracedRow({
  rule,
  metrics,
  cells,
}: {
  rule: Rule;
  metrics: SheetMetrics;
  cells: TracedCell[];
}) {
  const pitch = rulePitch(rule);
  const width = metrics.box.width;
  const lines = ruledLines({ x: 0, y: 0, width, height: pitch }, rule);
  const face = faceOf(metrics.font);

  // A row is usually one word written four times, and sometimes three letters
  // written four times each. Either way it is announced by what is on it and
  // not by how many places it is written in — and it is sized by what is on it
  // for the same reason.
  const said = [...new Set(cells.map((entry) => entry.text))]
    .filter((text) => text !== "")
    .join(" ");

  // Where the letters sit, and how big they are. A handwriting rule states
  // both; a notebook rule states only the line, so the body size fills what is
  // left above it. The writing space comes from the engine rather than from a
  // second subtraction here (`writingSpace`), so the size the family reserved
  // room for and the size that gets drawn cannot drift apart.
  const baseline = lines.find((line) => line.role === "base")?.y ?? pitch;
  const cell = cells.length > 0 ? Math.floor(width / cells.length) : width;
  const longest = cells.reduce(
    (most, one) => Math.max(most, one.text.length),
    0,
  );
  const size = Math.min(
    glyphEm(writingSpace(rule), face, said),
    fittedEm(cell, longest, face),
  );
  const ink = traceInk(size, face);

  return (
    <svg
      // The modifier is what lets a tail out of the box. An SVG viewport clips
      // by default, and a row is exactly one repeat tall — so on a ruling with
      // no descender space a `g` would print with its tail cut off at the
      // baseline, which is a worse model than one drawn through the line
      // below. See `Face.descent`, and `.sheet__ink--trace` in sheet.css.
      className="sheet__ink sheet__ink--trace"
      width={inch(width)}
      height={inch(pitch)}
      viewBox={`0 0 ${width} ${pitch}`}
      role="img"
      aria-label={said === "" ? "A line to write on" : said}
    >
      {/*
        A second viewport, one em taller than the row at each end and exactly
        as wide as it.

        Letting the row overflow is the *vertical* concession above, and it has
        to stay vertical. Two things run off the sides otherwise: the isometric
        ruling deliberately draws its diagonals half a side past each edge
        (`Ruling.tsx`) on the understanding that the viewport takes them off
        again, and `Face.advance` is a declared mean rather than a measurement,
        so a wide word typed into the builder — `M` is 0.876em against a
        declared 0.506 — can run past the margin the sheet reserved.

        A nested `<svg>` clips to itself whatever the outer one does, and with
        the viewBox restating the same rectangle the coordinates inside it are
        the coordinates outside it, so nothing here has to move. An em of slack
        clears the deepest tail any of the three faces draws (0.52em) twice
        over.
      */}
      <svg
        x={0}
        y={-size}
        width={width}
        height={pitch + 2 * size}
        viewBox={`0 ${-size} ${width} ${pitch + 2 * size}`}
      >
        <Ruling rule={rule} box={metrics.box} sets={1} />
        {cells.map((entry, index) => (
          <Glyph
            key={`${index}-${entry.text}`}
            text={entry.text}
            x={index * cell}
            y={baseline}
            size={size}
            style={entry.style}
            ink={ink}
          />
        ))}
      </svg>
    </svg>
  );
}
