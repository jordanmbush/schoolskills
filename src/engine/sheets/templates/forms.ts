/**
 * The forms a week of lessons is written on.
 *
 * A reading log, a book report, a story map, a paragraph frame, a writing
 * prompt, a lab report, the scientific method, an observation journal and a
 * timeline — nine sheets and one idea: a set of headings with room to answer
 * under each. That is the whole of the "templates" tier's argument (§11) and it
 * is what makes them cheap and honest at the same time. **They are supposed to
 * be empty.** A reading log is a reading log whoever printed it, and there is
 * nothing on one that could be wrong.
 *
 * The science styles are where that has to be said out loud. A lab report sheet
 * is a *form*: it asks what the question was and what happened, and it supplies
 * neither. Generating the science would be the thing §11's third tier refuses —
 * "5th grade science worksheets" without an editor is plausible nonsense — and
 * the paperwork round a science lesson is a different object entirely. It is
 * also the more useful one: a child who has done an experiment has to write it
 * up, and the writing up is the part nobody has the paper for.
 *
 * ── What the geometry has to get right ─────────────────────────────────────
 *
 * One thing, and it is not obvious: **a form is a page, and the boxes have to
 * add up to it.** Every field asking for the lines it would like is how a form
 * ends up an inch and a half too long — which `.sheet` hides, because it is
 * `min-height`, so nothing overflows on screen and the last box prints on a
 * second sheet of paper. So a style declares *shares* of the writing height
 * rather than line counts, the shares are divided into what is left after the
 * labels, and how many lines a box holds is what fits in its share. Every line
 * on every one of these sheets is therefore at least `answerLine` tall — a
 * quarter of an inch, never less than the type needs — and the page always
 * closes.
 *
 * Two of the nine are not forms at all. A reading log and a timeline are
 * *tables*, because a list of days is a list of days; they share their
 * arithmetic with the planner shelf through `table.ts`. And the writing prompt
 * is a prompt and a page of lines, which is the paper family's own block with a
 * sentence over it — a third way of drawing ruled lines would have been one too
 * many.
 */
import { sheetBlockBox } from "../chrome";
import { answerLine, columnWidth, type Box } from "../layout";
import { inches, own, points, rulePitch, whole } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  FormConfig,
  FormField,
  FormStyle,
  Mil,
  Rule,
  Sheet,
  SheetOptions,
  TableCell,
} from "../types";

import { WRITING_PROMPTS, promptAt } from "./prompts";
import { headRowHeight, tableColumns, tableShape } from "./table";

/* ── What a form is made of ───────────────────────────────────────────────
   A field as a *style* declares it: what the heading says, how much of the
   page it wants, and how much of the width it takes. The lengths are worked
   out against the paper in `formFields` below — a style that wrote inches
   would be a style that only fitted one stock.                             */

type FieldSpec = {
  label: string;
  /**
   * How much of the writing height this field's row asks for, relative to the
   * other rows. Unitless on purpose: it is the proportion that is editorial
   * ("what it is about" deserves more room than "author"), and the inches are
   * the paper's business.
   */
  weight: number;
  /** How many of the form's columns it takes. */
  span: number;
  /** Somewhere to draw rather than write, so no rules are ruled in it. */
  draw?: boolean;
};

type FormShape = { columns: number; fields: FieldSpec[] };

/**
 * How tall a field's heading stands, in ems of the body size.
 *
 * 0.85em over a 1.4 leading, which is what `.sheet__form-label` sets — trailing
 * sheet.css the way `chrome.ts` trails it for the header, and for the same
 * reason: the reservation is made here and the row is drawn there, and a copy
 * that drifted would be a form whose last box prints on a second sheet.
 */
const LABEL_EMS = 0.85 * 1.4;

/** The air between one row of fields and the next. */
const FIELD_GAP: Mil = inches(0.14);

/**
 * The forms, as headings.
 *
 * This table *is* the family. Everything else in the file is arithmetic, and
 * everything a parent notices about one of these sheets is a string below —
 * which is the right way round for a tier whose whole value is that somebody
 * chose good headings and left the rest blank.
 */
const SHAPES: Record<string, FormShape> = {
  "book-report": {
    columns: 2,
    fields: [
      { label: "Title", weight: 1, span: 2 },
      { label: "Who wrote it", weight: 1, span: 1 },
      { label: "How many pages", weight: 1, span: 1 },
      { label: "What it is about", weight: 5, span: 2 },
      { label: "My favourite part, and why", weight: 4, span: 2 },
      { label: "Who I would tell to read it", weight: 3, span: 2 },
    ],
  },
  "story-map": {
    columns: 2,
    fields: [
      { label: "Who is in it", weight: 2, span: 1 },
      { label: "Where and when", weight: 2, span: 1 },
      { label: "What goes wrong", weight: 2, span: 2 },
      { label: "Beginning", weight: 3, span: 2 },
      { label: "Middle", weight: 3, span: 2 },
      { label: "End", weight: 3, span: 2 },
    ],
  },
  "paragraph-frame": {
    columns: 1,
    fields: [
      {
        label: "Topic sentence — what this paragraph is about",
        weight: 2,
        span: 1,
      },
      { label: "First reason, and one detail", weight: 2, span: 1 },
      { label: "Second reason, and one detail", weight: 2, span: 1 },
      { label: "Third reason, and one detail", weight: 2, span: 1 },
      {
        label: "Closing sentence — say it again, differently",
        weight: 2,
        span: 1,
      },
    ],
  },
  "lab-report": {
    columns: 2,
    fields: [
      { label: "What we were trying to find out", weight: 2, span: 2 },
      { label: "What we used", weight: 3, span: 1 },
      { label: "What we did, in order", weight: 3, span: 1 },
      { label: "What happened", weight: 4, span: 2 },
      { label: "What we think it means", weight: 3, span: 2 },
    ],
  },
  "scientific-method": {
    columns: 1,
    fields: [
      { label: "1 · The question", weight: 2, span: 1 },
      { label: "2 · What I already know", weight: 2, span: 1 },
      { label: "3 · What I think will happen, and why", weight: 3, span: 1 },
      { label: "4 · How I am going to test it", weight: 3, span: 1 },
      { label: "5 · What actually happened", weight: 3, span: 1 },
      { label: "6 · What that tells me", weight: 3, span: 1 },
    ],
  },
  "observation-journal": {
    columns: 3,
    fields: [
      { label: "Date", weight: 1, span: 1 },
      { label: "Time", weight: 1, span: 1 },
      { label: "Weather", weight: 1, span: 1 },
      // The drawing box, and the reason it is a field with no rules in it
      // rather than a block of its own: it lines up with everything above and
      // below it because it is in the same grid, and a naturalist's page is
      // half drawing.
      { label: "What I saw", weight: 8, span: 3, draw: true },
      { label: "What I noticed about it", weight: 5, span: 3 },
    ],
  },
};

/** What each form is called at the head of its own page. */
const TITLE: Record<FormStyle, string> = {
  "reading-log": "Reading log",
  "book-report": "Book report",
  "story-map": "Story map",
  "paragraph-frame": "Paragraph frame",
  "writing-prompt": "Writing prompt",
  "lab-report": "Lab report",
  "scientific-method": "The scientific method",
  "observation-journal": "Observation journal",
  timeline: "Timeline",
};

/**
 * The line under the title, where the sheet needs telling how to use.
 *
 * Not on all nine. A story map with "fill in the boxes" over it is a sheet
 * explaining a thing a child can see, and the instruction row it costs is two
 * lines of writing space on the boxes underneath.
 */
const INSTRUCTION: Record<string, string> = {
  "reading-log": "One line a day. A grown-up signs when the reading is done.",
  "paragraph-frame":
    "One sentence in each box, in this order. Joined up, they are the paragraph.",
  "lab-report":
    "Fill in the first two before you start, and the rest as you go.",
  "scientific-method":
    "In order, and the first three before anything is tested.",
  "observation-journal": "Draw it first. Write what you noticed afterwards.",
  timeline: "One thing a row, earliest at the top.",
};

/* ── The two tables ───────────────────────────────────────────────────────
   A reading log and a timeline are lists of days rather than sets of headings,
   so they are the table block and share their arithmetic with the planner
   shelf. The columns are declared as shares, because the proportions are the
   editorial judgement and the inches belong to whichever stock is in the
   tray.                                                                    */

const LOG_COLUMNS = [
  { label: "Date", share: 1.1 },
  { label: "What I read", share: 3.4 },
  { label: "Pages", share: 0.8 },
  { label: "Minutes", share: 0.9 },
  { label: "Signed", share: 1.3 },
];

const TIMELINE_COLUMNS = [
  { label: "When", share: 1.2 },
  { label: "What happened", share: 4 },
];

/** The default number of rows on each of the two, and the most worth printing. */
const LOG_ROWS = 14;
const TIMELINE_ROWS = 10;
export const MAX_FORM_ROWS = 40;

/**
 * How far the writing lines may be stretched — see `FormConfig.space`.
 *
 * Three times a quarter of an inch is three quarters of an inch to a line,
 * which is what a five-year-old writes on, and it is the point at which a book
 * report is four questions rather than six. Past that the honest control is a
 * larger type size, which moves the headings with the lines.
 */
export const FORM_SPACE = { min: 1, max: 3 } as const;

/** The two styles that are a list of rows rather than a set of headings. */
export const isListForm = (style: FormStyle): boolean =>
  style === "reading-log" || style === "timeline";

/* ── Geometry ─────────────────────────────────────────────────────────── */

/**
 * The fields packed into rows, greedily, the way a wrapping row packs.
 *
 * A field wider than the form gets a row to itself rather than being dropped:
 * a span is a request about layout, and a heading that vanished because
 * somebody set two columns on a three-column form would be a missing question.
 */
function packRows(shape: FormShape): FieldSpec[][] {
  const columns = Math.max(1, shape.columns);
  const rows: FieldSpec[][] = [];
  let used = columns;

  for (const field of shape.fields) {
    const span = Math.max(1, Math.min(columns, Math.round(field.span)));
    if (used + span > columns) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push({ ...field, span });
    used += span;
  }
  return rows;
}

/**
 * How tall a writing line on this sheet is.
 *
 * `answerLine` is the shop's own answer to "a line a child writes on", and the
 * `space` option is a multiplier on it rather than a length: a parent whose
 * child writes large wants every line taller, not one box longer, and the
 * number of lines is then whatever fits — which is how the page stays a page.
 */
const lineHeight = (config: FormConfig): Mil =>
  Math.round(
    answerLine(config.fontPt) *
      whole(config.space, FORM_SPACE.min, FORM_SPACE.min, FORM_SPACE.max),
  );

/**
 * The fields, resolved to lengths against the page.
 *
 * The one calculation in the file, and the one that keeps the sheet on one
 * piece of paper. Three steps, and each of them exists because leaving it out
 * printed a form taller than the paper:
 *
 *  1. **How many rows the page can hold at all.** A heading and one line to
 *     write on is the least a question can occupy, so that is what a row is
 *     measured against — and a form asking for more rows than that gets as many
 *     as fit, which is the same rule every generating family follows about its
 *     count. A paragraph frame at 36pt on inch margins is more form than a page
 *     of Letter holds, and reserving for all five rows produced a sheet 35
 *     thousandths of an inch too tall: invisible on screen, because `.sheet` is
 *     `min-height`, and a second sheet of paper out of the printer.
 *  2. **A line each, before anything is shared out.** The shares are editorial
 *     — "what it is about" deserves more room than "author" — and a low share of
 *     a nearly full page is less than one line, which is a heading with a box
 *     under it too short to write in. So every row takes a line first and the
 *     weights divide only what is left over.
 *  3. **The rest by weight, floored.** Which is what keeps the total inside the
 *     box: every part of it is a floor of a division of the box.
 */
export function formFields(config: FormConfig, box: Box): FormField[] {
  const shape = own(SHAPES, config.style, SHAPES["book-report"]);
  const label = points(config.fontPt * LABEL_EMS);
  const line = lineHeight(config);
  // What one column of the form measures, gaps taken out first. A field
  // spanning two of them takes the gap between them as well, which is the
  // difference between a form whose boxes line up and one whose wide boxes are
  // a tenth of an inch short of the narrow ones above them.
  const column = columnWidth(box, columnsOf(config), FIELD_GAP);

  // `+ FIELD_GAP` on both sides because there is one fewer gap than there are
  // rows: `n` rows measure `n × (label + line) + (n − 1) × gap`.
  const holds = Math.floor(
    (box.height + FIELD_GAP) / (label + line + FIELD_GAP),
  );
  const rows = packRows(shape).slice(0, Math.max(0, holds));
  if (rows.length === 0) return [];

  const chrome = rows.length * label + (rows.length - 1) * FIELD_GAP;
  const writing = Math.max(0, box.height - chrome);
  const spare = Math.max(0, writing - rows.length * line);
  const weights = rows.map((row) =>
    row.reduce((most, field) => Math.max(most, field.weight), 0),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  return rows.flatMap((row, index) => {
    // A row's fields share one height, which is what makes them line up — and
    // lining up is most of what a form looks like.
    const space =
      line + (total > 0 ? Math.floor((spare * weights[index]) / total) : 0);
    return row.map((field) => ({
      label: field.label,
      // A ruled box holds as many lines as fit, and never fewer than one — the
      // row was given a line's height before anything was shared out, so the
      // floor below cannot come to nought.
      lines: field.draw ? 0 : Math.max(1, Math.floor(space / line)),
      space,
      width: column * field.span + FIELD_GAP * (field.span - 1),
      span: field.span,
    }));
  });
}

/** How many columns the form is laid out in. */
const columnsOf = (config: FormConfig): number =>
  Math.max(1, own(SHAPES, config.style, SHAPES["book-report"]).columns);

/** How many rows the two list styles print, capped at what the page holds. */
export function formRows(
  config: FormConfig,
  box: Box,
): { rows: number; row: Mil } {
  const want = whole(
    config.rows,
    config.style === "timeline" ? TIMELINE_ROWS : LOG_ROWS,
    1,
    MAX_FORM_ROWS,
  );
  return tableShape(box, config.fontPt, want, true);
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

/** The ruling a page of writing lines is set on, under a prompt. */
const PROMPT_RULE: Rule = { style: "college" };

/** The prompt this sheet asks, whether a parent wrote it or the seed drew it. */
export const promptOf = (config: FormConfig, seed: number): string =>
  typeof config.prompt === "string" && config.prompt.trim() !== ""
    ? config.prompt.trim()
    : promptAt(seed);

/**
 * The instruction line, which on one of the nine is the whole sheet.
 *
 * A writing prompt has no boxes: what it has is a sentence and a page of lines,
 * and the sentence belongs in the instruction row because that row is the one
 * `chromeHeight` already measures for wrapping (a prompt runs to a hundred and
 * forty characters, which is two rows at 12pt and five at the largest type a
 * config may ask for). Putting it anywhere else would mean reserving for it
 * twice.
 */
function instructionOf(config: FormConfig, seed: number): string | undefined {
  if (config.instructions) return config.instructions;
  if (config.style === "writing-prompt") return promptOf(config, seed);
  return own(INSTRUCTION, config.style, "") || undefined;
}

const titleOf = (config: FormConfig): string =>
  config.title ?? own(TITLE, config.style, TITLE["book-report"]);

/**
 * What the chrome will hold, so the page can be reserved for it.
 *
 * The same move `charts.ts` makes and for the same reason: a family prints a
 * title whatever the config says, and `chromeHeight` reserves a title row only
 * if the *options* it is handed carry one. Passing the config straight in
 * under-reserves by a row, `.sheet` is `min-height` so nothing overflows on
 * screen, and the page quietly grows past eleven inches.
 *
 * The seed reaches in here because one of the nine puts a drawn string in the
 * instruction row, and that row is measured rather than counted — a reservation
 * made against a different prompt than the one printed would be a reservation
 * made against the wrong number of rows.
 */
function headerOf(config: FormConfig, seed: number): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: titleOf(config),
    instructions: instructionOf(config, seed),
  };
}

/**
 * The page the blocks get.
 *
 * The footer is declared with the note a key prints, per `FootLine.note`: a key
 * is laid out against the same box as its sheet, so a footer that wraps to two
 * rows on one and one on the other is a key whose last row is on a second page.
 * Nothing on this shelf *has* a key — see `formKeyed` — and the row is reserved
 * anyway, because `SheetSpec.key` stamps the note on any sheet it is handed and
 * a row over-reserved costs a rule line where a row under-reserved costs a
 * sheet of paper.
 */
const formBox = (config: FormConfig, seed: number): Box =>
  sheetBlockBox(headerOf(config, seed), false, { note: "Answer key" });

/**
 * Nothing on this shelf withholds anything.
 *
 * Stated as a function rather than left implicit, for the reason `chartKeyed`
 * is: a catalog page has to decide whether to print a second copy of the paper
 * under the word "Answer key", and the family is the only thing that knows. A
 * blank form has no answer by definition — that is what the tier *is* — so this
 * is `false` and will stay `false`, and a page and the family cannot disagree
 * about it.
 */
export const formKeyed = (): boolean => false;

/** Which drawing this is. The one place `FormStyle` is narrowed. */
function formBlocks(config: FormConfig, box: Box): Block[] {
  switch (config.style) {
    case "reading-log":
    case "timeline": {
      const timeline = config.style === "timeline";
      const shape = formRows(config, box);
      const columns = tableColumns(
        timeline ? TIMELINE_COLUMNS : LOG_COLUMNS,
        box.width,
      );
      return [
        {
          kind: "table",
          columns,
          head: true,
          rows: shape.rows,
          row: shape.row,
          // Every cell blank: this is the tier that is supposed to be empty.
          cells: Array<TableCell>(columns.length * shape.rows).fill({}),
          headRow: headRowHeight(config.fontPt),
          // The line a timeline is drawn along, and the one thing that makes it
          // a timeline rather than a two-column table.
          ...(timeline ? { spine: 1 } : {}),
        },
      ];
    }
    case "writing-prompt":
      // The prompt is in the instruction row above; this is the page to write
      // on. The paper family's own block, so a line here is the same line as a
      // line on a sheet of college ruled.
      return [
        {
          kind: "rules",
          rule: PROMPT_RULE,
          lines: Math.max(1, Math.floor(box.height / rulePitch(PROMPT_RULE))),
        },
      ];
    default: {
      // No block at all where not one question would fit — a form with no
      // fields on it is a rectangle nobody asked for, and the honest answer to
      // "38pt on a page with inch margins" is a header, a footer and blank
      // paper. `cardGrid` refuses the same way for the same reason.
      const fields = formFields(config, box);
      return fields.length === 0
        ? []
        : [{ kind: "form", columns: columnsOf(config), fields }];
    }
  }
}

export function buildFormSheet(config: FormConfig, seed: number): Sheet {
  const box = formBox(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: titleOf(config),
      instructions: instructionOf(config, seed),
      fields: config.fields,
    },
    blocks: formBlocks(config, box),
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

/**
 * One line naming the sheet, in the words a parent says out loud.
 *
 * Each says the number that makes it the sheet somebody asked for rather than
 * one like it: how many rows the log has, how many things there are to fill in,
 * and — on the one style that draws from the seed — which prompt it drew.
 */
export function describeForm(config: FormConfig, seed = 0): string {
  const box = formBox(config, seed);
  const name = own(TITLE, config.style, TITLE["book-report"]);
  switch (config.style) {
    case "reading-log":
    case "timeline":
      return `${name}, ${formRows(config, box).rows} rows to fill in`;
    case "writing-prompt":
      // The one line here that has to be careful about the seed. `describe` is
      // handed a config and no seed — it names what a config *is*, and a
      // config that has not been given a prompt is one whose prompt is a
      // different sentence every time the seed moves. Quoting the seed-zero
      // one would be naming a sheet nobody printed.
      return config.prompt
        ? `${name}: “${promptOf(config, seed)}”`
        : `${name}, one of ${WRITING_PROMPTS.length} drawn from the seed, and a page of lines`;
    default: {
      const fields = formFields(config, box);
      // The same refusal `describeCards` makes when a card comes out too small
      // to cut, and for the same condition: `formBlocks` draws no block at all
      // where not one question fits, and a line reading "0 things to fill in
      // over 0 lines" would be naming a sheet that is a header, a footer and
      // blank paper as though it were a form.
      if (fields.length === 0)
        return `${name} — no room for a question at this size`;
      const lines = fields.reduce((total, field) => total + field.lines, 0);
      return `${name}, ${fields.length} things to fill in over ${lines} lines`;
    }
  }
}

export const FORM_SHEET: SheetSpec<FormConfig> = {
  id: "form",
  label: "Logs, reports and forms",
  world: SHEET_WORLD,
  build: buildFormSheet,
  // Nothing to reveal, ever — see `formKeyed`. What a key of one of these is
  // is the same blank form with "Answer key" in the footer, which is what a
  // parent who pressed the button gets and is why the catalog pages don't
  // offer it.
  key: (sheet) => ({
    ...sheet,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: (config) => describeForm(config),
};
