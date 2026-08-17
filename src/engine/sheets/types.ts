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
 * Answers are on the sheet from the moment it is built. A key prints the
 * answers the build already computed — `answers: true` and nothing else — so
 * however a key is obtained it can't disagree with the sheet it belongs to.
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

/**
 * A line to count along, under a problem.
 *
 * Two numbers and a tick spacing, which is all a number line is. The width is
 * declared here rather than measured by the renderer, for the same reason a
 * problem cell's is (§4): the family already worked out how wide a column is
 * to decide how many fit, and a second answer discovered in the browser is a
 * second answer.
 */
export type NumberLine = {
  from: number;
  to: number;
  /** A tick every `step`, each one labelled. */
  step: number;
  /** How wide it is drawn. */
  width: Mil;
};

/**
 * A whole cut into equal parts, some of them shaded.
 *
 * The picture a fraction is taught from before it is a pair of numbers, and the
 * only thing on a maths sheet that is a drawing rather than a sentence. Two
 * numbers and a shape is the whole of it: how many equal parts the whole was cut
 * into, and how many of them are filled in.
 *
 * How big it is drawn is deliberately not here. `fractionart.ts` is the one
 * place a bar's width and a circle's diameter are written down, so the height a
 * family reserves for the row and the height the renderer draws cannot disagree
 * (§4) — the same bargain `NumberLine` makes by declaring its width.
 */
export type FractionArt = {
  shape: "bar" | "circle";
  /** How many equal parts the whole is cut into — the denominator. */
  parts: number;
  /** How many of them are shaded — the numerator. */
  shaded: number;
};

export type Problem = {
  /**
   * How it reads on the sheet: "7 × 8 =".
   *
   * A single `_` marks where the answer goes when it belongs inside the
   * sentence rather than after it — "7 + _ = 15" — the same convention
   * `Blank.text` uses. A prompt with no gap gets a ruled slot at the end, so
   * every problem has exactly one place for an answer and the two forms can't
   * both apply. Empty when `operands` says the problem is drawn in columns.
   */
  prompt: string;
  /**
   * Text even when it's a number — "56", not 56 — for the same reason
   * `Card.answer` is. A worksheet's answers are printed, not compared.
   */
  answer: string;
  /**
   * The answer as more than one thing to write, one ruled line each — a fact
   * family's four number sentences.
   *
   * When it is here it *is* the answer place: the prompt prints no slot on the
   * end, and `workspace` becomes the height those lines share rather than
   * blank paper beneath them. A single slot instead would be a blank the size
   * of one sentence on the sheet and four sentences crammed into it on the key,
   * which wraps — and a row taller than the layout reserved is the last row of
   * the page printed on a second sheet.
   *
   * `answer` carries the same list joined onto one line, for anything that
   * wants the answer as a string. Both are built from one array where the
   * problem is made, so there is no second answer to disagree with the first.
   */
  answers?: string[];
  /**
   * Column form: the numbers stacked top to bottom, right-aligned under one
   * another with `operator` against the last of them and a rule under the lot.
   *
   * Absent for the problems that read across a line, which is most of them.
   * There is no second field saying which form a problem is in, because a
   * renderer stacks exactly when there is a stack to draw — a flag beside the
   * data is a flag that can disagree with it.
   */
  operands?: string[];
  /** The sign printed beside the stack: "+", "−" or "×". Column form only. */
  operator?: string;
  /**
   * The working that goes between the stack and its answer, one ruled line
   * each: the partial products of a long multiplication, one per digit of the
   * multiplier.
   *
   * Blank on the sheet and written in on the key, exactly like every other
   * answer place — which is the point of carrying the partials rather than a
   * count of them. A long multiplication is marked on its working as much as on
   * its total, and a key that showed only the product would leave the parent to
   * do the sum themselves to find where it went wrong.
   *
   * The rule under the problem is drawn above these lines and the total keeps
   * its own below them, which is the shape the algorithm is taught in. Column
   * form only, and absent when the multiplier is a single digit: there are no
   * partials to write, and blank rules over the answer would be a page asking a
   * child to show working that does not exist.
   *
   * `workspace` is the height the lines share, the same bargain `answers`
   * makes: the family reserved that height, so dividing it between them is what
   * keeps the row as tall as the layout arithmetic declared.
   */
  working?: string[];
  /**
   * Long division's tableau: the divisor outside the bracket, the dividend
   * under the bar, and the quotient written along the top of it.
   *
   * A shape of its own rather than a stack with a different sign, because it is
   * the one arithmetic form that is not a column of numbers — the working
   * happens under the dividend rather than beside it, and the answer is written
   * above the problem rather than below. `answer` is the quotient, remainder
   * and all ("234 r 2").
   */
  bracket?: { divisor: string; dividend: string };
  /**
   * Which fact this exercises, in the vocabulary the race already uses
   * ("7:8"). Optional, and the whole of what makes "print the facts they keep
   * missing" (§14) possible: the record book hands over fact ids and a family
   * turns them into problems without either side learning the other's shape.
   */
  factId?: string;
  /**
   * A fraction diagram beside the problem: a bar or a circle with some of its
   * parts shaded in.
   *
   * On a naming sheet this *is* the question — the child reads the picture and
   * writes the fraction — so it prints on the blank sheet as well as on the key,
   * exactly as a column stack does. Which is why it is shaded with an SVG fill
   * rather than with a CSS background: background paint is what a browser drops
   * when printing (§5), and a naming sheet whose pictures came out as empty
   * boxes asks a question that isn't there.
   */
  art?: FractionArt;
  /**
   * A clock face beside the problem — and, on half of the sheets that carry
   * one, the place the answer goes.
   *
   * `hands` decides which. A dial with hands on it is a question to read, and
   * the answer is written in a slot like any other; a dial without them is the
   * answer place itself, so no slot is printed at all and the key draws the
   * hands in. That is the same rule `answers` follows — a problem has exactly
   * one place to write the answer — reached from the one family whose answer is
   * drawn rather than written, and it is derived from the face rather than
   * declared beside it so the two cannot disagree.
   */
  clock?: ClockFace;
  /**
   * A shape beside the problem: the figure whose area, perimeter, name or angle
   * is being asked for.
   *
   * The question, always — never the answer — so it prints on the blank sheet as
   * well as on the key, exactly as a fraction diagram does, and for the same
   * reason it is drawn in SVG rather than tinted: background paint is what a
   * browser drops when printing (§5), and a geometry sheet whose shapes came out
   * as empty boxes asks nothing at all.
   */
  figure?: Figure;
  /** A number line under the problem, to count along. */
  line?: NumberLine;
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
  /**
   * What's printed in the squares only on a key, row-major and alongside
   * `cells` rather than instead of it.
   *
   * A multiplication square is a grid a child fills in, so its headers are on
   * the sheet from the start and its hundred and forty-four products are the
   * answer. Two lists rather than one flag, for the reason `operands` is a
   * stack rather than a boolean: a cell is either always printed or only
   * printed on the key, and which one it is has to be a fact about the cell.
   */
  answers?: string[];
  /**
   * Where the two heavier rules cross, counted in squares: a coordinate
   * plane's axes, or the line under a multiplication grid's headers.
   */
  origin?: { column: number; row: number };
  /**
   * The smallest and largest number written along an axis, counted from the
   * origin and the same in both directions.
   *
   * What the ruling runs to and what the *plane* runs to are two different
   * numbers: a first-quadrant plane keeps a square of margin outside its axes
   * for the numerals to sit in, and a gridline in that margin is one square
   * past nought rather than the first negative one. Without this the renderer
   * has no way to tell the two apart, and prints a "-1" on a sheet whose whole
   * promise is that a child who has not met negative numbers can do it.
   */
  axis?: { min: number; max: number };
  /**
   * Points marked where the ruling crosses, rather than inside the squares:
   * the lettered dots on a coordinate plane.
   *
   * A separate list from `cells` because it is a different place on the paper.
   * A cell is a box with a number in it and a coordinate is a corner of one, and
   * a plane whose points were written in the squares would be a plane whose
   * answers are all half a square out — which is the sort of thing that looks
   * fine on screen and is marked wrong on paper.
   */
  marks?: GridMark[];
};

/**
 * A dot at the corner of a square, with a letter beside it.
 *
 * Counted in squares from the top-left of the grid, the same way `origin` is,
 * so that where a point sits and where the axes cross are said in one
 * vocabulary — which is what lets a reader work out the coordinates of a mark
 * from the block alone.
 */
export type GridMark = { column: number; row: number; label: string };

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

/** A place on a drawing, in mil within that drawing's own box. */
export type Point = { x: Mil; y: Mil };

/**
 * A shape to measure, name or classify.
 *
 * The points are the whole of it: how big it is drawn, which way up it sits and
 * how many corners it has are all in the list, and `shape` only says what sort
 * of ink it takes — a closed outline, a circle from a centre and a point on it,
 * or the two open arms of an angle. `figure.ts` is where one is made, and the
 * note there is the reason a rectangle eight metres across is drawn an inch
 * across while an angle of forty degrees is drawn at forty degrees.
 */
export type Figure = {
  shape: "rectangle" | "triangle" | "circle" | "polygon" | "angle";
  points: Point[];
  /**
   * Side labels, in the order the points are given: `labels[i]` names the edge
   * that starts at `points[i]`. An empty string is an edge with nothing to say,
   * which is how a triangle carries a base and a height without also giving away
   * the sloping side.
   */
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

/* ── Type ──────────────────────────────────────────────────────────────── */

/**
 * Which face a sheet is set in.
 *
 * Three names rather than a font stack, because the name is the part that has
 * to survive: a sheet saved this term must still open on the face it was set
 * in after the stacks behind these ids are replaced by self-hosted files
 * (PRINT15). Until then each id resolves to whatever the reader's machine
 * already has, which is honest — a parent who asked for a dyslexia-friendly
 * face and has one installed gets it, and one who hasn't gets the default
 * rather than a download.
 *
 * `dyslexic` is an accessibility option and not a style: §17 lists a
 * dyslexia-friendly face beside larger type as a first-class choice rather than
 * a zoom hack, and the reason is the same for both — the sheet stays real
 * selectable text either way.
 *
 * It changes no length on the page. Every height the layout arithmetic
 * reserves is computed from `fontPt`, in points, so swapping the face cannot
 * push the last row onto a second sheet of paper.
 */
export type SheetFont = "print" | "cursive" | "dyslexic";

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
  /**
   * Body type size, in points rather than `Mil` — a font size on paper is
   * quoted in points by everyone who has ever set one, and it is the one number
   * here a renderer hands straight to CSS (`--sheet-pt`, §4). It travels on the
   * sheet because a `Sheet` is the whole hand-off: a renderer holding one has
   * to be able to set the type without also being given the config.
   */
  fontPt: number;
  /**
   * The three below are the presentation half of `SheetOptions`, carried here
   * for exactly the reason `fontPt` is: a `Sheet` is the whole hand-off, and a
   * renderer holding one must not also need the config it came from.
   *
   * No family sets them. They are copied on by `buildSheet` at the front door
   * (index.ts), which is the same bargain `chrome.ts` struck — every family
   * would otherwise write the same three lines, and the fifteenth one to be
   * added would be the one that forgot.
   */
  font?: SheetFont;
  /** A box round the answer place rather than a rule under it. */
  answerBox?: boolean;
  /** Dashed guides across the page, for a sheet that gets cut up. */
  cutLines?: boolean;
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
  /**
   * The face the sheet is set in. Absent is the print face, which is what a
   * worksheet is set in unless somebody says otherwise.
   */
  font?: SheetFont;
  /**
   * A box round the answer place instead of a rule under it.
   *
   * The same slot either way — this decides how it is drawn, not where it is —
   * so it can be a switch every family shares rather than a shape each one has
   * to offer. Which is also why it costs no height: a bordered slot is the same
   * line box as a ruled one, and the capacity arithmetic never learns about it.
   */
  answerBox?: boolean;
  /**
   * Dashed guides across the middle of the page, for a sheet that gets cut up
   * into cards.
   *
   * Drawn over the paper rather than in the flow, which is the whole reason it
   * can be a shared option: a `cutline` *block* takes a quarter of an inch the
   * family reserved for problems, and an overlay takes none. The 2-up and 4-up
   * card layouts of §17 are a later story; this is the guide you cut along
   * whichever of them a sheet was laid out for.
   */
  cutLines?: boolean;
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
 * Lined, ruled, graph, dot and isometric paper — a ruling and nothing written
 * on it.
 *
 * The first real family (§11's "templates" tier), and the smallest one that
 * proves the geometry end to end: there is nothing here but the ruling, so a ⅝
 * rule that comes off the printer at anything other than ⅝ of an inch has
 * nowhere to hide. It carries no options of its own beyond `rule`, because
 * `Rule` already says everything there is to say about a ruling — which size,
 * which midline, whether there is room for a `g`.
 */
export type PaperConfig = SheetOptions & { kind: "paper"; rule: Rule };

/* ── Arithmetic ────────────────────────────────────────────────────────────
   The first *generated* family: the one where a sheet is not a shape to write
   on but a set of problems that have right answers, and where a wrong answer
   key is worse than no sheet at all.                                        */

/** Which sums are on the page. `both` shuffles the two together. */
export type ArithmeticOperation = "add" | "subtract" | "both";

/**
 * What the problem asks for.
 *
 * `standard` gives both numbers and asks for the result; `missing` gives the
 * result and one number and asks for the other, which is the same fact
 * approached from the far side; `fact-family` gives the three numbers of a
 * family and asks for the four sentences they make.
 */
export type ArithmeticStyle = "standard" | "missing" | "fact-family";

/** Written across the line, or stacked in columns the way a sum is worked. */
export type ArithmeticForm = "horizontal" | "vertical";

/**
 * Whether a column may carry or borrow.
 *
 * The single most-asked-for switch on an arithmetic worksheet, because it is
 * the line between the week a child learns to add and the week they learn to
 * carry. `either` is the default: whatever the numbers happen to do.
 */
export type Regrouping = "either" | "never" | "always";

export type ArithmeticConfig = SheetOptions & {
  kind: "arithmetic";
  operation: ArithmeticOperation;
  style: ArithmeticStyle;
  form: ArithmeticForm;
  /**
   * Where both numbers in a problem come from, ends included.
   *
   * The numbers a child *sees*, not the answers they reach: "addition to 20"
   * with a range of 0–20 puts two numbers up to twenty on the page, and their
   * sum may run past it. That is what carrying is.
   */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  regrouping: Regrouping;
  /** Whether a subtraction may go below zero. Off unless asked for. */
  negatives?: boolean;
  /** A number line under every problem, to count along. */
  numberLine?: boolean;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Multiplication and division ───────────────────────────────────────────
   The tables the race already drills, on paper — and the two long forms,
   which are the first sheets where the working is the exercise rather than
   the answer.                                                              */

/** Which way round the facts are asked. `both` shuffles the two together. */
export type MultiplicationOperation = "multiply" | "divide" | "both";

/**
 * What the sheet asks for.
 *
 * `standard` gives both numbers and asks for the result; `missing` gives the
 * result and one number and asks for the other; `grid` is the multiplication
 * square, a row and a column of headers and a product in every space where
 * they meet; `long` is the written method — long multiplication, or the
 * division bracket.
 */
export type MultiplicationStyle = "standard" | "missing" | "grid" | "long";

/** Written across the line, or stacked in columns. `long` is always stacked. */
export type MultiplicationForm = "horizontal" | "vertical";

/**
 * How many digits each side of a long form has.
 *
 * `into` is the number being worked on — the multiplicand, or the dividend —
 * and `by` the one doing the working: the multiplier, or the divisor. It is
 * the phrase a teacher already uses ("three-digit by two-digit", "four into
 * nine hundred"), and it is the only thing that decides how much working space
 * the row reserves.
 */
export type LongDigits = { into: number; by: number };

export type MultiplicationConfig = SheetOptions & {
  kind: "multiplication";
  operation: MultiplicationOperation;
  style: MultiplicationStyle;
  form: MultiplicationForm;
  /**
   * Which tables are on the page. One entry is "the seven times table" and
   * several is a mixed set, which is the whole of the difference between
   * learning a table and knowing them.
   *
   * A table is the divisor when the sheet divides, so the seven times table
   * read backwards is dividing by seven — the same pair of facts the record
   * book folds onto one square and a drill keeps apart.
   */
  tables: number[];
  /** What each table is multiplied by, ends included. */
  factors: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Long forms only; ignored by the fact styles, which draw from `tables`. */
  digits?: LongDigits;
  /**
   * Long division only: whether a division may leave a remainder.
   *
   * Off unless asked for, because it is a change of question rather than a
   * harder version of the same one — a child who has not been taught
   * remainders and meets one has been set an impossible problem.
   */
  remainders?: boolean;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Fractions ─────────────────────────────────────────────────────────────
   The first family whose answer is not a number a child can count to. Every
   sheet above this line is marked by reading a total; a fraction is two numbers
   that mean one value, several pairs mean the same value, and only one of those
   pairs is the answer — so "right" here includes "in its lowest terms".       */

/**
 * What the sheet asks for.
 *
 * `identify` shows a picture and asks what fraction is shaded; `equivalent`
 * gives one pair and half of another; `simplify` asks for the same value
 * written the smallest way; `arithmetic` is the four operations.
 */
export type FractionStyle =
  "identify" | "equivalent" | "simplify" | "arithmetic";

/**
 * Which operation is on the page. `both` is addition and subtraction shuffled
 * together — the pair a child meets in one lesson. Multiplying and dividing
 * fractions is a different lesson, and a different sheet.
 */
export type FractionOperation =
  "add" | "subtract" | "multiply" | "divide" | "both";

/**
 * Whether the two fractions in a problem share a denominator.
 *
 * The switch this family turns on, the way regrouping is the switch on an
 * addition sheet: adding halves to quarters is a different week's work from
 * adding quarters to quarters, and a sheet that mixed them would be set at a
 * level nobody chose. `either` is whatever the draw happens to give.
 */
export type Denominators = "like" | "unlike" | "either";

/** Which picture a naming sheet draws. `both` shuffles the two together. */
export type FractionModel = "bar" | "circle" | "both";

export type FractionConfig = SheetOptions & {
  kind: "fractions";
  style: FractionStyle;
  /** Arithmetic only; the other three styles have no operation to choose. */
  operation: FractionOperation;
  /**
   * The denominators a sheet draws from — halves, thirds, quarters, and as far
   * up as a parent wants. A pool rather than a range, for the reason `tables`
   * is: "sevenths" is a choice somebody makes, and 2 to 12 is not.
   */
  denominators: number[];
  pairing: Denominators;
  /**
   * Whether whole numbers ride along with the fractions: `2 1/4` rather than
   * `1/4`, on the page and in the answer.
   */
  mixed?: boolean;
  /** Naming sheets only. */
  model?: FractionModel;
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Decimals, percents and money ──────────────────────────────────────────
   Three sheets built on one idea: a number with a point in it is a whole
   number of hundredths wearing a costume. Everything in `maths/exact.ts` is
   there so that nothing below ever holds 0.1 + 0.2 as a float.               */

/** What the sheet asks for. */
export type DecimalStyle = "standard" | "percent" | "convert";

/** `both` shuffles addition and subtraction, as it does on an arithmetic sheet. */
export type DecimalOperation = "add" | "subtract" | "multiply" | "both";

/**
 * Written across the line, or stacked in columns.
 *
 * Column form is worth more here than anywhere else in the shop: every value on
 * a decimal sheet prints to the same number of places, so stacking them
 * right-aligned puts the points in a column — which is the one thing a child
 * lining up a decimal sum has to get right.
 */
export type DecimalForm = "horizontal" | "vertical";

export type DecimalConfig = SheetOptions & {
  kind: "decimals";
  style: DecimalStyle;
  operation: DecimalOperation;
  form: DecimalForm;
  /**
   * How many digits after the point, 1 to 3. The whole of what makes a decimal
   * sheet easy or hard, and the one thing every other generator of these gets
   * wrong by rounding a float into the answer key.
   */
  places: number;
  /** The whole numbers the values sit between, ends included. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/**
 * Which money is on the page.
 *
 * A switch rather than a build-time constant, for the same reason A4 is (§4):
 * a British child counting dollars is being asked a question about a foreign
 * country, and the sheet is otherwise identical.
 */
export type Currency = "usd" | "gbp" | "eur";

/** `both` shuffles addition and subtraction — the two a till does. */
export type MoneyOperation = "add" | "subtract" | "multiply" | "both";

export type MoneyConfig = SheetOptions & {
  kind: "money";
  currency: Currency;
  operation: MoneyOperation;
  /**
   * Money is a two-place decimal with a symbol in front of it, so it is written
   * down the same two ways a decimal is.
   */
  form: DecimalForm;
  /** The whole units the amounts sit between — dollars, pounds or euros. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Time ──────────────────────────────────────────────────────────────────
   The maths that isn't arithmetic starts here. Every family above this line is
   a sentence with a number missing; a clock is a picture with two hands on it,
   and on half of these sheets the hands are the answer.                      */

/**
 * What the sheet asks for.
 *
 * `read` puts the hands on the dial and asks for the time; `draw` gives the time
 * and leaves the dial empty; `elapsed` is two times and the space between them,
 * which is the one of the three that is arithmetic — and the arithmetic nobody
 * can do in base ten.
 */
export type TimeStyle = "read" | "draw" | "elapsed";

export type TimeConfig = SheetOptions & {
  kind: "time";
  style: TimeStyle;
  /**
   * The minutes a time is allowed to land on, and the whole of what makes a
   * clock sheet easy or hard: 60 is o'clock, 30 is half past, 15 the quarters,
   * 5 the numerals a child counts round in fives, and 1 is any minute there is.
   *
   * A number rather than a union, because it arrives from outside this build and
   * a step of seven has to resolve to something rather than throw — see
   * `TIME_STEPS` in `maths/time.ts` for what it resolves to.
   */
  step: number;
  /**
   * Elapsed only: how far apart the two times may be, in minutes, ends
   * included. "Half an hour to two hours" is a different lesson from "five
   * minutes to twenty", and it is the only thing that decides which.
   */
  span?: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Measurement ───────────────────────────────────────────────────────────
   Two systems, and no conversion between them. A child converting metres into
   feet is doing a different lesson — an approximate one — and everything here
   is exact.                                                                  */

/**
 * Which system the sheet is in.
 *
 * A switch rather than a build-time constant, for the same reason the currency
 * is (§4): a British child converting yards is being asked about a country they
 * have never measured anything in, and an American child converting millimetres
 * likewise.
 */
export type UnitSystem = "metric" | "imperial";

/** What is being measured. */
export type Quantity = "length" | "mass" | "capacity";

/**
 * What the sheet asks for. `convert` writes the same amount in another unit;
 * `compare` puts two amounts side by side and asks which is the bigger, which
 * is the same skill with the arithmetic hidden inside it.
 */
export type MeasureStyle = "convert" | "compare";

export type MeasureConfig = SheetOptions & {
  kind: "measure";
  style: MeasureStyle;
  system: UnitSystem;
  /**
   * Which quantities are on the page — a pool rather than one, for the reason
   * `tables` is: "millimetres, centimetres and metres" is a lesson somebody
   * teaches, and "everything measurable" is not.
   */
  quantities: Quantity[];
  /** How many of the unit written on the left, ends included. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Geometry ──────────────────────────────────────────────────────────────
   Where a worksheet stops being a sentence. Five of the six styles below put a
   drawing on the page that the question is *about*, so the answer key is only
   as good as the shape: a rectangle labelled 8 by 3 and drawn 8 by 4 is a sheet
   that teaches a child not to trust the picture.                             */

/** What the sheet asks for. */
export type GeometryStyle =
  "area" | "perimeter" | "volume" | "angles" | "identify" | "coordinates";

export type GeometryConfig = SheetOptions & {
  kind: "geometry";
  style: GeometryStyle;
  /** Which units the measurements are in. Ignored by the three that have none. */
  system: UnitSystem;
  /** How big the sides get, ends included. */
  range: { min: number; max: number };
  /**
   * The coordinate plane only: one quadrant, or all four.
   *
   * The switch that family turns on. A plane that runs from nought is counting;
   * a plane with four quadrants is the week negative numbers arrive, and putting
   * one in front of a child who has not met them is not a harder sheet but an
   * impossible one.
   */
  quadrants?: number;
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Integers ──────────────────────────────────────────────────────────────
   Where a number stops being an amount of something. Everything above this
   line is a count a child could put on the table; here −7 is a direction as
   much as a quantity, and the sign is the whole of what is being taught — a
   key that had 7 − 9 as 2 would be marked right by a parent reading quickly,
   which is the failure this family has to make impossible.                   */

/**
 * What the sheet asks for.
 *
 * `arithmetic` is the four operations over positive and negative whole numbers;
 * `order` is one expression with several operations in it and the rule that
 * decides which is done first; `powers` is exponents and the roots that undo
 * them.
 */
export type IntegerStyle = "arithmetic" | "order" | "powers";

/** Which operations are on the page. `both` shuffles all four together. */
export type IntegerOperation =
  "add" | "subtract" | "multiply" | "divide" | "both";

export type IntegerConfig = SheetOptions & {
  kind: "integers";
  style: IntegerStyle;
  /** Ignored by the two styles that have no operation to choose. */
  operation: IntegerOperation;
  /**
   * How big the numbers get, sign aside.
   *
   * The *size* of what a child sees, because a range with a minus sign at one
   * end of it is a range nobody says out loud: a parent asks for "numbers to
   * twenty", and whether one of them is negative is the switch below rather
   * than the bottom of the range.
   */
  range: { min: number; max: number };
  /**
   * Whether a minus sign may appear on a number at all. On unless turned off,
   * because this is the integers family — but an order-of-operations sheet
   * without them is a real lesson, and it is the one a year younger.
   */
  negatives?: boolean;
  /** Order of operations only: how many operations the expression holds. */
  terms?: number;
  /**
   * Order of operations only: whether an expression may have a square in it.
   *
   * On unless turned off, because "brackets, powers, then × and ÷" is the rule
   * as it is taught. But powers are their own lesson and their own style here,
   * and a child who has met the rule a term before they meet exponents cannot
   * start `3² + 10 × 2` — so a sheet that asks for the rule without them is the
   * same lesson a year earlier, exactly as `negatives` above is. The printed
   * instruction follows the switch: a sheet with no squares on it does not tell
   * a child to do powers first.
   */
  powers?: boolean;
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Pre-algebra ───────────────────────────────────────────────────────────
   The family where the answer is not a number at all. `x = 5` is a sentence,
   `x > −4` is every number past a point, and a slope is a pair of numbers that
   only means something written the smallest way. Which is why nothing here is
   checked by evaluating the generator's own arithmetic: an equation's answer
   is checked by putting it back in, and an inequality's by trying numbers.   */

/**
 * What the sheet asks for.
 *
 * `expression` evaluates a rule at a value or collects like terms; `equation`
 * and `inequality` solve for the letter, in one step or two; `slope` is rise
 * over run from a pair of written points; `graph` is the same question read off
 * a coordinate plane, which is where a child meets it first.
 */
export type AlgebraStyle =
  "expression" | "equation" | "inequality" | "slope" | "graph";

export type PreAlgebraConfig = SheetOptions & {
  kind: "prealgebra";
  style: AlgebraStyle;
  /**
   * Equations and inequalities: one step, or two.
   *
   * The switch this family turns on, the way regrouping is the switch on an
   * addition sheet. `x + 7 = 12` is undone by one move and `3x + 4 = 19` by
   * two, and they are a term apart in the year rather than a harder version of
   * the same question.
   */
  steps?: number;
  /** How big the numbers get, sign aside — as on an integers sheet. */
  range: { min: number; max: number };
  /**
   * Whether a negative number may appear, in the question or in the answer.
   *
   * More than a difficulty here: dividing an inequality by a negative turns it
   * round, which is the single most-missed step in the whole of pre-algebra and
   * the reason this family exists on paper rather than in a race.
   */
  negatives?: boolean;
  /** The graph style only: one quadrant, or all four. */
  quadrants?: number;
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Ratio, proportion and rate ────────────────────────────────────────────
   Three names for one idea: two numbers whose *relationship* is the answer.
   `12 : 18` and `2 : 3` are the same ratio and only one of them is marked
   right, which is the bargain `exact.ts` already struck for fractions — so
   this family reduces with the same greatest common divisor and never divides
   a float.                                                                   */

/**
 * What the sheet asks for. `simplify` writes a ratio the smallest way;
 * `proportion` fills the gap in a pair that scale together; `rate` is the
 * amount for one of something, which is the form of it a shopper uses.
 */
export type RatioStyle = "simplify" | "proportion" | "rate";

export type RatioConfig = SheetOptions & {
  kind: "ratio";
  style: RatioStyle;
  /** How big the numbers in a ratio get, ends included. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Statistics ────────────────────────────────────────────────────────────
   The one maths family whose question is a *set* rather than a sum, and the
   one where the commonest generator bug is invisible: a set with two modes has
   two right answers, and a set of an even size has a median between two of its
   numbers rather than at one of them. Both print as a confident wrong key.   */

/**
 * What the sheet asks for. `all` is the four of them from one set of numbers,
 * which is how the topic is set in every textbook that teaches it.
 */
export type StatisticStyle = "mean" | "median" | "mode" | "range" | "all";

export type StatisticsConfig = SheetOptions & {
  kind: "statistics";
  style: StatisticStyle;
  /**
   * How many numbers are in each set.
   *
   * Not a difficulty dial so much as a choice of question: an even-sized set
   * has its median between two numbers, which is the lesson a five-number set
   * cannot teach.
   */
  size: number;
  /** The numbers the set is drawn from, ends included. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. */
  workspace?: boolean;
};

/* ── Word problems ─────────────────────────────────────────────────────────
   The one place in the maths set where generated *text* is read by a person.
   Everywhere else a template failure is a sum that looks odd; here it is a page
   that reads as machinery, and a parent stops trusting the rest of the shop. So
   the rule from §11 is the rule here: fewer templates rather than repetitive
   ones, and the suite counts the variety rather than hoping for it.          */

/** Which lessons the problems are about — a pool, so a page can mix them. */
export type WordTopic =
  "integers" | "rate" | "percent" | "equation" | "average";

export type WordProblemConfig = SheetOptions & {
  kind: "word-problems";
  topics: WordTopic[];
  /** How big the numbers in a story get, ends included. */
  range: { min: number; max: number };
  /** How many problems to ask for. Capped at what the page holds. */
  count: number;
  columns: number;
  /** Blank space under every problem, to work in. On by default here. */
  workspace?: boolean;
};

/**
 * Anything a saved sheet can hold. Narrow on `kind` — and only in index.ts,
 * which is the one module that knows the whole union.
 */
export type SheetConfig =
  | BlankConfig
  | PaperConfig
  | ArithmeticConfig
  | MultiplicationConfig
  | FractionConfig
  | DecimalConfig
  | MoneyConfig
  | TimeConfig
  | MeasureConfig
  | GeometryConfig
  | IntegerConfig
  | PreAlgebraConfig
  | RatioConfig
  | StatisticsConfig
  | WordProblemConfig;

/* ── A sheet somebody kept ─────────────────────────────────────────────── */

/**
 * A sheet a parent configured and saved — what the `sheets` store holds (§15).
 *
 * A config and the seed that chose which one of the infinitely many sheets it
 * makes, which together are the whole of it: `buildSheet(config, seed)`
 * reproduces the page exactly (§7), so none of the paper is stored and a sheet
 * saved in March prints the same problems in June.
 *
 * Declared here rather than in `services/sheets.ts` for the same reason
 * `CustomDeck` sits in `engine/types.ts`: the model owns the vocabulary and the
 * service owns the persistence, which is what lets `db.ts` state its schema
 * without importing a peer service back up the stack.
 *
 * `id` is prefixed `sheet-`, the way a custom deck's is prefixed `custom-`, so
 * the two can never collide wherever they end up side by side — one backup
 * file, one list of things a parent made.
 *
 * There is no `profileId`, and that is a decision rather than an omission. A
 * worksheet belongs to the household, not to a child (§15): the sheet made for
 * the eldest is the sheet the next one gets, and scoping it to a profile would
 * mean building it again for every kid at the table. It is also the one record
 * here with nowhere to put a child's name, which is not an accident either —
 * the name line is printed blank and filled in by hand (§1).
 */
export type SavedSheet = {
  id: string;
  name: string;
  config: SheetConfig;
  seed: number;
  createdAt: string;
  updatedAt: string;
};
