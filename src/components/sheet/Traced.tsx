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
 * pattern are attributes in mil, because both do — see `units.ts`.
 */
import { ruledLines } from "@/engine/sheets/layout";
import { rulePitch } from "@/engine/sheets/paper";
import type { Mil, Rule, TraceStyle } from "@/engine/sheets/types";

import { Ruling } from "./Ruling";
import { DASH_DASHED, DASH_DOTTED, inch, RULE } from "./units";
import type { SheetMetrics } from "./metrics";

/** The three styles that are an outline rather than a filled shape. */
const OUTLINED: TraceStyle[] = ["hollow", "dotted", "dashed"];

const DASHES: Partial<Record<TraceStyle, string>> = {
  dotted: DASH_DOTTED,
  dashed: DASH_DASHED,
};

export function Glyph({
  text,
  x,
  y,
  size,
  style,
}: {
  text: string;
  x: Mil;
  /** The baseline the letters sit on. */
  y: Mil;
  size: Mil;
  style: TraceStyle;
}) {
  // The empty space at the end of a trace → copy → write row, where the child
  // is on their own. Nothing is drawn, and the space is still reserved.
  if (style === "none" || text === "") return null;

  const outlined = OUTLINED.includes(style);
  return (
    <text
      className={`sheet__glyph sheet__glyph--${style}`}
      x={x}
      y={y}
      fontSize={size}
      strokeWidth={outlined ? RULE : undefined}
      strokeDasharray={DASHES[style]}
      strokeLinecap={style === "dotted" ? "round" : undefined}
    >
      {text}
    </text>
  );
}

export type TracedCell = { text: string; style: TraceStyle };

/**
 * One repeat of a ruling with letterforms written onto it.
 *
 * Both blocks that trace anything are this: a tracing row is several cells
 * across one repeat, and a line of copywork is one cell across one repeat.
 *
 * The type size is derived from the ruling rather than from the sheet's body
 * size, because on a handwriting sheet the ruling *is* the type size — a ⅝
 * rule with a midline is asking for letters whose bodies reach that midline.
 * `WRITING_TO_EM` is the em size that puts a capital's height at one writing
 * space — the inverse of a face's cap-height ratio, near enough for the site's
 * own Nunito. Phase 3 replaces the guesswork with the Playwrite Guides family,
 * which draws its own guidelines (§6).
 */
const WRITING_TO_EM = 1.35;

/**
 * A *declared* average advance width, as a share of the em.
 *
 * The same bargain as a problem cell in `layout.ts`: state what a character
 * will take rather than measure what it took, because there is no DOM to ask
 * at build time (§4). It is only used to keep letters inside their cell — a
 * family that sized its row properly never reaches it, and one that asked for
 * six repeats of a long word on a ⅝ rule gets small letters instead of letters
 * that run off the paper.
 */
const ADVANCE_PER_EM = 0.55;

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

  // Where the letters sit, and how big they are. A handwriting rule states
  // both; a notebook rule states only the line, so the body size fills what is
  // left above it.
  const baseline = lines.find((line) => line.role === "base")?.y ?? pitch;
  const top = lines.find((line) => line.role === "top")?.y ?? 0;
  const cell = cells.length > 0 ? Math.floor(width / cells.length) : width;
  const longest = cells.reduce(
    (most, one) => Math.max(most, one.text.length),
    0,
  );
  const size = Math.max(
    1,
    Math.min(
      Math.round((baseline - top) * WRITING_TO_EM),
      longest > 0 ? Math.floor(cell / (longest * ADVANCE_PER_EM)) : Infinity,
    ),
  );

  // Every cell in a row carries the same word — that is what a tracing row is
  // — so the row is announced once rather than four times over.
  const said = cells.find((entry) => entry.text !== "")?.text;

  return (
    <svg
      className="sheet__ink"
      width={inch(width)}
      height={inch(pitch)}
      viewBox={`0 0 ${width} ${pitch}`}
      role="img"
      aria-label={said ?? "A line to write on"}
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
        />
      ))}
    </svg>
  );
}
