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
import type { Inventory } from "./phonics/inventory";
import type { TranslationId } from "./passages/types";

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
 * A line to count along, under a problem — or, on its own, the whole sheet.
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
  /** A tick every `step`. */
  step: number;
  /** How wide it is drawn. */
  width: Mil;
  /**
   * A number under every `label`th tick, the rest left as bare ticks. Absent
   * means every tick is labelled, which is what a line under a problem does.
   *
   * The one thing a *reference* number line needs that a counting aid under a
   * sum does not. A line marked every 1 from 0 to 100 is the sheet a Year 2
   * teacher asks for, and a hundred and one numerals across seven and a half
   * inches is a smudge — so the ticks stay where the interval says and the
   * numbers thin out to what will fit. Which ticks keep their number is
   * arithmetic (`labelEvery` in numberline.ts), not a guess made in a browser,
   * because a spacing a browser worked out is a spacing no test can check.
   */
  label?: number;
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

/**
 * How tall one letter of a word stands — the three bands a word is written in.
 *
 * `tall` reaches the top line (an ascender, a capital, a numeral), `small` stops
 * at the midline, and `tail` drops below the baseline. It is the whole of what a
 * word-shape box is: `bed` is tall-small-tall and `pig` is tail-small-tail, and
 * the outline the two make is different enough to tell them apart without
 * reading either — which is what the exercise is training.
 *
 * Punctuation counts as `small`. An apostrophe is not a letter with a body, and
 * a box drawn for it at any other height would be a shape a child cannot match.
 *
 * A space is `gap`, and it is the one that is not a box at all. Every other
 * value is something a child writes into the box drawn for it — a letter, a
 * numeral, an apostrophe — and a space is nothing to write, so `1 Samuel` with
 * a box over its space would be asking for a ninth letter that does not exist.
 * The slot is still counted, because the boxes either side of a space have to
 * land where they would have anyway; only the rectangle goes.
 */
export type LetterShape = "tall" | "small" | "tail" | "gap";

/**
 * One word as a row of boxes, plus the word those boxes were drawn from.
 *
 * Both, because the word is the answer: the boxes are printed empty and the key
 * writes the letters into them, exactly as a ruled slot works. The shapes are
 * resolved by the engine rather than by the renderer, so the same word is the
 * same outline in a unit test, on a catalog page and in the builder (§4).
 */
export type WordShape = { word: string; letters: LetterShape[] };

/** One place on a tracing row: what is written there, and how it is drawn. */
export type TraceCell = { text: string; style: TraceStyle };

export type TraceRow = {
  /**
   * The cells across one row, left to right. `A` in `["solid", "dotted",
   * "dotted", "none"]` is the trace → copy → write progression for one letter,
   * and a row holds as many of those groups as the paper is wide enough for —
   * which is what puts a whole alphabet on one page rather than the first
   * thirteen letters of it.
   *
   * The text is per cell rather than per row for that reason alone. A row of
   * one repeated word is the commoner shape and still the easy one to write;
   * a row that could only say one thing would have made the letters family
   * choose between a legible rule size and the other half of the alphabet.
   */
  cells: TraceCell[];
};

export type GridSpec = {
  kind: "graph" | "chart" | "coordinate";
  columns: number;
  rows: number;
  /** The square: how wide a column is, and how tall a row is. */
  cell: Mil;
  /**
   * How tall a row is, where a row is not a square.
   *
   * Absent on every grid a child measures against — graph paper, a hundred
   * chart, a coordinate plane — because a square that is not square is a grid
   * that lies about its own geometry, and §4 is about nothing else. It is here
   * for the one chart whose columns are a *heading* rather than a unit: a
   * place-value chart's columns are as wide as the word "Hundreds" and its rows
   * are one digit tall, and squaring them would either print a chart three
   * inches wide on a page eight inches wide or one eight rows long that runs
   * off the bottom.
   *
   * So: stated, and stated only by the family that means it. A renderer reads
   * `row ?? cell`, which is what keeps every other grid square by construction
   * rather than by remembering.
   */
  row?: Mil;
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

/**
 * One word read out of a finished grid: where it starts, and which way it runs.
 *
 * "Read out of", not "written into", and the distinction is the whole of the
 * answer key on a word search. A puzzle whose key is its own placement record
 * is a key that agrees with the generator rather than with the paper — it says
 * a word is at (3, 4) because that is where the code meant to put it, which is
 * exactly the claim that is wrong when a later word overwrote a letter. So the
 * key is derived by searching the grid it is a key to (`findWord`), and this is
 * what that search returns.
 */
export type Found = {
  word: string;
  column: number;
  row: number;
  /** One step along the word, per letter. `(1, 0)` reads left to right. */
  dx: number;
  dy: number;
};

/**
 * One square of a crossword. `null` in the grid is a blocked square — no
 * letter, no ink, nothing written in it.
 *
 * The letter is on the square whether or not the sheet is a key: it is what the
 * square *is*, and `Sheet.answers` decides whether it is printed. Same bargain
 * as every other answer place, and the reason a key cannot disagree with its
 * sheet.
 */
export type CrosswordCell = {
  letter: string;
  /** The small number in the corner, where an entry starts on this square. */
  number?: number;
};

/**
 * One clue and the entry it belongs to.
 *
 * `column` and `row` are where the answer starts, so a test can hold the clue
 * list against the grid letter for letter rather than against the placement the
 * generator remembers making. That is the same independence `Found` buys the
 * word search, and it is what makes "the crossings agree" a checkable claim:
 * two entries that cross share one square, so if both spell their own answer
 * out of the grid then the crossing agrees by construction.
 */
export type CrosswordEntry = {
  number: number;
  clue: string;
  answer: string;
  column: number;
  row: number;
};

/**
 * One piece of a word as it is printed, and how it is marked.
 *
 * The piece is a *spelling* rather than a letter — `sh` is one piece, and so is
 * the `a` of `cake` while its `e` is another at the end of the word — because
 * that is the unit the whole phonics family is built on (`phonics/sounds.ts`).
 * A piece carries at most one mark, and the three cannot collide: see the note
 * in `phonics/cards.ts` for why that is provable rather than hoped for.
 *
 * `mark` absent is the ordinary case and is what every piece looks like with
 * all three switches off.
 */
export type MarkedPart = {
  text: string;
  mark?: "macron" | "silent" | "joined";
};

/** A word, or a whole sentence, cut into those pieces. */
export type MarkedWord = MarkedPart[];

/**
 * One card: a big line, and a smaller one under it.
 *
 * Three sheets are made of these and they differ only in what goes on the two
 * lines — a spelling over the word it is in, the same pair unboxed on a wall
 * chart, or a whole sentence on a strip with nothing underneath. Which is why
 * there is no `kind` here: a card is a shape, and the family that filled it is
 * the one that knows what it means.
 */
export type SoundCard = {
  big: MarkedWord;
  /** The example word under a spelling. Absent on a sentence strip. */
  small?: MarkedWord;
};

/**
 * One labelled place on a form: a heading, and room to answer under it.
 *
 * The whole of what a blank form is. A book report, a lab report and a story
 * map differ in what the headings say and in nothing else — which is why they
 * are one family and one block rather than three drawings, and why the honest
 * thing this tier can offer is a good set of headings rather than a generator
 * (§11: "they're supposed to be empty").
 *
 * `space` is stated rather than derived from `lines` because a field with no
 * lines is the one a child draws in, and a drawing box has a height that has
 * nothing to do with writing. Where there *are* lines, the family sets `space`
 * to `lines × answerLine(fontPt)`, so a line on a form is the same height as a
 * line anywhere else in the shop and a page of them can be counted.
 */
export type FormField = {
  /** What goes above the space — "What I predicted", "Beginning". */
  label: string;
  /**
   * How many places there are to write, which is one more than the number of
   * rules drawn inside the box: the last line is written on the box's own
   * bottom edge. Zero is a blank box — somewhere to draw rather than write.
   */
  lines: number;
  /** How tall the box under the label stands. */
  space: Mil;
  /**
   * And how wide it is drawn.
   *
   * Declared here rather than left to a CSS grid, for the reason a problem cell
   * declares its size (§4): the family already worked out how wide a column is
   * in order to decide what fits, and a second width discovered in the browser
   * is a second width. It also means the rules inside the box are drawn in the
   * same mil viewBox as every other stroke on a sheet, which is what keeps a
   * hairline a hairline on paper.
   */
  width: Mil;
  /** How many of the form's columns it takes. */
  span: number;
};

/**
 * One column of a table, and how wide it is drawn.
 *
 * Widths in mil rather than shares of the page, for the reason every other
 * length here is (§4): a reading log's "Minutes" column is as wide as three
 * numerals and its "Book" column is as wide as a title, and a table that
 * divided the page evenly would print the one too narrow to use and the other
 * mostly empty. The family works the widths out against the box it was given,
 * so what the renderer draws is what the capacity arithmetic already fitted.
 */
export type TableColumn = { label: string; width: Mil };

/**
 * One cell of a table: what is printed in it, and what is printed in its
 * corner.
 *
 * Two places rather than one, because a calendar needs both at once — the date
 * is set small in the top-left corner so the rest of the square stays empty for
 * whatever is written in it, and a row label on a chore chart sits in the
 * middle of its own cell like ordinary text. A cell with neither is a box to
 * fill in, which is most of them.
 */
export type TableCell = {
  /** Set on the cell's own baseline, left-aligned. A row label, a day name. */
  text?: string;
  /** Set small in the top-left corner. A calendar's date. */
  corner?: string;
};

/**
 * One card face — the piece of paper that gets cut out.
 *
 * Every field is optional and a face with none of them is a blank card, which
 * is the commonest thing on this shelf and not a degenerate case: "blank
 * flashcards" is what somebody searched for.
 *
 * `fields` is a rule with its purpose printed *under* it rather than beside it,
 * which is the shape a certificate is written in — the name goes on the line
 * and the word "Name" goes small underneath so it does not crowd what is
 * written. `lines` is the same rule with nothing said about it.
 */
export type CardFace = {
  /** Small, above the big line — "Hello, my name is", "This certifies that". */
  eyebrow?: string;
  /** The big line: the word, the verse reference, what the award is for. */
  heading?: string;
  /** The words under it: the verse itself, a quotation. */
  body?: string;
  /** A rule to write on, with what it is for set small underneath. */
  fields?: string[];
  /** Rules to write on with nothing said about them. */
  lines?: number;
};

/**
 * One face of a cube net: how many pips are on it, or what is written there.
 *
 * `pips` is a count rather than a numeral because a die has spots, and a child
 * who is learning to subitise is reading a pattern rather than a number. Zero
 * pips with a `label` is the same net used as a word die — six things to do,
 * six sounds to say — which is the version most homeschool rooms actually cut
 * out, and it is the same six squares either way.
 */
export type NetFace = { pips: number; label?: string };

/** Which edge of a face a glue tab hangs off. */
export type NetEdge = "top" | "right" | "bottom" | "left";

/**
 * A tab to glue under the face it meets when the net is folded up.
 *
 * On the net rather than left to the renderer, because which edges get one is a
 * fact about the *folding* and not about the drawing: a cube has twelve edges,
 * five of them are folds in this net, and the remaining seven each need exactly
 * one tab. Two tabs on one join is a lump that stops the cube closing, and none
 * is a hole — both invisible until somebody has cut it out.
 */
export type NetTab = { face: number; edge: NetEdge };

/**
 * Something to cut out and fold, or cut out and spin.
 *
 * The two share a block because they share the thing that makes them hard: the
 * ink says where the scissors go, and being a sixteenth of an inch out is a
 * cube that will not close or a spinner that is not fair. Neither has an answer
 * and neither is drawn from a seed.
 */
export type Net =
  | {
      shape: "cube";
      /** One face's edge. The cube it folds up into is this on a side. */
      edge: Mil;
      /** The grid the net is laid out on, so a renderer places nothing. */
      columns: number;
      rows: number;
      /** Row-major over that grid. `null` is paper with no face on it. */
      faces: Array<NetFace | null>;
      tabs: NetTab[];
      /** How far a glue tab sticks out from the edge it hangs off. */
      tab: Mil;
    }
  | {
      shape: "spinner";
      radius: Mil;
      /**
       * One label per sector, clockwise from twelve o'clock.
       *
       * The sectors are equal by construction — the renderer divides a whole
       * turn by `sectors.length` — because a spinner whose sectors are not
       * equal is not the spinner the sheet says it is, and "is this fair?" is
       * the question the thing exists to answer.
       */
      sectors: string[];
      /** The pointer to cut out and pin through the middle. */
      pointer: { length: Mil; width: Mil };
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
      /**
       * The words to look for, exactly as they appear in the grid — upper case,
       * and with anything that is not a letter taken out. A grid has nowhere to
       * put the apostrophe in "don't", so the list says `DONT`: what is printed
       * under the puzzle is what is findable in it.
       */
      find: string[];
      /** Where each word was found, for the key. Derived from `letters`. */
      solution?: Found[];
      /**
       * Words the grid could not hold, printed on the sheet rather than quietly
       * dropped.
       *
       * The classic silent bug in a word search is a word that failed to place
       * and vanished: the child hunts for something that is not there, and the
       * answer key is wrong about a word it never mentions. A word that could
       * not be placed is not on the `find` list, and it is named here instead.
       *
       * Only as many as the family reserved room to print. The line is set
       * under a block already trimmed to the page, so what it holds is capped —
       * and the rest are counted in `omittedMore` rather than named.
       */
      omitted?: string[];
      /**
       * How many more there were than the page could name.
       *
       * A count is a poor substitute for a name and it is only ever reached by
       * a config at the far end — the largest type, the longest list — where
       * naming them all would be a page with no puzzle on it. The alternative
       * is a paragraph below the bottom margin, which names them on a sheet of
       * paper nobody prints.
       */
      omittedMore?: number;
    }
  | {
      kind: "crossword";
      /** Row-major. `null` is a blocked square. */
      cells: Array<Array<CrosswordCell | null>>;
      across: CrosswordEntry[];
      down: CrosswordEntry[];
      /** Words the grid had no room for — see `wordsearch.omitted`. */
      omitted?: string[];
      /** And how many more than it could name — see `wordsearch.omittedMore`. */
      omittedMore?: number;
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
  /**
   * Words as the outline their letters make, one row of boxes each.
   *
   * A block of its own rather than a `problems` item with a drawing on it, for
   * the reason a fraction diagram is not: the boxes *are* the answer place. A
   * problem may have exactly one of those, and a row of eight boxes with a ruled
   * slot on the end of it would be a sheet a child answers twice.
   */
  | { kind: "wordshapes"; columns: number; words: WordShape[] }
  /**
   * Cards: a spelling over the word it is in, or a sentence on a strip.
   *
   * A block of its own rather than `problems` with a big prompt, for the reason
   * `wordshapes` is one: there is no answer place on it at all. A card is a
   * thing to be read — cut out, pinned up, or handed over — and a ruled slot on
   * the end of one would be a sheet asking a question nobody set.
   */
  | {
      kind: "cards";
      columns: number;
      cards: SoundCard[];
      /**
       * How big the big line is set, in ems of the body size.
       *
       * On the block rather than in the stylesheet because a card and a
       * sentence strip are the same block at two very different sizes, and the
       * family reserved the page against this number — see `cardRowEms`.
       */
      bigEms: number;
      /** A border to cut round. Off for a wall chart, which is not cut up. */
      boxed: boolean;
    }
  | { kind: "clock"; faces: ClockFace[] }
  | { kind: "shapes"; figures: Figure[] }
  /**
   * A number line on its own, rather than under a sum.
   *
   * A block of its own for the reason `wordshapes` is one: there is no problem
   * here. A `problems` block numbers what is in it — "1." against a strip a
   * child is going to cut out and stick on a desk is a question nobody asked —
   * and a reference line is the sheet rather than an aid beside something else.
   * The line itself is the same `NumberLine` a problem carries, drawn by the
   * same renderer, so the ticks on a wall strip land exactly where the ticks
   * under a sum do.
   */
  | { kind: "numberline"; line: NumberLine }
  /**
   * A blank form: labelled boxes to write in, laid out across the page.
   *
   * A block of its own rather than a `problems` block with empty answers, for
   * the reason `wordshapes` is one: there is no question here. A form asks
   * nothing that has a right answer — it asks what the book was about — so
   * numbering it "1." would be a page pretending to be a worksheet, and the key
   * mechanism has nothing to reveal on it.
   */
  | { kind: "form"; columns: number; fields: FormField[] }
  /**
   * A ruled table: headings across the top, and rows to fill in under them.
   *
   * Distinct from a `grid`, which is squares a child measures against and whose
   * columns are therefore all one width. A table's columns are as wide as what
   * goes in them, its heading row is its own height, and its cells hold words
   * rather than numerals. Everything on this shelf that is a week — a reading
   * log, a chore chart, a calendar, a timeline — is this block with different
   * headings on it.
   */
  | {
      kind: "table";
      columns: TableColumn[];
      /** Whether the column labels are drawn as a heading row above the body. */
      head: boolean;
      /** How many body rows there are under the heading. */
      rows: number;
      /** Row-major, `columns.length` to a row. Short lists leave cells blank. */
      cells: TableCell[];
      /** How tall a body row stands, and how tall the heading row does. */
      row: Mil;
      headRow: Mil;
      /**
       * A heavier upright at this column boundary, with a tick into every row —
       * the line a timeline is drawn along.
       *
       * Counted in column boundaries, so `1` is the rule between the first
       * column and the second and `0` is the left edge of the table. A timeline
       * is a table whose spine happens to be a date column wide; nothing else on
       * the shelf sets it.
       */
      spine?: number;
    }
  /**
   * Cards to cut out: faces at a stated size, in a grid, with the cut lines on
   * the boundaries between them.
   *
   * The one block on the shelf whose geometry a pair of scissors checks. Three
   * things are therefore not the renderer's to decide and all three are here:
   * how big a card is, how many there are across and down, and where the cuts
   * go — which is every card boundary, the outside trim included, because a
   * sheet whose outer edge is not marked is a sheet cut freehand.
   *
   * There is no gutter, and that is the design rather than an omission. A
   * gutter means two cuts and a strip of waste per boundary; a shared edge
   * means one cut makes two cards, which is what a paper trimmer is for. The
   * waste that is left over goes *round* the block, split evenly, so a sheet
   * fed back through a printer or a guillotine is square with itself — an
   * uneven margin is the way this goes wrong, and it goes wrong invisibly.
   */
  | {
      kind: "cutcards";
      /** The face, on paper. What the sheet says it is, and what it measures. */
      card: { width: Mil; height: Mil };
      columns: number;
      rows: number;
      faces: CardFace[];
      /** How big the heading is set, in ems of the body size. */
      headingEms: number;
      /**
       * A ruled border inside every card, for a certificate.
       *
       * `plain` draws nothing but the cut guides, which is what a blank
       * flashcard wants: a card that is going to be written on all over does not
       * need a box drawn round the writing. `award` is the double rule a
       * certificate is printed in, set in from the cut so that a cut a
       * thirty-second of an inch out does not slice through it.
       */
      frame: "plain" | "award";
      /**
       * Fold the card in half across the middle, and print the upper half
       * upside down.
       *
       * A tent — a name tag that stands on a desk and reads from both sides.
       * The rotation is what makes that true rather than a nicety: fold the top
       * half back and down and it ends up facing the other way, so it has to be
       * printed the other way up to be read. The fold is exactly halfway down
       * the card, which is the whole of what makes the two panels match.
       */
      fold?: boolean;
    }
  /** Something to cut out and fold up, or cut out and spin. */
  | { kind: "net"; net: Net }
  /** Where to cut, for cards and bookmarks. */
  | { kind: "cutline" }
  | { kind: "spacer"; height: Mil };

/* ── Type ──────────────────────────────────────────────────────────────── */

/**
 * Which face a sheet is set in.
 *
 * Names rather than font stacks, because the name is the part that has to
 * survive: these ids were system stacks for two stories and are self-hosted
 * files now (`src/styles/fonts.css`), and not one saved sheet had to change its
 * mind about which face it wanted. Named by shape, never by a teaching model —
 * D'Nealian® and Zaner-Bloser® are trademarks with commercial fonts behind
 * them, and this is a description of letterforms.
 *
 * **Three of the five are cursive**, and that is the answer to a question print
 * never asks: joined writing has no single correct form. The looped hand an
 * American school teaches, the unlooped one that lifts the pencil after certain
 * letters, and the fully joined hand a British school teaches disagree about
 * which letters join at all — so the model is a choice a parent makes rather
 * than one this repo makes for them. `cursive` is the looped hand and stays
 * unqualified because it is the id already written into saved sheets (§7).
 *
 * `dyslexic` is an accessibility option and not a style: §17 lists a
 * dyslexia-friendly face beside larger type as a first-class choice rather than
 * a zoom hack, and the reason is the same for both — the sheet stays real
 * selectable text either way.
 *
 * It changes almost no length on the page: every height the layout arithmetic
 * reserves is computed from `fontPt`, in points, so a face swap can't move a
 * ruling or a row. What it does change is how wide a *character* is, and the
 * proportions the five differ by are measured in `faces.ts` rather than
 * assumed.
 */
export type SheetFont =
  "print" | "cursive" | "cursive-modern" | "cursive-uk" | "dyslexic";

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
  /**
   * The credit the *content* requires, where the words on the page are
   * somebody else's: "Scripture: World English Bible Updated (public domain) ·
   * worldenglish.bible" (§12).
   *
   * A field of its own rather than a second use of `note` below, because a
   * sheet often has to say both things at once and they are different claims.
   * `note` is what this printout *is* — an answer key — and it is set by
   * `SheetSpec.key` on a sheet that already carries a source; joining the two
   * into one string would make the key overwrite the credit, which is the one
   * of the pair we promised to print.
   *
   * Absent where the source asks for nothing. An 1885 poem needs no credit
   * line, and a sheet that printed one anyway would be noise on a child's page.
   */
  source?: string;
  /** Short, and pointing back at the game the sheet came from (§16). */
  url?: string;
  /** Printed small, so the same sheet can be had again next week (§7). */
  seed: number;
  /** What this printout is, where it is not simply the sheet: "Answer key". */
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
   * would otherwise write the same three lines, and the next one to be added
   * would be the one that forgot.
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

/**
 * The blank maths references: a hundred chart, a number line, a coordinate
 * grid, a place-value chart.
 *
 * The second family in the "templates" tier (§11) and the second one that is
 * geometry rather than generation — which is why it sits beside `PaperConfig`
 * rather than in `maths/`. Nothing here is drawn from a seed and nothing here
 * has a right answer to check, save the one that does: a hundred chart printed
 * blank is filled in, and the filled chart is its key.
 *
 * Every style-specific field is optional and every one of them is clamped to
 * what the paper holds, because all four arrive from the same places a saved
 * sheet does — a bookmarked link, a config written last term. They resolve in
 * two places rather than one: `hundredChart`, `lineStrips` and `placeChart` in
 * `templates/charts.ts` clamp their own fields through `whole()`, while `span`
 * and `quadrants` go to `planeOf` in `plane.ts`, which guards them itself so
 * that every sheet drawn on a plane — blank grid or geometry exercise — gets
 * the same answer to "how far do the axes run".
 */
export type ChartStyle =
  "hundred" | "number-line" | "coordinate" | "place-value";

export type ChartConfig = SheetOptions & {
  kind: "chart";
  style: ChartStyle;
  /**
   * The hundred chart's numbers, ends included.
   *
   * Both ends, rather than a count from one, because the two charts a parent
   * asks for are 1–100 and 0–99 and the argument between them is a real one:
   * a chart that starts at nought puts every multiple of ten at the end of its
   * own row, and a chart that starts at one puts them under each other in the
   * last column. Neither is wrong and a child is usually taught one of them.
   */
  range?: { min: number; max: number };
  /**
   * Whether the numbers are printed, or left for the child to write in.
   *
   * One switch and two sheets: the wall chart, and the exercise whose answer
   * key is the wall chart. The numbers are computed either way — which is what
   * makes the pair one build with `answers` flipped rather than two families.
   */
  filled?: boolean;
  /** The number line: how far apart one tick is from the next. */
  step?: number;
  /**
   * The number line: how many strips down the page, to cut apart.
   *
   * `strips` rather than the `count` every generating family carries, because
   * it is not the same question. A count is how many *problems* were asked for
   * and is the number a sheet is marked out of; this is how many copies of one
   * line are printed, and there is nothing on any of them to mark.
   */
  strips?: number;
  /** The coordinate grid: how far the axes run from nought. */
  span?: number;
  /** And whether it has negative numbers on it: four quadrants, or one. */
  quadrants?: number;
  /**
   * The place-value chart's columns, as powers of ten: 2 is hundreds, 0 is
   * ones, −2 is hundredths.
   *
   * The exponent rather than the name, because the exponent is what the chart
   * *is*: the columns are consecutive powers of ten, the decimal point goes
   * between 0 and −1 wherever both are present, and every name printed at the
   * head of a column is looked up from it. A pair of names would let a chart be
   * configured with tens beside thousandths.
   */
  places?: { largest: number; smallest: number };
  /** The place-value chart: how many rows there are to write numbers in. */
  rows?: number;
};

/* ── The paperwork ─────────────────────────────────────────────────────────
   The rest of the "templates" tier of §11: the forms, the week, and the paper
   that gets cut up. Four families, and the thing they have in common is the
   thing that makes them honest — **they are supposed to be empty.** Nothing on
   any of them is generated out of a subject we would be inventing, which is
   exactly the line §11's third tier draws: a reading log is a reading log
   whoever printed it, and "5th grade science worksheets" without an editor is
   plausible nonsense.

   Three things *are* worked out rather than left blank, and each is worked out
   because getting it wrong would be a sheet that lies:

     - a calendar's weekdays, which is arithmetic with a right answer,
     - a die's faces, which have to come out opposite in threes summing to
       seven when the net is folded,
     - a spinner's sectors, which are equal or the thing is not fair.

   Everything else on these four is a heading, a rule and a box.             */

/**
 * The forms a week of lessons is written on.
 *
 * One family and nine styles, for the reason the spelling family is one: none
 * of the nine changes what the sheet *is*. It is a set of headings with room to
 * answer under each, and which headings they are is the setting — so a book
 * report and a lab report are one block with two vocabularies rather than two
 * families that would each grow their own idea of how tall a line is.
 *
 * The science styles are the ones worth being careful about, and the care is
 * all in what they leave out. A lab report sheet is a *form*: it asks what the
 * question was and what happened, and it does not supply either. That is the
 * distinction §11's third tier turns on — the paperwork around a science
 * lesson is ours to print, and the science is not.
 */
export type FormStyle =
  | "reading-log"
  | "book-report"
  | "story-map"
  | "paragraph-frame"
  | "writing-prompt"
  | "lab-report"
  | "scientific-method"
  | "observation-journal"
  | "timeline";

export type FormConfig = SheetOptions & {
  kind: "form";
  style: FormStyle;
  /**
   * How many rows the two styles that are lists print — the reading log and the
   * timeline. Capped at what the page holds, like every other count.
   */
  rows?: number;
  /**
   * How much room each answer gets, as a multiplier on what the style asks for.
   *
   * One control rather than a height per field, because the fields are not
   * independent: a form is a page, and giving "What it is about" four more
   * lines has to take them from somewhere. So the style says the proportions
   * and this says how generous the whole sheet is — which is also the honest
   * way to offer "my child writes large".
   */
  space?: number;
  /**
   * The prompt on a writing-prompt sheet, where a parent has set their own.
   *
   * Absent draws one from the seed out of the bank in `templates/prompts.ts`,
   * which is what makes that style the one generated thing on this shelf and
   * why "another one like this" is `seed + 1` here as everywhere else (§7).
   */
  prompt?: string;
};

/**
 * The week, on a wall.
 *
 * A calendar, a planner, a chore chart, a behaviour chart and a verse of the
 * week — five things that are all a table with different headings, which is why
 * they are one family. The two charts differ only in their labels and their
 * title, and that is stated rather than hidden: "chore chart" and "behaviour
 * chart" are different queries, different sets of rows and the same paper, and
 * pretending otherwise would mean either two families or one page that answers
 * neither search.
 */
export type PlannerStyle =
  "calendar" | "week" | "chores" | "behaviour" | "verse-week";

export type PlannerConfig = SheetOptions & {
  kind: "planner";
  style: PlannerStyle;
  /**
   * Which month the calendar prints, as a full year and a month 1–12.
   *
   * **Both, or neither.** With neither the calendar is undated — seven columns
   * of empty squares under the weekday names, which is what "blank calendar"
   * means and is the version that does not go out of date. With both, the dates
   * are worked out (`monthGrid`), and that is the one piece of arithmetic on
   * this shelf with a right answer: a calendar whose first of the month is
   * under the wrong weekday is a sheet somebody plans a term around.
   */
  year?: number;
  month?: number;
  /** Whether the week is drawn starting on Sunday or on Monday. */
  weekStart?: "sunday" | "monday";
  /**
   * A parent's own headings: the jobs down a chore chart, the goals down a
   * behaviour chart — and, on a planner, the parts of the day *across* it.
   *
   * Rows on two of the styles and columns on the third, which is not an
   * inconsistency but the shape of the sheet: a week is seven days whatever the
   * columns are called, so a planner's fixed axis is its rows and the named one
   * runs the other way. The builder labels the control "Columns" there and
   * "Rows" on the charts for the same reason.
   *
   * Empty is a legitimate answer, always — a chart with blank row labels is one
   * to fill in by hand, which is what a family whose jobs change weekly
   * actually wants.
   */
  labels?: string[];
  /** How many rows, where the labels do not decide it. */
  rows?: number;
  /** The verse on a verse-of-the-week chart — a library id (§12). */
  passage?: string;
  translation?: TranslationId;
  /** Or the words somebody pasted, if they did not pick one. */
  text?: string;
};

/**
 * The paper that gets cut up.
 *
 * Five styles and one geometry. What they have in common is the only thing that
 * matters on this shelf: a stated size on paper, a grid of that size, and cut
 * guides on the boundaries. What they differ in is what is printed on a face,
 * which is a handful of strings.
 *
 * "Blank flashcards", "printable name tags" and "printable bookmarks" are three
 * of the plainest queries in this whole section and all three are the same
 * sheet with a different rectangle on it, which is exactly the case §8 says to
 * curate the slugs for and generate the sheets from.
 */
export type CardStyle =
  "flashcard" | "name-tag" | "bookmark" | "verse-card" | "certificate";

export type CardsConfig = SheetOptions & {
  kind: "cards";
  style: CardStyle;
  /**
   * How many cards to a page — the 2-up and 4-up of §17.
   *
   * A request, like every other count: each style declares the layouts it has
   * (`CARD_LAYOUTS`), because how many cards fit across is a fact about the
   * shape of the card and not something to be asked for freely — four bookmarks
   * to a page is four columns, and four flashcards is two by two.
   */
  up?: number;
  /**
   * What is written on the faces, one card each.
   *
   * Empty is the default and is not a lesser sheet: blank is what a flashcard
   * is for. A list shorter than the page holds fills the cards it can and
   * leaves the rest blank, which is what a parent with nine spellings and a
   * ten-up sheet should get.
   */
  words?: string[];
  /** The verse on a memory-verse card or a Scripture bookmark (§12). */
  passage?: string;
  translation?: TranslationId;
  text?: string;
  /**
   * Fold each card in half and print the top half upside down — a tent name
   * tag that stands on a desk and reads from both sides.
   */
  fold?: boolean;
  /** What a certificate is awarded for: "for finishing the times tables". */
  reason?: string;
};

/** Something to cut out and fold up, or cut out and spin. */
export type NetStyle = "dice" | "spinner";

export type NetConfig = SheetOptions & {
  kind: "net";
  style: NetStyle;
  /**
   * How many equal sectors a spinner is cut into.
   *
   * Equal is not negotiable and is not a setting: a spinner is a thing a child
   * is asked whether they think is fair, and one whose sectors were sized by
   * how long their labels are would teach the opposite of the answer.
   */
  sectors?: number;
  /**
   * What is written on the faces or in the sectors, in order.
   *
   * On a die, replacing the pips: six things to do, six sounds to say, six ways
   * to end a story. On a spinner, one per sector. Empty leaves a die with its
   * pips and a spinner with its numbers.
   */
  labels?: string[];
};

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
  /**
   * Named facts, in the vocabulary the race already uses ("7:8") — the whole
   * of "print exactly what they keep missing" (§14) on this family.
   *
   * When it has anything in it, it *is* the pool: `range` and `regrouping`
   * stop applying, because the facts are the constraint and a sheet that
   * dropped half of them for not carrying would not be the sheet that was
   * asked for. Absent or empty is a sheet drawn from the range as usual, which
   * is what a child with nothing in the record book gets.
   *
   * A pair is read the way `decks/flashcards.ts` builds it: added, the two
   * addends; subtracted, the number taken away and what is left. The record
   * book hands these over and the family turns them into problems, and neither
   * side learns the other's shape — see `Problem.factId`.
   */
  facts?: string[];
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
  /**
   * Named facts, in the vocabulary the race already uses ("7:8") — the whole
   * of "print exactly what they keep missing" (§14) on this family.
   *
   * When it has anything in it, it *is* the pool: `tables` and `factors` stop
   * deciding what is on the page, because a sheet of the eight facts a child
   * keeps missing is not a sheet of the eight times table. The pair reads the
   * way the deck builds it — the table that was picked, then what it was
   * paired with — so a division fact is its divisor and its answer, and
   * "56 ÷ 7" and "56 ÷ 8" stay the two questions the drill keeps apart.
   *
   * Ignored by the grid and the long forms, which have no facts to name: a
   * multiplication square is every fact there is, and a three-digit long
   * division is not one of the twelve tables at all.
   */
  facts?: string[];
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

/* ── Words ─────────────────────────────────────────────────────────────────
   The first family whose content is not generated at all. Every sheet above
   this line is drawn from a range or a pool the engine owns; a spelling sheet
   is a list somebody else wrote — this week's words off a school letter, a
   deck a parent typed in, or the words a child kept missing in the jungle —
   and the only judgements left are how they are set on the page.

   Which is why the list travels in the config rather than being named by an
   id: a sheet has to print the same words next term after the deck it came
   from has been deleted, exactly as a saved run outlives its deck. It is also
   what keeps the shared-link promise intact — a word list is what a parent
   typed, never anything the site knows about their child (§1).             */

/**
 * What the sheet asks a child to do with the list.
 *
 * Seven exercises over one list, which is the whole reason this is a union
 * rather than seven families: none of them changes what the sheet is *about*,
 * so a parent who has typed in this week's words gets all seven from the one
 * control beside them.
 *
 * `copy` is "write it three times", the oldest spelling exercise there is;
 * `missing` takes letters out and leaves the gaps to fill; `test` prints
 * numbered lines and nothing else, for a list read aloud; `abc` prints the list
 * as it was given and asks for it back in alphabetical order; `shapes` draws
 * each word as the outline its letters make; `sentence` asks for the word used
 * in one; `find` prints the word among the words it is most easily confused
 * with, which is the same judgement the race's "spot it" round makes.
 */
export type WordSheetStyle =
  "copy" | "missing" | "test" | "abc" | "shapes" | "sentence" | "find";

export type WordsConfig = SheetOptions & {
  kind: "words";
  style: WordSheetStyle;
  /**
   * The list, in the order it was given: a spelling list is often taught in
   * order, and `parseWords` already keeps it.
   *
   * There is no name for the list here on purpose. A config travels in a URL
   * (§14), and the one thing that must never be in one is a child — so the
   * sheet is titled after what it does, and a parent who wants their own words
   * at the top of the page types them into `title` themselves.
   */
  words: string[];
  /**
   * How many ruled lines each word gets: the times it is written out on a
   * `copy` sheet, and the lines left to write a sentence on for `sentence`.
   *
   * One field because it is one measurement — the rules under a word — and the
   * capacity arithmetic multiplies it by `answerLine` either way. Two names for
   * the same number would be two things a saved config could disagree about.
   */
  times: number;
  /** `missing` only: how many letters are taken out of each word. */
  gaps: number;
  /** How many words to ask for. Capped at what the page holds. */
  count: number;
  /**
   * How many words across the page.
   *
   * Ignored by the two styles that are a list down it: a gapped word and a word
   * printed among its own near misses are each a line of their own, whatever a
   * saved config says — see `wordsLayout`.
   */
  columns: number;
};

/* ── Word study ────────────────────────────────────────────────────────────
   The other half of the words shelf, and the mirror image of the family above:
   there the content is a parent's and the exercise is ours, here the exercise
   is a parent's and the *content* is ours. Ten topics somebody teaches in a
   week each — rhyming, syllables, word families, prefixes and suffixes,
   plurals, contractions, homophones, synonyms and antonyms — and none of them
   is generatable from a rule, because English is not. A plural is `-s` until it
   is `-es`, `-ies`, `-ves` or `children`, and a generator that reached for the
   rule would print `mouses` in an answer key.

   So the words are authored, in `words/bank.ts`, and this config only says
   which topic and which of the three shapes of question to ask it in. What that
   buys is the thing §11 asks for: every answer here is one somebody wrote down
   on purpose, and the key is right because a person checked it rather than
   because arithmetic can't be wrong.                                        */

/**
 * Which lesson the sheet is about.
 *
 * One topic to a sheet, never a mix. A page of rhyming and contractions
 * together is not a harder sheet, it is a sheet nobody set: these are separate
 * weeks in every scheme there is, and the instruction line can only say one
 * thing.
 */
export type WordStudyTopic =
  | "rhyming"
  | "syllables"
  | "families"
  | "prefixes"
  | "suffixes"
  | "plurals"
  | "contractions"
  | "homophones"
  | "synonyms"
  | "antonyms";

/**
 * How the question is put.
 *
 * `write` gives the prompt and a ruled slot; `choose` gives four options with
 * the near misses drawn from the same topic; `match` is two columns to join with
 * a pencil. Every topic states which of the three it can honestly be asked in
 * (`STUDY_TOPICS`), because they are not interchangeable — "write a word that
 * rhymes with cat" has a hundred right answers and no key, and matching a word
 * to a syllable count is a column of four numbers repeated down the page.
 */
export type WordStudyStyle = "write" | "choose" | "match";

export type WordStudyConfig = SheetOptions & {
  kind: "word-study";
  topic: WordStudyTopic;
  /**
   * Resolved against what the topic supports rather than trusted: a style
   * saved in March must still print in June if the topic has since dropped it,
   * for the same reason `sheetSpec` never throws.
   */
  style: WordStudyStyle;
  /** How many questions to ask for. Capped at what the page holds. */
  count: number;
  /** `write` only — a choice and a matching column are the width of the page. */
  columns: number;
};

/* ── Puzzles ───────────────────────────────────────────────────────────────
   The third of the words shelf, and the one where a sheet can look completely
   right and be completely wrong. A page of sums is checked by doing the sums;
   a word search is checked by *reading the paper*, which nobody does, so a word
   that failed to place looks exactly like a word that placed well. The whole
   design of this family is arranged around that one failure:

   - Nothing on the page is trusted to the generator's own bookkeeping. The key
     to a word search is found by searching the finished grid, and a crossword's
     entries are read out of the finished squares. If the letters on the paper
     say something different from what the placer intended, the paper wins.
   - A word that could not be placed is **named on the sheet**. Not logged, not
     dropped — printed, under the puzzle, where the person marking it will see
     it.
   - Everything terminates. There is no "shuffle and try again until it works"
     anywhere in here: a candidate position is tried at most once, so a list of
     twenty words that cannot possibly fit produces a sheet rather than a hung
     tab (`puzzles.test.ts` is what holds it to that).                       */

/**
 * Which puzzle.
 *
 * `search` is a letter grid with the words hidden in it; `crossword` is the
 * numbered squares, clued from the list's own sentences where it has them; and
 * `scramble` is the letters of a word out of order, which is the one of the
 * three that is a plain list of problems and needs no grid at all.
 */
export type PuzzleStyle = "search" | "crossword" | "scramble";

/**
 * Which ways a word may run in a word-search grid.
 *
 * A stated set rather than a count, because the three are not degrees of
 * difficulty so much as three different exercises: `across` is a reading
 * exercise a five-year-old can do, `across-down` is the usual school puzzle,
 * and `all` adds the two diagonals, which is where a word search stops being
 * about reading and starts being about scanning. `reverse` is separate for the
 * same reason — a backwards word is a different kind of hard from a diagonal
 * one, and a parent setting one of them is not asking for the other.
 */
export type SearchDirections = "across" | "across-down" | "all";

export type PuzzleConfig = SheetOptions & {
  kind: "puzzle";
  style: PuzzleStyle;
  /**
   * The list, in the order it was given — the same field `WordsConfig` carries,
   * and for the same reasons: there is no name for it here, because a config
   * travels in a URL and a child must never be in one (§14).
   */
  words: string[];
  /**
   * How many cells across and down. Square, and a request rather than a
   * promise: a grid that would not fit the paper with its word list under it is
   * shrunk until it does (`searchLayout`).
   *
   * The crossword reads it too, as the largest grid it may lay words out in.
   * The finished puzzle is cropped to the words that actually landed, so this
   * is a bound rather than a size — but it is the same question asked of the
   * same paper, and two fields for it would be two things a saved config could
   * disagree about.
   */
  size: number;
  /** `search` only. */
  directions: SearchDirections;
  /** `search` only: words may be written backwards. */
  reverse: boolean;
  /**
   * `search` only: words may cross, sharing a letter where they meet.
   *
   * Off makes a sparser, easier grid and a harder placement problem — every
   * word needs a clear run of its own — so this is the setting most likely to
   * leave a word unplaced, which is exactly why the sheet says when it has.
   */
  overlap: boolean;
  /** How many words to use. Capped at what the page holds. */
  count: number;
  /** `scramble` only — a grid and a clue list are the width of the page. */
  columns: number;
};

/* ── Grammar ───────────────────────────────────────────────────────────────
   The third bank-backed family, and the one where being wrong costs the most.
   A page of sums is right or wrong and nobody argues; a page of grammar can be
   *defensibly* answered two ways, and a sheet that marks the second way wrong
   has taught a child something false. So nothing here parses English. Every
   sentence is written down once and tagged in `grammar/bank.ts` — what it is
   for, where it divides, which one word can be named without argument, which
   word needs its capital back — and the five topics below are five views of
   those tags rather than five analyses.

   Which is also why there is no `match` style, unlike word study: four kinds of
   sentence over twelve rows is a matching column with three right answers on
   every line.                                                               */

/**
 * Which lesson the sheet is about.
 *
 * The five §11 names, and each is one topic rather than several because they
 * are one week's teaching each: the parts of speech, the two halves of a
 * sentence, what a sentence is *for*, the mark it ends on, and the word inside
 * it that takes a capital.
 */
export type GrammarTopic =
  "parts" | "subject" | "types" | "punctuation" | "capitals";

/**
 * How the question is put.
 *
 * `write` gives the sentence and a ruled place to answer; `choose` gives the
 * sentence and the fixed set of names to circle one of. Both sets are a scale
 * rather than a draw of near misses — there are five parts of speech and four
 * kinds of sentence, and those are the options on every line — so unlike word
 * study a `choose` sheet here never has to be checked for a second right
 * answer among its distractors: the options are the whole vocabulary.
 *
 * A topic states which of the two it can honestly be asked in (`GRAMMAR_TOPICS`
 * / `grammarStyles`). Three of them are `write` only, because the answer is a
 * mark, a word out of the sentence, or the sentence itself cut in half — and
 * none of those is a list of options.
 */
export type GrammarStyle = "write" | "choose";

export type GrammarConfig = SheetOptions & {
  kind: "grammar";
  topic: GrammarTopic;
  /**
   * Resolved against what the topic supports rather than trusted, exactly as
   * `WordStudyConfig.style` is: a saved sheet outlives the table it was made
   * from, for the same reason `sheetSpec` never throws.
   */
  style: GrammarStyle;
  /** How many sentences to ask about. Capped at what the page holds. */
  count: number;
  /**
   * How many across. A sentence is a long thing to print, so this caps lower
   * than the maths families do — and the subject-and-predicate sheet ignores it
   * entirely, because its answer is two ruled lines the width of the column.
   */
  columns: number;
};

/* ── Handwriting ───────────────────────────────────────────────────────────
   The family where the ruling stops being the paper and becomes the exercise.
   Every sheet above this line could be printed a thousandth of an inch out and
   nobody would know; here the child is being taught to write between two lines,
   so a ⅝ rule that is not ⅝ of an inch teaches the wrong size of letter — and
   the model they trace has to stand on the baseline and reach the top line in
   whichever face the sheet is set in (`faces.ts`).                          */

/**
 * What is written on the sheet.
 *
 * `letters` and `numbers` are the two sets the engine owns outright — the
 * alphabet and the numerals, in the order they are taught. The other two are
 * content somebody else wrote, and they differ only in how much of it goes on
 * one line: a word is written several times *across* a row, and a line of a
 * passage fills the row, so its repeats run *down* the page instead.
 *
 * A sentence is a passage of one line. It is not a style of its own because it
 * would be the same function with the same arguments — what makes a sentence
 * sheet a sentence sheet is how many lines are left under it, which is
 * `repeats`.
 *
 * `joins` is a style of its own, and it is the one that *is* a different set
 * rather than a different shape of one: two letters written together are not
 * two letters, because in a joined hand the stroke between them is a third
 * thing with a name and a lesson of its own. It is also the only style that
 * makes no sense in a print face — see `cursiveOf` in `faces.ts`.
 */
export type HandwritingStyle =
  "letters" | "numbers" | "joins" | "words" | "passage";

/**
 * Which joins a joins sheet practises, in the order they are taught.
 *
 * The four classic joins are named for where the exit stroke leaves the first
 * letter and how tall the second one is: a *diagonal* join climbs from the
 * baseline, a *horizontal* one carries across from the x-height, and a tall
 * second letter changes where the stroke has to arrive. `round` is the fifth
 * thing every scheme teaches separately — the letters written anticlockwise
 * (`a c d g o q`) are entered at the top rather than joined into at the
 * baseline, and a child who joins into them the ordinary way writes `oi` for
 * `oa`.
 *
 * `breaks` is not a join at all: the pairs where a model may lift the pencil.
 * It is a group here because *whether* it lifts is the model's business and not
 * ours — the looped and British hands join out of every letter, the unlooped
 * one stops after `b f g j p q s y` — so the sheet prints the pair and the face
 * answers the question (`writing/joins.ts`).
 */
export type JoinFamily =
  | "diagonal"
  | "diagonal-tall"
  | "horizontal"
  | "horizontal-tall"
  | "round"
  | "breaks";

/**
 * Which alphabet a letter sheet writes.
 *
 * `both` writes each letter as a pair — `A` then `a`, `B` then `b` — rather
 * than the capitals and then the small letters, because the pair is what a
 * child is taught as one letter.
 */
export type LetterCase = "upper" | "lower" | "both";

export type HandwritingConfig = SheetOptions & {
  kind: "handwriting";
  style: HandwritingStyle;
  /**
   * The paper it is written on — any ruling in §5, and the whole of what makes
   * this family physical. Blank paper is the one that cannot work: a
   * handwriting sheet is rows of a repeating ruling, and a ruling with no pitch
   * has no rows. See `ruleOf` for what it resolves to instead.
   */
  rule: Rule;
  /**
   * How a model is drawn — any style in §6. `none` is a sheet with nothing to
   * trace, which is a real sheet: the model is the solid one at the start of
   * the row and the rest is the child's own writing.
   */
  trace: TraceStyle;
  /**
   * How many times each thing is written, the model and the empty space
   * included.
   *
   * Across the row for letters, numbers and words; down the page for a
   * passage, whose lines are too wide to sit beside each other.
   */
  repeats: number;
  /**
   * Trace → copy → write: the first is a solid model and the last is left
   * empty, with everything between drawn in `trace`.
   *
   * On unless turned off, because it is what the whole sheet is for — one page
   * that carries a child from a letter they follow to a letter they make. Off
   * is every repeat drawn the same way, which is the sheet for a child who is
   * still tracing and not yet ready to be left on their own.
   */
  progression?: boolean;
  /** `letters` only. Absent is both cases, which is how letters are taught. */
  letters?: LetterCase;
  /**
   * `joins` only: which family of joins to practise.
   *
   * Absent is all of them in teaching order, which is the sheet a parent means
   * by "cursive joins" — the whole progression on one page, the way the letters
   * sheet is the whole alphabet on one page.
   */
  joins?: JoinFamily;
  /**
   * `words` only: the list, in the order it was given.
   *
   * There is no name for it here for the reason `WordsConfig.words` gives — a
   * config travels in a URL, and the one thing that must never be in one is a
   * child (§1).
   */
  words?: string[];
  /**
   * `passage` only: what is copied, as it should read on the page.
   *
   * Wrapped to the ruling by the family rather than by the renderer, because
   * there is no DOM to measure in (§4) — a newline here is a line break the
   * author asked for, and everything else breaks where the paper runs out.
   *
   * What a parent typed or pasted. `passage` below is the other door, and it
   * wins where both are set — see `copyworkSource`.
   */
  text?: string;
  /**
   * `passage` only: one of the library's passages, by id — Psalm 23, the
   * Gettysburg Address, a fable (`engine/sheets/passages`).
   *
   * An id rather than the words, which is what makes a copywork sheet fit in a
   * link (§14): "psalm-23" is nine characters where the psalm is seven hundred,
   * and the sheet built from it carries the provenance the library holds rather
   * than a quotation with no source attached. A passage this build has never
   * heard of falls back to `text`, for the same reason `sheetSpec` never throws
   * — a bookmark outlives the library it was made on.
   */
  passage?: string;
  /**
   * Which translation a Scripture passage is read in. Ignored by everything
   * else in the library, which has only the one text.
   */
  translation?: TranslationId;
};

/* ── Memory work ───────────────────────────────────────────────────────────
   The one family whose exercise is what is *missing* from the page. Every
   other sheet in the shop either generates its content or prints somebody's
   words as they stand; this one prints them and then takes them away a few at
   a time, which is how a verse is learnt by heart and is also the one thing
   §12's licence condition has something to say about — so the sheet says
   plainly that words are left out on purpose, and the answer key is the whole
   passage.                                                                  */

/**
 * A passage written out several times, with more of it missing each time.
 *
 * The oldest memory-work exercise there is, and it is one dial: how many times
 * the passage is written. The first round is the whole thing to read, the last
 * has every word gone, and the ones between take out a share of the words that
 * grows evenly — so a sheet is a progression rather than a difficulty setting,
 * exactly as a handwriting sheet is.
 *
 * Which words go is decided by the seed and nothing else, and the sets nest:
 * a word missing in round two is missing in round three. A round that gave a
 * word back would read as a mistake in the printing.
 *
 * The text comes from the library or from a paste, the same two doors a
 * copywork sheet has, and by exactly the same fields — see `copyworkSource`,
 * which is the one place either is read.
 */
export type MemoryConfig = SheetOptions & {
  kind: "memory";
  /** A passage from the library, by id. */
  passage?: string;
  /** Which translation a Scripture passage is read in. */
  translation?: TranslationId;
  /** What a parent typed or pasted. `passage` wins where both are set. */
  text?: string;
  /**
   * How many times the passage is written out, the whole one at the top and
   * the empty one at the bottom included. Capped at what the page holds.
   */
  rounds: number;
};

/* ── Phonics ───────────────────────────────────────────────────────────────
   The family whose content is decided by something the parent states rather
   than by a range or a list: a sound inventory, which is the set of spellings
   their child has been taught (`engine/sheets/phonics/`, §13). Everything on
   every one of these sheets is spellable from it, which is the one promise the
   family makes and the reason it exists rather than a word list.

   The inventory travels *in the config*, as a value, rather than as an id
   pointing at the store `services/phonics.ts` keeps. That is what lets a sheet
   somebody configured survive being sent to a family who has never heard of
   this household's list — and it is why a config carrying a two-hundred-word
   sight list can outgrow the share cap in `share.ts` and simply not decode,
   which is the same "fall back to defaults rather than throw" §14 asks for. */

/**
 * What the sheet asks for.
 *
 * Seven, and each of them is a thing somebody sets on a Tuesday morning:
 * `cards` are the spellings to cut out, `chart` is the same set as one page for
 * the wall, `blending` prints a word cut into its sounds to be said slowly and
 * then quickly, `families` adds a beginning to an ending, `matching` joins a
 * spelling to a word it is in, `dictation` is ruled lines for words read aloud,
 * and `sentences` are strips of connected text with nothing in them a child has
 * not been taught.
 *
 * One family rather than seven, for the reason the spelling family is one: none
 * of the seven changes what the sheet is *about*. It is about the sounds this
 * child knows, and a parent who has ticked those gets all seven from the
 * control beside the list.
 */
export type PhonicsStyle =
  | "cards"
  | "chart"
  | "blending"
  | "families"
  | "matching"
  | "dictation"
  | "sentences";

/**
 * The three typographic conventions, as three independent switches.
 *
 * Switches rather than a named preset, and that is the whole design (§13):
 * marking a long vowel with a bar, a silent letter with a lighter weight and a
 * digraph with a join are shared across many phonics traditions and belong to
 * none of them, but a particular *combination* of them under a programme's name
 * is that programme's modified alphabet. So there are three booleans, no
 * shipped set of them is named after anything, and every mark is derived from
 * the table of spellings rather than authored (`phonics/cards.ts`).
 *
 * All three off is the default, and is not a lesser sheet: most schemes print
 * plain text and mark on the whiteboard.
 */
export type PhonicsMarking = {
  /** A bar over a single vowel letter that says its own name — `cāke`. */
  macron?: boolean;
  /** Letters that say nothing, set pale — the `e` of `cake`, the `w` of `two`. */
  silent?: boolean;
  /** Two letters saying one sound, joined underneath — `sh`, `ck`, `igh`. */
  joined?: boolean;
};

export type PhonicsConfig = SheetOptions & {
  kind: "phonics";
  style: PhonicsStyle;
  /**
   * What this child has been taught. Everything on the page comes out of it.
   *
   * Read through `readInventory` before it is used, exactly as a word list is
   * read through `wordsOf`: it arrives from a saved sheet, from a link somebody
   * was sent, or from a record written by a build that taught a spelling this
   * one has retired.
   */
  inventory: Inventory;
  /**
   * Only words using this spelling — "this week we're doing `sh`".
   *
   * A correspondence id, and a sheet about a spelling the parent has not ticked
   * comes back empty rather than quietly widening: see `WordPick.focus`, which
   * is where that argument is made.
   */
  focus?: string;
  /**
   * At most this many *sounds* in a word — what makes a CVC sheet a CVC sheet.
   *
   * Counted in sounds rather than in letters, which is the same distinction the
   * rest of the model turns on: `box` is three letters and four sounds, `ship`
   * is four letters and three. A child who has just learned to hold three
   * sounds in their head meets a fourth and stalls at the thing they were doing
   * correctly, and "short word" is not a length in characters.
   *
   * Absent on most sheets, and that is the honest default — once blending is
   * working, the length of the word is no longer the exercise. See
   * `WordPick.maxSounds`, which is where the filter lives.
   */
  maxSounds?: number;
  marking: PhonicsMarking;
  /** How many cards, lines, pairs or strips. Capped at what the page holds. */
  count: number;
  /** How many across the page. */
  columns: number;
};

/**
 * Anything a saved sheet can hold. Narrow on `kind` — and only in index.ts,
 * which is the one module that knows the whole union.
 */
export type SheetConfig =
  | BlankConfig
  | PaperConfig
  | ChartConfig
  | FormConfig
  | PlannerConfig
  | CardsConfig
  | NetConfig
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
  | WordProblemConfig
  | WordsConfig
  | WordStudyConfig
  | PuzzleConfig
  | GrammarConfig
  | HandwritingConfig
  | MemoryConfig
  | PhonicsConfig;

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
