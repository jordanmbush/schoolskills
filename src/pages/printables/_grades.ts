/**
 * The school years the Print Shop is browsable by, and how a sheet gets onto
 * one of them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `grade/[grade].astro`, which prerenders one hub per year, and
 * `grade/index.astro`, which lists them.
 *
 * **No sheet on this site is labelled “Grade 3”, and none is going to be.**
 * Every catalog entry states the ages it was drawn for, on its own page, in the
 * shape “Ages 8–11” — a judgement made once, beside the sheet, by whoever chose
 * the numbers that go on it. A grade page collects the sheets whose stated ages
 * reach the years a child is in that grade, and says so out loud. That is the
 * whole mechanism, and it is deliberately the weakest claim that is still
 * useful: a grade-level label invented by a worksheet site is a guess dressed
 * up as a standard, and the parent reading it can already see their own child.
 *
 * The consequence is that the same sheet appears on two or three of these
 * pages, which is correct rather than sloppy. A sheet for nine to twelve
 * belongs to the fourth-grader and the seventh-grader both, and pretending
 * otherwise would mean withholding it from one of them.
 */
import { SHELVES, type Shelf, type ShelfSheet } from "./_shelves";

export type Grade = {
  /** The route under /printables/grade, and the head term it answers. */
  slug: string;
  /** How the year is named in a heading, and where a page addresses it. */
  label: string;
  /**
   * The same year inside a sentence, where the capital would be wrong.
   *
   * Written out rather than lower-cased from `label`: "pre-k" is not how
   * anybody writes Pre-K, and it is the one of the ten that would break the
   * rule the other nine follow.
   */
  phrase: string;
  /** How it is labelled in a row of the ten. A few characters. */
  short: string;
  /** The page's `<h1>`. */
  heading: string;
  /** The query this page exists to answer, in the words a parent types. */
  keyword: string;
  /**
   * The ages most children are during this year, inclusive at both ends.
   *
   * Two of them, not one: a first-grader is six in the autumn and seven by the
   * spring, and a shelf that only reached one of those would drop half the
   * sheets a parent needs in the second half of the year.
   */
  ages: [number, number];
  /** The lead paragraph: what changes at this age. */
  lead: string;
  /** Two things that are true of this year and not of the one beside it. */
  notes: string[];
  /**
   * Three sheets worth starting with, by route, and why this year.
   *
   * A route rather than a name, so the name is read back out of the catalog
   * that owns it and cannot drift from it. `_grades.test.ts` holds every one of
   * these to two things: that it is a sheet that exists, and that it is a sheet
   * this year's ages actually reach — the second being the way a hand-written
   * recommendation goes quietly wrong when a catalog entry is re-aged.
   */
  landmarks: Array<{ href: string; why: string }>;
};

/**
 * Pre-K through 8th, at the ages an American school puts them.
 *
 * Ten pages, and the bound is the same one §8 puts on every other shelf here:
 * these are the years a parent types into a search box, and the twelve-way
 * cross with subject and difficulty that would follow from generating more is
 * the doorway-page farm that section exists to forbid.
 */
export const GRADES: Grade[] = [
  {
    slug: "pre-k",
    label: "Pre-K",
    phrase: "Pre-K",
    short: "Pre-K",
    heading: "Pre-K printable worksheets",
    keyword: "Free printable Pre-K worksheets",
    ages: [4, 5],
    lead: "Four and five, and almost all of it is a shape to fill in: letters and numbers traced an inch high, the first sounds on cards, and the words that have to be known by sight before anything else can be read. Nothing on this page asks a child to read the instructions, because at this age the grown-up reads them.",
    notes: [
      "The paper is the biggest ruling in the shop, and that is the point rather than a concession. An inch from one set of lines to the next, with a solid midline through the middle of it, because a four-year-old is aiming at a line rather than reading a hint — and because a child whose fine motor control is still arriving writes large. Paper that asks them to write small teaches them that handwriting is something they are bad at, which is a lesson that takes years to undo.",
      "The phonics shelf is the one to spend this year on, and it is built the opposite way round from most of them: you tick the sounds that have actually been taught, and the sheet is made out of those and nothing else. A four-year-old handed a page with a spelling on it they have never seen is being asked to guess, and guessing is the habit the whole method exists to prevent.",
    ],
    landmarks: [
      {
        href: "/printables/phonics/phonics-sound-cards",
        why: "The sounds you have taught, on cards to cut out, and none you haven’t.",
      },
      {
        href: "/printables/kindergarten-writing-paper",
        why: "Inch-high lines with a solid midline: the ruling a first letter is written on.",
      },
      {
        href: "/printables/handwriting/letter-tracing-worksheets",
        why: "The whole alphabet, traced then copied, a letter at a time.",
      },
    ],
  },
  {
    slug: "kindergarten",
    label: "Kindergarten",
    phrase: "kindergarten",
    short: "K",
    heading: "Kindergarten printable worksheets",
    keyword: "Free printable kindergarten worksheets",
    ages: [5, 6],
    lead: "Five and six: small letters after the capitals, the first sight words, sounds blended into whole words, and numbers that start behaving like quantities rather than like shapes. This is the year the ruling comes down a size, from an inch to three quarters of one.",
    notes: [
      "Sight words are the odd ones out on the spelling shelf and this is the year they matter most. A hundred or so words make up about half of everything a child reads, and a good many of them — “said”, “one”, “come” — do not say what their letters suggest, so they are learned by the eye rather than worked out. The sheets trace them, write them out and hide them in a grid to find, which is three different ways of looking at the same short list.",
      "The counting sheets here have nothing on them to answer, and that is what they are for. A hundred chart is ten rows of ten so that moving down it is adding ten; a number line to twenty is a distance a finger can walk. Both are references a child works against rather than work a child hands in, and both stay on the wall long after the worksheets have gone in the recycling.",
    ],
    landmarks: [
      {
        href: "/printables/handwriting/lowercase-letter-tracing-worksheets",
        why: "The small letters, which are the ones nearly all writing is actually made of.",
      },
      {
        href: "/printables/spelling/sight-word-worksheets",
        why: "The words that will not sound out, on the list a school works through first.",
      },
      {
        href: "/printables/charts/hundred-chart",
        why: "Ten rows of ten, so that going down the chart is adding ten.",
      },
    ],
  },
  {
    slug: "1st-grade",
    label: "First grade",
    phrase: "first grade",
    short: "1st",
    heading: "Printable 1st grade worksheets",
    keyword: "Free printable 1st grade worksheets",
    ages: [6, 7],
    lead: "Six and seven: sums that cross ten, sentences that a child can decode on their own, and the ⅝-inch ruling that most of primary school is written on. The work stops being letters and starts being lines of them.",
    notes: [
      "Adding with regrouping is the sheet this year turns on. Carrying is the first piece of arithmetic that is a procedure rather than a fact, and it is where a child who has been counting on their fingers quietly runs out of fingers — so the sheet is set in columns, with the room above the sum where the carried digit goes, rather than written along a line where there is nowhere to put it.",
      "Decodable sentences are the reading equivalent, and they come off the same ticked list of sounds as the rest of the phonics shelf: every word in every sentence is built from spellings that have already been taught. A first sentence read without a single guess in it is worth more than a page of pictures, and it is only possible if the page knows what has been covered.",
    ],
    landmarks: [
      {
        href: "/printables/handwriting-paper",
        why: "⅝ of an inch, dashed midline: the size most of Year 1 is written at.",
      },
      {
        href: "/printables/addition-with-regrouping-worksheets",
        why: "Carrying, set in columns with room above the sum for the digit.",
      },
      {
        href: "/printables/phonics/decodable-sentences-worksheets",
        why: "Sentences with nothing untaught in them, so there is nothing to guess.",
      },
    ],
  },
  {
    slug: "2nd-grade",
    label: "Second grade",
    phrase: "second grade",
    short: "2nd",
    heading: "Printable 2nd grade worksheets",
    keyword: "Free printable 2nd grade worksheets",
    ages: [7, 8],
    lead: "Seven and eight: the times tables start, money and clocks arrive, handwriting drops to half an inch, and the first joined letters appear. It is the busiest year in this catalog, which is why nearly every shelf has something on this page.",
    notes: [
      "Multiplication is the one to be systematic about, because it is the last piece of arithmetic that is pure recall and everything after it — long division, fractions, ratio — is built on the assumption that it is already automatic. The worksheets and the twelve times-table pages here are the same facts as the flash cards in The Grid, so a table can be practised on paper in the morning and raced on screen in the afternoon.",
      "Cursive can start this year, and the sheets say what most cursive worksheets leave out: the joins are the skill. A child who can form twenty-six cursive letters and cannot join them writes print with curls on it, so the alphabet, the joins and the words are three separate sheets rather than one.",
    ],
    landmarks: [
      {
        href: "/printables/multiplication-worksheets",
        why: "The tables, on paper, and the same facts the flash cards deal.",
      },
      {
        href: "/printables/handwriting-paper-1-2-inch",
        why: "Half an inch: small enough that a sentence fits on a line.",
      },
      {
        href: "/printables/spelling/spelling-practice-worksheets",
        why: "This week’s list, written out, or your own list typed in.",
      },
    ],
  },
  {
    slug: "3rd-grade",
    label: "Third grade",
    phrase: "third grade",
    short: "3rd",
    heading: "Printable 3rd grade worksheets",
    keyword: "Free printable 3rd grade worksheets",
    ages: [8, 9],
    lead: "Eight and nine: division, the first fractions, area and the measures that go with it, and the ⅜ ruling that has a top line and a baseline and nothing in between. Grammar becomes a subject of its own rather than something corrected in passing.",
    notes: [
      "Division here is the short kind — facts that undo the times tables — and equivalent fractions sit beside it for a reason. Both are the same idea approached twice: that a quantity can be cut into equal parts and named. A child who is fluent with the tables meets neither as a new fact, which is the whole argument for having spent the year before on them.",
      "The transitional ruling is the quiet event of this year. Three eighths of an inch, top line and baseline, no midline — the sheet stops telling a child how tall a letter is, because by now they know. It is the last ruling before ordinary lined paper, and printing both and writing the same sentence on each is a fair way to see whether someone is ready.",
    ],
    landmarks: [
      {
        href: "/printables/division-worksheets",
        why: "The facts that undo the tables, with the key on the page behind.",
      },
      {
        href: "/printables/cursive/cursive-alphabet-worksheets",
        why: "The joined alphabet, in whichever of the three models you were taught.",
      },
      {
        href: "/printables/grammar/parts-of-speech-worksheets",
        why: "Nouns, verbs and adjectives, with the answers written down by a person.",
      },
    ],
  },
  {
    slug: "4th-grade",
    label: "Fourth grade",
    phrase: "fourth grade",
    short: "4th",
    heading: "Printable 4th grade worksheets",
    keyword: "Free printable 4th grade worksheets",
    ages: [9, 10],
    lead: "Nine and ten: long division, fractions that are added rather than shaded, decimals, and word problems where the hard part is deciding what to do. The handwriting shelf is down to its last sheet by now, and that sheet is copywork.",
    notes: [
      "Long division is the longest procedure in primary maths and the one most often printed badly, so these sheets are set in the bracket with the quotient written along the top and a band of blank paper under each problem to bring the digits down into. The working is the exercise rather than the answer. If the columns drift the answer is wrong for a reason that has nothing to do with division, which is why squared paper is on this page as well.",
      "Copywork is what handwriting turns into once the letters are formed. The passage is real writing — a psalm, a speech, a poem out of the public domain — and the sheet is a model line above an empty one, so the practice is a sentence worth reading rather than a row of the same letter. It is also the shelf where Scripture sits, in the same picker as everything else.",
    ],
    landmarks: [
      {
        href: "/printables/long-division-worksheets",
        why: "Set on the bracket, with room for the subtractions underneath.",
      },
      {
        href: "/printables/fraction-worksheets",
        why: "Added, subtracted and reduced, with every key in its lowest terms.",
      },
      {
        href: "/printables/bible/psalm-23-copywork",
        why: "The whole psalm, copied out, in a public-domain translation.",
      },
    ],
  },
  {
    slug: "5th-grade",
    label: "Fifth grade",
    phrase: "fifth grade",
    short: "5th",
    heading: "Printable 5th grade worksheets",
    keyword: "Free printable 5th grade worksheets",
    ages: [10, 11],
    lead: "Ten and eleven: percentages, negative numbers, the order of operations, and the first equations with a letter in them. Wide ruled paper is running out of usefulness and college ruled starts to make sense.",
    notes: [
      "This is where arithmetic turns into algebra without announcing it. An equation with a letter in it is a sum with the answer moved, the order of operations is a rule about reading rather than about numbers, and integers are the first quantity a child meets that cannot be counted out on a table. Each of those has a sheet of its own here, and each prints its own key.",
      "The paper changes with the work. College ruled is nine thirty-seconds of an inch against wide ruled’s eleven, which is about six more lines to the page — the difference between fitting a paragraph and running out of room. If handwriting is still growing into the line, print the wide ruled sheet instead: narrow rules do not make writing neater, they make a child write smaller than they can control.",
    ],
    landmarks: [
      {
        href: "/printables/percentage-worksheets",
        why: "Percentages of a quantity, and the fraction each one is.",
      },
      {
        href: "/printables/decimal-worksheets",
        why: "Added as whole hundredths, so no key ever prints a rounded last place.",
      },
      {
        href: "/printables/college-ruled-paper",
        why: "Six more lines to the page than wide ruled, and the same margin.",
      },
    ],
  },
  {
    slug: "6th-grade",
    label: "Sixth grade",
    phrase: "sixth grade",
    short: "6th",
    heading: "Printable 6th grade worksheets",
    keyword: "Free printable 6th grade worksheets",
    ages: [11, 12],
    lead: "Eleven and twelve: ratio and proportion, averages, the whole pre-algebra strand, and paperwork that starts to look like a secondary school’s — a lab report, a timeline, a paragraph frame with the shape of an argument printed on it.",
    notes: [
      "Ratio and averages are the two topics on this page where a generated worksheet most often prints a confident wrong answer, and both are guarded in the engine rather than by hand: a ratio is reduced with a greatest common divisor so the key is in its lowest terms rather than merely equal to the right answer, and a set of numbers is redrawn until it has a single mode, because a page that asks for “the” mode of a set with two is asking for something that does not exist.",
      "The writing frames matter more than they look. A paragraph frame is a page with the shape of a paragraph on it and nothing else — a topic sentence, three reasons with a detail attached to each, and a close — and it is the difference between a child who cannot start and a child who has started. It is also scaffolding, which is meant to come down: print it for a fortnight, then hand over lined paper and ask for the same thing.",
    ],
    landmarks: [
      {
        href: "/printables/order-of-operations-worksheets",
        why: "A rule about reading a sum, practised until it is not a rule any more.",
      },
      {
        href: "/printables/charts/decimal-place-value-chart",
        why: "Hundreds to thousandths, with the point ruled between ones and tenths.",
      },
      {
        href: "/printables/templates/lab-report",
        why: "Question, method, results, conclusion: blank, and better for it.",
      },
    ],
  },
  {
    slug: "7th-grade",
    label: "Seventh grade",
    phrase: "seventh grade",
    short: "7th",
    heading: "Printable 7th grade worksheets",
    keyword: "Free printable 7th grade worksheets",
    ages: [12, 13],
    lead: "Twelve and thirteen: the maths shelf keeps its top half — fractions, decimals and the pre-algebra sheets — while most of what actually gets printed is paper to work on rather than questions to answer.",
    notes: [
      "By this age the useful printables are mostly blank. Squared paper at five millimetres, the four-quadrant grid, a lab report form, a weekly planner: the work itself comes out of a textbook or a class, and what a home printer is for is the surface it is done on. The paper shelf keeps everything on this page except the primary rulings, while the worksheet shelves have thinned right out.",
      "Narrow ruled is the paper for this end of the catalog, and it is a fair-copy paper rather than a practice one — a quarter of an inch between rules and no margin line at all, because at that size there is not much page left to give away. It is the ruling for lists, indexes and notes meant to be kept, and it is the tightest one here. It says Ages 12+, so it is already on the sixth-grade page for anyone who turned twelve there.",
    ],
    landmarks: [
      {
        href: "/printables/one-step-equations-worksheets",
        why: "Solve for the letter, one operation at a time, key on the second page.",
      },
      {
        href: "/printables/graph-paper-5-mm",
        why: "The squares a school exercise book is printed at, on both stocks.",
      },
      {
        href: "/printables/narrow-ruled-paper",
        why: "Quarter-inch rules, no margin: the most words on a page here.",
      },
    ],
  },
  {
    slug: "8th-grade",
    label: "Eighth grade",
    phrase: "eighth grade",
    short: "8th",
    heading: "Printable 8th grade worksheets",
    keyword: "Free printable 8th grade worksheets",
    ages: [13, 14],
    lead: "Thirteen and fourteen, and this is the shortest page of the ten. The pre-algebra worksheets, the reference paper, the paperwork a week needs and the longer copywork are what a catalog built for primary school honestly has at this age.",
    notes: [
      "The shelves that stop, stop. There is no handwriting, cursive, phonics, spelling or grammar sheet on this page, because every one of those states an age range that ends before thirteen — and relabelling one “Grade 8” to make this page look fuller is the single thing a catalog like this must not do. A parent who found a tracing sheet listed for a fourteen-year-old would be right to distrust every other page here.",
      "What is left is genuinely for this age. Integers, ratio, averages, the order of operations and one-step equations are the arithmetic that carries into algebra; the four-quadrant grid and the graph papers are what it is worked on; and the copywork and memory sheets take whole passages rather than a verse at a time. If your child needs something from an earlier year, the page for that year is one link away and nothing here will disagree with you about which to use.",
    ],
    landmarks: [
      {
        href: "/printables/ratio-and-proportion-worksheets",
        why: "Ratios reduced properly, and proportions solved rather than guessed.",
      },
      {
        href: "/printables/mean-median-mode-worksheets",
        why: "Sets drawn so the mode is single and the median is a real value.",
      },
      {
        href: "/printables/bible/1-corinthians-13-copywork",
        why: "A long passage, copied out over several pages of ruled lines.",
      },
    ],
  },
];

/**
 * The band a sheet's own page states, as `[from, to]`.
 *
 * Two shapes exist across the ten catalogs and only two: a closed range,
 * “Ages 6–9”, and an open one, “Ages 4+”, for the sheets that never stop being
 * useful. Anything else **throws**, deliberately and at build time: the failure
 * to avoid is a new sheet whose age string is written a third way, silently
 * matching no grade and appearing on none of these pages while every test still
 * passes and the page still builds.
 */
export function ageBand(ages: string): [number, number] {
  const closed = /^Ages (\d+)–(\d+)$/.exec(ages);
  if (closed) return [Number(closed[1]), Number(closed[2])];

  const open = /^Ages (\d+)\+$/.exec(ages);
  if (open) return [Number(open[1]), Infinity];

  throw new Error(
    `Unreadable age range ${JSON.stringify(ages)}. A catalog entry states its ages as "Ages 6–9" or "Ages 4+" — the grade hubs are built entirely out of that string, so a third shape would drop the sheet off every one of them.`,
  );
}

/** Whether a sheet's stated ages reach any part of this year. */
const fits = (grade: Grade, sheet: ShelfSheet): boolean => {
  const [from, to] = ageBand(sheet.ages);
  return from <= grade.ages[1] && to >= grade.ages[0];
};

/**
 * Every shelf, cut down to what this year's ages reach.
 *
 * A shelf with nothing left is dropped rather than printed empty. That is the
 * honest rendering of the eighth-grade page — five of the ten shelves end
 * before thirteen — and an empty heading would read as a missing link.
 */
export function shelvesForGrade(grade: Grade): Shelf[] {
  return SHELVES.map((shelf) => ({
    ...shelf,
    sheets: shelf.sheets.filter((sheet) => fits(grade, sheet)),
  })).filter((shelf) => shelf.sheets.length > 0);
}

/** Everything printable for a year, whichever shelf it came off. */
export const sheetsForGrade = (grade: Grade): ShelfSheet[] =>
  shelvesForGrade(grade).flatMap((shelf) => shelf.sheets);

/** A sheet by route, for the landmarks — which name a page rather than copy it. */
export const sheetByHref = (href: string): ShelfSheet | undefined =>
  SHELVES.flatMap((shelf) => shelf.sheets).find((sheet) => sheet.href === href);

/** The route a year is listed at. */
export const gradeHref = (grade: Grade): string =>
  `/printables/grade/${grade.slug}`;

/** The ages, as `typicalAgeRange` wants them and as the page says them. */
export const ageRange = (grade: Grade): string =>
  `${grade.ages[0]}-${grade.ages[1]}`;
