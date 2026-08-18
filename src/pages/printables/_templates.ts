/**
 * The blank paperwork the Print Shop has set, and the words that go round it.
 *
 * Underscored so Astro leaves it out of the routing table: it is data two pages
 * share — `templates/[slug].astro`, which prerenders one sheet per entry, and
 * `templates/index.astro`, which is the hub — rather than a route of its own.
 * `_catalog.ts` does that job for paper, `_charts.ts` for the maths references,
 * `_maths.ts` for the worksheets, and so on down the shelf.
 *
 * **The whole shelf is supposed to be empty, and that is the argument for it.**
 * §11 sorts the catalog into three tiers, and this is the middle one: nothing on
 * any of these twenty-two pages is generated out of a subject somebody would
 * have to be an editor to get right, so there is nothing on one that could be
 * wrong. A reading log is a reading log whoever printed it. The lab report here
 * is the clearest case — it is a *form*, asking what the question was and what
 * happened, and supplying neither, because the paperwork round a science lesson
 * is ours to print and the science is the third tier's "not ours to fake".
 *
 * **Four families, five groups, and the groups are not the families.** Forms,
 * the week, the paper that gets cut up and the two things that are objects
 * rather than pages: `templates/forms.ts`, `planner.ts`, `cards.ts` and
 * `nets.ts`. A parent looking for a chore chart does not know or care that it
 * shares a block with a reading log, so the shelf is grouped by what somebody is
 * doing — reading and writing, science and history, the week, cards to cut out,
 * and the things that get made — and a group takes sheets from whichever family
 * draws them.
 *
 * **Three of the twenty-two carry a verse, and they are listed where they fall.**
 * §12 is explicit that Scripture is woven through rather than cordoned off: the
 * memory-verse cards sit beside the blank flashcards because they are the same
 * rectangle, and the verse-of-the-week chart sits beside the chore chart because
 * it is the same week. The passage is a setting on all three, chosen from the
 * same picker copywork uses, and the credit line travels with the words rather
 * than with the page.
 *
 * **What is already next door.** Lined, squared and handwriting paper is the
 * paper shelf, and the hundred charts, number lines, coordinate grids and
 * place-value mats are `/printables/charts`. Both are this same tier and neither
 * is rebuilt here.
 *
 * **One stock, for a different reason than the charts shelf has.** Nothing here
 * is a *stated* measurement the way a ⅝ rule is: a card's size is worked out
 * from the paper it is being cut out of rather than declared on it, so a sheet
 * of these on A4 is a correct sheet of slightly different cards rather than a
 * wrong one. What the prose quotes is what US Letter gives, because that is the
 * paper these pages print on; a different stock is a control in the builder, and
 * the geometry follows it.
 */
import { DEFAULT_FONT_PT } from "@/engine/sheets/paper";
import { cardsKeyed } from "@/engine/sheets/templates/cards";
import { formKeyed } from "@/engine/sheets/templates/forms";
import { netKeyed } from "@/engine/sheets/templates/nets";
import { plannerKeyed } from "@/engine/sheets/templates/planner";
import type {
  CardsConfig,
  FormConfig,
  HeaderField,
  NetConfig,
  PlannerConfig,
  SheetConfig,
} from "@/engine/sheets/types";

import { SHEET_FIELDS, benchHref, paperOf, shelve } from "./_catalog";

/** How the hub groups the shelf: what a parent is doing, not which family drew it. */
export type TemplateGroup = "writing" | "science" | "week" | "cards" | "making";

export type TemplateSheet = {
  /** The route under /printables/templates, and the head term it answers. */
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
  /** The lead paragraph: what the sheet is, stated plainly. */
  lead: string;
  /**
   * Two things that are true of this sheet and not of the one beside it.
   *
   * The sheet is prerendered directly under this prose (§8), which makes a
   * number quoted in it a claim about the paper rather than a description of
   * it — a reader can look down the page and count the rows, or hold a ruler
   * against a card. `_templates.test.ts` holds every number written in words to
   * what the sheet under it actually draws.
   */
  notes: string[];
  /** For the `LearningResource` block. */
  teaches: string;
  ages: string;
  group: TemplateGroup;
  /** The sheet itself. Prerendered at build time — this IS the page (§8). */
  config: SheetConfig;
};

/**
 * The seed every sheet on this shelf is built from, and it never moves.
 *
 * It decides one thing, on one page: the writing prompt is drawn from it, out of
 * the bank in `templates/prompts.ts`, and "another one like this" is `seed + 1`
 * there as everywhere else (§7). The other twenty-one ignore it entirely — a
 * chore chart is the same seven columns whoever prints it — and it is still
 * printed in the footer of all of them, because a sheet is reproducible from its
 * seed and a reader has no way of knowing which sheets ignore theirs.
 */
export const TEMPLATE_SEED = 1;

/**
 * Printed blank, always — on the sheets that carry one at all.
 *
 * A worksheet asks for a name because a teacher has thirty of them to hand back.
 * Nothing here holds one (§1): these are two ruled lines on paper and there is
 * nowhere in a config to put a value for either. What varies is whether they are
 * drawn, and on this shelf that is the difference between a sheet a child works
 * on — a book report, a lab write-up, a timeline — and a chart that goes on a
 * wall or a sheet that is about to be cut into six. A name line above a page of
 * cards would be a name line on none of them.
 */
const WORKED: HeaderField[] = SHEET_FIELDS;
const PINNED: HeaderField[] = [];

/** A form on Letter, portrait. */
const form = (
  fields: HeaderField[],
  extra: Partial<FormConfig>,
): FormConfig => ({
  kind: "form",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields,
  style: "book-report",
  ...extra,
});

/** A week, on Letter, portrait. */
const planner = (
  fields: HeaderField[],
  extra: Partial<PlannerConfig>,
): PlannerConfig => ({
  kind: "planner",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields,
  style: "calendar",
  ...extra,
});

/**
 * A page of cards to cut up.
 *
 * `paper` is spread over rather than fixed, which one entry needs: a certificate
 * is a landscape document, and the sheet carries its own paper — so `@page`
 * follows the sheet and the page prints landscape without anybody having to find
 * the orientation control in the print dialog.
 */
const cardsheet = (
  fields: HeaderField[],
  extra: Partial<CardsConfig>,
): CardsConfig => ({
  kind: "cards",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields,
  style: "flashcard",
  ...extra,
});

/** Something to cut out and fold up, or cut out and spin. */
const net = (fields: HeaderField[], extra: Partial<NetConfig>): NetConfig => ({
  kind: "net",
  paper: paperOf("letter"),
  fontPt: DEFAULT_FONT_PT,
  fields,
  style: "dice",
  ...extra,
});

export const TEMPLATE_SHEETS: TemplateSheet[] = [
  /* ── Reading and writing ────────────────────────────────────────────── */
  {
    slug: "reading-log",
    name: "Reading log",
    short: "Reading log",
    heading: "Printable reading log",
    keyword: "Free printable reading log",
    summary:
      "Fourteen ruled rows under five columns — Date, What I read, Pages, Minutes and Signed — for a fortnight of reading at a time.",
    lead: "A fortnight on one sheet: fourteen rows, and five columns across them for the date, what was read, how many pages, how many minutes and a grown-up's signature. One line a day, filled in when the reading is done rather than planned before it.",
    notes: [
      "The minutes column is the one to insist on, and the pages column is the one to be relaxed about. A page of a picture book and a page of a chapter book are not the same quantity, so a log kept in pages rewards whoever happens to be reading large type; minutes are the same minutes for everybody, and twenty of them is what a school asks for when it asks for anything. A child who has read for eleven minutes writes eleven.",
      'The columns are as wide as what goes in them rather than a fifth of the page each. "Minutes" is three numerals wide and "What I read" has to hold a title, so an even division would print one column nobody can write in and another that is mostly empty. If a fortnight is the wrong period, the row count is a control in the builder and the widths follow it.',
    ],
    teaches: "Keeping a record of daily reading",
    ages: "Ages 5–11",
    group: "writing",
    config: form(WORKED, { style: "reading-log", rows: 14 }),
  },
  {
    slug: "book-report",
    name: "Book report form",
    short: "Book report",
    heading: "Printable book report form",
    keyword: "Free printable book report template",
    summary:
      "A page of plain headings for a book that has been finished: the title, who wrote it, what it is about, the favourite part and why, and who else should read it.",
    lead: 'Six headings with room to write under each, in the words a child already uses. Not "protagonist" and not "setting" — what it is about, the favourite part and why, and who you would tell to read it.',
    notes: [
      'The two words that do the work on this sheet are "and why". A favourite part with no reason attached is one sentence and the end of the exercise; the same question with a reason asked for is a paragraph, and it is the first paragraph most children write that argues something rather than retelling it. The box is sized for that answer rather than for the question.',
      "The boxes are deliberately not the same height as each other. The title gets a line, because a title is a line; what the book is about gets the largest share of the page, because that is the part worth thinking about. A form ruled into equal boxes teaches a child that every question on it is worth the same amount of writing, which is precisely the thing a book report is trying to unteach.",
    ],
    teaches: "Summarising a book, and giving a reason",
    ages: "Ages 7–11",
    group: "writing",
    config: form(WORKED, { style: "book-report" }),
  },
  {
    slug: "story-map",
    name: "Story map",
    short: "Story map",
    heading: "Printable story map",
    keyword: "Free printable story map template",
    summary:
      "Who is in it, where and when, and what goes wrong — then the three boxes a story is actually told in: beginning, middle and end.",
    lead: "A planning sheet rather than a writing one. The people and the place go in first, then the thing that goes wrong, and only then the three boxes the story is told in — which is the order a story is invented in rather than the order it is read in.",
    notes: [
      '"What goes wrong" is the box that makes this a story map rather than a list. A child who plans a beginning, a middle and an end without one writes an account of a day out: they went to the beach, they had chips, they came home. Something has to go wrong for the middle to be about anything, and asking for it on its own line — before any of the three boxes — is the cheapest way to get it.',
      "It works just as well backwards, on a book somebody has read rather than a story they are inventing, and that is comprehension rather than composition without being a different sheet. Filling in the same six boxes from a chapter book is a harder exercise than it looks: naming what went wrong in a story you did not write is most of what a reading comprehension question is asking.",
    ],
    teaches: "Planning a story",
    ages: "Ages 6–10",
    group: "writing",
    config: form(WORKED, { style: "story-map" }),
  },
  {
    slug: "paragraph-frame",
    name: "Paragraph frame",
    short: "Paragraph frame",
    heading: "Printable paragraph frame",
    keyword: "Free printable paragraph writing template",
    summary:
      "Five boxes — a topic sentence, three reasons with a detail each, and a closing sentence — that read as a finished paragraph once they are joined up.",
    lead: "One sentence in each box, in the order they are printed. Joined up, they are the paragraph: an opening that says what it is about, three reasons with something specific attached to each, and a close that says it again differently.",
    notes: [
      'Each of the three middle boxes asks for a reason *and* a detail, on one line, and the detail is the half that goes missing. "Dogs are good pets because they are friendly" is a reason with nothing behind it; "because ours waits by the door at half past three" is the same reason with the thing that makes a reader believe it. Asking for both in one box means a missing detail is visible as a short line rather than invisible as a complete sentence.',
      "It is scaffolding, and scaffolding is meant to come down. The frame is worth printing for a fortnight and then worth withholding: a child who can fill it in can write the paragraph without it, and the way to find that out is to hand them a sheet of lined paper and ask for the same thing. If the paragraph falls apart, print the frame again for a week. If it does not, the sheet has done its job.",
    ],
    teaches: "Writing a paragraph that argues something",
    ages: "Ages 8–12",
    group: "writing",
    config: form(WORKED, { style: "paragraph-frame" }),
  },
  {
    slug: "writing-prompts",
    name: "Writing prompt",
    short: "Writing prompt",
    heading: "Printable writing prompt",
    keyword: "Free printable writing prompts",
    summary:
      "One prompt across the top of the page and college-ruled lines under it — a different prompt each time the seed moves.",
    lead: "A sentence to start from, and a page to write on. The prompt is a situation rather than a title: something has happened, and what happens next is the child's to decide.",
    notes: [
      "This is the one page on the shelf that is drawn from a seed rather than the same paper every time. Everything else here is a form or a grid, and a form is what it is whoever prints it; a prompt has to come from somewhere, so it comes from the number in the footer, and the sheet printed here is the one that number draws. Another prompt is the next seed along in the builder, which is the same move every generated sheet in the shop makes (§7).",
      "The lines are college ruled — the same ruling as the lined-paper shelf, drawn by the same block — so a child who fills the page can carry on onto an ordinary sheet without their handwriting changing size halfway through a story. If the writing is still growing into the line, print the prompt, then hand them wide ruled paper to write on instead; the sheet is a starting sentence rather than a place the writing has to fit.",
    ],
    teaches: "Creative writing from a prompt",
    ages: "Ages 7–12",
    group: "writing",
    config: form(WORKED, { style: "writing-prompt" }),
  },

  /* ── Science and history ────────────────────────────────────────────── */
  {
    slug: "lab-report",
    name: "Lab report sheet",
    short: "Lab report",
    heading: "Printable lab report sheet",
    keyword: "Free printable lab report template",
    summary:
      "What we were trying to find out, what we used, what we did in order, what happened, and what we think it means — the write-up, with none of the science supplied.",
    lead: "The paper an experiment is written up on. The first two boxes are filled in before anything is touched and the rest as it goes, which is the whole of the discipline the sheet is teaching.",
    notes: [
      'This sheet is a form, and that is the point rather than a limitation. §11 draws a line under science content — generating "5th grade science worksheets" without an editor produces plausible nonsense, and a wrong fact on a page a child trusts is worse than a blank page — but the paperwork round an experiment is nobody\'s opinion. What is here is a set of headings; what happened at your kitchen table is yours, and nothing on the sheet pretends to know it.',
      '"What we think it means" is not called a conclusion, and the wording is the useful part. A conclusion sounds like something a child could get wrong and be marked down for, so what gets written in it is a guess at the expected answer; "what we think it means" is a claim being made from what was actually seen, which is what a conclusion is and is the thing a child can defend when the result was not what anybody predicted.',
    ],
    teaches: "Writing up an experiment",
    ages: "Ages 8–13",
    group: "science",
    config: form(WORKED, { style: "lab-report" }),
  },
  {
    slug: "scientific-method",
    name: "Scientific method sheet",
    short: "Scientific method",
    heading: "Printable scientific method worksheet",
    keyword: "Free printable scientific method worksheet",
    summary:
      "Six numbered boxes in order: the question, what I already know, what I think will happen and why, how I will test it, what happened, and what that tells me.",
    lead: "The method as six boxes, numbered, in the order they are meant to be filled in. The first three are written before anything is tested — which is the only part of the scientific method that is difficult to keep to, and the reason the numbers are printed on the paper.",
    notes: [
      "A prediction written after the result is not a prediction, and a child who fills this sheet in at the end of an experiment has done the whole thing backwards without noticing. The numbers are what stop that: they are on the boxes rather than in an instruction, so an empty box three under a filled-in box five is visible from across the table. Fill in the first three, put the pencil down, then do the experiment.",
      'The third box asks what will happen *and why*, and the "why" is the hypothesis. A guess is "the big one will fall faster"; a hypothesis is "the big one will fall faster because it is heavier" — and the second one can be shown to be wrong in a way that teaches something, which is exactly what happens when both hit the floor together. This is the sheet to carry through an experiment; the lab report next door is the one to write it up on afterwards.',
    ],
    teaches: "The scientific method, in order",
    ages: "Ages 8–13",
    group: "science",
    config: form(WORKED, { style: "scientific-method" }),
  },
  {
    slug: "observation-journal",
    name: "Observation journal",
    short: "Observation journal",
    heading: "Printable nature observation journal",
    keyword: "Free printable nature journal page",
    summary:
      "The date, the time and the weather across the top, a box to draw what was seen, and ruled lines under it for what was noticed about it.",
    lead: "Half the page is a box with nothing ruled in it, because half of a naturalist's page is a drawing. Draw it first, and write what you noticed afterwards.",
    notes: [
      'Drawing first is the instruction and it is the whole method. A child who writes "a bird" has stopped looking; a child who has to draw one has to decide how long its beak is against its head, whether its legs are behind it or under it, and how many colours are actually on it — and the sentence they write afterwards is a different sentence for having drawn. The box is unruled for that reason: rules in it would be a page asking for writing in the space reserved for looking.',
      "The three small boxes across the top are the ones that turn a nice drawing into an observation. The same feeder at eight in the morning and at four in the afternoon is two different sets of birds, and a page with no time on it cannot say so; a fortnight of these with the date and the weather filled in is a record somebody can look back through and notice something in, which is the point of keeping one at all.",
    ],
    teaches: "Observing carefully, and recording what was seen",
    ages: "Ages 6–11",
    group: "science",
    config: form(WORKED, { style: "observation-journal" }),
  },
  {
    slug: "timeline",
    name: "Timeline",
    short: "Timeline",
    heading: "Printable blank timeline",
    keyword: "Free printable blank timeline template",
    summary:
      "Ten rows in two columns — When on the left and What happened on the right — with a heavy line ruled down the boundary between them.",
    lead: "One thing to a row, earliest at the top. The dates go down the left of a heavy upright rule and the events hang off the right of it, which is the one thing that makes this a timeline rather than a two-column table.",
    notes: [
      "The heavy rule with a tick into every row is the whole drawing. A two-column table of dates and events carries exactly the same information and does not read as time passing; a spine does, because the eye follows it and the ticks are stops along it. It is worth pointing at when the sheet is handed over — the line is the century, and each tick is a place on it.",
      "What it records is order rather than scale, and it is worth saying so out loud: the rows are all the same height, so a gap of a hundred years and a gap of a fortnight take up the same amount of paper. That is the right trade for a life, a reign or the events of a book. For a period where the *distances* are the lesson — how long the Romans were here against how recent the war is — a scaled line is the honest drawing, and a printable number line is on the charts shelf.",
    ],
    teaches: "Putting events in order",
    ages: "Ages 7–12",
    group: "science",
    config: form(WORKED, { style: "timeline", rows: 10 }),
  },

  /* ── The week ───────────────────────────────────────────────────────── */
  {
    slug: "blank-calendar",
    name: "Blank calendar",
    short: "Blank calendar",
    heading: "Printable blank calendar",
    keyword: "Free printable blank calendar",
    summary:
      "Seven columns headed with the days of the week and five rows of empty squares, with no month and no year printed anywhere on it.",
    lead: "A month with the dates left out: seven columns under the day names, five rows of squares, and nothing to say which month it is. Write the month in the title line, number the squares, and it is whichever one you need.",
    notes: [
      "Undated is not a lesser calendar, it is the commoner request. A blank month grid does not go out of date on a wall, so the same sheet is next month as well; a family that wants January writes January. The dated version is one control away in the builder, and when a month *is* named the dates stop being decoration and become arithmetic with a right answer — the first landing under the correct weekday, and thirty-one days beginning on a Friday needing six rows rather than five.",
      "The week starts on Sunday here, as an American wall calendar does, and most of the rest of the world starts it on Monday. It is a switch in the builder rather than a preference to live with, and it is worth getting right before printing a term's worth: a family handed the wrong one counts the weekend on the wrong end of every row, and the mistake is the sort that is invisible until somebody plans around it.",
    ],
    teaches: "The days of the week, and planning a month",
    ages: "Ages 5–12",
    group: "week",
    config: planner(PINNED, { style: "calendar", rows: 5 }),
  },
  {
    slug: "weekly-planner",
    name: "Weekly planner",
    short: "Weekly planner",
    heading: "Printable weekly planner",
    keyword: "Free printable weekly planner",
    summary:
      "The seven days down the page with three columns across each — morning, afternoon and evening — for a week planned by when rather than by what.",
    lead: "Seven day rows, and each day cut into a morning, an afternoon and an evening. A week with one box a day is a to-do list; the thing a home-schooling week actually needs to say is when.",
    notes: [
      'Splitting the day into three is what makes the sheet usable by the child rather than only by the adult who wrote it. "Maths" somewhere on Tuesday is a plan only the planner can read; "maths" in Tuesday morning answers the question a seven-year-old asks four times a day, and answers it without anybody being interrupted. Pin it at their height rather than filing it.',
      'The three columns are named rather than fixed. A family that works in periods, or in blocks named after the people teaching them, can put their own headings across the top in the builder and get the same grid — and a week whose columns are "before lunch" and "after lunch" is a perfectly good week. What stays fixed is the seven rows, because a week is seven days whatever the columns are called.',
    ],
    teaches: "Planning a week",
    ages: "Ages 6–13",
    group: "week",
    config: planner(PINNED, { style: "week" }),
  },
  {
    slug: "chore-chart",
    name: "Chore chart",
    short: "Chore chart",
    heading: "Printable chore chart",
    keyword: "Free printable chore chart",
    summary:
      "Ten blank rows for the jobs, seven day columns across them, and a box to tick when one is done.",
    lead: "Eight columns: one for the job and one for each day of the week. The job column is empty, and that is deliberate — this is a chart your household fills in, not one that arrives with somebody else's idea of what a child should be doing.",
    notes: [
      "A chore chart printed with jobs already on it is a chart most families have to cross half of. What counts as a job here depends on whether there is a dishwasher, a dog, a garden or a baby, and it changes every few months anyway — so the left column is a parent's own words, written in pencil the first week and in pen once they have settled. Ten rows is more than most weeks need, and a chart with four jobs on it and six rows spare is exactly what a growing list wants.",
      "The day columns are a box wide rather than a line long, and that is what makes the chart maintainable by a five-year-old. A tick is a mark anyone can make; a chart that asks for a word or an initial is one an adult ends up filling in at the end of the week from memory, which is a record of what the adult remembers rather than of what was done.",
    ],
    teaches: "Routine, and taking responsibility for a job",
    ages: "Ages 4–12",
    group: "week",
    config: planner(PINNED, { style: "chores", rows: 10 }),
  },
  {
    slug: "behaviour-chart",
    name: "Behaviour chart",
    short: "Behaviour chart",
    heading: "Printable behaviour chart",
    keyword: "Free printable behaviour chart",
    summary:
      "Eight rows for the things being worked on, the seven days across them, and a column on the end to count up how many went well.",
    lead: "Nine columns: what I am working on, the seven days, and how many. The left column is headed as a thing being worked on rather than as a fault being recorded, and the last column counts what went well.",
    notes: [
      "A chart that counts the good days and a chart that counts the bad ones are different objects even when the arithmetic is identical, and a child reads which one they have been given immediately. This one ticks the day it went well and adds them up at the end of the week, so a bad Tuesday is an empty box rather than a mark against a name — and a week with four ticks in it is visibly better than last week's three, which is the only comparison worth making.",
      'Keep the goals few and phrase them as the thing to do. "Hang my coat up" can be ticked; "stop leaving my coat on the floor" cannot, because there is no moment at which it has been achieved. Two or three rows filled in is a usable chart and eight is a list of grievances, so the rows are there for a family that wants them rather than as a target — and "how many" gets counted up on a Sunday, with the child doing the counting.',
    ],
    teaches: "Setting a goal, and keeping to it for a week",
    ages: "Ages 4–11",
    group: "week",
    config: planner(PINNED, { style: "behaviour", rows: 8 }),
  },
  {
    slug: "verse-of-the-week",
    name: "Verse of the week",
    short: "Verse of the week",
    heading: "Printable verse of the week chart",
    keyword: "Free printable verse of the week chart",
    summary:
      "Proverbs 3:5-6 set large across the top, with a row for each stage of learning it and a box for every day of the week.",
    lead: "The verse set large enough to read across a room, and a small chart under it: read it, said it with help, said it on my own. A box for each of those on each day of the week.",
    notes: [
      "The three rows are stages rather than repetitions, which is what makes the chart worth keeping. Reading a verse off a wall, saying it with somebody feeding you the next word, and saying it cold are three different skills arriving in that order, and a chart that only counted how many times it had been said would not show which of them a child had reached. The row that stays empty all week is the one to work on.",
      "The verse is a setting, not a fixture. This page prints Proverbs 3:5-6 because a page has to print something, and any of the passages in the library — or a verse pasted in — gives the identical chart, chosen from the same picker the copywork sheets use (§12). The credit line at the foot of the paper travels with the words rather than with the page, which is why it appears on this sheet and not on the chore chart beside it.",
    ],
    teaches: "Memory work, a verse at a time",
    ages: "Ages 4–12",
    group: "week",
    config: planner(PINNED, {
      style: "verse-week",
      passage: "trust-in-the-lord",
    }),
  },

  /* ── Cards to cut out ───────────────────────────────────────────────── */
  {
    slug: "blank-flashcards",
    name: "Blank flashcards",
    short: "Flashcards",
    heading: "Printable blank flashcards",
    keyword: "Free printable blank flashcards with cut lines",
    summary:
      "Eight blank cards to a page at 3.75 by 2.25 inches, with a cut line on every boundary including the outside trim.",
    lead: "Eight cards, two across and four down, each one three and three quarter inches by two and a quarter. Nothing is printed on them: what goes on a flashcard is whatever this week is about, and it is written by hand.",
    notes: [
      "The cut lines sit on the boundaries between the cards, and the outside trim is one of them. There is no gutter, which is the design rather than an omission — a shared edge means one cut makes two cards, and a gutter would mean two cuts and a strip of waste at every boundary. Whatever paper is left over is split evenly to the left and to the right instead, so a stack of cut sheets is square with itself rather than a sixteenth wider down one side.",
      "The card is a whole number of eighths of an inch, which is what makes the dimension above checkable: hold a ruler against one and it says three and three quarters. A size like 3.734 would be a truer fit to the page and no use to anybody. There is no printed back, deliberately — duplex on a home printer lands within about an eighth of an inch and lands there asymmetrically — so write both sides on the same face, or switch the fold on in the builder and get a card that stands up like a tent.",
    ],
    teaches: "Making a set of cards to learn from",
    ages: "Ages 4+",
    group: "cards",
    config: cardsheet(PINNED, { style: "flashcard", up: 8 }),
  },
  {
    slug: "name-tags",
    name: "Name tags",
    short: "Name tags",
    heading: "Printable name tags",
    keyword: "Free printable name tags",
    summary:
      "Four tent name tags to a page at 3.75 by 4.625 inches, folded in half so each panel stands up and reads from both sides.",
    lead: 'Four tags, each with "Hello, my name is" over a rule to write on. Folded across the middle, one stands on a desk and reads from the front and the back at once.',
    notes: [
      "The two panels of a tent are the same piece of paper, which is exactly what a printed back cannot promise on a home printer. A second pass through the tray lands a little off and lands off asymmetrically, so a name printed on the back of a card ends up a few millimetres from where the front says it is. Folding sidesteps the whole problem: whatever the printer did, it did to both halves at once.",
      "The upper panel is printed upside down, and it is meant to be. Fold the top half back and down and it comes round to face the other way, so it has to be printed the other way up to be read — and the fold is exactly halfway down the card, which is what makes the two panels match rather than nearly match. Print on the heaviest paper the printer will take; at this size a tag in ordinary copier paper will not stand.",
    ],
    teaches: "Making a name tag for a class or a group",
    ages: "Ages 4+",
    group: "cards",
    config: cardsheet(PINNED, { style: "name-tag", up: 4, fold: true }),
  },
  {
    slug: "bookmarks",
    name: "Blank bookmarks",
    short: "Bookmarks",
    heading: "Printable blank bookmarks",
    keyword: "Free printable blank bookmarks",
    summary:
      "Four blank bookmarks to a page at 1.875 by 7.5 inches, laid out along the page with cut lines on every boundary.",
    lead: "Four bookmarks side by side, each one seven and a half inches long and just under two wide. They run along the page rather than down it, because a bookmark is as long as a book is tall.",
    notes: [
      "Seven and a half inches rather than the whole length of the paper, and the inch that gives up is the useful decision on this sheet. A bookmark as long as the page is nine and a half inches and does not fit in a paperback; seven and a half is a paperback plus a tab to hold. The paper that is left stays at the bottom of the sheet as paper — the cut lines have to mark where a bookmark ends, not where the page does.",
      "They are blank because a bookmark is a thing a child makes rather than a thing we print. A reading target down one edge, the words being learned this week, a drawing of whatever is happening in the chapter — all of it belongs to whoever is reading. Print on card if there is any, and cut with a trimmer rather than scissors if there is one: a straight edge is most of what makes a home-made bookmark look deliberate.",
    ],
    teaches: "Making something to keep a place in a book",
    ages: "Ages 4+",
    group: "cards",
    config: cardsheet(PINNED, { style: "bookmark", up: 4 }),
  },
  {
    slug: "memory-verse-cards",
    name: "Memory verse cards",
    short: "Verse cards",
    heading: "Printable memory verse cards",
    keyword: "Free printable memory verse cards",
    summary:
      "Six cards to a page at 3.75 by 3 inches, each printing John 3:16 in full with its reference over it.",
    lead: "Six pocket-sized cards, each carrying the whole verse and the reference it comes from. Cut them apart and one goes in a lunchbox, one on the fridge and one in a pocket.",
    notes: [
      "This and the Scripture bookmark are the same words on two different rectangles, which is the entire difference between them: a card goes in a pocket and a bookmark goes in the book the verse was read out of. Six to a page here rather than three, because a card is a quarter of the height of a bookmark and a verse this length sits comfortably on one.",
      "The passage is a setting (§12). Any entry in the library gives the identical six cards, chosen from the same picker the copywork sheets use, and a verse pasted in works exactly the same way — the sheet cannot tell which door the words came in by. Leave the passage off altogether and the cards print with three ruled lines instead, for a family that would rather write the verse out themselves, which is a better exercise than reading it. The credit line at the foot travels with the words.",
    ],
    teaches: "Memory work, and carrying a verse about",
    ages: "Ages 5–13",
    group: "cards",
    config: cardsheet(PINNED, {
      style: "verse-card",
      up: 6,
      passage: "for-god-so-loved-the-world",
    }),
  },
  {
    slug: "scripture-bookmarks",
    name: "Scripture bookmarks",
    short: "Verse bookmarks",
    heading: "Printable Scripture bookmarks",
    keyword: "Free printable Scripture bookmarks",
    summary:
      "Three bookmarks to a page at 2.5 by 7.5 inches, each printing the whole of Psalm 23.",
    lead: "The bookmark sheet with a psalm on it. Three to a page rather than four, because a passage this long wants the extra half-inch of column to be read in.",
    notes: [
      "It is honestly the same sheet as the blank bookmarks, with a passage chosen and one fewer to a page — same length, same cut lines on every boundary, same seven and a half inches that fits a paperback. That is what a shelf built out of families looks like from underneath: a page here is a config rather than a drawing somebody made, and the two pages differ by two settings.",
      "Psalm 23 in full is about as much text as a bookmark will hold at a readable size, and it fits because a bookmark is seven and a half inches of column with nothing else on it. A longer passage is better served by the copywork family, where the words are written out rather than read off. Any passage in the library can be set here instead, and the credit line at the foot travels with whichever one is chosen (§12).",
    ],
    teaches: "Memory work, and reading a psalm through",
    ages: "Ages 6–13",
    group: "cards",
    config: cardsheet(PINNED, {
      style: "bookmark",
      up: 3,
      passage: "psalm-23",
    }),
  },

  /* ── Awards, dice and spinners ──────────────────────────────────────── */
  {
    slug: "award-certificates",
    name: "Award certificates",
    short: "Certificates",
    heading: "Printable award certificates",
    keyword: "Free printable award certificates",
    summary:
      "One certificate to a page at 10 by 6.875 inches, printed landscape, with ruled lines for who it is for, what it is for, the date and a signature.",
    lead: "A single certificate filling a landscape page, inside a double rule, with four lines to fill in by hand: awarded to, for, date and signed.",
    notes: [
      "It prints landscape without anybody choosing landscape. A certificate is a landscape document, the sheet carries its own paper, and the page rule follows the sheet — so pressing print gives a certificate the right way round rather than a portrait one somebody has to notice and rotate in the dialog. That is the single commonest thing wrong with a printable certificate, and it costs a reprint every time.",
      'The line that matters is "For". A certificate for great work is wallpaper; a certificate for finishing the seven times table, or for reading every night for a month, is a record of a specific thing that happened, and it is the specificity that makes a child keep it. The double rule is set in from the cut rather than against it, so a cut a thirty-second of an inch out trims paper instead of slicing through the border.',
    ],
    teaches: "Recognising something specific that was finished",
    ages: "Ages 4+",
    group: "making",
    config: cardsheet(PINNED, {
      style: "certificate",
      up: 1,
      // The one entry that overrides the stock, and the reason is on the paper:
      // a certificate is a landscape document. `@page` follows the sheet's own
      // paper (`PageSize` in Sheet.tsx), so declaring it here is what makes ⌘P
      // produce a landscape page with nothing set in the print dialog.
      paper: { size: "letter", orientation: "landscape", margin: "normal" },
    }),
  },
  {
    slug: "printable-dice",
    name: "Dice to cut out",
    short: "Dice net",
    heading: "Printable dice net",
    keyword: "Free printable dice template to cut out and fold",
    summary:
      "A cube net two inches on a side with seven glue tabs, spotted so that opposite faces add to seven.",
    lead: "Six squares in a cross, spotted one to six, with a tab on each of the seven edges that has to be glued. Cut round the outside, fold every dotted line, and glue each tab inside the cube.",
    notes: [
      "Opposite faces add to seven on a real die, and on a net that is not something you can check by looking. Which two squares end up opposite each other is a fact about the folding rather than about the drawing, so the numbering here is worked out from the folds instead of written on by hand — the column of four wraps the cube, which puts its first square opposite its third, and the two flaps end up opposite each other. A cube whose 6 lands next to its 1 rolls the same and is not a die.",
      "Seven tabs, and exactly one on each join. A cube has twelve edges; five of them are folds in this layout, so seven need gluing — two tabs on one join is a lump that stops the cube closing, and none is a hole, and both are invisible until it has been cut out. Score the fold lines first by running a dry ballpoint down a ruler, and print on the heaviest paper the printer takes: at two inches a die in copier paper goes soft as soon as it is rolled.",
    ],
    teaches: "Nets of solids, and what makes a die fair",
    ages: "Ages 5–12",
    group: "making",
    config: net(PINNED, { style: "dice" }),
  },
  {
    slug: "spinner-template",
    name: "Spinner template",
    short: "Spinner",
    heading: "Printable spinner template",
    keyword: "Free printable spinner template",
    summary:
      "A dial cut into six equal sectors of 60°, numbered, with the pointer to cut out and pin through the middle printed underneath it.",
    lead: "A circle divided into six equal slices, and an arrow under it to cut out and pin through the centre. Push a split pin through both and the arrow turns freely.",
    notes: [
      'The sectors are equal, and they are equal by construction rather than by having been drawn carefully: a whole turn is divided by how many there are, and there is nowhere for a longer label to buy itself a wider slice. That matters because "do you think this is fair?" is the question the object exists to answer. A spinner whose sectors had been sized by how much text was on them would teach the opposite of the answer, and a child would have no way of telling.',
      "The pointer is cut from the same sheet, which is why the dial is not as large as the page would allow — the paper has to hold both, so the circle is sized against what is left after the arrow rather than against the margin. A split pin is the fastener this is drawn for; a paper clip opened out and bent over on the back works, and a pencil point held through the middle does not, because the arrow has to turn without being held.",
    ],
    teaches: "Chance, and whether a thing is fair",
    ages: "Ages 5–12",
    group: "making",
    config: net(PINNED, { style: "spinner", sectors: 6 }),
  },
];

/** What each group is called on a hub, in the order they are listed. */
export const TEMPLATE_GROUPS: Array<{
  id: TemplateGroup;
  label: string;
  blurb: string;
}> = [
  {
    id: "writing",
    label: "Reading and writing",
    blurb: "Headings to write under, and a record of what has been read.",
  },
  {
    id: "science",
    label: "Science and history",
    blurb: "The paperwork round a lesson, with none of the lesson supplied.",
  },
  {
    id: "week",
    label: "The week",
    blurb: "Seven columns, and something different to put in them each time.",
  },
  {
    id: "cards",
    label: "Cards to cut out",
    blurb: "Paper at a stated size, with the cut lines on every boundary.",
  },
  {
    id: "making",
    label: "Awards, dice and spinners",
    blurb: "The three that are objects rather than pages.",
  },
];

/**
 * Which family owns a config, for the one question a page has to ask it.
 *
 * Four entries because four families draw this shelf. A kind that is not one of
 * them is not on the shelf at all, and answers as the forms family does — which
 * is the same answer, and is why the fallback is a function rather than a
 * literal.
 */
const FAMILY_KEYED: Partial<Record<SheetConfig["kind"], () => boolean>> = {
  form: formKeyed,
  planner: plannerKeyed,
  cards: cardsKeyed,
  net: netKeyed,
};

/**
 * Whether this sheet's answer key says anything its sheet doesn't.
 *
 * Nothing on this shelf does, and it is asked rather than assumed for the reason
 * `_charts.ts` asks it with `chartKeyed`: a page has to decide whether to print a
 * second copy of the paper under the words "Answer key", and the family is the
 * only thing that knows. All four of `formKeyed`, `plannerKeyed`, `cardsKeyed`
 * and `netKeyed` return `false` — a blank form has no answer by definition,
 * which is what this tier *is* (§11) — so the page and the families cannot
 * disagree about it, and the day one of them grows a key this reads it rather
 * than contradicting it.
 */
export const keyed = (sheet: TemplateSheet): boolean =>
  (FAMILY_KEYED[sheet.config.kind] ?? formKeyed)();

/** The route a sheet prints at. One stock, so one route — see the note above. */
export const pathFor = (sheet: TemplateSheet): string =>
  `/printables/templates/${sheet.slug}`;

/** The builder, opened on this sheet. */
export const builderHref = (sheet: TemplateSheet): string =>
  benchHref(sheet.config, TEMPLATE_SEED);

/** The shelf, grouped — the shape every page lists it in. */
export function templateShelf(): Array<{
  id: TemplateGroup;
  label: string;
  blurb: string;
  sheets: TemplateSheet[];
}> {
  return shelve(TEMPLATE_GROUPS, TEMPLATE_SHEETS);
}
