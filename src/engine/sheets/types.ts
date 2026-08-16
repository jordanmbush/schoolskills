/**
 * A worksheet, as plain data.
 *
 * `Sheet` is to the print shop what `Card` is to the race: the engine decides
 * what goes on the page and returns it as values, and the view's only job is to
 * turn that into elements. Nothing here knows what a `<div>` is, nothing here
 * measures anything, and every length is already resolved — which is what lets
 * the same build function run in a unit test, in the build-time render of a
 * catalog page, and in the live builder (docs/printables.md §2).
 *
 * Answers are on the sheet from the moment it is built. The answer key is the
 * same `Sheet` with `answers: true`, not a second build from the same seed, so
 * a key can't drift from the sheet it belongs to.
 */

/* ── Units ────────────────────────────────────────────────────────────────
   Every length on a sheet is a whole number of thousandths of an inch.

   One integer unit for the whole subtree, because a ⅝-inch rule is ⅝ of an
   inch or it is wrong (§4), and a child taught to write between two lines
   notices before an adult does. A thousandth of an inch is 25 microns — finer
   than any home printer resolves — and it lands close enough to an inch, a
   point (13.889) and a millimetre (39.37) that the rounding never reaches
   paper. The rest of the app sizes in `rem` × `--ui-scale`; a sheet must not,
   and this type is the reminder.                                            */

export type Mil = number;

/* ── Paper ─────────────────────────────────────────────────────────────── */

export type PaperSize = "letter" | "a4" | "legal";

export type Orientation = "portrait" | "landscape";

/**
 * Margins are named, not free numbers.
 *
 * A sheet that runs off the bottom of the page is worse than no sheet, so the
 * capacity arithmetic in layout.ts has to hold for every margin a parent can
 * choose — which is a set worth being able to enumerate in a test.
 */
export type MarginSize = "none" | "narrow" | "normal" | "wide";

export type Paper = {
  size: PaperSize;
  orientation: Orientation;
  margin: MarginSize;
};

/* ── Ruling ────────────────────────────────────────────────────────────── */

/**
 * The ruling systems of §5, as ids. The geometry behind each — pitch, where
 * the lines sit inside the repeat, where the margin line goes — is in paper.ts.
 */
export type RuleStyle =
  | "blank"
  /** Handwriting rules, named by the repeat every teacher already says aloud. */
  | "hand-1"
  | "hand-3-4"
  | "hand-5-8"
  | "hand-1-2"
  | "hand-3-8"
  /** Notebook rules: one line per repeat, and a margin line on the first two. */
  | "wide"
  | "college"
  | "narrow"
  /** Rules that repeat across the page as well as down it. */
  | "graph"
  | "dot"
  | "isometric";

/** Dashed is the usual; solid is for the youngest, none for the oldest. */
export type Midline = "dashed" | "solid" | "none";

export type Rule = {
  style: RuleStyle;
  /** Handwriting only. Defaults to dashed, which is what schools print. */
  midline?: Midline;
  /**
   * Handwriting only. Room below the baseline for the tail of a `g`, taken out
   * of the repeat rather than added to it — the pitch is what it says it is.
   */
  descender?: boolean;
  /**
   * Graph, dot and isometric only: the square, or the triangle's side, when it
   * isn't the ¼-inch default. See `GRID_PITCHES` in paper.ts.
   */
  pitch?: Mil;
};

/* ── Blocks ────────────────────────────────────────────────────────────── */

/**
 * How a letterform is drawn on a tracing row — §6, all five from one ordinary
 * font. `none` is the empty space at the end of a trace → copy → write row,
 * where the child is on their own.
 */
export type TraceStyle =
  "solid" | "dim" | "hollow" | "dotted" | "dashed" | "none";

export type Problem = {
  /** How it reads on the sheet: "7 × 8 =". */
  prompt: string;
  /**
   * Text even when it's a number — "56", not 56 — for the same reason
   * `Card.answer` is. A worksheet's answers are printed, not compared.
   */
  answer: string;
  /**
   * Which fact this exercises, in the vocabulary the race already uses
   * ("7:8"). Optional, and the whole of what makes "print the facts they keep
   * missing" (§14) possible: the record book hands over fact ids and a family
   * turns them into problems without either side learning the other's shape.
   */
  factId?: string;
  /** Blank height under the problem for working out. Absent means none. */
  workspace?: Mil;
};

export type TraceRow = {
  text: string;
  /**
   * One entry per repeat across the row, left to right. `["solid", "dotted",
   * "dotted", "none"]` is the trace → copy → write progression on one line.
   */
  repeats: TraceStyle[];
};

export type GridSpec = {
  kind: "graph" | "chart" | "coordinate";
  columns: number;
  rows: number;
  /** The square. */
  cell: Mil;
  /** What's printed in the squares, row-major. Empty for a blank grid. */
  cells?: string[];
  /** Coordinate planes only: where the axes cross, counted in squares. */
  origin?: { column: number; row: number };
};

export type Blank = {
  /** `_` marks each gap, the same convention `Card.clue` already uses. */
  text: string;
  /** What belongs in the gaps, in order. */
  answers: string[];
};

export type Choice = {
  prompt: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
};

export type ClockFace = {
  hour: number;
  minute: number;
  /** Hands drawn (read the time) or left off (draw them). */
  hands: boolean;
  label?: string;
};

/** A shape to measure, name or shade. Points are in mil, within its own box. */
export type Figure = {
  shape: "rectangle" | "triangle" | "circle" | "polygon";
  points: Array<{ x: Mil; y: Mil }>;
  /** Side labels, in the order the points are given. */
  labels?: string[];
};

export type Block =
  | { kind: "problems"; columns: number; items: Problem[] }
  | { kind: "rules"; rule: Rule; lines: number }
  | { kind: "trace"; rule: Rule; rows: TraceRow[] }
  | { kind: "copywork"; text: string; rule: Rule; mode: TraceStyle }
  | { kind: "grid"; grid: GridSpec }
  | {
      kind: "wordsearch";
      letters: string[][];
      find: string[];
      /** Where each word was placed, for the key. `dx`/`dy` are per step. */
      solution?: Array<{
        word: string;
        column: number;
        row: number;
        dx: number;
        dy: number;
      }>;
    }
  | {
      kind: "matching";
      left: string[];
      right: string[];
      /** `answer[i]` is the index in `right` that `left[i]` pairs with. */
      answer: number[];
    }
  | { kind: "blanks"; sentences: Blank[] }
  | { kind: "choice"; questions: Choice[] }
  | { kind: "clock"; faces: ClockFace[] }
  | { kind: "shapes"; figures: Figure[] }
  /** Where to cut, for cards and bookmarks. */
  | { kind: "cutline" }
  | { kind: "spacer"; height: Mil };

/* ── The sheet ─────────────────────────────────────────────────────────── */

/**
 * A blank the child fills in by hand.
 *
 * Printed empty, always. A child's name is the one field every worksheet on
 * earth asks for and the one thing this site refuses to hold (§1), so it is a
 * ruled line on paper and never a value in the config.
 */
export type HeaderField = "name" | "date" | "class";

export type SheetHeader = {
  title: string;
  instructions?: string;
  fields: HeaderField[];
  /** The "___ / 20" box. Absent when there is nothing to mark. */
  score?: { outOf: number };
};

export type SheetFooter = {
  credit: string;
  /** Short, and pointing back at the game the sheet came from (§16). */
  url?: string;
  /** Printed small, so the same sheet can be had again next week (§7). */
  seed: number;
  /** "Answer key", or a source credit the sheet's content requires. */
  note?: string;
};

export type Sheet = {
  paper: Paper;
  header: SheetHeader;
  /**
   * The flow, in order. A sheet is one document that may print over more than
   * one page; keeping a block inside a page is the family's job, using the
   * capacity arithmetic in layout.ts, and breaking between them is the print
   * stylesheet's.
   */
  blocks: Block[];
  footer: SheetFooter;
  /**
   * Print the answers that are already in the blocks.
   *
   * This is the whole of the answer-key mechanism. `SheetSpec.key` flips it,
   * every renderer reads it, and because the answers were computed when the
   * sheet was built there is no second generation to disagree with the first.
   */
  answers: boolean;
};

/* ── Configs ───────────────────────────────────────────────────────────── */

/** What every sheet config carries, whatever family it belongs to. */
export type SheetOptions = {
  paper: Paper;
  /**
   * Body type size in points, not `rem`. Larger type is a first-class option
   * here rather than a zoom hack (§17), and points are what a font size means
   * on paper.
   */
  fontPt: number;
  /** Overrides the family's own title. */
  title?: string;
  instructions?: string;
  fields: HeaderField[];
};

/**
 * A page with nothing on it but the header and the footer.
 *
 * Not one of the sheet families in §11 — it generates no problems and has no
 * answers. It is the spine's own sheet: the page the builder opens on, the one
 * a retired sheet type falls back to, and the smallest thing that proves the
 * front door routes, builds and keys.
 */
export type BlankConfig = SheetOptions & { kind: "blank" };

/**
 * Anything a saved sheet can hold. Narrow on `kind` — and only in index.ts,
 * which is the one module that knows the whole union.
 */
export type SheetConfig = BlankConfig;
