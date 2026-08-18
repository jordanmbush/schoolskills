/**
 * The Scripture sheets the Print Shop has set, and the words that go round
 * them.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `bible/[...slug].astro`, which prerenders one sheet per entry, and
 * `bible/index.astro`, which is the subject hub — rather than a route of its
 * own. `_catalog.ts` does the same job for paper, `_maths.ts` for maths, and
 * `_handwriting.ts` and `_cursive.ts` for the two hands.
 *
 * **A shelf of its own, and a peer of the others** (§12). Not because Scripture
 * is set apart — the whole design decision is that it isn't; a verse sits in the
 * same passage picker as the Gettysburg Address, and the sheets below are the
 * ordinary copywork and memory families with a passage id on them. It is a
 * shelf because a shelf is how somebody arrives: "bible verse copywork
 * printable" and "scripture handwriting practice" are queries a parent types,
 * and a page that answers one of them has to exist to be found. The engine has
 * no Scripture family and does not need one.
 *
 * **Where it doesn't go is in `_maths.ts`.** A verse reference bolted to a long
 * division serves neither, and that is a craft judgement rather than a
 * positioning one (§12).
 *
 * **The credit prints on every page here.** A public-domain text needs none,
 * and eBible.org attaches one condition to the World English Bible's name that
 * a credit line is the easiest way to keep honestly. The line is the engine's
 * own constant, read off the passage rather than typed here, so the sheet
 * footer and the page around it cannot drift apart.
 *
 * **Two stocks, as with paper and handwriting.** Most of this shelf is ruled,
 * and a ⅝ rule sent to a printer loaded with A4 is scaled to fit — which is no
 * longer a ⅝ rule. The memory sheets have no ruling to distort and could have
 * lived on one stock, as the maths sheets do; they come on both anyway, because
 * a shelf where some pages have an A4 twin and some don't is a shelf a parent
 * has to check.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import { passage as passageById } from "@/engine/sheets/passages";
import type {
  HandwritingConfig,
  MemoryConfig,
  PaperSize,
  SheetConfig,
} from "@/engine/sheets/types";

import {
  SHEET_FIELDS as FIELDS,
  STOCKS,
  benchHref,
  paperOf,
  shelve,
  stockHref,
  stockPath,
  type Stock,
} from "./_catalog";

/** How the hub groups the shelf: what is being done with the words. */
export type BibleGroup = "tracing" | "copywork" | "memory";

/** Either of the two families that take a passage. Nothing else is on here. */
export type BibleConfig = HandwritingConfig | MemoryConfig;

export type BibleSheet = {
  /** The route under /printables/bible, and the head term it answers. */
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
  group: BibleGroup;
  /**
   * Which passage, by its id in the library.
   *
   * Here rather than inside `config` so that the page and the sheet cannot
   * quote two different verses: `configFor` is what puts it on the config, and
   * it is also what the page reads to print the passage's own credit line.
   */
  passage: string;
  /** The sheet itself, less the passage. Prerendered — this IS the page (§8). */
  config: BibleConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves.
 *
 * It decides nothing on a copywork sheet — a passage is a passage — and on a
 * memory sheet it decides *which* words come out in each round, which is
 * exactly the kind of thing §7 promises stays put: the sheet a parent printed
 * in March is the sheet they print in June, down to the gaps.
 */
export const BIBLE_SEED = 1;

export const BIBLE_SHEETS: BibleSheet[] = [
  /* ── Tracing ────────────────────────────────────────────────────────── */
  {
    slug: "bible-verse-tracing-worksheets",
    name: "Bible verse tracing — Genesis 1:1",
    short: "Genesis 1:1",
    heading: "Bible verse tracing worksheets",
    keyword: "Free printable Bible verse tracing worksheets",
    summary:
      "The first verse of Genesis on ⅝-inch handwriting paper: printed to read, dotted to trace, and an empty line to write it alone.",
    lead: "Ten words a five-year-old can hear the whole of, on the ⅝-inch ruling a school means by “handwriting paper”. Each line is printed once to read, once in dots to trace over, and then left empty.",
    notes: [
      "This is a handwriting sheet that happens to be a verse, which is the right way round at this age. A child who is still forming letters cannot also be thinking about what a sentence means, so the sentence had better be one they already half know — and “In the beginning, God created the heavens and the earth” is ten words, one clause, and no word longer than nine letters. By the fourth line it is being written from memory without anybody having called it memory work.",
      "The ⅝ ruling has a dashed midline and room below the baseline for a tail, which this verse needs twice over: the two g’s of “beginning” are the only letters on it that drop below the line, and on paper without descender space they get written small and flat to avoid the rule underneath. Print the ¾ or the inch version from the builder if letters are still growing into the line — the sheet is identical apart from the size.",
    ],
    teaches: "Letter formation and Scripture copywork",
    ages: "Ages 5–7",
    group: "tracing",
    passage: "in-the-beginning",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "hand-5-8", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },
  {
    slug: "bible-verse-handwriting-worksheets",
    name: "Bible verse handwriting — John 3:16",
    short: "John 3:16",
    heading: "Bible verse handwriting worksheets",
    keyword: "Free printable Bible verse handwriting worksheets",
    summary:
      "John 3:16 on half-inch handwriting paper, each line traced twice and then written on a line of its own.",
    lead: "The verse most families teach first, on the half-inch ruling that fits a whole clause on a line. Every line appears three times down the page: printed to read, dotted to trace, and empty to write.",
    notes: [
      "Half an inch is where handwriting stops being about forming letters and starts being about getting to the end of a line without the words drifting. That makes it the right size for a verse rather than a word: the clauses are short enough to sit one to a line, so a child copying this is copying whole phrases — which is also how a verse is actually learnt, in pieces that mean something rather than word by word.",
      "The dotted model runs down the page rather than across it, which is the difference between a word sheet and a copywork sheet. A word can be written six times on one line; a line of a verse fills the line, so the repeats have to go underneath — and the empty rule at the bottom of each group is the one that counts, because it is the only place nobody is helping.",
    ],
    teaches: "Handwriting and Scripture copywork",
    ages: "Ages 6–9",
    group: "tracing",
    passage: "for-god-so-loved-the-world",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "hand-1-2", midline: "dashed", descender: true },
      trace: "dotted",
      repeats: 3,
    },
  },

  /* ── Copywork ───────────────────────────────────────────────────────── */
  {
    slug: "bible-copywork-worksheets",
    name: "Bible copywork — Proverbs 3:5-6",
    short: "Proverbs 3:5-6",
    heading: "Bible copywork worksheets",
    keyword: "Free printable Bible copywork worksheets",
    summary:
      "Proverbs 3:5-6 on ⅜-inch transitional paper: the line printed, a grey copy to write over, and an empty line to write it from nothing.",
    lead: "Two verses on the transitional ⅜-inch ruling — a top line, a baseline and nothing between them. Each line is printed to read, printed faintly once to write over, and then left as an empty rule.",
    notes: [
      "The faint grey line is what marks this sheet as the one after tracing. A dotted letter is a path to follow and a grey one is a shape to write over, so the pencil has to do the deciding about where a stroke starts and how far it goes. It is a small change and it is the whole step between copying a letter and writing one, which is why the middle line here is grey rather than dotted.",
      "Copywork is the oldest handwriting exercise there is and it is still the best one once letters are formed, because it is three lessons at once: the hand practises, the eye holds the spelling and the punctuation long enough for them to go in, and the words themselves get read four or five times without anybody being asked to memorise anything. Two verses is about right for one sitting at this age — long enough to be work, short enough to finish.",
    ],
    teaches: "Copywork and sustained handwriting",
    ages: "Ages 7–10",
    group: "copywork",
    passage: "trust-in-the-lord",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "hand-3-8", midline: "none", descender: true },
      trace: "dim",
      repeats: 3,
    },
  },
  {
    slug: "psalm-23-copywork",
    name: "Psalm 23 copywork",
    short: "Psalm 23",
    heading: "Psalm 23 copywork worksheet",
    keyword: "Free printable Psalm 23 copywork",
    summary:
      "The whole of Psalm 23 on narrow ruled paper, every line printed once to read and left once to copy.",
    lead: "All six verses of the psalm, on the quarter-inch ruling that gets the whole of it onto one page. Each line is printed and then left blank underneath, which is copywork with nothing else in the way.",
    notes: [
      "The whole psalm rather than a verse of it, and that is what decides the ruling: at six hundred characters this needs about thirty lines, so quarter-inch rules are the only ones that fit the lot on a single sheet. It is a page for a child who is writing fluently and wants a real piece of work — twenty minutes rather than five — and it is worth saying that out loud before handing it over.",
      "There is nothing dotted and nothing grey on this sheet. A reader at this stage does not need a model to write over; what they need is the line above to look at and an empty rule to fill, which is exactly what a page of copywork is. If a lighter version is wanted, the builder will set the same psalm with a grey model and fewer lines to a page, on any of the twelve rulings.",
    ],
    teaches: "Copywork and Scripture memory",
    ages: "Ages 9–13",
    group: "copywork",
    passage: "psalm-23",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "narrow" },
      trace: "dim",
      repeats: 2,
    },
  },
  {
    slug: "lords-prayer-copywork",
    name: "The Lord’s Prayer copywork",
    short: "Lord’s Prayer",
    heading: "The Lord’s Prayer copywork worksheet",
    keyword: "Free printable Lord’s Prayer copywork",
    summary:
      "The Lord’s Prayer from Matthew 6 on ⅜-inch paper, each line printed once and left once to copy.",
    lead: "The prayer as Matthew has it, a line at a time on the transitional ⅜-inch ruling. Each line is printed to read and followed by an empty rule to write it on.",
    notes: [
      "The Lord’s Prayer is the passage most often learnt by heart before it is understood, which makes it unusually good copywork: a child who has said it a hundred times meets the words on paper and notices where the clauses actually break. Writing “Forgive us our debts, as we also forgive our debtors” out slowly is the first time most people see that half of it is a comparison.",
      "One copy under each line rather than two, because the lines here are long and the prayer is not short. That is the trade a copywork sheet always makes — how many times each line is written against how much of the passage fits on the page — and the builder is where to change it: the same prayer at three copies a line runs to two sheets, which is a perfectly good week’s work if that is what is wanted.",
    ],
    teaches: "Copywork and Scripture memory",
    ages: "Ages 7–11",
    group: "copywork",
    passage: "the-lords-prayer",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "hand-3-8", midline: "none", descender: true },
      trace: "dim",
      repeats: 2,
    },
  },
  {
    slug: "1-corinthians-13-copywork",
    name: "1 Corinthians 13 copywork — love is patient",
    short: "1 Cor 13",
    heading: "1 Corinthians 13 copywork worksheet",
    keyword: "Free printable 1 Corinthians 13 copywork",
    summary:
      "“Love is patient and is kind…” — five verses on college ruled paper, printed to read and left to copy.",
    lead: "The passage from verse four to verse eight, on college ruled paper. Each line is printed once and followed by an empty rule, so the whole of it fits on a single page.",
    notes: [
      "Psalm 23 aside, this is the longest passage on the shelf, and the one that reads least like a list when it is copied out — which is the point of copying it. Fifteen separate statements about one word go past far too quickly when they are read; written out at the speed of a hand, the shape of the argument shows up, and so does the fact that most of the statements are about what love does not do.",
      "College ruled rather than handwriting paper, because by the age this passage is worth setting a child is writing on ordinary lined paper at school and should be practising on the same thing. There is no midline and no descender space here; what there is instead is about six more lines to the page than wide ruled gives you, which is what makes a passage this long fit on one.",
    ],
    teaches: "Copywork and sustained handwriting",
    ages: "Ages 10–14",
    group: "copywork",
    passage: "love-is-patient",
    config: {
      kind: "handwriting",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      style: "passage",
      rule: { style: "college" },
      trace: "dim",
      repeats: 2,
    },
  },

  /* ── Memory work ────────────────────────────────────────────────────── */
  {
    slug: "bible-memory-verse-worksheets",
    name: "Memory verse — John 3:16",
    short: "John 3:16 by heart",
    heading: "Bible memory verse worksheets",
    keyword: "Free printable Bible memory verse worksheets",
    summary:
      "John 3:16 written out four times with more words missing each time — and the whole verse on the answer key.",
    lead: "The verse in full at the top, then three times over with more of it gone: a few words, then most of them, then a line of blanks. It is the whiteboard exercise every family already does, on paper.",
    notes: [
      "Rubbing a few words off the board and saying it again is how a verse is learnt, and the reason it works is that each round is only slightly harder than the one before. That is the whole of what this sheet does: the words are taken away in the same order every round, so nothing that has gone ever comes back, and by the last line there is nothing left to read from. A child who gets to the bottom has said the verse from memory three times without being asked to recite it once.",
      "Words are left out here on purpose, and the sheet says so on it — printing part of a translation without saying that is what it is would be publishing a modified text under somebody else’s name. The answer key behind this page is the verse whole, exactly as the translation has it, punctuation and all. That is also the page to hand the person doing the listening.",
    ],
    teaches: "Scripture memory",
    ages: "Ages 6–12",
    group: "memory",
    passage: "for-god-so-loved-the-world",
    config: {
      kind: "memory",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      rounds: 4,
    },
  },
  {
    slug: "psalm-23-memory-verse",
    name: "Memory work — Psalm 23",
    short: "Psalm 23 by heart",
    heading: "Psalm 23 memory worksheet",
    keyword: "Free printable Psalm 23 memory worksheet",
    summary:
      "The whole of Psalm 23 printed to read, and then asked for again with every word of it gone — with the psalm entire on the answer key.",
    lead: "A psalm rather than a verse, which changes the exercise: a hundred and eighteen words will not go three times onto one page once every one of them needs a gap wide enough to write in, so this is the psalm printed whole and then asked for with nothing left to read from.",
    notes: [
      "Two rounds rather than four is the page deciding, not a judgement about difficulty — the sheet asks for four and comes down to the number that fit, keeping the empty round at the end because that is the one the whole progression aims at. A gap has to be wide enough to write a word in, so it takes more room on the paper than the word it replaced: the psalm printed runs to eight lines and the psalm with every word gone to about twice that, which is why a whole psalm gets two rounds where a single verse gets four.",
      "This is a sheet to spend a fortnight on rather than an afternoon. The usual way through it is to do the first round as copywork on one day and the second one when somebody thinks they have it, a week or two later — and the answer key behind this page is the psalm entire, which is what the person listening should be holding.",
    ],
    teaches: "Scripture memory",
    ages: "Ages 9–14",
    group: "memory",
    passage: "psalm-23",
    config: {
      kind: "memory",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      // Four asked for and two printed. Nothing here decides that the psalm
      // gets fewer rounds than the verses do — `memoryLayout` does, against the
      // room a hundred and eighteen gaps take, and the note above says so
      // because the page says so.
      rounds: 4,
    },
  },
  {
    slug: "fruit-of-the-spirit-memory-verse",
    name: "Memory verse — the fruit of the Spirit",
    short: "Fruit of the Spirit",
    heading: "Fruit of the Spirit memory worksheet",
    keyword: "Free printable fruit of the Spirit worksheet",
    summary:
      "Galatians 5:22-23 four times over with more of the list missing each time, and the full verse on the key.",
    lead: "The nine-word list every Sunday school teaches, in the sentence it comes in. Written out in full, then three times with more of it gone, ending with a line of blanks.",
    notes: [
      "A list is the hardest kind of thing to learn by heart and the easiest to think you have learnt: most children can say seven of the nine and stall in the same place every time. Taking the words out in a fixed order is what finds the gap — a third of the verse is gone in the second round and two thirds of it in the third, so whichever of the nine is missed at that point is missed in the same place every time, and it is worth five minutes on its own before the last round is attempted.",
      "The verse rather than the list on its own, deliberately. “Love, joy, peace…” recited as nine nouns is a spelling test; the sentence around them says what they are and what they are not, and the last clause — “against such things there is no law” — is the part almost nobody remembers, which is a fair sign it is usually taught as a list rather than as a verse.",
    ],
    teaches: "Scripture memory",
    ages: "Ages 7–12",
    group: "memory",
    passage: "the-fruit-of-the-spirit",
    config: {
      kind: "memory",
      paper: paperOf("letter"),
      fontPt: DEFAULT_FONT_PT,
      fields: FIELDS,
      rounds: 4,
    },
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const BIBLE_GROUPS: Array<{
  id: BibleGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "tracing",
    label: "Verses to trace",
    blurb:
      "A verse on primary ruled paper, traced first and then written alone.",
  },
  {
    id: "copywork",
    label: "Copywork",
    blurb:
      "A passage a line at a time, once the letters are no longer the work.",
  },
  {
    id: "memory",
    label: "Memory work",
    blurb:
      "The same passage with more of it missing each time, and the whole of it on the key.",
  },
];

/**
 * The sheet, measured for a stock and pointed at its passage.
 *
 * The passage is put on here rather than written into each config for the
 * reason `BibleSheet.passage` gives: one field, so the verse the page names and
 * the verse the sheet prints cannot come apart.
 */
export function configFor(sheet: BibleSheet, size: PaperSize): SheetConfig {
  return { ...sheet.config, passage: sheet.passage, paper: paperOf(size) };
}

/**
 * The credit the sheet will print, read off the passage itself.
 *
 * Never typed on a page. §12 puts the line in one constant in the engine
 * precisely so that the footer of the sheet and the prose around it cannot
 * disagree, and a catalog page that quoted it by hand would be the second copy
 * that goes stale.
 */
export const creditFor = (sheet: BibleSheet): string | undefined =>
  passageById(sheet.passage)?.credit;

/** How the passage is named — "Psalm 23" — and who it is by. */
export const passageFor = (sheet: BibleSheet) => passageById(sheet.passage);

/**
 * Whether this sheet has an answer key worth printing.
 *
 * Copywork has none and needs none: the model is already on the page, which is
 * the exercise. A memory sheet's key is the passage whole, and it is the single
 * most useful page on this shelf — it is what the person listening holds.
 */
export const keyed = (sheet: BibleSheet): boolean =>
  sheet.config.kind === "memory";

/** The route a sheet prints at, on a given stock — see `_catalog.ts`. */
export const pathFor = (sheet: BibleSheet, stock: Stock): string =>
  stockPath(sheet.slug, stock);

/** The whole URL, which is what a hub links to and the canonical says. */
export const hrefFor = (sheet: BibleSheet, stock: Stock): string =>
  stockHref("/printables/bible", sheet.slug, stock);

/** The builder, opened on this sheet. */
export const builderHref = (sheet: BibleSheet, stock: Stock): string =>
  benchHref(configFor(sheet, stock.id), BIBLE_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function bibleShelf(): Array<{
  id: BibleGroup;
  label: string;
  blurb: string;
  sheets: BibleSheet[];
}> {
  return shelve(BIBLE_GROUPS, BIBLE_SHEETS);
}

/** Letter first, then A4 — the order `_catalog.ts` sets and the reason for it. */
export { STOCKS };
