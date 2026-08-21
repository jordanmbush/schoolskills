/**
 * The maths sheets the Print Shop has set, and the words that go round them.
 *
 * **The slugs are curated; the sheets are generated** (§8), and this is the
 * family where that stops being theoretical: the engine can make millions of
 * plausible pages out of the families, styles, forms, currencies and ranges it
 * already has, and every one of them would be a page nobody wrote for. So each
 * slug is a phrase a parent actually types, with two paragraphs true of that
 * sheet and of no other, and everything else is reached by the builder.
 *
 * **One stock, unlike paper** (§8). Nothing on a maths sheet is a measurement,
 * so a slug here is one route and the A4 switch is the builder's.
 */
import { encodeSharedSheet } from "@/engine/sheets/share";
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import type { HeaderField, Paper, SheetConfig } from "@/engine/sheets/types";

/** How the hub groups the shelf: five strands of school maths, in order. */
export type MathsStrand =
  "adding" | "tables" | "parts" | "measuring" | "algebra";

export type MathsSheet = {
  /** The route under /printables, and the head term it is written to answer. */
  slug: string;
  /** How it is listed on a hub. */
  name: string;
  /** How it is labelled in the row of neighbouring sheets. A few words. */
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
    play: "The Grid drills subtraction as timed cards alongside the other three operations, so a fact that stalls on paper can be practised on screen.",
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
      "The sums are stacked rather than written along a line, because the algorithm being practised is a layout as much as an arithmetic. Ones under ones, tens under tens, the answer under the rule — the commonest wrong answer at this age is a right sum written in the wrong column, and squared paper is worth printing alongside this if that is what keeps happening.",
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
      "A chart a child fills in is worth more than a chart they are handed, and it is the same piece of paper. Working across a row is counting in that number; working down a column is the same facts from the other side; and the squares that stay empty longest are a map of exactly which tables to practise.",
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
    slug: "percentage-worksheets",
    name: "Percentages of an amount",
    short: "Percentages",
    heading: "Percentage worksheets",
    keyword: "Free printable percentage worksheets",
    summary:
      "Twelve percentages of an amount, in the sizes a shop actually uses, with an answer key.",
    lead: "Twelve questions of the form “what is 25% of 80?”, using the percentages that turn up in real life rather than the ones that happen to be easy to generate, with room to work.",
    notes: [
      "A percentage is a fraction with a hundred underneath it, and the fastest route through most of these is to say that out loud: 25% is a quarter, 10% is a tenth, and 15% is a tenth plus half of it. A child who reaches for a formula on 50% of 60 has learnt the wrong thing about percentages.",
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
    lead: "Millimetres to centimetres, grams to kilograms, millilitres to litres — fifteen conversions to a page, mixed across the three things a child measures. Imperial units are the same sheet, one switch away.",
    notes: [
      "Every conversion here is exact and every one of them is a power of ten, which is the argument for the metric system in one page of arithmetic: converting is moving the point, and the only thing to get right is which way. Nothing on this sheet converts between the two systems — metres into feet is an approximation, and it is a different lesson.",
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
      "Nine shapes drawn to scale with their sides labelled, to find the area of, with an answer key.",
    lead: "Nine rectangles and triangles, each drawn with its measurements written on the sides it needs, and a line to write the area on. Perimeter is the same shapes asked the other way, one switch away in the builder.",
    notes: [
      "The drawing agrees with the labels. A shape marked 8 by 3 is drawn eight units by three units, at one scale for the whole figure — which sounds like the minimum and is the thing worksheets get wrong most often. A rectangle labelled 8 by 3 and drawn 8 by 4 teaches a child that the picture is decoration and the numbers are the question, which is the opposite of what a geometry sheet is for.",
      "A triangle carries a base and a height and nothing else. The sloping side is left unlabelled on purpose: the commonest mistake in this topic is multiplying the two numbers that happen to be printed, and a sheet that offered a third number would be inviting it.",
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
      "A minus sign is doing two different jobs here and it is worth naming both while working: it says which side of zero a number is on, and it says take away. Once a child can read −7 as a place rather than as an instruction, subtracting one stops being a rule to memorise.",
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
      "Twelve expressions with three operations each, brackets included, and no negative numbers or powers in the way.",
    lead: "Twelve expressions with three operations in each — brackets, then multiplying and dividing, then adding and taking away — with space to work down the page a step at a time.",
    notes: [
      "Every number on this sheet is positive and none of them is squared, on purpose. Order of operations, negative numbers and powers are three lessons, and a page that asked for more than one of them at a time would tell you a child had got it wrong without telling you which of the three they had got wrong. The integers sheet is where the signs come in, and squares and cubes are a setting of their own in the builder.",
      "The rule is not really a rule about left and right; it is about which operations bind their neighbours tightest. Writing each line out underneath the last — one operation resolved per line — is slower and it is what turns this from a page of tricks into a page of arithmetic. That is why there is room under each expression rather than a slot beside it.",
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
      "A proportion is two ratios saying the same thing at different sizes, which is the maths behind a recipe doubled, a map's scale and a price per kilo. The question to ask of each pair is what the first was multiplied by to get the second, and the answer is always the same multiplier on both halves.",
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
    blurb: "Clocks, units and shapes: the maths that is about something.",
  },
  {
    id: "algebra",
    label: "Numbers, algebra and data",
    blurb: "Signs, letters standing for numbers, and what a set is doing.",
  },
];

/** The route a maths sheet prints at. One stock — see the note at the top. */
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
