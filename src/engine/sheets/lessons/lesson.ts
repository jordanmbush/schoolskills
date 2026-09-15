/**
 * Lessons: a method, explained on one page (§23).
 *
 * The one family that teaches rather than drills. A page is the idea in a
 * child's words, a picture, a worked example, and a few problems to try with
 * the same scaffold — authored, topic by topic, the way the grammar bank is,
 * because what to say first is a judgement and a generator has none. The
 * family here is the paper round a topic: the header, the paging, and the
 * key.
 *
 * **Every height is declared** (§4), and this is the family where that costs
 * something: a lesson is mostly prose, so a note's lines are counted from its
 * characters before it is laid out, and the page is cut where those counts
 * say it is full. A lesson that outruns the page goes on to a second one
 * rather than being trimmed — the problems to try on page two is the common
 * case at large type.
 */
import { mulberry32 } from "@/engine/random";

import { sheetBlockBox } from "../chrome";
import { BLOCK_GAP, PROBLEM_GAP, columnWidth, type Box } from "../layout";
import { own } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import type {
  Block,
  LessonConfig,
  LessonTopic,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
} from "../types";

import {
  blockHeight,
  note,
  tryIt,
  type LessonBlock,
  type Page,
  type Topic,
} from "./blocks";
import { DECIMAL_TOPICS } from "./decimals";
import { DIVISION_TOPICS } from "./division";
import { WRITTEN_TOPICS } from "./written";

/**
 * Every lesson, in the order a child meets them: the three meanings of
 * division, then leftovers and the two written methods, then decimals. The
 * record type is what holds the three modules to covering `LessonTopic`
 * between them.
 */
const TOPICS: Record<LessonTopic, Topic> = {
  ...DIVISION_TOPICS,
  ...WRITTEN_TOPICS,
  ...DECIMAL_TOPICS,
};

/** Every topic, in the order a child meets them — for a picker. */
export const LESSON_TOPICS = Object.keys(TOPICS) as LessonTopic[];

/**
 * What a topic this build has never heard of prints.
 *
 * A saved sheet outlives the table above (§3): a lesson written next year and
 * bookmarked will open here on this build, and the page has to say so rather
 * than fail — the same promise `UNKNOWN_SHEET` makes for a whole family.
 */
const MISSING: Topic = {
  label: "A lesson this build does not have",
  title: "Lesson unavailable",
  instructions: "This lesson isn't in this copy of the site.",
  columns: 1,
  lesson: (page) => [
    note(page, {
      text: [
        "This lesson is not here yet. Choose another topic, or open a newer copy of the site.",
      ],
    }),
  ],
  practice: () => [],
};

/** The topic a config names. Never throws, for the reason `sheetSpec` doesn't. */
export const topicOf = (topic: string): Topic =>
  own(TOPICS as Record<string, Topic>, topic, MISSING);

/** What a topic is called, for a picker that has not loaded the lesson. */
export const lessonTopicLabel = (topic: string): string => topicOf(topic).label;

/** Whether the problems to try are printed. On unless switched off. */
const practising = (config: LessonConfig): boolean => config.practice !== false;

/** The most columns the problems to try are laid out in. */
const MAX_COLUMNS = 4;

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value) || low));

/**
 * The header this sheet will actually print, read by the layout and the
 * build so the two cannot disagree about what is at the top of the page.
 */
function headerOf(config: LessonConfig): SheetOptions {
  const topic = topicOf(config.topic);
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? topic.title,
    instructions: config.instructions ?? topic.instructions,
  };
}

/** The page a topic is written for: the box, and the page as a topic sees it. */
export function lessonLayout(config: LessonConfig): {
  box: Box;
  page: Page;
  columns: number;
} {
  const topic = topicOf(config.topic);
  // Against the header the sheet will print, and with a score box only when
  // there is something on the page to mark.
  const box = sheetBlockBox(headerOf(config), practising(config));
  const columns = clamp(topic.columns, 1, MAX_COLUMNS);
  const cellOf = (across: number): Mil =>
    columnWidth(box, Math.max(1, across), PROBLEM_GAP.x);
  return {
    box,
    columns,
    page: {
      width: box.width,
      cell: cellOf(columns),
      cellOf,
      fontPt: config.fontPt,
      font: config.font,
    },
  };
}

/**
 * The problems to try as blocks the page can hold: one block when it fits a
 * page, else one block to a row, each numbered on from the last. A row is the
 * smallest piece the renderer prints whole, and a block taller than the page
 * would run off the foot of it — which at the largest type every lesson's
 * six did.
 */
function tryIts(
  problems: Problem[],
  columns: number,
  page: Page,
  limit: Mil,
): LessonBlock[] {
  const whole = tryIt(problems, columns);
  if (blockHeight(whole, page) <= limit) return [whole];
  const rows: LessonBlock[] = [];
  for (let at = 0; at < problems.length; at += columns) {
    const before = problems.slice(0, at).filter((one) => !one.worked).length;
    rows.push(tryIt(problems.slice(at, at + columns), columns, before + 1));
  }
  return rows;
}

/**
 * The blocks, cut into pages where their declared heights say a page is full.
 *
 * Greedy, block by block, with the gap between blocks paid for: a block that
 * would cross the bottom of the page starts the next one. A block taller than
 * a whole page — a note at the largest type a config may ask for — gets a page
 * to itself and runs over it, which is the honest answer to a page that cannot
 * hold one paragraph.
 */
function paged(blocks: Block[], heights: number[], limit: number): Block[] {
  const out: Block[] = [];
  let used = 0;
  blocks.forEach((block, index) => {
    const height = heights[index];
    const next = used === 0 ? height : used + BLOCK_GAP + height;
    if (next > limit && used > 0) {
      out.push({ kind: "break" });
      used = height;
    } else {
      used = next;
    }
    out.push(block);
  });
  return out;
}

/** The lesson and its problems, paged, and how many problems there are. */
export function lessonBlocks(
  config: LessonConfig,
  seed: number,
): { blocks: Block[]; outOf: number } {
  const topic = topicOf(config.topic);
  const { box, page, columns } = lessonLayout(config);
  const lesson = topic.lesson(page);
  const problems = practising(config)
    ? topic.practice(page, mulberry32(seed))
    : [];
  const flow =
    problems.length > 0
      ? [...lesson, ...tryIts(problems, columns, page, box.height)]
      : lesson;
  return {
    blocks: paged(
      flow,
      flow.map((block) => blockHeight(block, page)),
      box.height,
    ),
    outOf: problems.length,
  };
}

/* ── What it is called ─────────────────────────────────────────────────── */

function describeLesson(config: LessonConfig): string {
  const topic = topicOf(config.topic);
  if (!practising(config)) return `${topic.label} — the lesson only`;
  const count = topic.practice(lessonLayout(config).page, mulberry32(0)).length;
  return count > 0 ? `${topic.label} — with ${count} to try` : topic.label;
}

/* ── The sheet ─────────────────────────────────────────────────────────── */

function buildLessonSheet(config: LessonConfig, seed: number): Sheet {
  const head = headerOf(config);
  const { blocks, outOf } = lessonBlocks(config, seed);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Marked out of the problems to try, and not marked at all when there
      // are none: a lesson pinned to the wall has no score.
      ...(outOf > 0 ? { score: { outOf } } : {}),
    },
    blocks,
    // The site itself: there is no race that teaches a method (§16).
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const LESSON_SHEET: SheetSpec<LessonConfig> = {
  world: SHEET_WORLD,
  build: buildLessonSheet,
  // The answers were decided when the problems were dealt, and the worked
  // examples already print theirs, so a key cannot disagree with its sheet.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeLesson,
};
