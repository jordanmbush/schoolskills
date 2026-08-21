/**
 * A worksheet, as plain data (§3).
 *
 * Two invariants shape everything below. Nothing here measures anything —
 * every length arrives resolved, which is what lets one build run in a unit
 * test, in a build-time catalog page and in the live builder. And the answers
 * are on the sheet from the moment it is built, so a key is `answers: true`
 * and nothing else and cannot disagree with the sheet it belongs to.
 */
import type { Inventory } from "./phonics/inventory";
import type { TranslationId } from "./passages/types";

/* ── Units ─────────────────────────────────────────────────────────────── */

/** A length on a sheet: thousandths of an inch, always a whole number (§4). */
export type Mil = number;

/* ── Paper ─────────────────────────────────────────────────────────────── */

export type PaperSize = "letter" | "a4" | "legal";

export type Orientation = "portrait" | "landscape";

/**
 * Named rather than free numbers, so a test can walk every margin a parent can
 * choose and check the capacity arithmetic in layout.ts holds at each.
 */
export type MarginSize = "none" | "narrow" | "normal" | "wide";

export type Paper = {
  size: PaperSize;
  orientation: Orientation;
  margin: MarginSize;
};

/* ── Ruling ────────────────────────────────────────────────────────────── */

/** The rulings of §5, as ids. The geometry behind each is in paper.ts. */
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
  /** Graph, dot and isometric only. Defaults per `GRID_PITCHES` in paper.ts. */
  pitch?: Mil;
};

/* ── Blocks ────────────────────────────────────────────────────────────── */

/**
 * How a letterform is drawn on a tracing row (§6). `none` is the empty space
 * at the end of a trace → copy → write row, where the child is on their own.
 */
export type TraceStyle =
  "solid" | "dim" | "hollow" | "dotted" | "dashed" | "none";

/** A line to count along, under a problem — or, on its own, the whole sheet. */
export type NumberLine = {
  from: number;
  to: number;
  step: number;
  width: Mil;
  /**
   * A number under every `label`th tick, the rest left bare. Absent labels
   * every tick, which is what a line under a sum does; a reference line thins
   * them out to what fits, per `labelEvery` in numberline.ts.
   */
  label?: number;
};

/**
 * A whole cut into equal parts, some of them shaded. How big it is drawn is
 * deliberately not here: `fractionart.ts` is the one place those sizes are
 * written down.
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
   * A single `_` marks a gap inside the sentence — "7 + _ = 15" — the same
   * convention `Blank.text` uses; a prompt with no gap gets a ruled slot on the
   * end instead. Every problem has exactly one place to write the answer, and
   * that rule is what decides between the two. Empty in column form.
   */
  prompt: string;
  /** Text even when it's a number — "56", not 56, as `Card.answer` is. */
  answer: string;
  /**
   * The answer as more than one thing to write, one ruled line each — a fact
   * family's four number sentences.
   *
   * When it is here it *is* the answer place: the prompt prints no slot, and
   * `workspace` becomes the height those lines share. One slot instead would
   * hold one sentence on the sheet and four on the key, and text that wraps is
   * a row taller than the layout reserved — which is the last row of the page
   * printed on a second sheet. `answer` is the same list joined onto one line,
   * built from the same array, so the two cannot disagree.
   */
  answers?: string[];
  /**
   * Column form: the numbers stacked, right-aligned, `operator` against the
   * last of them and a rule under the lot. There is no second field saying
   * which form a problem is in — a renderer stacks exactly when there is a
   * stack to draw, and a flag beside the data can disagree with it.
   */
  operands?: string[];
  /** The sign printed beside the stack: "+", "−" or "×". Column form only. */
  operator?: string;
  /**
   * The partial products of a long multiplication, one ruled line each, between
   * the stack and its answer.
   *
   * The partials themselves rather than a count of them, because a long
   * multiplication is marked on its working as much as on its total: they are
   * blank on the sheet and written in on the key, like every other answer
   * place. Column form only, and absent for a single-digit multiplier — there
   * are no partials, and blank rules would ask for working that does not
   * exist. `workspace` is the height the lines share, as it is for `answers`.
   */
  working?: string[];
  /**
   * Long division's tableau: the divisor outside the bracket, the dividend
   * under the bar, the quotient along the top.
   *
   * Not a stack with a different sign — it is the one arithmetic form whose
   * working happens under the dividend and whose answer is written above the
   * problem. `answer` is the quotient, remainder and all ("234 r 2").
   */
  bracket?: { divisor: string; dividend: string };
  /**
   * Which fact this exercises, in the vocabulary the race already uses ("7:8")
   * — what lets the record book hand over fact ids and a family turn them into
   * problems without either side learning the other's shape (§14).
   */
  factId?: string;
  /**
   * A fraction diagram beside the problem. On a naming sheet it *is* the
   * question, so it prints on the blank sheet as well as on the key.
   */
  art?: FractionArt;
  /**
   * A clock face beside the problem — and, where it has no hands on it, the
   * place the answer goes.
   *
   * `ClockFace.hands` decides which, rather than a flag beside it, so the two
   * cannot disagree: a dial with hands is a question and takes a slot like any
   * other, a dial without them is the answer place and takes none. One place to
   * write the answer, as everywhere else here.
   */
  clock?: ClockFace;
  /**
   * The figure whose area, perimeter, name or angle is being asked for. The
   * question, always — never the answer — so it prints on the sheet as well as
   * on the key.
   */
  figure?: Figure;
  line?: NumberLine;
  /** Blank height under the problem for working out. Absent means none. */
  workspace?: Mil;
};

/**
 * How tall one letter stands: `tall` reaches the top line, `small` stops at the
 * midline, `tail` drops below the baseline. `bed` is tall-small-tall and `pig`
 * is tail-small-tail, and telling those outlines apart without reading them is
 * what the exercise trains.
 *
 * Punctuation counts as `small` — an apostrophe has no body, and a box at any
 * other height is a shape a child cannot match. A space is `gap` and is the one
 * value that is not a box at all: it still takes its slot, so the boxes either
 * side land where they would have, but nothing is drawn for it.
 */
export type LetterShape = "tall" | "small" | "tail" | "gap";

/**
 * One word as a row of boxes, plus the word they were drawn from — because the
 * word is the answer: the boxes print empty and the key writes into them.
 */
export type WordShape = { word: string; letters: LetterShape[] };

/** One place on a tracing row: what is written there, and how it is drawn. */
export type TraceCell = { text: string; style: TraceStyle };

export type TraceRow = {
  /**
   * The cells across one row, left to right: `A` in `["solid", "dotted",
   * "dotted", "none"]` is one letter's trace → copy → write progression.
   *
   * The text is per cell rather than per row so a row can hold several of those
   * groups — otherwise the letters family would have to choose between a
   * legible rule size and the second half of the alphabet.
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
   * Absent on every grid a child measures against, because a square that is not
   * square is a grid that lies about its own geometry. It exists for the one
   * chart whose columns are a *heading* rather than a unit: a place-value
   * chart's columns are as wide as the word "Hundreds" and its rows are one
   * digit tall. A renderer reads `row ?? cell`, so every other grid is square
   * by construction rather than by remembering.
   */
  row?: Mil;
  /** What's printed in the squares, row-major. Empty for a blank grid. */
  cells?: string[];
  /**
   * What's printed in the squares only on a key, row-major and alongside
   * `cells` rather than instead of it — a multiplication square's headers are
   * on the sheet from the start and its products are the answer. Two lists
   * rather than one flag, because which of the two a cell is has to be a fact
   * about the cell.
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
   * What the *ruling* runs to and what the *plane* runs to are two different
   * numbers: a first-quadrant plane keeps a square of margin outside its axes
   * for the numerals, and a gridline in that margin is one past nought rather
   * than the first negative one. Without this a renderer prints "-1" on a sheet
   * whose whole promise is that a child who has not met negatives can do it.
   */
  axis?: { min: number; max: number };
  /**
   * Points marked where the ruling crosses rather than inside the squares — a
   * separate list from `cells` because it is a different place on the paper. A
   * plane whose points were written in the squares has every answer half a
   * square out, which looks fine on screen and is marked wrong on paper.
   */
  marks?: GridMark[];
};

/**
 * A dot at the corner of a square, with a letter beside it. Counted in squares
 * from the top-left as `origin` is, so a reader can work out a mark's
 * coordinates from the block alone.
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
 * A shape to measure, name or classify. The points are the whole of it, and
 * `shape` only says what sort of ink they take: a closed outline, a circle from
 * a centre and a point on it, or the two open arms of an angle. `figure.ts`
 * makes one, and says why a rectangle is drawn in proportion and an angle true.
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
 * "Read out of", not "written into". A key that is the generator's own
 * placement record agrees with the generator rather than with the paper, and is
 * wrong in exactly the case where a later word overwrote a letter — so it is
 * derived by searching the finished grid (`findWord`), and this is what that
 * search returns.
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
 * One square of a crossword. `null` in the grid is a blocked square.
 *
 * The letter is on the square whether or not the sheet is a key — it is what
 * the square *is*, and `Sheet.answers` decides whether it is printed.
 */
export type CrosswordCell = {
  letter: string;
  /** The small number in the corner, where an entry starts on this square. */
  number?: number;
};

/**
 * One clue and the entry it belongs to. `column` and `row` are where the answer
 * starts, so a test can hold the clue list against the grid letter for letter —
 * the same independence `Found` buys the word search, and what makes "the
 * crossings agree" checkable rather than promised.
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
 * the `a` of `cake` while its `e` is another — because that is the unit the
 * phonics family is built on (`phonics/sounds.ts`). A piece carries at most one
 * mark; `phonics/cards.ts` is where the three are shown not to collide.
 */
export type MarkedPart = {
  text: string;
  mark?: "macron" | "silent" | "joined";
};

/** A word, or a whole sentence, cut into those pieces. */
export type MarkedWord = MarkedPart[];

/**
 * One card: a big line, and a smaller one under it. There is no `kind` here
 * because a card is a shape — the three sheets made of these differ only in
 * what goes on the two lines, and the family that filled one knows what it is.
 */
export type SoundCard = {
  big: MarkedWord;
  /** The example word under a spelling. Absent on a sentence strip. */
  small?: MarkedWord;
};

/**
 * One labelled place on a form: a heading, and room to answer under it (§11).
 *
 * `space` is stated rather than derived from `lines` because a field with no
 * lines is one a child draws in, and a drawing box has a height that has
 * nothing to do with writing. Where there are lines, the family sets `space` to
 * `lines × answerLine(fontPt)`, so a line on a form is the same height as a
 * line anywhere else in the shop.
 */
export type FormField = {
  /** "What I predicted", "Beginning". */
  label: string;
  /**
   * Places to write, which is one more than the rules drawn inside the box —
   * the last line is written on the box's own bottom edge. Zero is a blank box:
   * somewhere to draw rather than write.
   */
  lines: number;
  space: Mil;
  /** Declared rather than left to a CSS grid, as every other length here is. */
  width: Mil;
  /** How many of the form's columns it takes. */
  span: number;
};

/**
 * One column of a table. Widths in mil rather than shares of the page: a
 * reading log's "Minutes" column is three numerals wide and its "Book" column
 * is a title wide, and dividing the page evenly prints one too narrow to use
 * and the other mostly empty.
 */
export type TableColumn = { label: string; width: Mil };

/**
 * One cell of a table. Two places rather than one because a calendar needs both
 * at once: the date sits small in the corner so the square stays empty for
 * whatever is written in it, while a chore chart's row label is ordinary text.
 */
export type TableCell = {
  /** Set on the cell's own baseline, left-aligned. A row label, a day name. */
  text?: string;
  /** Set small in the top-left corner. A calendar's date. */
  corner?: string;
};

/**
 * One card face. Every field is optional, and a face with none of them is a
 * blank card — the commonest thing on this shelf rather than a degenerate case.
 */
export type CardFace = {
  /** Small, above the big line — "Hello, my name is", "This certifies that". */
  eyebrow?: string;
  /** The word, the verse reference, what the award is for. */
  heading?: string;
  /** The verse itself, a quotation. */
  body?: string;
  /**
   * A rule to write on with its purpose set small *underneath* — the shape a
   * certificate is written in, so the label does not crowd the writing.
   */
  fields?: string[];
  /** Rules to write on with nothing said about them. */
  lines?: number;
};

/**
 * One face of a cube net. `pips` is a count rather than a numeral because a die
 * has spots, and a child learning to subitise reads a pattern rather than a
 * number. Zero pips with a `label` is the same net used as a word die.
 */
export type NetFace = { pips: number; label?: string };

/** Which edge of a face a glue tab hangs off. */
export type NetEdge = "top" | "right" | "bottom" | "left";

/**
 * A tab to glue under the face it meets when the net is folded up. On the net
 * rather than left to the renderer, because which edges get one is a fact about
 * the folding: two tabs on a join is a lump that stops the cube closing and
 * none is a hole, and both are invisible until somebody has cut it out (§11).
 */
export type NetTab = { face: number; edge: NetEdge };

/**
 * Something to cut out and fold, or cut out and spin. One block because the ink
 * says where the scissors go on both: a sixteenth of an inch out is a cube that
 * will not close or a spinner that is not fair.
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
       * One label per sector, clockwise from twelve. There are no angles here:
       * the renderer divides a whole turn by `sectors.length`, so a longer word
       * cannot buy itself a wider slice (§11).
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
       * non-letters stripped. A grid has nowhere to put the apostrophe in
       * "don't", so the list says `DONT`: what is printed under the puzzle is
       * what is findable in it.
       */
      find: string[];
      /** Where each word was found, for the key. Derived from `letters`. */
      solution?: Found[];
      /**
       * Words the grid could not hold, printed on the sheet rather than quietly
       * dropped.
       *
       * A word that failed to place and vanished is the classic silent bug
       * here: the child hunts for something that is not there and the key is
       * wrong about a word it never mentions. Such a word is off the `find`
       * list and named here instead — as many as the line has room for, the
       * rest counted in `omittedMore`.
       */
      omitted?: string[];
      /**
       * How many more there were than the page could name. Only ever reached by
       * a config at the far end, where naming them all would be a page with no
       * puzzle left on it.
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
   * Not a `problems` item with a drawing on it, because the boxes *are* the
   * answer place — and a problem may have exactly one of those, so a row of
   * eight boxes with a ruled slot on the end is a sheet a child answers twice.
   */
  | { kind: "wordshapes"; columns: number; words: WordShape[] }
  /**
   * Cards: a spelling over the word it is in, or a sentence on a strip. Its own
   * block because there is no answer place on it at all — a card is read, cut
   * out or pinned up, and a ruled slot would ask a question nobody set.
   */
  | {
      kind: "cards";
      columns: number;
      cards: SoundCard[];
      /**
       * How big the big line is set, in ems of the body size. On the block
       * rather than in the stylesheet because a card and a sentence strip are
       * one block at two very different sizes, and the family reserved the page
       * against this number (`cardRowEms`).
       */
      bigEms: number;
      /** A border to cut round. Off for a wall chart, which is not cut up. */
      boxed: boolean;
    }
  | { kind: "clock"; faces: ClockFace[] }
  | { kind: "shapes"; figures: Figure[] }
  /**
   * A number line on its own, rather than under a sum. Its own block because a
   * `problems` block numbers what is in it, and "1." against a strip a child
   * cuts out and sticks on a desk is a question nobody asked. The line is the
   * same `NumberLine` a problem carries, drawn by the same renderer.
   */
  | { kind: "numberline"; line: NumberLine }
  /**
   * A blank form: labelled boxes to write in, laid out across the page. Its own
   * block because there is no question here — it asks what the book was about,
   * so numbering it "1." would be a page pretending to be a worksheet and the
   * key has nothing to reveal on it.
   */
  | { kind: "form"; columns: number; fields: FormField[] }
  /**
   * A ruled table: headings across the top, rows to fill in under them.
   *
   * Distinct from a `grid`, which is squares a child measures against and whose
   * columns are therefore all one width. A table's columns are as wide as what
   * goes in them and its cells hold words. Everything on this shelf that is a
   * week is this block with different headings on it.
   */
  | {
      kind: "table";
      columns: TableColumn[];
      /** Whether the column labels are drawn as a heading row above the body. */
      head: boolean;
      rows: number;
      /** Row-major, `columns.length` to a row. Short lists leave cells blank. */
      cells: TableCell[];
      row: Mil;
      headRow: Mil;
      /**
       * A heavier upright at this column boundary, with a tick into every row —
       * the line a timeline is drawn along. Counted in boundaries, so `1` is the
       * rule between the first column and the second and `0` is the left edge.
       */
      spine?: number;
    }
  /**
   * Cards to cut out: faces at a stated size, in a grid, cut lines on every
   * boundary between them.
   *
   * The one block whose geometry a pair of scissors checks, so how big a card
   * is, how many go across and where the cuts fall are all decided here rather
   * than by the renderer. The cut geometry itself — the outside trim, the
   * shared edges, the evenly split waste — is §11.
   */
  | {
      kind: "cutcards";
      /** The face, on paper. What the sheet says it is, and what it measures. */
      card: { width: Mil; height: Mil };
      columns: number;
      rows: number;
      faces: CardFace[];
      headingEms: number;
      /**
       * `award` is the double rule a certificate is printed in, set in from the
       * cut so that a cut a thirty-second of an inch out does not slice through
       * it. `plain` draws nothing but the cut guides.
       */
      frame: "plain" | "award";
      /**
       * Fold in half across the middle and print the upper half upside down — a
       * tent that reads from both sides. Folding the top half back and down
       * turns it round, so it has to be printed the other way up. The fold is
       * exactly halfway, which is what makes the two panels match (§11).
       */
      fold?: boolean;
    }
  | { kind: "net"; net: Net }
  /** Where to cut, for cards and bookmarks. */
  | { kind: "cutline" }
  | { kind: "spacer"; height: Mil };

/* ── Type ──────────────────────────────────────────────────────────────── */

/**
 * Which face a sheet is set in. The five themselves are §6; these are names
 * rather than font stacks, so a saved sheet keeps its mind about which face it
 * wanted while the files behind it change. `cursive` stays unqualified for the
 * looped hand because that is the id already written into saved sheets.
 *
 * A face swap moves no length on the page: every height the layout reserves is
 * computed from `fontPt`. What it does change is how wide a character is, and
 * the proportions the five differ by are measured in `faces.ts`.
 */
export type SheetFont =
  "print" | "cursive" | "cursive-modern" | "cursive-uk" | "dyslexic";

/* ── The sheet ─────────────────────────────────────────────────────────── */

/**
 * A blank the child fills in by hand. Printed empty, always: a name is a ruled
 * line on paper and never a value in the config (§1).
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
   * The credit the *content* requires, where the words on the page are somebody
   * else's (§12).
   *
   * Its own field rather than a second use of `note`, because a sheet often has
   * to say both at once and they are different claims: `note` is what the
   * printout *is*, and `SheetSpec.key` sets it on a sheet that already carries a
   * source. One string would let the key overwrite the credit we promised to
   * print. Absent where the source asks for nothing — an 1885 poem needs none.
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
   * Body type size, in points rather than `Mil`: it is the one number here a
   * renderer hands straight to CSS (`--sheet-pt`, §4).
   */
  fontPt: number;
  /**
   * The three below are the presentation half of `SheetOptions`, carried here
   * for the reason `fontPt` is — a `Sheet` is the whole hand-off, and a renderer
   * holding one must not also need the config it came from.
   *
   * No family sets them. `buildSheet` copies them on at the front door, the same
   * bargain `chrome.ts` struck: otherwise every family writes the same three
   * lines and the next one added is the one that forgets.
   */
  font?: SheetFont;
  /** A box round the answer place rather than a rule under it. */
  answerBox?: boolean;
  /** Dashed guides across the page, for a sheet that gets cut up. */
  cutLines?: boolean;
  header: SheetHeader;
  /**
   * The flow, in order. A sheet is one document that may run over more than one
   * page: keeping a block inside a page is the family's job, using layout.ts,
   * and breaking between them is the print stylesheet's.
   */
  blocks: Block[];
  footer: SheetFooter;
  /**
   * Print the answers already in the blocks — the whole of the key mechanism
   * (§7). `SheetSpec.key` flips it and every renderer reads it.
   */
  answers: boolean;
};

/* ── Configs ───────────────────────────────────────────────────────────────
   Three fields recur across every generating family and mean the same thing
   in each: `count` is how many problems were asked for and is always capped
   at what the page holds, `columns` is how many go across, and `workspace` is
   blank paper under each problem to work in. Where a family reads one of them
   differently, that field says so.                                          */

/** What every sheet config carries, whatever family it belongs to. */
export type SheetOptions = {
  paper: Paper;
  /** In points, not `rem`: larger type is an option here, not a zoom (§17). */
  fontPt: number;
  /** Overrides the family's own title. */
  title?: string;
  instructions?: string;
  fields: HeaderField[];
  /** Absent is the print face, which is what a worksheet is set in. */
  font?: SheetFont;
  /**
   * A box round the answer place instead of a rule under it. The same slot
   * either way — this decides how it is drawn, not where — which is why it can
   * be a shared switch and why it costs no height: a bordered slot is the same
   * line box as a ruled one, and the capacity arithmetic never learns about it.
   */
  answerBox?: boolean;
  /**
   * Dashed guides across the page, for a sheet that gets cut up. Drawn over the
   * paper rather than in the flow, which is why it can be a shared option: a
   * `cutline` *block* takes a quarter of an inch the family reserved for
   * problems, and an overlay takes none.
   */
  cutLines?: boolean;
};

/**
 * A page with nothing on it but the header and the footer — the spine's own
 * sheet. What the builder opens on, what a retired sheet type falls back to,
 * and the smallest thing that proves the front door routes, builds and keys.
 */
export type BlankConfig = SheetOptions & { kind: "blank" };

/**
 * A ruling and nothing written on it. No options of its own beyond `rule`,
 * because `Rule` already says everything there is to say about a ruling.
 */
export type PaperConfig = SheetOptions & { kind: "paper"; rule: Rule };

/**
 * The blank maths references: a hundred chart, a number line, a coordinate
 * grid, a place-value chart. Geometry rather than generation, which is why it
 * sits beside `PaperConfig` rather than in `maths/`.
 *
 * Every style-specific field is optional and every one is clamped, because they
 * arrive from wherever a saved sheet does. They clamp in two places rather than
 * one: `templates/charts.ts` for the three charts, and `planeOf` in `plane.ts`
 * for `span` and `quadrants`, so a blank grid and a geometry exercise get the
 * same answer to "how far do the axes run".
 */
export type ChartStyle =
  "hundred" | "number-line" | "coordinate" | "place-value";

export type ChartConfig = SheetOptions & {
  kind: "chart";
  style: ChartStyle;
  /**
   * The hundred chart's numbers, ends included. Both ends rather than a count,
   * because the two charts a parent asks for are 1–100 and 0–99: one puts every
   * multiple of ten at the end of its own row and the other puts them under each
   * other in the last column, and a child is usually taught one of them.
   */
  range?: { min: number; max: number };
  /**
   * Whether the numbers are printed or left to write in. One switch and two
   * sheets — the wall chart, and the exercise whose key is the wall chart —
   * because the numbers are computed either way.
   */
  filled?: boolean;
  /** The number line: how far apart one tick is from the next. */
  step?: number;
  /**
   * The number line: how many strips down the page, to cut apart. Not `count`,
   * because that is how many problems a sheet is marked out of and there is
   * nothing on a strip to mark.
   */
  strips?: number;
  /** The coordinate grid: how far the axes run from nought. */
  span?: number;
  /** And whether it has negative numbers on it: four quadrants, or one. */
  quadrants?: number;
  /**
   * The place-value chart's columns, as powers of ten: 2 is hundreds, 0 is ones,
   * −2 is hundredths. The exponent rather than the name, because the columns are
   * consecutive powers of ten and the point goes between 0 and −1 — a pair of
   * names would let a chart be configured with tens beside thousandths.
   */
  places?: { largest: number; smallest: number };
  /** The place-value chart: how many rows there are to write numbers in. */
  rows?: number;
};

/* ── The paperwork ─────────────────────────────────────────────────────── */

/**
 * The forms a week of lessons is written on. One family and nine styles,
 * because none of the nine changes what the sheet is: a set of headings with
 * room to answer under each, and which headings they are is the setting.
 *
 * The science styles are the ones to be careful with, and the care is in what
 * they leave out — a lab report asks what the question was and what happened,
 * and supplies neither (§11).
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
   * How many rows the two styles that are lists print — the reading log and
   * the timeline.
   */
  rows?: number;
  /**
   * How much room each answer gets, as a multiplier on what the style asks for.
   * One control rather than a height per field, because a form is a page and
   * four more lines for "What it is about" have to come from somewhere.
   */
  space?: number;
  /**
   * The prompt on a writing-prompt sheet, where a parent set their own. Absent
   * draws one from the seed out of `templates/prompts.ts`, which is what makes
   * that style the one generated thing on this shelf.
   */
  prompt?: string;
};

/**
 * The week, on a wall: five things that are all a table with different headings.
 * The chore and behaviour charts differ only in their labels and their title,
 * which is stated rather than hidden — they are different queries and the same
 * paper, and collapsing them would answer neither search (§8).
 */
export type PlannerStyle =
  "calendar" | "week" | "chores" | "behaviour" | "verse-week";

export type PlannerConfig = SheetOptions & {
  kind: "planner";
  style: PlannerStyle;
  /**
   * Which month the calendar prints. **Both, or neither.** Neither is the
   * undated calendar — empty squares under the weekday names, the version that
   * does not go out of date. Both works the dates out (`monthGrid`), which is
   * the one piece of arithmetic here with a right answer: a first of the month
   * under the wrong weekday is a sheet somebody plans a term around.
   */
  year?: number;
  month?: number;
  weekStart?: "sunday" | "monday";
  /**
   * A parent's own headings: the jobs down a chore chart, and on a planner the
   * parts of the day *across* it.
   *
   * Rows on two styles and columns on the third, which is the shape of the sheet
   * rather than an inconsistency — a week is seven days whatever the columns are
   * called, so a planner's fixed axis is its rows. Empty is always a legitimate
   * answer: blank labels are a chart to fill in by hand.
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
 * The paper that gets cut up: five styles and one geometry. A stated size on
 * paper, a grid of that size, cut guides on the boundaries — what differs is a
 * handful of strings printed on a face. Curated slugs over a generated
 * permutation is §8.
 */
export type CardStyle =
  "flashcard" | "name-tag" | "bookmark" | "verse-card" | "certificate";

export type CardsConfig = SheetOptions & {
  kind: "cards";
  style: CardStyle;
  /**
   * How many cards to a page (§17). A request: each style declares the layouts
   * it has (`CARD_LAYOUTS`), because how many fit across is a fact about the
   * shape of the card — four bookmarks is four columns, four flashcards is two
   * by two.
   */
  up?: number;
  /**
   * What is written on the faces, one card each. Empty is the default and not a
   * lesser sheet — blank is what a flashcard is for — and a short list fills the
   * cards it can and leaves the rest blank.
   */
  words?: string[];
  /** The verse on a memory-verse card or a Scripture bookmark (§12). */
  passage?: string;
  translation?: TranslationId;
  text?: string;
  /** A tent name tag: folded in half, the top half printed upside down. */
  fold?: boolean;
  /** What a certificate is awarded for: "for finishing the times tables". */
  reason?: string;
};

export type NetStyle = "dice" | "spinner";

export type NetConfig = SheetOptions & {
  kind: "net";
  style: NetStyle;
  /** How many equal sectors a spinner is cut into. Equal is not a setting. */
  sectors?: number;
  /**
   * What is written on the faces or in the sectors, in order. On a die it
   * replaces the pips; empty leaves a die with its pips and a spinner with its
   * numbers.
   */
  labels?: string[];
};

/* ── Arithmetic ────────────────────────────────────────────────────────── */

/** Which sums are on the page. `both` shuffles the two together. */
export type ArithmeticOperation = "add" | "subtract" | "both";

/**
 * `standard` gives both numbers and asks for the result; `missing` gives the
 * result and one number and asks for the other; `fact-family` gives the three
 * numbers of a family and asks for the four sentences they make.
 */
export type ArithmeticStyle = "standard" | "missing" | "fact-family";

/** Written across the line, or stacked in columns the way a sum is worked. */
export type ArithmeticForm = "horizontal" | "vertical";

/**
 * Whether a column may carry or borrow — the line between the week a child
 * learns to add and the week they learn to carry. `either` is whatever the
 * numbers happen to do.
 */
export type Regrouping = "either" | "never" | "always";

export type ArithmeticConfig = SheetOptions & {
  kind: "arithmetic";
  operation: ArithmeticOperation;
  style: ArithmeticStyle;
  form: ArithmeticForm;
  /**
   * Where both numbers come from, ends included — the numbers a child *sees*,
   * not the answers they reach. "Addition to 20" puts two numbers up to twenty
   * on the page and their sum may run past it, which is what carrying is.
   */
  range: { min: number; max: number };
  /**
   * Named facts, in the vocabulary the race uses ("7:8") — "print exactly what
   * they keep missing" on this family (§14).
   *
   * Non-empty, it *is* the pool: `range` and `regrouping` stop applying,
   * because a sheet that dropped half the facts for not carrying is not the
   * sheet that was asked for. A pair reads the way `decks/flashcards.ts` builds
   * it — added, the two addends; subtracted, what was taken away and what is
   * left.
   */
  facts?: string[];
  count: number;
  columns: number;
  regrouping: Regrouping;
  /** Whether a subtraction may go below zero. Off unless asked for. */
  negatives?: boolean;
  numberLine?: boolean;
  workspace?: boolean;
};

/* ── Multiplication and division ───────────────────────────────────────── */

/** Which way round the facts are asked. `both` shuffles the two together. */
export type MultiplicationOperation = "multiply" | "divide" | "both";

/**
 * `standard` asks for the result; `missing` gives the result and one number and
 * asks for the other; `grid` is the multiplication square; `long` is the
 * written method — long multiplication, or the division bracket.
 */
export type MultiplicationStyle = "standard" | "missing" | "grid" | "long";

/** Written across the line, or stacked in columns. `long` is always stacked. */
export type MultiplicationForm = "horizontal" | "vertical";

/**
 * How many digits each side of a long form has. `into` is the multiplicand or
 * dividend and `by` the multiplier or divisor — the phrase a teacher already
 * uses, and the only thing that decides how much working space a row reserves.
 */
export type LongDigits = { into: number; by: number };

export type MultiplicationConfig = SheetOptions & {
  kind: "multiplication";
  operation: MultiplicationOperation;
  style: MultiplicationStyle;
  form: MultiplicationForm;
  /**
   * Which tables are on the page — one entry is "the seven times table" and
   * several is a mixed set. A table is the *divisor* when the sheet divides, so
   * the seven times table read backwards is dividing by seven.
   */
  tables: number[];
  /** What each table is multiplied by, ends included. */
  factors: { min: number; max: number };
  /**
   * Named facts, in the vocabulary the race uses ("7:8") — "print exactly what
   * they keep missing" on this family (§14).
   *
   * Non-empty, it *is* the pool: `tables` and `factors` stop deciding what is on
   * the page, because a sheet of the eight facts a child keeps missing is not a
   * sheet of the eight times table. The pair reads the way the deck builds it —
   * the table picked, then what it was paired with — so "56 ÷ 7" and "56 ÷ 8"
   * stay the two questions the drill keeps apart. Ignored by the grid and the
   * long forms, which have no named facts: a square is every fact there is.
   */
  facts?: string[];
  count: number;
  columns: number;
  /** Long forms only; ignored by the fact styles, which draw from `tables`. */
  digits?: LongDigits;
  /**
   * Long division only. Off unless asked for, because a remainder is a change
   * of question rather than a harder version of the same one — a child who has
   * not been taught them has been set an impossible problem.
   */
  remainders?: boolean;
  workspace?: boolean;
};

/* ── Fractions ─────────────────────────────────────────────────────────── */

/**
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
 * Whether the two fractions share a denominator — the switch this family turns
 * on, as regrouping is on an addition sheet. Halves to quarters is a different
 * week's work from quarters to quarters, and a sheet that mixed them is set at
 * a level nobody chose.
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
   * A pool rather than a range, for the reason `tables` is: "sevenths" is a
   * choice somebody makes, and 2 to 12 is not.
   */
  denominators: number[];
  pairing: Denominators;
  /** `2 1/4` rather than `1/4`, on the page and in the answer. */
  mixed?: boolean;
  /** Naming sheets only. */
  model?: FractionModel;
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Decimals, percents and money ──────────────────────────────────────── */

export type DecimalStyle = "standard" | "percent" | "convert";

/** `both` shuffles addition and subtraction, as it does on an arithmetic sheet. */
export type DecimalOperation = "add" | "subtract" | "multiply" | "both";

/**
 * Column form is worth more here than anywhere else: every value prints to the
 * same number of places, so stacking them right-aligned puts the points in a
 * column — the one thing a child lining up a decimal sum has to get right.
 */
export type DecimalForm = "horizontal" | "vertical";

export type DecimalConfig = SheetOptions & {
  kind: "decimals";
  style: DecimalStyle;
  operation: DecimalOperation;
  form: DecimalForm;
  /**
   * How many digits after the point, 1 to 3. What makes a decimal sheet easy or
   * hard, and the thing a generator gets wrong by rounding a float into the key.
   */
  places: number;
  /** The whole numbers the values sit between, ends included. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/**
 * A switch rather than a build-time constant, for the reason A4 is (§4): a
 * British child counting dollars is being asked about a foreign country, and
 * the sheet is otherwise identical.
 */
export type Currency = "usd" | "gbp" | "eur";

/** `both` shuffles addition and subtraction — the two a till does. */
export type MoneyOperation = "add" | "subtract" | "multiply" | "both";

export type MoneyConfig = SheetOptions & {
  kind: "money";
  currency: Currency;
  operation: MoneyOperation;
  /** Money is a two-place decimal with a symbol on it, so it stacks the same. */
  form: DecimalForm;
  /** The whole units the amounts sit between — dollars, pounds or euros. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Time ──────────────────────────────────────────────────────────────── */

/**
 * `read` puts the hands on the dial and asks for the time; `draw` gives the
 * time and leaves the dial empty; `elapsed` is the space between two times —
 * the one of the three that is arithmetic, and not in base ten.
 */
export type TimeStyle = "read" | "draw" | "elapsed";

export type TimeConfig = SheetOptions & {
  kind: "time";
  style: TimeStyle;
  /**
   * The minutes a time may land on, and what makes a clock sheet easy or hard:
   * 60 is o'clock, 30 half past, 15 the quarters, 5 the numerals, 1 any minute.
   *
   * A number rather than a union, because it arrives from outside this build and
   * a step of seven has to resolve rather than throw (`TIME_STEPS`).
   */
  step: number;
  /**
   * Elapsed only: how far apart the two times may be, in minutes. "Half an hour
   * to two hours" is a different lesson from "five minutes to twenty".
   */
  span?: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Measurement ───────────────────────────────────────────────────────── */

/**
 * A switch for the reason the currency is: a British child converting yards is
 * being asked about a country they have never measured anything in, and an
 * American child converting millimetres likewise.
 */
export type UnitSystem = "metric" | "imperial";

export type Quantity = "length" | "mass" | "capacity";

/**
 * `convert` writes the same amount in another unit; `compare` asks which of two
 * is the bigger, which is the same skill with the arithmetic hidden inside it.
 */
export type MeasureStyle = "convert" | "compare";

export type MeasureConfig = SheetOptions & {
  kind: "measure";
  style: MeasureStyle;
  system: UnitSystem;
  /**
   * A pool rather than one, for the reason `tables` is: "millimetres,
   * centimetres and metres" is a lesson somebody teaches, and "everything
   * measurable" is not.
   */
  quantities: Quantity[];
  /** How many of the unit written on the left, ends included. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Geometry ──────────────────────────────────────────────────────────── */

export type GeometryStyle =
  "area" | "perimeter" | "volume" | "angles" | "identify" | "coordinates";

export type GeometryConfig = SheetOptions & {
  kind: "geometry";
  style: GeometryStyle;
  /** Ignored by the three styles whose questions carry no measurements. */
  system: UnitSystem;
  /** How big the sides get, ends included. */
  range: { min: number; max: number };
  /**
   * The coordinate plane only: one quadrant, or all four. A plane from nought
   * is counting; four quadrants is the week negative numbers arrive, and one in
   * front of a child who has not met them is impossible rather than harder.
   */
  quadrants?: number;
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Integers ──────────────────────────────────────────────────────────── */

/**
 * `arithmetic` is the four operations over positive and negative whole numbers;
 * `order` is one expression and the rule deciding which part is done first;
 * `powers` is exponents and the roots that undo them.
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
   * How big the numbers get, sign aside — the *size* of what a child sees. A
   * parent asks for "numbers to twenty"; whether one of them is negative is the
   * switch below rather than the bottom of the range.
   */
  range: { min: number; max: number };
  /**
   * Whether a minus sign may appear at all. On unless turned off — but an
   * order-of-operations sheet without them is a real lesson, a year younger.
   */
  negatives?: boolean;
  /** Order of operations only: how many operations the expression holds. */
  terms?: number;
  /**
   * Order of operations only: whether an expression may hold a square. On
   * unless turned off, because "brackets, powers, then × and ÷" is the rule as
   * taught — but a child who meets the rule a term before exponents cannot
   * start `3² + 10 × 2`. The printed instruction follows the switch: a sheet
   * with no squares on it does not tell a child to do powers first.
   */
  powers?: boolean;
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Pre-algebra ───────────────────────────────────────────────────────── */

/**
 * `expression` evaluates a rule at a value or collects like terms; `equation`
 * and `inequality` solve for the letter; `slope` is rise over run from a pair
 * of written points; `graph` is the same question read off a plane.
 */
export type AlgebraStyle =
  "expression" | "equation" | "inequality" | "slope" | "graph";

export type PreAlgebraConfig = SheetOptions & {
  kind: "prealgebra";
  style: AlgebraStyle;
  /**
   * Equations and inequalities: one step, or two. `x + 7 = 12` is undone by one
   * move and `3x + 4 = 19` by two, and they are a term apart in the year rather
   * than a harder version of the same question.
   */
  steps?: number;
  /** How big the numbers get, sign aside — as on an integers sheet. */
  range: { min: number; max: number };
  /**
   * More than a difficulty here: dividing an inequality by a negative turns it
   * round, which is the most-missed step in pre-algebra.
   */
  negatives?: boolean;
  /** The graph style only: one quadrant, or all four. */
  quadrants?: number;
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Ratio, proportion and rate ────────────────────────────────────────── */

/**
 * `simplify` writes a ratio the smallest way; `proportion` fills the gap in a
 * pair that scale together; `rate` is the amount for one of something.
 */
export type RatioStyle = "simplify" | "proportion" | "rate";

export type RatioConfig = SheetOptions & {
  kind: "ratio";
  style: RatioStyle;
  /** How big the numbers in a ratio get, ends included. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Statistics ────────────────────────────────────────────────────────── */

/** `all` is the four of them from one set of numbers, as a textbook sets it. */
export type StatisticStyle = "mean" | "median" | "mode" | "range" | "all";

export type StatisticsConfig = SheetOptions & {
  kind: "statistics";
  style: StatisticStyle;
  /**
   * How many numbers are in each set. A choice of question rather than a
   * difficulty: an even-sized set has its median between two numbers, which is
   * the lesson a five-number set cannot teach.
   */
  size: number;
  /** The numbers the set is drawn from, ends included. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  workspace?: boolean;
};

/* ── Word problems ─────────────────────────────────────────────────────── */

/** Which lessons the problems are about — a pool, so a page can mix them. */
export type WordTopic =
  "integers" | "rate" | "percent" | "equation" | "average";

export type WordProblemConfig = SheetOptions & {
  kind: "word-problems";
  topics: WordTopic[];
  /** How big the numbers in a story get, ends included. */
  range: { min: number; max: number };
  count: number;
  columns: number;
  /** On by default here: a story problem is worked out, not answered. */
  workspace?: boolean;
};

/* ── Words ─────────────────────────────────────────────────────────────── */

/**
 * Seven exercises over one list: `copy` is "write it three times"; `missing`
 * takes letters out; `test` prints numbered lines for a list read aloud; `abc`
 * asks for the list back in alphabetical order; `shapes` draws each word as the
 * outline its letters make; `sentence` asks for the word used in one; and
 * `find` prints the word among its near misses, which is the same judgement the
 * race's "spot it" round makes.
 */
export type WordSheetStyle =
  "copy" | "missing" | "test" | "abc" | "shapes" | "sentence" | "find";

export type WordsConfig = SheetOptions & {
  kind: "words";
  style: WordSheetStyle;
  /**
   * The list, in the order it was given — a spelling list is often taught in
   * order, and `parseWords` already keeps it.
   *
   * The words themselves rather than the id of a deck, so a sheet prints the
   * same list next term after the deck it came from has been deleted — the way
   * a saved run outlives its deck. And no name for the list: a config travels in
   * a URL and the one thing that must never be in one is a child (§14), so the
   * sheet is titled after what it does and a parent who wants their own words at
   * the top types them into `title`.
   */
  words: string[];
  /**
   * How many ruled lines each word gets — the repeats on a `copy` sheet, the
   * lines to write on for `sentence`. One field because it is one measurement,
   * and two names for it would be two things a saved config could disagree
   * about.
   */
  times: number;
  /** `missing` only: how many letters are taken out of each word. */
  gaps: number;
  count: number;
  /**
   * Ignored by the two styles that run down the page: a gapped word and a word
   * among its near misses are each a line of their own, whatever a saved config
   * says (`wordsLayout`).
   */
  columns: number;
};

/* ── Word study ────────────────────────────────────────────────────────── */

/**
 * One topic to a sheet, never a mix. Rhyming and contractions together is not a
 * harder sheet but one nobody set — they are separate weeks in every scheme,
 * and the instruction line can only say one thing.
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
 * `write` gives the prompt and a ruled slot; `choose` gives four options with
 * the near misses drawn from the same topic; `match` is two columns to join.
 *
 * Every topic states which of the three it can honestly be asked in
 * (`STUDY_TOPICS`): "write a word that rhymes with cat" has a hundred right
 * answers and no key, and matching a word to a syllable count is a column of
 * four numbers repeated down the page.
 */
export type WordStudyStyle = "write" | "choose" | "match";

export type WordStudyConfig = SheetOptions & {
  kind: "word-study";
  topic: WordStudyTopic;
  /**
   * Resolved against what the topic supports rather than trusted: a style saved
   * in March must still print in June if the topic has since dropped it, for
   * the reason `sheetSpec` never throws.
   */
  style: WordStudyStyle;
  count: number;
  /** `write` only — a choice and a matching column are the width of the page. */
  columns: number;
};

/* ── Puzzles ───────────────────────────────────────────────────────────── */

/**
 * `search` is a letter grid with the words hidden in it; `crossword` is the
 * numbered squares, clued from the list's own sentences where it has them;
 * `scramble` is a word's letters out of order and needs no grid at all.
 */
export type PuzzleStyle = "search" | "crossword" | "scramble";

/**
 * Which ways a word may run in a word-search grid — three different exercises
 * rather than three degrees of one. `across` is reading, `across-down` is the
 * usual school puzzle, and `all` adds the diagonals, where a word search stops
 * being about reading and starts being about scanning. `reverse` is separate
 * for the same reason: a parent setting one is not asking for the other.
 */
export type SearchDirections = "across" | "across-down" | "all";

export type PuzzleConfig = SheetOptions & {
  kind: "puzzle";
  style: PuzzleStyle;
  /** As `WordsConfig.words`, and unnamed here for the same reason. */
  words: string[];
  /**
   * How many cells across and down. Square, and a request: a grid that would not
   * fit the paper with its word list under it is shrunk until it does
   * (`searchLayout`).
   *
   * The crossword reads it as the largest grid it may lay words out in, then
   * crops to the words that landed — a bound rather than a size, but the same
   * question asked of the same paper, and two fields would be two things a
   * saved config could disagree about.
   */
  size: number;
  /** `search` only. */
  directions: SearchDirections;
  /** `search` only: words may be written backwards. */
  reverse: boolean;
  /**
   * `search` only: words may cross, sharing a letter where they meet. Off makes
   * an easier grid and a harder placement problem — every word needs a clear run
   * of its own — so it is the setting most likely to leave a word unplaced,
   * which is why `omitted` exists.
   */
  overlap: boolean;
  count: number;
  /** `scramble` only — a grid and a clue list are the width of the page. */
  columns: number;
};

/* ── Grammar ───────────────────────────────────────────────────────────── */

/**
 * The five §11 names, one week's teaching each: the parts of speech, the two
 * halves of a sentence, what a sentence is *for*, the mark it ends on, and the
 * word inside it that takes a capital.
 */
export type GrammarTopic =
  "parts" | "subject" | "types" | "punctuation" | "capitals";

/**
 * `write` gives the sentence and a ruled place to answer; `choose` gives the
 * fixed set of names to circle one of.
 *
 * A `choose` sheet here never has to be checked for a second right answer among
 * its distractors, unlike word study: the options are a whole closed
 * vocabulary — five parts of speech, four kinds of sentence — not a draw of
 * near misses. A topic states which of the two it can honestly be asked in
 * (`grammarStyles`); three are `write` only, because their answer is a mark, a
 * word out of the sentence, or the sentence cut in half.
 */
export type GrammarStyle = "write" | "choose";

export type GrammarConfig = SheetOptions & {
  kind: "grammar";
  topic: GrammarTopic;
  /** Resolved against the topic rather than trusted, as `WordStudyConfig` is. */
  style: GrammarStyle;
  count: number;
  /**
   * Caps lower than the maths families, because a sentence is a long thing to
   * print — and the subject-and-predicate sheet ignores it entirely, its answer
   * being two ruled lines the width of the column.
   */
  columns: number;
};

/* ── Handwriting ───────────────────────────────────────────────────────── */

/**
 * What is written on the sheet.
 *
 * `letters` and `numbers` are the two sets the engine owns outright. The other
 * two are somebody else's content and differ only in how much of it goes on one
 * line: a word is written several times *across* a row, while a line of a
 * passage fills the row and its repeats run *down* the page. A sentence is a
 * passage of one line — not a style of its own, because what would make it one
 * is how many lines are left under it, which is `repeats`.
 *
 * `joins` is a different set rather than a different shape of one: in a joined
 * hand the stroke between two letters is a third thing with a lesson of its own.
 * It is also the only style that makes no sense in a print face (`cursiveOf`).
 */
export type HandwritingStyle =
  "letters" | "numbers" | "joins" | "words" | "passage";

/**
 * Which joins a joins sheet practises, in the order they are taught.
 *
 * The four classic joins are named for where the exit stroke leaves the first
 * letter and how tall the second is: a *diagonal* join climbs from the
 * baseline, a *horizontal* one carries across from the x-height. `round` is the
 * fifth thing every scheme teaches separately — the anticlockwise letters
 * (`a c d g o q`) are entered at the top, and a child who joins into them the
 * ordinary way writes `oi` for `oa`.
 *
 * `breaks` is not a join at all but the pairs where a model may lift the
 * pencil. It is a group here because *whether* it lifts is the face's business
 * and not ours: the sheet prints the pair and the font answers the question
 * (`writing/joins.ts`).
 */
export type JoinFamily =
  | "diagonal"
  | "diagonal-tall"
  | "horizontal"
  | "horizontal-tall"
  | "round"
  | "breaks";

/**
 * `both` writes each letter as a pair — `A` then `a`, `B` then `b` — rather
 * than the capitals and then the small letters, because the pair is what a
 * child is taught as one letter.
 */
export type LetterCase = "upper" | "lower" | "both";

export type HandwritingConfig = SheetOptions & {
  kind: "handwriting";
  style: HandwritingStyle;
  /**
   * Any ruling in §5. Blank paper is the one that cannot work — a handwriting
   * sheet is rows of a repeating ruling, and a ruling with no pitch has no rows
   * — so `ruleOf` resolves it to one that has.
   */
  rule: Rule;
  /**
   * Any style in §6. `none` is a real sheet, not an empty one: the model is the
   * solid cell at the start of the row and the rest is the child's own writing.
   */
  trace: TraceStyle;
  /**
   * How many times each thing is written, the model and the empty space
   * included. Across the row for letters, numbers and words; down the page for
   * a passage, whose lines are too wide to sit beside each other.
   */
  repeats: number;
  /**
   * Trace → copy → write: the first cell is a solid model, the last is left
   * empty, and everything between is drawn in `trace`. On unless turned off,
   * because it is what the whole sheet is for. Off draws every repeat the same
   * way, which is the sheet for a child not yet ready to be left alone.
   */
  progression?: boolean;
  /** `letters` only. Absent is both cases, which is how letters are taught. */
  letters?: LetterCase;
  /**
   * `joins` only. Absent is all of them in teaching order, which is what a
   * parent means by "cursive joins" — the whole progression on one page, the
   * way the letters sheet is the whole alphabet on one page.
   */
  joins?: JoinFamily;
  /** `words` only, and unnamed for the reason `WordsConfig.words` gives. */
  words?: string[];
  /**
   * `passage` only: what a parent typed or pasted, as it should read on the
   * page. A newline is a line break the author asked for; everything else is
   * wrapped to the ruling by the family, there being no DOM to measure in (§4).
   * `passage` below is the other door and wins where both are set
   * (`copyworkSource`).
   */
  text?: string;
  /**
   * `passage` only: one of the library's passages, by id.
   *
   * An id rather than the words is what makes a copywork sheet fit in a link
   * (§14) — "psalm-23" is nine characters where the psalm is seven hundred —
   * and it carries the provenance the library holds rather than a quotation
   * with no source. An id this build has never heard of falls back to `text`,
   * because a bookmark outlives the library it was made on.
   */
  passage?: string;
  /**
   * Which translation a Scripture passage is read in. Ignored by everything
   * else in the library, which has only the one text.
   */
  translation?: TranslationId;
};

/* ── Memory work ───────────────────────────────────────────────────────── */

/**
 * A passage written out several times, with more of it missing each time (§12).
 *
 * One dial: how many rounds. The first is the whole thing to read, the last has
 * every word gone, and the ones between take out an evenly growing share — so a
 * sheet is a progression rather than a difficulty setting.
 *
 * Which words go is decided by the seed and nothing else, and the sets nest: a
 * word missing in round two is missing in round three, because a round that
 * gave one back would read as a mistake in the printing. The text comes through
 * `copyworkSource`, the same two doors a copywork sheet has.
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
   * How many times the passage is written out, the whole one at the top and the
   * empty one at the bottom included. Capped at what the page holds.
   */
  rounds: number;
};

/* ── Phonics ───────────────────────────────────────────────────────────── */

/**
 * `cards` are the spellings to cut out; `chart` is the same set as one page for
 * the wall; `blending` prints a word cut into its sounds, to say slowly and then
 * quickly; `families` adds a beginning to an ending; `matching` joins a spelling
 * to a word it is in; `dictation` is ruled lines for words read aloud; and
 * `sentences` are strips of connected text (§13).
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
 * The three typographic conventions, as three independent switches — the whole
 * of §13's argument in the type: each mark belongs to nobody, while a named
 * *combination* of them is somebody's modified alphabet. So there is no preset
 * to ship and every mark is derived from the table of spellings rather than
 * authored (`phonics/cards.ts`). All three off is the default.
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
   * The list itself rather than an id into the store `services/phonics.ts`
   * keeps, so a sheet survives being sent to a family who has never heard of
   * this household's list. The cost is stated rather than hidden: a config
   * carrying a long list of sight words can outgrow the cap in `share.ts` and
   * simply not decode, which is the "fall back rather than throw" §14 asks for.
   *
   * Read through `readInventory` before use, as a word list is read through
   * `wordsOf`: it arrives from a saved sheet, from a link somebody was sent, or
   * from a build that taught a spelling this one has retired.
   */
  inventory: Inventory;
  /**
   * Only words using this spelling — "this week we're doing `sh`". A
   * correspondence id, and a sheet about a spelling the parent has not ticked
   * comes back empty rather than quietly widening (`WordPick.focus`).
   */
  focus?: string;
  /**
   * At most this many *sounds* in a word — what makes a CVC sheet a CVC sheet.
   * Sounds rather than letters, the distinction the whole model turns on: `box`
   * is three letters and four sounds, `ship` four letters and three, and "short
   * word" is not a length in characters. Absent on most sheets, because once
   * blending works the length of the word is no longer the exercise.
   */
  maxSounds?: number;
  marking: PhonicsMarking;
  count: number;
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
 * A config and its seed and nothing else: `buildSheet(config, seed)` reproduces
 * the page exactly, so none of the paper is stored. Declared here rather than in
 * `services/sheets.ts` for the reason `CustomDeck` sits in `engine/types.ts` —
 * the model owns the vocabulary and the service owns the persistence, which is
 * what lets `db.ts` state its schema without importing a service back up the
 * stack.
 *
 * `id` is prefixed `sheet-` as a custom deck's is prefixed `custom-`, so the
 * two can never collide in a backup file. There is no `profileId`, and that is
 * §15's decision rather than an omission.
 */
export type SavedSheet = {
  id: string;
  name: string;
  config: SheetConfig;
  seed: number;
  createdAt: string;
  updatedAt: string;
};
