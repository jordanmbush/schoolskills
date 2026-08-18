/**
 * Paper and rulings, in real units.
 *
 * Everything here is a whole number of thousandths of an inch (`Mil`). The
 * conversions are one-way on purpose: a size is written in whichever unit it is
 * genuinely specified in — 8.5 inches, 210 millimetres, 12 points — and stored
 * as mil, so nothing downstream has to remember which stock came from which
 * standard.
 *
 * Where a ruling's pitch isn't a whole thousandth (wide ruled is 11/32in, or
 * 343.75) it is rounded to the nearest one. That is a quarter of a thousandth
 * of an inch, about six microns, and positions are computed from the repeat
 * index rather than accumulated (see layout.ts) so it never compounds down the
 * page.
 */
import type {
  Mil,
  MarginSize,
  Paper,
  PaperSize,
  Rule,
  RuleStyle,
} from "./types";

/* ── Units ─────────────────────────────────────────────────────────────── */

export const MIL_PER_INCH = 1000;

export const inches = (value: number): Mil => Math.round(value * MIL_PER_INCH);
export const mm = (value: number): Mil =>
  Math.round((value * MIL_PER_INCH) / 25.4);
/** Type is specified in points, and 72 of them are an inch. */
export const points = (value: number): Mil =>
  Math.round((value * MIL_PER_INCH) / 72);

export const toInches = (mil: Mil): number => mil / MIL_PER_INCH;
export const toMm = (mil: Mil): number => (mil * 25.4) / MIL_PER_INCH;
export const toPoints = (mil: Mil): number => (mil * 72) / MIL_PER_INCH;

/* ── Lookups ───────────────────────────────────────────────────────────── */

/**
 * A table lookup that survives a key from outside this build.
 *
 * Every table below is keyed by a string union, and every one of them is asked
 * about a value that may have arrived from a bookmarked URL or a sheet saved
 * before a ruling was renamed — so each needs a fallback. `table[key] ??
 * fallback` is not that fallback: `"toString"`, `"constructor"` and the rest of
 * `Object.prototype` resolve to inherited functions, which are truthy, so the
 * `??` never fires and the caller is handed a function where it expected a
 * stock or a pitch. Nothing throws at that point; the lengths computed from it
 * just quietly become `NaN`. Asking for an *own* property is the whole fix.
 *
 * Exported because the hazard is not about paper. Every table in the shop that
 * is keyed by something a saved config carries has it — the currencies in
 * `maths/money.ts` are the second — and a second copy of this three-line
 * function would be a second place for somebody to write the `??` instead.
 */
export function own<T>(table: Record<string, T>, key: string, fallback: T): T {
  return Object.hasOwn(table, key) ? table[key] : fallback;
}

/**
 * The numeric twin of `own`: a number a config asked for, as a whole number
 * inside the bounds.
 *
 * Beside it because it guards the same thing. Every optional number on a config
 * can arrive from outside this build — a bookmarked link, a sheet saved last
 * term, a hand-edited fragment — and a row count of `NaN`, a month of `13` or a
 * range of `"lots"` has to produce a sheet rather than an exception four modules
 * downstream. Rounding rather than truncating, so a stepper that has been
 * through a JSON round trip lands where the parent left it.
 *
 * It was the chart family's private helper until four more families in the same
 * tier wanted it. A copy each would be four chances to write `??` instead, which
 * is the mistake `own` exists to stop.
 */
export function whole(
  value: unknown,
  fallback: number,
  low: number,
  high: number,
): number {
  const asked = typeof value === "number" ? Math.round(value) : NaN;
  const chosen = Number.isFinite(asked) ? asked : fallback;
  return Math.max(low, Math.min(high, chosen));
}

/* ── Stock ─────────────────────────────────────────────────────────────── */

export type PaperStock = {
  id: PaperSize;
  label: string;
  width: Mil;
  height: Mil;
};

/**
 * Letter is the default because most of the audience is American. A4 is a
 * switch rather than an afterthought (§4): a sheet whose last rule falls off
 * the bottom of the page is worse than no sheet at all.
 */
export const PAPERS: Record<PaperSize, PaperStock> = {
  letter: {
    id: "letter",
    label: "Letter",
    width: inches(8.5),
    height: inches(11),
  },
  a4: { id: "a4", label: "A4", width: mm(210), height: mm(297) },
  legal: {
    id: "legal",
    label: "Legal",
    width: inches(8.5),
    height: inches(14),
  },
};

/**
 * The margin presets, and the reason the A4 default in §4 reads as 12.7mm:
 * that is half an inch exactly, so every stock defaults to the same number.
 *
 * `none` is offered because `@page` margin is zero and the sheet owns its own
 * geometry — a full-bleed grid is a legitimate thing to print, even if most
 * printers will clip a few thousandths of it.
 */
export const MARGINS: Record<MarginSize, Mil> = {
  none: 0,
  narrow: inches(0.25),
  normal: inches(0.5),
  wide: inches(1),
};

export const DEFAULT_PAPER: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

/**
 * The body size a sheet is set at when its config doesn't say. Points, because
 * that is what a type size means on paper — and 12pt because it is what a
 * worksheet for a reader who has finished learning to read is printed at. The
 * larger sizes of §17 are the config's job, not a fallback's.
 */
export const DEFAULT_FONT_PT = 12;

/**
 * How far the body size may be moved, in points.
 *
 * Eight is the smallest a child is asked to read on paper and thirty-six is
 * about one line of a Letter page, so the pair is the honest limit of "larger
 * type as a first-class option rather than a zoom hack" (§17) rather than a
 * guess. It lives here beside the default because both the builder's stepper
 * and the guard on a config arriving from a URL have to agree about it, and two
 * copies would eventually not.
 */
export const FONT_PT = { min: 8, max: 36 } as const;

/** The sheet of paper itself, with landscape already applied. */
export function pageSize(paper: Paper): { width: Mil; height: Mil } {
  const stock = own(PAPERS, paper.size, PAPERS.letter);
  return paper.orientation === "landscape"
    ? { width: stock.height, height: stock.width }
    : { width: stock.width, height: stock.height };
}

export function marginOf(paper: Paper): Mil {
  return own(MARGINS, paper.margin, MARGINS.normal);
}

/* ── Rulings ───────────────────────────────────────────────────────────── */

export type RuleRole = "top" | "mid" | "base" | "line";

/** One line of a ruling, as an offset down from the top of its repeat. */
export type RuleLine = { at: Mil; role: RuleRole; dashed: boolean };

export type Ruling = {
  id: RuleStyle;
  label: string;
  /** How far it is from one repeat to the next. Zero for blank paper. */
  pitch: Mil;
  /** Whether the repeat runs across the page as well as down it. */
  grid: boolean;
  /** Handwriting rules have a midline and a descender space; the rest don't. */
  handwriting: boolean;
  /** A vertical line this far in from the left edge of the paper. */
  marginLine?: Mil;
};

/**
 * Every ruling in §5, and nothing else claims to be one.
 *
 * Handwriting sizes are named by their pitch because that is what a teacher
 * says out loud — "we're on ⅝ paper this year" — and what a parent searches
 * for. Wide and college ruled carry the margin line at 1.25in that makes a
 * page look like notebook paper rather than lined paper.
 */
export const RULINGS: Record<RuleStyle, Ruling> = {
  blank: {
    id: "blank",
    label: "Blank",
    pitch: 0,
    grid: false,
    handwriting: false,
  },
  "hand-1": {
    id: "hand-1",
    label: 'Handwriting 1"',
    pitch: inches(1),
    grid: false,
    handwriting: true,
  },
  "hand-3-4": {
    id: "hand-3-4",
    label: 'Handwriting ¾"',
    pitch: inches(0.75),
    grid: false,
    handwriting: true,
  },
  "hand-5-8": {
    id: "hand-5-8",
    label: 'Handwriting ⅝"',
    pitch: inches(0.625),
    grid: false,
    handwriting: true,
  },
  "hand-1-2": {
    id: "hand-1-2",
    label: 'Handwriting ½"',
    pitch: inches(0.5),
    grid: false,
    handwriting: true,
  },
  "hand-3-8": {
    id: "hand-3-8",
    label: 'Handwriting ⅜"',
    pitch: inches(0.375),
    grid: false,
    handwriting: true,
  },
  // 11/32in and 9/32in — the two rulings a notebook is actually printed at.
  wide: {
    id: "wide",
    label: "Wide ruled",
    pitch: inches(11 / 32),
    grid: false,
    handwriting: false,
    marginLine: inches(1.25),
  },
  college: {
    id: "college",
    label: "College ruled",
    pitch: inches(9 / 32),
    grid: false,
    handwriting: false,
    marginLine: inches(1.25),
  },
  narrow: {
    id: "narrow",
    label: "Narrow ruled",
    pitch: inches(0.25),
    grid: false,
    handwriting: false,
  },
  graph: {
    id: "graph",
    label: "Graph",
    pitch: inches(0.25),
    grid: true,
    handwriting: false,
  },
  dot: {
    id: "dot",
    label: "Dot grid",
    pitch: inches(0.25),
    grid: true,
    handwriting: false,
  },
  isometric: {
    id: "isometric",
    label: "Isometric",
    pitch: inches(0.25),
    grid: true,
    handwriting: false,
  },
};

/** The squares a graph, dot or isometric sheet can be drawn at (§5). */
export const GRID_PITCHES = {
  "quarter-inch": inches(0.25),
  "fifth-inch": inches(0.2),
  centimetre: mm(10),
  "half-centimetre": mm(5),
} as const;

/**
 * Resolves a ruling. Never throws, for the same reason `deckSpec` doesn't: a
 * sheet saved last term must still print after its ruling has been renamed,
 * and blank paper is the honest answer to "I don't know that one".
 */
export function rulingOf(rule: Rule): Ruling {
  return own(RULINGS, rule.style, RULINGS.blank);
}

/**
 * How a handwriting repeat divides.
 *
 * With descender space on, the writing space (top line down to the baseline)
 * takes two thirds of the repeat and the tail space below it one third — the
 * proportion primary paper is printed at, and the difference between a sheet a
 * child can write a `g` on and one they can't. With it off there is no tail
 * space, so one set's baseline is the next set's top line.
 */
const DESCENDER_SHARE = 1 / 3;

/**
 * How far it is from one repeat of a ruling to the next, down the page.
 *
 * Isometric is the one place the declared pitch isn't the answer: its rows are
 * the height of an equilateral triangle of that side, which is what makes the
 * grid 30° rather than square.
 */
export function rulePitch(rule: Rule): Mil {
  const ruling = rulingOf(rule);
  const pitch = ruling.grid ? (rule.pitch ?? ruling.pitch) : ruling.pitch;
  if (rule.style === "isometric") return Math.round((pitch * Math.sqrt(3)) / 2);
  return pitch;
}

/**
 * The square, or the triangle's side, across the page.
 *
 * Zero for every ruling that doesn't repeat across the page, which is the
 * mirror of `ruleLines` returning nothing for the ones that do: a handwriting
 * rule has no square, and answering with its vertical pitch would invite a
 * renderer to draw one that isn't there.
 */
export function gridPitch(rule: Rule): Mil {
  const ruling = rulingOf(rule);
  return ruling.grid ? (rule.pitch ?? ruling.pitch) : 0;
}

/**
 * The writing space of a ruling: the top line down to the baseline.
 *
 * The one distance a type size is set from (`glyphEm`), because it is the space
 * the tallest letter has to stand in. A notebook rule has no top line, so its
 * writing space is the whole repeat — you write on the line, and everything
 * above it is the room you have.
 *
 * Here rather than in the family that first needed it: the trace renderer, the
 * handwriting family and the suite that holds the faces to their files all ask
 * the same question, and three copies of it would be three chances to disagree
 * about where a letter sits.
 */
export function writingSpace(rule: Rule): Mil {
  const lines = ruleLines(rule);
  const pitch = rulePitch(rule);
  const base = lines.find((line) => line.role === "base")?.at ?? pitch;
  const top = lines.find((line) => line.role === "top")?.at ?? 0;
  return base - top;
}

/**
 * The lines of one repeat, as offsets down from the top of it.
 *
 * A notebook rule is one line at the foot of its repeat, because you write on
 * top of it. A handwriting rule is three: the top line, the midline a letter's
 * body reaches, and the baseline it sits on. Grid rulings return nothing —
 * their geometry is two pitches and a renderer, not a list of offsets.
 */
export function ruleLines(rule: Rule): RuleLine[] {
  const ruling = rulingOf(rule);
  const pitch = rulePitch(rule);
  if (pitch <= 0 || ruling.grid) return [];
  if (!ruling.handwriting) return [{ at: pitch, role: "line", dashed: false }];

  const writing = rule.descender
    ? Math.round(pitch * (1 - DESCENDER_SHARE))
    : pitch;
  const midline = rule.midline ?? "dashed";
  return [
    { at: 0, role: "top", dashed: false },
    ...(midline === "none"
      ? []
      : [
          {
            at: Math.round(writing / 2),
            role: "mid" as const,
            dashed: midline === "dashed",
          },
        ]),
    { at: writing, role: "base", dashed: false },
  ];
}
