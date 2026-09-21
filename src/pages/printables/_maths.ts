/**
 * The math sheets the Print Shop has set, and the words that go round them.
 *
 * **The slugs are curated; the sheets are generated** (§8), and this is the
 * family where that stops being theoretical: the engine can make millions of
 * plausible pages out of the families, styles, forms, currencies and ranges it
 * already has, and every one of them would be a page nobody wrote for. So each
 * slug is a phrase a parent actually types, with two paragraphs true of that
 * sheet and of no other, and everything else is reached by the builder.
 *
 * **One stock, unlike paper** (§8). Nothing on a math sheet is a measurement,
 * so a slug here is one route and the A4 switch is the builder's.
 */
import { encodeSharedSheet } from "@/engine/sheets/share";
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type { HeaderField, Paper, SheetConfig } from "@/engine/sheets/types";

/** How the hub groups the shelf: five strands of school math, in order. */
export type MathsStrand =
  "adding" | "tables" | "parts" | "measuring" | "algebra";

export type MathsSheet = {
  /** The route under /printables, and the head term it is written to answer. */
  slug: string;
  /** How it is listed on a hub. */
  name: string;
  /** How it is labeled in the row of neighboring sheets. A few words. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /** One sentence of what is on the sheet. Used in the description and hubs. */
  summary: string;
  /** The lead paragraph: what the sheet asks for, stated plainly. */
  lead: string;
  /** Two things that are true of this sheet and not of the one beside it. */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  strand: MathsStrand;
  /**
   * The times-table pages whose facts this sheet drills, where any.
   *
   * The internal-linking win §8 calls significant and free, and it is only
   * offered where it is honest: a long division leans on the tables it divides
   * by, an equivalent-fractions sheet leans on nothing of the sort, and a row
   * of twelve links on a page about fractions would be a nav bar rather than a
   * cross-reference.
   */
  tables?: number[];
  /** What the race does with the same facts, in one sentence that is true. */
  play: string;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: SheetConfig;
};

/**
 * The seed every catalog sheet is built from, and it never moves.
 *
 * `buildSheet(config, seed)` is deterministic (§7), so a fixed seed is what
 * makes these pages stable: the same sums are in the HTML on every build, a
 * crawler that comes back next month reads the page it indexed, and a parent
 * who printed this sheet in March can print the identical one in June. The
 * footer prints the number, so the sheet is reproducible from the paper as well
 * as from the URL.
 */
export const MATHS_SEED = 1;

/** Every sheet here is Letter portrait — see the note at the top of the file. */
const PAPER: Paper = {
  size: "letter",
  orientation: "portrait",
  margin: "normal",
};

/**
 * Printed blank, always, and the reason there is no third field: these are two
 * ruled lines on paper, and there is nowhere in a config to put a value for
 * either (§1).
 */
const FIELDS: HeaderField[] = ["name", "date"];

/** What every catalog sheet shares: the stock, the type size, the two lines. */
const SHEET = {
  paper: PAPER,
  fontPt: DEFAULT_FONT_PT,
  fields: FIELDS,
} as const;

/** The twelve tables, which is what a fact sheet draws from unless it says so. */
const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * The denominators a fraction sheet draws from.
 *
 * Halves through twelfths, skipping sevenths, ninths and elevenths — the ones a
 * primary child meets on a clock, in a recipe and on a ruler. A pool rather
 * than a range, because "sevenths" is a choice somebody makes and 2 to 12 is
 * not.
 */
const DENOMINATORS = [2, 3, 4, 5, 6, 8, 10, 12];

export const MATHS_SHEETS: MathsSheet[] = [
  /* ── Adding and taking away ─────────────────────────────────────────── */
  {
    slug: "addition-worksheets",
    name: "Addition facts to 20",
    short: "Addition",
    heading: "Addition worksheets",
    keyword: "Free printable addition worksheets",
    summary:
      "Twenty-four addition facts with both numbers up to 20, written along the line, and an answer key on the second page.",
    lead: "The first sheet in the shop: two numbers up to twenty, added along a line, twenty-four of them to a page. Nothing has to be chosen before it prints, and the answers are already on the second page.",
    notes: [
      "Both numbers go up to twenty, which means some of the answers run past it: sums like 14 + 9 are drawn from the same pool as 4 + 9. That is deliberate and it is the whole of what makes a facts sheet worth doing twice: the sums that cross ten are the ones a child counts on their fingers for longest, and they are the ones that have to become recall rather than arithmetic.",
      "No problem appears twice, and the pairs are not in order, so a child cannot get the fourth answer from the third. That sounds obvious and it is the thing most generated worksheets get wrong — a page of sums drawn at random from a small pool repeats itself surprisingly often, and a child who spots the repeat has been given fewer problems than the page claims to hold.",
    ],
    teaches: "Addition facts to 20",
    ages: "Ages 5–8",
    strand: "adding",
    play: "The Grid deals these same facts as timed cards, and keeps the ones that come out slow in a practice deck of their own.",
    config: {
      ...SHEET,
      kind: "arithmetic",
      operation: "add",
      style: "standard",
      form: "horizontal",
      range: { min: 1, max: 20 },
      count: 24,
      columns: 3,
      regrouping: "either",
    },
  },
  {
    slug: "subtraction-worksheets",
    name: "Subtraction facts to 20",
    short: "Subtraction",
    heading: "Subtraction worksheets",
    keyword: "Free printable subtraction worksheets",
    summary:
      "Twenty-four subtraction facts within 20, none of them going below zero, with the answer key on the second page.",
    lead: "Taking away, within twenty, twenty-four to a page. Nothing on this sheet drops below zero — a child who has not met negative numbers should not find one waiting in question nine.",
    notes: [
      "Subtraction is the same fact read backwards, and that is worth saying out loud while a child works: 15 − 7 is the question “seven and what makes fifteen?”, which most children can answer a year before they can take away. If a sum stalls, turning it round is usually faster than counting back.",
      "Negative answers are off, not absent — the engine will produce them, and the builder has the switch. They belong on the integers sheet, where the minus sign is the lesson rather than an accident of which number happened to be drawn first.",
    ],
    teaches: "Subtraction facts within 20",
    ages: "Ages 5–8",
    strand: "adding",
    play: "The Grid drills subtraction as timed cards alongside the other three operations, so a fact that stalls on paper can be practiced on screen.",
    config: {
      ...SHEET,
      kind: "arithmetic",
      operation: "subtract",
      style: "standard",
      form: "horizontal",
      range: { min: 1, max: 20 },
      count: 24,
      columns: 3,
      regrouping: "either",
    },
  },
  {
    slug: "addition-with-regrouping-worksheets",
    name: "2-digit addition with regrouping",
    short: "Regrouping",
    heading: "Addition with regrouping worksheets",
    keyword: "Free printable addition with regrouping worksheets",
    summary:
      "Sixteen two-digit sums stacked in columns, every one of them carrying, with an answer key on the second page.",
    lead: "Two-digit numbers stacked in columns, with a rule under them and space to write the carry. Every sum on this page regroups — that is the setting, not the luck of the draw.",
    notes: [
      "The week a child learns to carry is the week they need a page where carrying happens every time. A mixed sheet teaches something else by accident: that most sums do not carry, so the ones that do can be treated as the odd case. Here all sixteen carry somewhere — sometimes out of the units, sometimes out of the tens — so the question is never whether to carry but where.",
      "The sums are stacked rather than written along a line, because the algorithm being practiced is a layout as much as an arithmetic. Ones under ones, tens under tens, the answer under the rule — the commonest wrong answer at this age is a right sum written in the wrong column, and graph paper is worth printing alongside this if that is what keeps happening.",
    ],
    teaches: "Two-digit column addition with carrying",
    ages: "Ages 6–9",
    strand: "adding",
    play: "The Grid does not stack sums — it deals facts. It is the sheet to run when the columns are fine but the number bonds inside them are slow.",
    config: {
      ...SHEET,
      kind: "arithmetic",
      operation: "add",
      style: "standard",
      form: "vertical",
      range: { min: 10, max: 99 },
      count: 16,
      columns: 4,
      regrouping: "always",
    },
  },

  /* ── Times tables ───────────────────────────────────────────────────── */
  {
    slug: "multiplication-worksheets",
    name: "Multiplication facts, 1 to 12",
    short: "Multiplication",
    heading: "Multiplication worksheets",
    keyword: "Free printable multiplication worksheets",
    summary:
      "Thirty multiplication facts drawn from the whole twelve-by-twelve table, mixed, with the answer key on the second page.",
    lead: "Thirty facts from the full twelve-by-twelve table, shuffled rather than in order, thirty to a page. The mixed set is the test; the single tables are twelve pages of their own, linked below.",
    notes: [
      "A sheet of the seven times table in order can be answered by adding seven each time, which is a real skill and not the one being tested. Mixed is what proves recall: nothing on this page can be got from the answer above it, and the facts are drawn from all twelve tables so 12 × 8 turns up as often as 2 × 3.",
      "7 × 8 and 8 × 7 count as one fact here, and only one of them will be on the page. They are the same product asked from two sides, and a sheet that printed both would be giving a child twenty-nine problems and a freebie — the same fold the record book makes when it decides which facts a child actually knows.",
    ],
    teaches: "Multiplication facts to 12 × 12",
    ages: "Ages 7–11",
    strand: "tables",
    tables: ALL_TABLES,
    play: "The Grid is this sheet with a clock on it: the same twelve tables as timed cards, raced against your own best run.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "multiply",
      style: "standard",
      form: "horizontal",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      count: 30,
      columns: 3,
    },
  },
  {
    slug: "what-is-division-worksheets",
    name: "What is division? Sharing, a first lesson",
    short: "What is division",
    heading: "What is division? A first lesson in sharing",
    keyword: "What is division? A free printable first lesson",
    summary:
      "A one-page lesson that teaches division as sharing out fairly — twelve counters dealt into three rings — with a worked example, six to try, and the answers on the second page.",
    lead: "The first division sheet in the shop is a lesson, not a drill: the idea in a child’s words, a picture of 12 counters already dealt into 3 rings, the sum worked step by step, and six problems to try with the same picture beside each. Nothing to choose before it prints.",
    notes: [
      "Sharing comes first because it is the meaning of division children arrive at school already holding: a five-year-old can deal candies out fairly long before anyone shows them a ÷ sign, and the research this page follows found sharing to be the one model of division most children carry all the way into middle school. So the page starts there — one for you, one for you, one for you — and the counters are drawn already dealt into as many rings as there are children, because that is the picture children read most easily: the rings are the children, and the count in one ring is the answer.",
      "The sentence is written three ways under the picture — 12 shared between 3 is 4 each, 12 ÷ 3 = 4, 3 × 4 = 12 — so the sign is tied to the story and to the times table from the first page, and the total is always the first number written. The next lesson, division as making groups, uses the same 12 ÷ 3 to tell the other story; the two pages are meant to be read a day or two apart, and the drill sheets after them are for the week the picture is no longer needed.",
    ],
    teaches: "Division as sharing equally",
    ages: "Ages 6–8",
    strand: "tables",
    tables: [2, 3, 4, 5],
    play: "The Grid deals division as a deck of its own, for later: once a child no longer needs the rings, the same facts are there to race.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "division-sharing",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "division-as-grouping-worksheets",
    name: "Division as making groups",
    short: "Grouping",
    heading: "Division as grouping: how many 3s in 12?",
    keyword: "Free printable division as grouping worksheets",
    summary:
      "The second division lesson: the same 12 ÷ 3 read as how many groups of 3, with counters ringed along a row, a number line jumped back in threes, and six to try.",
    lead: "The same sum as the sharing lesson told the other way round: 12 ÷ 3 as how many 3s make 12. Counters in a row ringed three at a time, a number line from 0 to 12 with four jumps back of 3, the steps written out, and six problems to ring or jump through.",
    notes: [
      "A child who only ever meets division as sharing gets stuck the day the divisor stops being a number of people — you cannot share between 0.2 of a person, but you can ask how many 0.2s fit in 8.4. That second meaning is what every later sheet leans on: chunking is repeated subtraction, the number line’s jumps are the same thing drawn, and dividing by a decimal is a grouping question or it is nothing. So this page names the second story with the same numbers as the first, and says out loud that both are dividing.",
      "Four of the six problems are counters in a plain row with no rings drawn, because drawing the rings is the exercise; the last two are a blank number line, for a child to jump back along in the divisor. The answer key gives the number of groups. The lesson before this one is the sharing page, and the one after is the array, which holds both stories in one picture and the two multiplications besides.",
    ],
    teaches: "Division as making equal groups",
    ages: "Ages 6–8",
    strand: "tables",
    tables: [2, 3, 4, 5, 6],
    play: "Every fact on this page is in The Grid’s division deck, for the week the picture is no longer needed.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "division-grouping",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "division-arrays-worksheets",
    name: "Division arrays: one picture, four facts",
    short: "Arrays",
    heading: "Division arrays worksheets: one picture, four facts",
    keyword: "Free printable division arrays worksheets",
    summary:
      "A lesson on the array: 3 rows of 4 dots read as 3 × 4, 4 × 3, 12 ÷ 3 and 12 ÷ 4, then five arrays to write the two divisions under, and one bare fact to think through.",
    lead: "An array of 12 dots, three rows of four, with its four facts beside it and the picture read four ways step by step. Then five arrays to try — none of them square — each with two ruled lines for the two divisions it holds, and one fact with no picture at all.",
    notes: [
      "The array is the one picture that holds a multiplication and its two divisions at once, and turning the page a quarter turn is the commutative law: 3 rows of 4 is 4 rows of 3 without moving a dot. That is why it comes third — after sharing and grouping have each been met on their own — and why the page ends on a boxed think-multiplication: 12 ÷ 4 = ? is 4 × ? = 12, and a child who can turn one into the other has the reflex every written method later depends on, because a long division is a column of exactly that question.",
      "None of the arrays to try is square. A 4 by 4 holds only one division, and the exercise is writing two; so the five are 2 by 5, 3 by 6, 4 by 5, 3 by 7 and 4 by 6, with the row and column counts printed in the gutters and the total left for the child to find. The problems run on to a second page: five arrays with two lines under each are more than the room left under the lesson, and the lesson is not cut to make them fit — a parent who wants the lesson alone prints page one.",
    ],
    teaches: "Division as the inverse of multiplication, from arrays",
    ages: "Ages 7–9",
    strand: "tables",
    tables: [2, 3, 4, 5, 6, 7],
    play: "The Grid asks these same facts both ways, times and divide, which is the whole of what an array teaches.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "division-arrays",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "division-with-remainders-worksheets",
    name: "Division with remainders, a lesson",
    short: "Remainders",
    heading: "Division with remainders: a lesson in what is left over",
    keyword: "Free printable division with remainders worksheets for beginners",
    summary:
      "A one-page lesson on remainders: 14 counters dealt into 4 rings with 2 left outside, the check line written as a multiplication, one story where the leftover changes the answer, and six to try.",
    lead: "The fourth division lesson, for the day the candies do not share out. Fourteen counters are drawn already dealt into four rings with two left over outside them, the sum is worked step by step to 3 r 2, and the check is written the way it should be — 4 × 3 + 2 = 14 — before five more to try with the same picture, and one story about tables.",
    notes: [
      "A remainder is drawn before it is written. The two counters that would not go round sit outside every ring, which is what a leftover looks like on a table, and the answer is written as 3 r 2 with the check as a multiplication sentence rather than a chain of equals signs — because 3 r 2 is not a number, and a child who writes 14 ÷ 4 = 3 r 2 = 4 × 3 + 2 has been taught that it is. The five counter problems keep every total under two dozen and every divisor at what a child can ring.",
      "The sixth problem is a story, and it is the reason this page exists: nine children sit four to a table, and the answer is three tables, not 2 r 1. Children who can do the division perfectly still stop at the remainder when the story wants it rounded up — it is the best-known failure in the whole research on division — so the lesson works one such story on the page before asking for one. The problems run on to a second page; a parent who wants the lesson alone prints page one.",
    ],
    teaches: "Division with a remainder, and what the remainder means",
    ages: "Ages 7–9",
    strand: "tables",
    tables: [3, 4, 5, 6],
    play: "The Grid’s division deck has no remainders in it, on purpose: once a child has this page, the exact facts are the ones to race.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "division-remainders",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "partial-quotients-division-worksheets",
    name: "Partial quotients: division by chunking",
    short: "Chunking",
    heading: "Partial quotients worksheets: division by chunking, explained",
    keyword: "Free printable partial quotients division worksheets",
    summary:
      "A one-page lesson on chunking, or partial quotients: 156 ÷ 12 as one hop of 120 and one of 36 along a number line, the column written down the page, and six to try with room to work.",
    lead: "Division by taking away big lumps of the divisor — ten twelves at once, then three more — which is what partial quotients means. The number line shows the two hops, the column is written down the page the way a child writes it, the steps say why each lump was chosen, and six divisions by two-digit numbers follow with blank room under each for the lumps.",
    notes: [
      "This page comes before long division, not after it, and that is the research talking. Children who reach the compact algorithm by way of chunking make fewer of the errors that come from following steps without a reason, because every line of a chunked division says what it means: 156 take away 120 is ten twelves gone. Every divisor here has two digits, since a one-digit divisor is a table fact a child can already do in their head and would learn nothing from, and the last one leaves a remainder to show the method survives one.",
      "Any lump works, and the lesson says so: five twelves at a time gets to the same answer in more steps, and ten-lumps are only the fastest. What the child is practicing is writing every lump down and adding them at the end — the side column — which is the habit the long-division page then abbreviates into a digit over each column. The six problems run on to a second page, each with six lines of room, so the working has somewhere to go.",
    ],
    teaches: "Division by partial quotients (chunking)",
    ages: "Ages 9–11",
    strand: "tables",
    tables: [11, 12],
    play: "Not in the games. The multiples a child reaches for — ten twelves, three twelves — are, in The Grid.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "division-chunking",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "how-to-do-long-division-worksheets",
    name: "How to do long division, step by step",
    short: "Long division lesson",
    heading: "How to do long division: a step-by-step lesson",
    keyword: "How to do long division, a free printable step-by-step lesson",
    summary:
      "A one-page lesson on long division: 657 ÷ 3 worked in the bracket with every written square shaded, the four steps explained in place-value words, and six to try on the guided grid.",
    lead: "Divide, multiply, subtract, bring down — the four words a child meets at school, each printed beside what it means. The worked example is 657 ÷ 3 in the bracket with the shaded squares filled in, the steps under it say what every digit is worth, and six three-digit divisions follow: four with the squares shaded, two with the shape of the working drawn and the squares left plain.",
    notes: [
      "The words are the abbreviation, and the page’s job is the thing abbreviated. A child chanting the four steps can carry them out with no idea that the 2 they wrote is two hundreds, and that child brings the next digit down into the wrong column, which is the commonest long-division error there is. So every step here is said in place-value language — how many 3s in 6 hundreds? — and the grid under the bracket gives every digit a column of its own. Read the chunking page first if the bracket is new: this is the same method, written shorter.",
      "The six to try are chosen so the method is met clean: three digits by one, the first digit at least the divisor, no remainder and no zero in the answer. Four are guided, with the squares that get written in shaded and the last row marked R; two show only the minus signs and the rules, for a child who no longer needs to be shown which square. The problems run on to a second page. The long-division drill pages carry on from here, with the grid, the zeros and the two-digit divisors.",
    ],
    teaches: "Long division, three digits by one, in the bracket",
    ages: "Ages 9–11",
    strand: "tables",
    tables: [3, 4, 5, 7],
    play: "Every subtraction under the bar and every fact over it is in The Grid; the bracket itself is paper's.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "long-division-steps",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "division-worksheets",
    name: "Division facts, 1 to 12",
    short: "Division",
    heading: "Division worksheets",
    keyword: "Free printable division worksheets",
    summary:
      "Thirty division facts, every one of them a times-table fact read backwards, with an answer key.",
    lead: "Thirty divisions with whole-number answers, drawn from the same twelve tables as the multiplication sheet and read the other way round. Nothing here divides by zero and nothing leaves a remainder.",
    notes: [
      "Every question on this page is a table fact asked backwards: 56 ÷ 7 is “seven times what makes fifty-six?”. A child who knows their tables can answer all thirty, and a child who cannot answer them has been told exactly which table to go back to — which is what a division sheet is diagnostically good for.",
      "Unlike multiplication, division does not fold. 56 ÷ 7 and 56 ÷ 8 are two different questions with two different answers, so both may appear on one page, and that is not a repeat. It is the same distinction the game makes when it decides what counts as one fact and what counts as two.",
    ],
    teaches: "Division facts to 144 ÷ 12",
    ages: "Ages 8–11",
    strand: "tables",
    tables: ALL_TABLES,
    play: "The Grid deals division as its own deck, so the table a child is slow to divide by can be raced rather than re-printed.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "divide",
      style: "standard",
      form: "horizontal",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      count: 30,
      columns: 3,
    },
  },
  {
    slug: "multiplication-chart",
    name: "Blank multiplication chart",
    short: "Chart",
    heading: "Multiplication chart",
    keyword: "Free printable multiplication chart",
    summary:
      "A blank twelve-by-twelve grid with the headers printed, to be filled in — and the completed chart on the second page.",
    lead: "The twelve-by-twelve square with its headers printed and its hundred and forty-four squares empty. Filling one in is a lesson; the finished chart on the second page is the wall chart.",
    notes: [
      "A chart a child fills in is worth more than a chart they are handed, and it is the same piece of paper. Working across a row is counting in that number; working down a column is the same facts from the other side; and the squares that stay empty longest are a map of exactly which tables to practice.",
      "The completed grid is the second page, so one print gives both. It is worth pinning up: the diagonal from 1 to 144 is the square numbers, the grid is symmetrical about it — which is 7 × 8 and 8 × 7 being one fact, drawn — and the half above the diagonal is the only half anybody has to learn.",
    ],
    teaches: "The multiplication table to 12 × 12",
    ages: "Ages 7–11",
    strand: "tables",
    tables: ALL_TABLES,
    play: "The Grid is the same twelve-by-twelve square with a clock on it — the squares that stay blank longest here are the decks to race there.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "multiply",
      style: "grid",
      form: "horizontal",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      count: 0,
      columns: 1,
    },
  },
  {
    slug: "long-division-worksheets",
    name: "Long division, 3-digit by 1-digit",
    short: "Long division",
    heading: "Long division worksheets",
    keyword: "Free printable long division worksheets",
    summary:
      "Nine long divisions set in the bracket, three digits by one, with room to work and no remainders.",
    lead: "Three-digit numbers divided by one digit, set in the bracket with the quotient written along the top, and blank space under each one to bring the digits down into. Every answer comes out exactly.",
    notes: [
      "No remainders on this sheet. A remainder is a change of question rather than a harder version of the same one, and a child who has not been taught what to do with the two left over has been set an impossible problem rather than a stretching one. The builder has the switch for the week that changes.",
      "The working is the exercise here, not the answer, which is why each problem gets a band of blank paper under it rather than a ruled line. The answer key shows the quotient; if it disagrees with what a child got, the place to look is the column the first digit came down into.",
    ],
    teaches: "Long division without remainders",
    ages: "Ages 9–12",
    strand: "tables",
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
    play: "A long division is a stack of table facts with subtraction in between. The Grid drills both halves, which is usually where it actually goes wrong.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "divide",
      style: "long",
      form: "vertical",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      digits: { into: 3, by: 1 },
      remainders: false,
      count: 9,
      columns: 3,
      workspace: true,
    },
  },
  {
    slug: "long-division-grid-worksheets",
    name: "Long division on a grid, 3-digit by 1-digit",
    short: "Division grid",
    heading: "Long division worksheets with grids",
    keyword: "Free printable long division worksheets with grids",
    summary:
      "Nine long divisions set in the bracket on a place-value grid — a column for each digit and a square for every line of working — with no remainders.",
    lead: "The same three-digit-by-one-digit divisions as the plain sheet, set on a grid of squares: a column for each digit of the dividend, a box for each digit of the quotient above the bar, and a square for every line of working underneath. Every answer comes out exactly.",
    notes: [
      "The grid is there for place value. The commonest long-division mistake is not a wrong table fact but a digit brought down into the wrong column — the working drifts a place to the left, the quotient comes out a digit short, and the child cannot see why. With a column for each digit there is only one square the brought-down digit can go in, and the quotient digit sits exactly over the digit it divided into.",
      "The grid is the first of three levels of help. The builder can add the minus signs and the rules under each take-away row, so the shape of the method is on the page before the numbers are; and beyond that it can shade the squares a division actually writes in and label the last row R, which is the sheet for the first week. Take the help away a level at a time as the columns start to hold themselves.",
    ],
    teaches: "Long division on a place-value grid",
    ages: "Ages 9–12",
    strand: "tables",
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
    play: "A long division is a stack of table facts with subtraction in between, and the grid only holds the columns. The Grid drills the facts themselves.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "divide",
      style: "long",
      form: "vertical",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      digits: { into: 3, by: 1 },
      remainders: false,
      help: "grid",
      count: 9,
      columns: 3,
      workspace: true,
    },
  },
  {
    slug: "long-division-2-digit-divisor-worksheets",
    name: "Long division, 4-digit by 2-digit",
    short: "Two-digit divisor",
    heading: "Long division worksheets with 2-digit divisors",
    keyword: "Free printable long division worksheets with 2-digit divisors",
    summary:
      "Six long divisions of a four-digit number by a two-digit one, set in the bracket on a place-value grid with no remainders, and an answer key.",
    lead: "Four-digit numbers divided by two-digit ones, six to a page, set in the bracket on a grid of squares: a column for each of the four digits, a box for each digit of the quotient above the bar, and rows of squares for the working. Every answer comes out exactly.",
    notes: [
      "The step up from a one-digit divisor is not the division, it is the estimating. How many 23s in 161 is not a table fact, and a child who has only ever divided by 7 has never had to guess, check and adjust. The grid holds the columns while they do: the first digit of the answer lands over the third digit of the dividend, because 1 and 16 are both smaller than 23, and that is the first thing this sheet teaches.",
      "Six to a page rather than nine, because four digits by two is a tall piece of working — up to three take-aways with a digit brought down after each — and the rows are reserved for the longest case rather than the average one. No remainders here; the builder adds them, and steps the help up to the marked take-away rows or the shaded guided grid.",
    ],
    teaches: "Long division by a two-digit number",
    ages: "Ages 10–12",
    strand: "tables",
    play: "Every estimate on this sheet is a multiplication by a two-digit number, and every take-away is a subtraction. The Grid drills the facts under both.",
    config: {
      ...SHEET,
      kind: "multiplication",
      operation: "divide",
      style: "long",
      form: "vertical",
      tables: ALL_TABLES,
      factors: { min: 1, max: 12 },
      digits: { into: 4, by: 2 },
      remainders: false,
      help: "grid",
      count: 6,
      columns: 2,
    },
  },

  /* ── Parts of a number ──────────────────────────────────────────────── */
  {
    slug: "fraction-worksheets",
    name: "Adding and subtracting fractions",
    short: "Fractions",
    heading: "Fraction worksheets",
    keyword: "Free printable fraction worksheets",
    summary:
      "Twelve fractions added and taken away, like and unlike denominators mixed, with every answer in its lowest terms.",
    lead: "Twelve additions and subtractions over halves, thirds, quarters and up to twelfths — some pairs sharing a denominator, some not — with space to work and an answer key that has already been simplified.",
    notes: [
      "Adding quarters to quarters and adding quarters to thirds are a week apart in the classroom, and this page has both, because telling them apart is the skill. The first thing to do with each problem is not to add anything: it is to look at the two bottom numbers and decide whether there is a common denominator to find.",
      "Every answer on the key is in its lowest terms. That is the part a generated worksheet usually gets wrong — 2/8 and 1/4 are the same value and only one of them is marked right — so the arithmetic here is done in whole numbers and reduced by a greatest common divisor rather than by rounding a decimal that was never exact.",
    ],
    teaches: "Adding and subtracting fractions",
    ages: "Ages 9–12",
    strand: "parts",
    play: "Fractions are not in the games yet. What is underneath them — the times tables that find a common denominator — is, in The Grid.",
    config: {
      ...SHEET,
      kind: "fractions",
      style: "arithmetic",
      operation: "both",
      denominators: DENOMINATORS,
      pairing: "either",
      count: 12,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "equivalent-fractions-worksheets",
    name: "Equivalent fractions",
    short: "Equivalent",
    heading: "Equivalent fractions worksheets",
    keyword: "Free printable equivalent fractions worksheets",
    summary:
      "Sixteen pairs of fractions with one number missing from the second — the same value written another way.",
    lead: "One fraction, then the same value written with a different bottom number and one of the two numbers left blank. Sixteen to a page, and an answer key.",
    notes: [
      "This is the sheet that makes everything after it possible. A child who can see that 3/4 and 6/8 are one number, written twice, can add unlike fractions, simplify an answer and compare two fractions without a calculator; a child who cannot is doing all three by a rule they will forget over a summer.",
      "Whatever you do to the top you do to the bottom — but only multiplying and dividing, never adding. That is worth saying while the sheet is being worked, because 3/4 and 4/5 look convincingly like the same fraction with one added to each half, and every child tries it once.",
    ],
    teaches: "Equivalent fractions",
    ages: "Ages 8–11",
    strand: "parts",
    play: "Not in the games. The nearest thing on screen is the times tables in The Grid, which is what the scaling on this sheet is made of.",
    config: {
      ...SHEET,
      kind: "fractions",
      style: "equivalent",
      operation: "add",
      denominators: DENOMINATORS,
      pairing: "either",
      count: 16,
      columns: 2,
    },
  },
  {
    slug: "decimal-place-value-worksheets",
    name: "Decimal place value",
    short: "Place value",
    heading: "Decimal place value worksheets",
    keyword: "Free printable decimal place value worksheets",
    summary:
      "Fourteen questions asking what one digit of a two-place decimal is worth — the 5 in 3.75 is 0.05 — with an answer key.",
    lead: "Fourteen decimals with two places and whole parts of up to two digits, each with one digit picked out: what is the 5 in 43.75 worth? The answer is written as a number — 0.05 — so a child has to read the column the digit sits in, not just name it.",
    notes: [
      "The digit asked about appears exactly once in its number, so “the 7 in 47.35” names one column and no other. Most of the questions point at the digits after the point, which is what the sheet is for, but some point at a tens or units digit — a child who assumes every answer is small has stopped reading the columns, and the 4 in 43.75 being worth 40 is the check.",
      "The answer is a number rather than a word, deliberately. “Hundredths” is a label a child can produce without knowing what it means; 0.05 is a value they have to place, and it is the form that carries into every decimal sum they do afterwards. The key prints each worth at the places its column has — 0.7, 0.05, 40 — and never 0.70 or 0.050.",
    ],
    teaches: "Decimal place value",
    ages: "Ages 8–11",
    strand: "parts",
    play: "Not in the games, which drill facts rather than number sense.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "place",
      operation: "add",
      form: "horizontal",
      places: 2,
      range: { min: 0, max: 99 },
      count: 14,
      columns: 2,
    },
  },
  {
    slug: "comparing-decimals-worksheets",
    name: "Comparing decimals",
    short: "Comparing",
    heading: "Comparing decimals worksheets",
    keyword: "Free printable comparing decimals worksheets",
    summary:
      "Eighteen pairs of decimals to write <, > or = between, built around the pairs that catch “longer is bigger”, with an answer key.",
    lead: "Eighteen pairs of decimals with a gap between them for <, > or =. Half the pairs share a whole part and differ in how many places they have — 4.5 against 4.45 — a quarter are the same number written two ways, 3.4 and 3.40, and the rest are two ordinary two-place decimals.",
    notes: [
      "The pairs are built for the two wrong rules children actually use. One says a longer decimal is bigger, so 4.45 beats 4.5 because 45 beats 5; the other, learned later, says a shorter one is bigger because tenths are bigger than hundredths, so 4.5 beats 4.55. On this sheet the longer number is bigger about half the time and smaller the other half, so neither rule gets a child through the page — only lining the points up does.",
      "The equal pairs are there because trailing zeros are where a lot of decimal trouble starts: 3.40 is 3.4, and a child who marks it bigger is reading the digits as a whole number. Every value keeps the places it was drawn with — 3.40 stays 3.40 on the page — because that is the form the question is about. A tenths sheet in the builder has none of these pairs, since every number on it has one place.",
    ],
    teaches: "Comparing decimals",
    ages: "Ages 9–11",
    strand: "parts",
    play: "Not in the games, which drill facts rather than number sense.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "compare",
      operation: "add",
      form: "horizontal",
      places: 2,
      range: { min: 0, max: 20 },
      count: 18,
      columns: 3,
    },
  },
  {
    slug: "ordering-decimals-worksheets",
    name: "Ordering decimals",
    short: "Ordering",
    heading: "Ordering decimals worksheets",
    keyword: "Free printable ordering decimals worksheets",
    summary:
      "Ten sets of four or five decimals to write in order, smallest first, on a ruled line under each set, with an answer key.",
    lead: "Ten sets of four or five decimals — 3.4, 3.04, 3.45, 3.5 — with a ruled line under each to write them in order, smallest first. Every set shares a whole part, so the ordering is decided after the point, and the decimals in a set have one or two places between them.",
    notes: [
      "Mixed places inside a set are the point. Four two-place decimals sort the way whole numbers do, and a child can do it without thinking about the point at all; 3.4 next to 3.04 and 3.45 cannot be sorted that way, and lining them up — 3.40, 3.04, 3.45 — is the method the sheet is for. No set contains the same value twice, and none is already in order.",
      "The answer goes on a ruled line rather than in a box, because the answer is the whole set rewritten and a box would fit one number. On the key the line carries the sorted set. The sheet is two columns wide at most, since a line of five decimals will not fit a narrower column, and the builder drops it to one column at larger type for the same reason.",
    ],
    teaches: "Ordering decimals",
    ages: "Ages 9–11",
    strand: "parts",
    play: "Not in the games, which drill facts rather than number sense.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "order",
      operation: "add",
      form: "horizontal",
      places: 2,
      range: { min: 0, max: 20 },
      count: 10,
      columns: 2,
    },
  },
  {
    slug: "rounding-decimals-worksheets",
    name: "Rounding decimals",
    short: "Rounding",
    heading: "Rounding decimals worksheets",
    keyword: "Free printable rounding decimals worksheets",
    summary:
      "Eighteen two-place decimals to round to the nearest tenth — 2.97 becomes 3.0 — including the ones that carry through a 9, with an answer key.",
    lead: "Eighteen decimals with two places, each to be rounded to the nearest tenth: 5.62 to 5.6, 9.78 to 9.8, and 2.97 to 3.0. The hundredths digit is the one that decides, and about one question in four is built so that rounding up carries through a 9.",
    notes: [
      "The rule most children carry is “5 or more, add one to the last digit”, and it works until the digit is a 9. 2.97 to the nearest tenth is 3.0, not 2.10, and a sheet that never sets that case never finds out whether a child is rounding or just adding one. Here about one question in four is a 9 that has to carry, which is often enough to be practiced and rare enough not to be expected.",
      "Every answer is printed to one place, so 2.97 rounds to 3.0 and not to 3. The zero is not decoration: it says the number was rounded to tenths, which is the whole of what was asked. The builder rounds to the nearest whole number or hundredth as well, and the values always carry one place more than the target, because that is the only digit rounding looks at.",
    ],
    teaches: "Rounding decimals",
    ages: "Ages 9–11",
    strand: "parts",
    play: "Not in the games, which drill facts rather than number sense.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "round",
      operation: "add",
      form: "horizontal",
      to: "tenth",
      places: 2,
      range: { min: 0, max: 20 },
      count: 18,
      columns: 3,
    },
  },
  {
    slug: "multiplying-decimals-by-10-explained-worksheets",
    name: "Multiplying and dividing by 10, 100 and 1000, explained",
    short: "By 10, explained",
    heading:
      "Multiplying decimals by 10, 100 and 1000, explained on a place-value chart",
    keyword:
      "Multiplying and dividing decimals by 10, 100 and 1000 explained, a free printable lesson",
    summary:
      "A one-page lesson on a place-value chart: 3.7 sliding one column left under × 10, 48 sliding three right under ÷ 1000 with its noughts written in, the sentence the digits move and the point stays, and six to try.",
    lead: "A place-value chart with the point drawn as a fixed heavy line, and the digits moving past it: 3.7 becomes 37 when every digit steps one column left, 48 becomes 0.048 when every digit steps three columns right and the empty places are filled with noughts. The steps say what each digit is worth before and after, and six questions follow.",
    notes: [
      "Move the decimal point is the rule most parents were taught, and it is not what this page says, for a reason that is worth a sentence. A digit one column to the left is worth ten times as much — that is what × 10 does — and a child who says the 7 was tenths and is now ones can explain the answer; a child who slid a point can only report it. The two pictures give the same answers, and the lesson does not call the other one wrong; it teaches the one that keeps a child saying what each digit is worth.",
      "The division example is a whole number on purpose. 48 ÷ 1000 is the question a child who has only ever slid a point along a decimal has nowhere to start on, and the chart shows what happens: the 4 and the 8 step three columns right, and the ones and tenths columns are left empty until noughts are written in them, so the answer is 0.048 and not .48. The six to try mix decimals with whole numbers the same way, and run on to a second page.",
    ],
    teaches: "Multiplying and dividing by powers of ten, as the digits moving",
    ages: "Ages 9–12",
    strand: "parts",
    tables: [10],
    play: "Not in the games. The ten times table underneath is, in The Grid.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "decimals-powers-of-ten",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "multiplying-decimals-by-10-100-1000-worksheets",
    name: "Multiplying and dividing by 10, 100 and 1000",
    short: "By 10, 100, 1000",
    heading: "Multiplying and dividing decimals by 10, 100 and 1000 worksheets",
    keyword:
      "Free printable worksheets for multiplying and dividing decimals by 10, 100 and 1000",
    summary:
      "Eighteen decimals and whole numbers multiplied and divided by 10, 100 and 1000, taught as the digits moving, with an answer key.",
    lead: "Eighteen questions of the form 3.7 × 100 and 48 ÷ 1000, mixing two-place decimals with whole numbers, multiplied and divided by ten, a hundred and a thousand. The instruction line says how: the digits move, and the point stays where it is.",
    notes: [
      "“Move the decimal point” is the rule most adults were taught, and it is not what this sheet says. The digits move — one place to the left for every ten multiplied by, one to the right for every ten divided by — and the point stays put, because a digit one column to the left is worth ten times as much, and that is the reason the answer is what it is. The two pictures give the same answers; the digits-move one keeps a child saying what each digit is now worth.",
      "A third of the questions are whole numbers, and the divisions among them — 48 ÷ 1000 is 0.048 — are the ones a child who has only ever slid a point along a decimal has nowhere to start on. Answers never run past three places, no value on the sheet ends in a zero, and a whole number that turns into a decimal keeps its leading zero: 0.048, never .048.",
    ],
    teaches: "Multiplying and dividing decimals by powers of ten",
    ages: "Ages 9–12",
    strand: "parts",
    tables: [10],
    play: "Not in the games. The ten times table it rests on is, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "powers",
      operation: "multiply",
      form: "horizontal",
      places: 2,
      range: { min: 0, max: 99 },
      count: 18,
      columns: 3,
    },
  },
  {
    slug: "decimal-worksheets",
    name: "Adding and subtracting decimals",
    short: "Decimals",
    heading: "Decimal worksheets",
    keyword: "Free printable decimal worksheets",
    summary:
      "Twelve two-place decimals added and taken away in columns, with the points lined up and an answer key.",
    lead: "Two-place decimals stacked in columns so the points sit under one another, added and taken away, twelve to a page. Every value prints to the same number of places, which is what makes the column line up.",
    notes: [
      "Lining up the decimal points is the whole lesson, and it is why these are stacked rather than written along a line. A child adding 4.70 and 12.05 as though they were 470 and 1205 gets the digits right and the answer ten times too big, and a page where the points are already in a column makes that mistake visible rather than mysterious.",
      "Nothing here was worked out in floating point. 0.1 + 0.2 is not 0.3 in a computer, and a worksheet generator that adds decimals the obvious way prints an answer key with 0.30000000000000004 in it — or, worse, silently rounds and prints a key that is wrong in the last place. These sums are done in whole hundredths and the point is put back at the end.",
    ],
    teaches: "Adding and subtracting decimals",
    ages: "Ages 9–12",
    strand: "parts",
    play: "Not in the games. The number bonds under a decimal column are, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "both",
      form: "vertical",
      places: 2,
      range: { min: 0, max: 50 },
      count: 12,
      columns: 3,
    },
  },
  {
    slug: "multiplying-decimals-worksheets",
    name: "Multiplying decimals by decimals",
    short: "Multiplying decimals",
    heading: "Multiplying decimals worksheets",
    keyword: "Free printable multiplying decimals worksheets",
    summary:
      "Twelve one-place decimals multiplied by one-place decimals in columns — 3.7 × 2.4 — with the places counted into the answer, and an answer key.",
    lead: "Twelve decimals with one place multiplied by decimals with one place, stacked in columns: 3.7 × 2.4 is 8.88. The method is to multiply as if there were no points and then count the decimal places in both numbers — two here — and put that many in the answer.",
    notes: [
      "This is the sheet where lining the points up stops being the rule. A decimal sum is set with the points in a column; a decimal product is set with the digits lined up on the right, worked as 37 × 24, and given its point at the end by counting — one place in each number, so two in the answer. The instruction line says so, because a child who lines the points up here gets a neat column and a wrong answer.",
      "Neither number ends in a zero, so the count of places in the question is the count that is true — 3.70 × 2.4 would show three places and mean two — and every answer is printed with exactly the places the count gives, 4.5 × 0.2 being 0.90 and never 0.9. The multiplier is under ten, so each one is a short long-multiplication rather than a long one.",
    ],
    teaches: "Multiplying a decimal by a decimal",
    ages: "Ages 10–12",
    strand: "parts",
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
    play: "A decimal product is a long multiplication with the point put back, and a long multiplication is a stack of table facts. The Grid drills the facts.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "multiply",
      by: "decimal",
      form: "vertical",
      places: 1,
      range: { min: 0, max: 9 },
      count: 12,
      columns: 3,
    },
  },
  {
    slug: "dividing-decimals-explained-worksheets",
    name: "Dividing decimals, explained",
    short: "Dividing decimals lesson",
    heading:
      "Dividing decimals explained: 8.46 ÷ 3 in the bracket, step by step",
    keyword:
      "Dividing decimals explained, a free printable step-by-step lesson",
    summary:
      "A one-page lesson on dividing a decimal by a whole number: 8.46 ÷ 3 worked in the bracket with the point carried straight up, an estimate first, and six to try on the guided grid.",
    lead: "A decimal divided exactly like a whole number, with one extra thing to get right: the point in the answer sits directly above the point in the question. 8.46 ÷ 3 is worked in the bracket with every written square shaded, the steps say what each column is worth — ones, tenths, hundredths — and six divisions follow, three guided and three with the shape of the working alone.",
    notes: [
      "The first step is an estimate, and it is there to make the point's position a matter of size rather than of counting. 8.46 is nearly 9, and 9 ÷ 3 is 3, so the answer is a bit under 3 — which means 2.82 is right and 28.2 and 0.282 are not, whatever the digits say. A child who checks the answer against the estimate has a way of catching the commonest decimal-division error; a child who counts places has a rule, and rules slip.",
      "Two of the six to try are chosen for the squares a child leaves empty. 5.46 ÷ 6 starts with a nought, which has to be written — 0.91, never .91 — and 8.16 ÷ 4 has a nought in the tenths, which has to be written too or the answer is 2.4. Both are among the guided three, where the shading says the square is written in. The problems run on to a second page, and the dividing-decimals drill pages follow with the grid alone.",
    ],
    teaches:
      "Dividing a decimal by a whole number, with the point placed by size",
    ages: "Ages 10–12",
    strand: "parts",
    tables: [3, 4, 5, 6, 8],
    play: "A decimal division is a long division with the point carried up, and a long division is a stack of table facts. The Grid drills the facts.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "decimal-division",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "how-to-divide-by-a-decimal-worksheets",
    name: "How to divide by a decimal",
    short: "Divide by a decimal, explained",
    heading: "How to divide by a decimal: 8.4 ÷ 0.2 is 84 ÷ 2",
    keyword: "How to divide by a decimal, a free printable lesson",
    summary:
      "A one-page lesson on dividing by a decimal: 8.4 ÷ 0.2 asked as how many 0.2s make 8.4, rewritten as 84 ÷ 2 by scaling both numbers by ten, and six to try with a line for the rewrite and a line for the answer.",
    lead: "You cannot share between 0.2 of a person, but you can ask how many 0.2s make 8.4 — and that question has the same answer as how many 2s make 84. The lesson scales both numbers by ten, works 84 ÷ 2, checks that 42 × 0.2 is 8.4, and says why the answer came out bigger than the number you started with. Six to try follow, two of them needing a hundred rather than ten.",
    notes: [
      "This is the page where division stops making things smaller, and it says so out loud. Every child arrives with the belief that dividing shrinks a number, because it always has; 8.4 ÷ 0.2 = 42 breaks it, and a child who is not told why concludes the sum is wrong. It is a grouping question — how many small pieces fit — so a big answer is the right kind of answer, and the fraction bar at the top shows five 0.2s in a single one before the sum is attempted.",
      "The six to try are written along a line with two ruled lines under each, not in a bracket: the first line is for the rewritten sum, the second for the answer. Scaling only one of the two numbers is the mistake this shape catches, since the rewrite has to be written down before it is divided, and the answer key shows both lines. Four are scaled by ten and two by a hundred, so the multiplier is a thing to decide rather than a number to remember. The problems run on to a second page.",
    ],
    teaches:
      "Dividing by a decimal, by rewriting as an equivalent whole-number division",
    ages: "Ages 11–13",
    strand: "parts",
    play: "Not in the games. The whole-number division each one turns into is, in The Grid.",
    config: {
      ...SHEET,
      kind: "lesson",
      topic: "dividing-by-decimals",
      practice: true,
      fontPt: 14,
    },
  },
  {
    slug: "dividing-decimals-worksheets",
    name: "Dividing decimals by whole numbers",
    short: "Dividing decimals",
    heading: "Dividing decimals worksheets",
    keyword: "Free printable dividing decimals worksheets",
    summary:
      "Nine two-place decimals divided by a single digit, set in the bracket on a place-value grid with the point placed above the bar, and an answer key.",
    lead: "Two-place decimals divided by the numbers two to nine, set in the bracket with a column for every digit, a box for each digit of the answer above the bar, and a square for every line of working underneath. Every division comes out exactly, because each one was made from its answer.",
    notes: [
      "The whole lesson is where the point goes, and this sheet says it as geometry: the point in the answer sits directly above the point in the number, on the line between the same two columns. The grid draws it there before the child starts, so what is left to do is the long division they already know — the working under the bar never sees a point at all.",
      "Every answer is exact, and none was found by dividing. Each division was built backwards from its answer — the answer drawn, multiplied by the divisor, and the product written under the bar — so nothing on the key is rounded, nothing recurs, and an answer under one is written 0.23 with its leading zero, the way a child is asked to write it. The builder turns the grid off, or steps it up to the marked and shaded levels the long-division pages use.",
    ],
    teaches: "Dividing a decimal by a whole number",
    ages: "Ages 10–12",
    strand: "parts",
    tables: [2, 3, 4, 5, 6, 7, 8, 9],
    play: "A decimal division is a long division with the point carried up, and a long division is a stack of table facts. The Grid drills the facts.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "divide",
      form: "vertical",
      places: 2,
      range: { min: 0, max: 9 },
      help: "grid",
      count: 9,
      columns: 3,
    },
  },
  {
    slug: "dividing-decimals-by-two-digit-numbers-worksheets",
    name: "Dividing decimals by two-digit numbers",
    short: "Decimals by two digits",
    heading: "Dividing decimals by two-digit numbers worksheets",
    keyword:
      "Free printable worksheets for dividing decimals by two-digit numbers",
    summary:
      "Nine two-place decimals divided by numbers from 11 to 25, set in the bracket on a grid with the take-away rows marked, and an answer key.",
    lead: "The same bracket as the single-digit sheet with the divisor grown to two digits, from 11 to 25: dividends that run to three digits before the point, the first digit of the answer landing a column further in, and the minus sign and the rule under each take-away row drawn in before the numbers are.",
    notes: [
      "A two-digit divisor changes one thing and it is not the arithmetic: the first digit of the answer goes a column further to the right, because 1 and then 13 are both smaller than 25 and the first number that isn’t is 131. That is the mistake this sheet exists for, and the reason the take-away rows are marked — the shape of the working is on the page, and the child has only to decide which column it starts in.",
      "Multiplying by 25 is not a table fact, and a child who has to guess how many 25s are in 131 will guess. Writing the first few multiples of the divisor down the margin before starting is the habit to build, and the divisors stop at 25 so that every one of those lists is short. The builder runs them to 99, and steps the help down to the bare grid or up to the shaded guided sheet.",
    ],
    teaches: "Dividing a decimal by a two-digit number",
    ages: "Ages 10–12",
    strand: "parts",
    play: "Not in the games, which stop at the twelve times table. The subtraction under every row is, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "divide",
      form: "vertical",
      places: 2,
      range: { min: 0, max: 9 },
      divisor: { min: 11, max: 25 },
      help: "steps",
      count: 9,
      columns: 3,
    },
  },
  {
    slug: "dividing-by-decimals-worksheets",
    name: "Dividing by a decimal",
    short: "By a decimal",
    heading: "Dividing by decimals worksheets",
    keyword: "Free printable dividing by decimals worksheets",
    summary:
      "Twelve divisions by a decimal — 8.4 ÷ 0.2 — written along a line with room to rewrite each one as a whole-number division, and an answer key.",
    lead: "Decimals divided by decimals, written along a line with work space under each: the divisor has one or two places, the number divided has at least as many, and every one is meant to be rewritten first — multiply both sides by ten or a hundred until the divisor is whole — and then divided.",
    notes: [
      "These are deliberately not set in the bracket. The method is to change the question into one you can already do — 8.4 ÷ 0.2 is 84 ÷ 2, because multiplying both numbers by ten leaves the answer alone — and a bracket would have to show either the question, which is not what gets worked, or the rewritten sum, which is not what was asked. So each one is a sentence with room underneath, and the rewriting is the work.",
      "Every answer is exact, because every division here was built the other way round: a whole-number division was drawn first and the points put in afterwards, so the rewritten sum is always one that comes out. Some answers are whole and some are not — 0.91 ÷ 0.7 is 1.3 — which is the check that the rewriting was done to both numbers and not just to one of them.",
    ],
    teaches: "Dividing by a decimal",
    ages: "Ages 11–13",
    strand: "parts",
    play: "Not in the games. The whole-number division each one turns into is, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "divide",
      form: "horizontal",
      by: "decimal",
      places: 2,
      range: { min: 1, max: 40 },
      count: 12,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "long-division-with-decimals-worksheets",
    name: "Long division with decimal answers",
    short: "Decimal answers",
    heading: "Long division with decimals worksheets",
    keyword: "Free printable long division worksheets with decimal answers",
    summary:
      "Nine whole-number divisions whose answers run past the point — 7 ÷ 4 = 1.75 — set in the bracket with the zeros already annexed, on a grid, with an answer key.",
    lead: "Whole numbers divided to a decimal answer instead of a remainder: 7 ÷ 4 is 1.75. Each dividend is printed with a point and two zeros after it, 7.00, so there is something to keep dividing into, and the grid gives every digit of the working a column.",
    notes: [
      "This is the sheet for the week after remainders. A child who can write 7 ÷ 4 = 1 r 3 has stopped at the point; annexing the zeros — 7.00 — and carrying on is the same algorithm run two more columns, and the point in the answer goes where the point in the number is. The zeros are printed rather than left for the child to add, because forgetting them is not the lesson.",
      "Only divisors that share a factor with ten — 2, 4, 5, 6 and 8 here — can give an answer that stops, so those are the ones drawn; 7 ÷ 3 never ends and is not a question for this sheet. Every answer is printed to two places, 1.50 as well as 1.75: the zero is the last column worked and found empty, which is worth seeing once.",
    ],
    teaches: "Long division with a decimal answer",
    ages: "Ages 10–12",
    strand: "parts",
    tables: [2, 4, 5, 6, 8],
    play: "Not in the games. The table facts under each row are, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "standard",
      operation: "divide",
      form: "vertical",
      places: 2,
      range: { min: 1, max: 9 },
      wholeDividend: true,
      help: "grid",
      count: 9,
      columns: 3,
    },
  },
  {
    slug: "percentage-worksheets",
    name: "Percentages of an amount",
    short: "Percentages",
    heading: "Percentage worksheets",
    keyword: "Free printable percentage worksheets",
    summary:
      "Twelve percentages of an amount, in the sizes a shop actually uses, with an answer key.",
    lead: "Twelve questions of the form “what is 25% of 80?”, using the percentages that turn up in real life rather than the ones that happen to be easy to generate, with room to work.",
    notes: [
      "A percentage is a fraction with a hundred underneath it, and the fastest route through most of these is to say that out loud: 25% is a quarter, 10% is a tenth, and 15% is a tenth plus half of it. A child who reaches for a formula on 50% of 60 has learned the wrong thing about percentages.",
      "The amounts run from ten to two hundred, which is roughly the range a price tag, a test score and a recipe live in. That matters more than it sounds — the whole reason this topic is on the syllabus is that it is the one piece of school arithmetic an adult uses weekly.",
    ],
    teaches: "Finding a percentage of an amount",
    ages: "Ages 10–13",
    strand: "parts",
    play: "Not in the games. The tables that make 25% of 80 a one-step question are, in The Grid.",
    config: {
      ...SHEET,
      kind: "decimals",
      style: "percent",
      operation: "multiply",
      form: "horizontal",
      places: 2,
      range: { min: 10, max: 200 },
      count: 12,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "money-worksheets",
    name: "Adding and subtracting money",
    short: "Money",
    heading: "Money worksheets",
    keyword: "Free printable money worksheets",
    summary:
      "Twelve amounts of money added and taken away in columns, in dollars, with an answer key.",
    lead: "Dollars and cents stacked in columns, added and taken away — the arithmetic a till does — twelve to a page. Pounds and euros are the same sheet with a different symbol, one switch away in the builder.",
    notes: [
      "Money is a two-place decimal wearing a symbol, which is exactly why it is taught before decimals in most classrooms: a child who cannot say what 0.05 means can usually tell you what five cents is. If the decimals sheet is going badly, this one is often the way back into it.",
      "Every answer prints with both places, so $4.50 is not $4.5. That is a small thing on screen and a real one on paper — writing money with one figure after the point is the commonest mark lost on this topic, and a key that did it too would be teaching the mistake.",
    ],
    teaches: "Adding and subtracting money",
    ages: "Ages 7–10",
    strand: "parts",
    play: "Not in the games. The addition facts underneath the cents column are, in The Grid.",
    config: {
      ...SHEET,
      kind: "money",
      currency: "usd",
      operation: "both",
      form: "vertical",
      range: { min: 0, max: 40 },
      count: 12,
      columns: 3,
    },
  },

  /* ── Measuring the world ────────────────────────────────────────────── */
  {
    slug: "telling-time-worksheets",
    name: "Telling the time to five minutes",
    short: "Telling time",
    heading: "Telling time worksheets",
    keyword: "Free printable telling time worksheets",
    summary:
      "Twelve clock faces with the hands drawn on, to be read to the nearest five minutes, with an answer key.",
    lead: "Twelve dials with both hands on them and a line beside each one to write the time. Everything lands on a five-minute mark — the numerals a child counts round in fives.",
    notes: [
      "The hour hand is the one that gets read wrong, and this sheet does not help by cheating it: at twenty-five to four it is drawn most of the way round to four, exactly where it would be on a real clock, rather than parked on the three. A child who has only seen dials where the short hand points straight at a numeral is being taught something that is not true of any clock in the house.",
      "Five minutes is the middle of five settings. O'clock, half past and the quarters come first; the minute-by-minute dial comes later, and it is a genuinely harder sheet rather than the same one with more clocks. The builder moves between them without changing anything else about the page.",
    ],
    teaches: "Reading an analog clock to five minutes",
    ages: "Ages 6–9",
    strand: "measuring",
    play: "Not in the games — a clock face is a picture rather than a card to type an answer to, which is why it is paper.",
    config: {
      ...SHEET,
      kind: "time",
      style: "read",
      step: 5,
      count: 12,
      columns: 4,
    },
  },
  {
    slug: "measurement-conversion-worksheets",
    name: "Metric unit conversion",
    short: "Measures",
    heading: "Measurement conversion worksheets",
    keyword: "Free printable measurement conversion worksheets",
    summary:
      "Fifteen metric conversions across length, mass and capacity, with an answer key.",
    lead: "Millimeters to centimeters, grams to kilograms, milliliters to liters — fifteen conversions to a page, mixed across the three things a child measures. Imperial units are the same sheet, one switch away.",
    notes: [
      "Every conversion here is exact and every one of them is a power of ten, which is the argument for the metric system in one page of arithmetic: converting is moving the point, and the only thing to get right is which way. Nothing on this sheet converts between the two systems — meters into feet is an approximation, and it is a different lesson.",
      "The three quantities are mixed rather than blocked, deliberately. A page of nothing but length lets a child work out the multiplier once and apply it fourteen times; a mixed page asks the actual question every time, which is what a test does.",
    ],
    teaches: "Converting metric units of length, mass and capacity",
    ages: "Ages 8–12",
    strand: "measuring",
    play: "Not in the games. The times tables that turn 3.5 kg into grams are, in The Grid.",
    config: {
      ...SHEET,
      kind: "measure",
      style: "convert",
      system: "metric",
      quantities: ["length", "mass", "capacity"],
      range: { min: 1, max: 20 },
      count: 15,
      columns: 3,
    },
  },
  {
    slug: "area-worksheets",
    name: "Area of rectangles and triangles",
    short: "Area",
    heading: "Area worksheets",
    keyword: "Free printable area worksheets",
    summary:
      "Nine shapes drawn to scale with their sides labeled, to find the area of, with an answer key.",
    lead: "Nine rectangles and triangles, each drawn with its measurements written on the sides it needs, and a line to write the area on. Perimeter is the same shapes asked the other way, one switch away in the builder.",
    notes: [
      "The drawing agrees with the labels. A shape marked 8 by 3 is drawn eight units by three units, at one scale for the whole figure — which sounds like the minimum and is the thing worksheets get wrong most often. A rectangle labeled 8 by 3 and drawn 8 by 4 teaches a child that the picture is decoration and the numbers are the question, which is the opposite of what a geometry sheet is for.",
      "A triangle carries a base and a height and nothing else. The sloping side is left unlabeled on purpose: the commonest mistake in this topic is multiplying the two numbers that happen to be printed, and a sheet that offered a third number would be inviting it.",
    ],
    teaches: "Area of rectangles and triangles",
    ages: "Ages 8–12",
    strand: "measuring",
    play: "Not in the games. The multiplication under every area is, in The Grid.",
    config: {
      ...SHEET,
      kind: "geometry",
      style: "area",
      system: "metric",
      range: { min: 2, max: 12 },
      count: 9,
      columns: 3,
    },
  },

  /* ── Numbers, algebra and data ──────────────────────────────────────── */
  {
    slug: "integers-worksheets",
    name: "Positive and negative numbers",
    short: "Integers",
    heading: "Integers worksheets",
    keyword: "Free printable integers worksheets",
    summary:
      "Twenty questions over positive and negative whole numbers, with an answer key that has the signs right.",
    lead: "Twenty questions where the numbers may be negative and the answer certainly may be — the four operations over the integers, mixed rather than blocked, so the sign has to be read every time.",
    notes: [
      "The sign is the whole of what is being taught, so it is the whole of what has to be marked. 7 − 9 is −2, and a key that printed 2 would be read as correct by a parent going quickly down the page. That is the failure this family is written to make impossible: every answer here is checked by an independent path rather than by re-running the arithmetic that produced it.",
      "A minus sign is doing two different jobs here and it is worth naming both while working: it says which side of zero a number is on, and it says take away. Once a child can read −7 as a place rather than as an instruction, subtracting one stops being a rule to memorize.",
    ],
    teaches: "Arithmetic with positive and negative integers",
    ages: "Ages 10–13",
    strand: "algebra",
    play: "Not in the games — the race deals whole positive facts. The recall it builds is what makes the sign the only thing left to think about here.",
    config: {
      ...SHEET,
      kind: "integers",
      style: "arithmetic",
      operation: "both",
      range: { min: 1, max: 12 },
      count: 20,
      columns: 3,
    },
  },
  {
    slug: "order-of-operations-worksheets",
    name: "Order of operations",
    short: "Order",
    heading: "Order of operations worksheets",
    keyword: "Free printable order of operations worksheets",
    summary:
      "Twelve expressions with three operations each, parentheses included, and no negative numbers or powers in the way.",
    lead: "Twelve expressions with three operations in each — parentheses, then multiplying and dividing, then adding and taking away — with space to work down the page a step at a time.",
    notes: [
      "Every number on this sheet is positive and none of them is squared, on purpose. Order of operations, negative numbers and powers are three lessons, and a page that asked for more than one of them at a time would tell you a child had got it wrong without telling you which of the three they had got wrong. The integers sheet is where the signs come in, and squares and cubes are a setting of their own in the builder.",
      "The rule is not really a rule about left and right; it is about which operations bind their neighbors tightest. Writing each line out underneath the last — one operation resolved per line — is slower and it is what turns this from a page of tricks into a page of arithmetic. That is why there is room under each expression rather than a slot beside it.",
    ],
    teaches: "Order of operations",
    ages: "Ages 10–13",
    strand: "algebra",
    play: "Not in the games. Each individual step on this page is a fact The Grid deals.",
    config: {
      ...SHEET,
      kind: "integers",
      style: "order",
      operation: "both",
      range: { min: 1, max: 12 },
      negatives: false,
      // The lesson on this page is which operation binds tightest, and the
      // child who is set it is a term away from meeting exponents. The sheet's
      // own instruction line follows the switch, so what is printed at the top
      // of the page and what is on it are one decision.
      powers: false,
      terms: 3,
      count: 12,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "one-step-equations-worksheets",
    name: "One-step equations",
    short: "Equations",
    heading: "One-step equations worksheets",
    keyword: "Free printable one-step equations worksheets",
    summary:
      "Sixteen equations solved by a single move, with an answer key checked by substitution.",
    lead: "Sixteen equations with a single operation to undo — x + 7 = 12, 9x = 54, x/12 = 4 — with a line for the answer on each and a key that has been checked by putting the answer back in.",
    notes: [
      "One step, not two, and the difference is a term of the school year rather than a difficulty slider. x + 7 = 12 is undone by a single move; 3x + 4 = 19 needs two of them in the right order, and a child who meets the second before the first tends to learn a procedure rather than the idea underneath it.",
      "The idea underneath it is that an equation is a pair of scales. Whatever is done to one side is done to the other, and the letter is only ever a number that has not been said yet. Every answer here is checked by substituting it back into the original equation rather than by trusting the arithmetic that produced it.",
    ],
    teaches: "Solving one-step linear equations",
    ages: "Ages 10–13",
    strand: "algebra",
    play: "Not in the games. Undoing an equation is a fact recalled backwards, which is exactly what The Grid's division decks drill.",
    config: {
      ...SHEET,
      kind: "prealgebra",
      style: "equation",
      steps: 1,
      range: { min: 1, max: 12 },
      negatives: false,
      count: 16,
      columns: 2,
    },
  },
  {
    slug: "ratio-and-proportion-worksheets",
    name: "Ratio and proportion",
    short: "Ratio",
    heading: "Ratio and proportion worksheets",
    keyword: "Free printable ratio and proportion worksheets",
    summary:
      "Twelve proportions with one number missing from the pair, with an answer key in whole numbers.",
    lead: "Twelve pairs of ratios that scale together with one of the four numbers left out — 3 : 12 as 5 : ? — with space to work and an answer key.",
    notes: [
      "A proportion is two ratios saying the same thing at different sizes, which is the math behind a recipe doubled, a map's scale and a price per kilo. The question to ask of each pair is what the first was multiplied by to get the second, and the answer is always the same multiplier on both halves.",
      "Everything here comes out in whole numbers. A ratio is only in its lowest terms one way — 12 : 18 and 2 : 3 are the same ratio and only one is marked right — so the arithmetic is done with a greatest common divisor rather than by dividing a decimal that would not have come out exactly.",
    ],
    teaches: "Ratio, proportion and scaling",
    ages: "Ages 10–13",
    strand: "algebra",
    play: "Not in the games. The multiplication and division either side of a proportion are, in The Grid.",
    config: {
      ...SHEET,
      kind: "ratio",
      style: "proportion",
      range: { min: 1, max: 12 },
      count: 12,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "mean-median-mode-worksheets",
    name: "Mean, median, mode and range",
    short: "Averages",
    heading: "Mean, median, mode and range worksheets",
    keyword: "Free printable mean median mode and range worksheets",
    summary:
      "Four sets of numbers, each with all four averages asked for, and an answer key that handles an even-sized set properly.",
    lead: "Four sets of six numbers, with the mean, the median, the mode and the range asked for each time — the four of them from one set, which is how the topic is set in every textbook that teaches it.",
    notes: [
      "Every set here has an even number of values, so the median falls between two of them and has to be averaged rather than pointed at. That is the case a five-number set cannot teach and the one an exam always asks, and it is also where a generated worksheet usually prints a confident wrong answer.",
      "Each set has exactly one mode. A set with two most-common values has two right answers, and a key that named one of them would mark a correct child wrong — so the numbers on this page are drawn until there is a single answer to give.",
    ],
    teaches: "Mean, median, mode and range",
    ages: "Ages 10–13",
    strand: "algebra",
    play: "Not in the games. The adding and dividing inside every mean is, in The Grid.",
    config: {
      ...SHEET,
      kind: "statistics",
      style: "all",
      size: 6,
      range: { min: 1, max: 20 },
      count: 4,
      columns: 2,
      workspace: true,
    },
  },
  {
    slug: "math-word-problems",
    name: "Word problems",
    short: "Word problems",
    heading: "Math word problems",
    keyword: "Free printable math word problems",
    summary:
      "Six worded problems across rates, percentages, averages and equations, with room to work and an answer key.",
    lead: "Six short problems written as sentences rather than sums, over the topics a middle-school year covers — a rate, a percentage, an average, an equation to set up — with space under each to work.",
    notes: [
      "The hard part of a word problem is never the arithmetic; it is deciding which arithmetic. So there is room under each one to write the sum out before doing it, and the answer key gives the number rather than the method, because the method is the bit worth talking about at the table.",
      "There are few enough templates here that they stay readable and are not padded out with more. A generated word problem that reads as machinery is worse than no word problem at all — a parent stops trusting the rest of the shop over it — which is why this is the one family in the Print Shop deliberately kept small.",
    ],
    teaches: "Solving worded arithmetic problems",
    ages: "Ages 9–13",
    strand: "algebra",
    play: "Not in the games. Once the sum is written down, it is a fact — and facts are what The Grid is for.",
    config: {
      ...SHEET,
      kind: "word-problems",
      topics: ["integers", "rate", "percent", "equation", "average"],
      range: { min: 2, max: 20 },
      count: 6,
      columns: 1,
      workspace: true,
    },
  },
];

/** What each strand is called on a hub, in the order they are listed. */
export const STRANDS: Array<{
  id: MathsStrand;
  label: string;
  blurb: string;
}> = [
  {
    id: "adding",
    label: "Adding and taking away",
    blurb: "The facts underneath everything else, and the columns after them.",
  },
  {
    id: "tables",
    label: "Times tables",
    blurb:
      "Multiplication and division, from the twelve tables to the bracket.",
  },
  {
    id: "parts",
    label: "Parts of a number",
    blurb: "Fractions, decimals, percentages and money — one idea, four ways.",
  },
  {
    id: "measuring",
    label: "Measuring the world",
    blurb: "Clocks, units and shapes: the math that is about something.",
  },
  {
    id: "algebra",
    label: "Numbers, algebra and data",
    blurb: "Signs, letters standing for numbers, and what a set is doing.",
  },
];

/** The route a math sheet prints at. One stock — see the note at the top. */
export function pathFor(sheet: MathsSheet): string {
  return `/printables/${sheet.slug}`;
}

/**
 * The builder, opened on this sheet. The config lives in the fragment (§14),
 * and the seed goes with it, so what the bench opens on is the sheet that was
 * printed rather than another one like it.
 */
export function builderHref(sheet: MathsSheet): string {
  const payload = encodeSharedSheet({ config: sheet.config, seed: MATHS_SEED });
  return `/printables/make#s=${payload}`;
}

/** The shelf, grouped — the shape every page lists it in. */
export function mathsShelf(): Array<{
  id: MathsStrand;
  label: string;
  blurb: string;
  sheets: MathsSheet[];
}> {
  return STRANDS.map((strand) => ({
    ...strand,
    sheets: MATHS_SHEETS.filter((sheet) => sheet.strand === strand.id),
  }));
}
