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
  /**
   * Body type size, in points rather than `Mil` — a font size on paper is
   * quoted in points by everyone who has ever set one, and it is the one number
   * here a renderer hands straight to CSS (`--sheet-pt`, §4). It travels on the
   * sheet because a `Sheet` is the whole hand-off: a renderer holding one has
   * to be able to set the type without also being given the config.
   */
  fontPt: number;
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
  | MoneyConfig;
