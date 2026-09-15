/**
 * What a lesson is built out of, with every height worked out as it is built
 * (§23).
 *
 * A topic module writes its lesson in these — a note, a picture, a line to
 * jump along, a row of worked facts, the problems to try — and each comes
 * back carrying the room it will take on the page, so `lesson.ts` can page
 * the lesson by adding the numbers up rather than by measuring anything (§4).
 * The one estimate is a note's line count, taken from its characters at the
 * face's declared advance; every other height is a drawing's declared size or
 * a line a child writes on.
 */
import { CAPTION_EMS, counters as place } from "../counters";
import { faceOf, fittedCharacters } from "../faces";
import {
  ASIDE_EM,
  NOTE_PAD,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  noteHeight,
} from "../layout";
import { lineHeight, numberLine } from "../numberline";
import { inches, points } from "../paper";
import type { Block, CounterLayout, Mil, Problem, SheetFont } from "../types";

/** The page a topic is written for: its width, a column of it, and the type. */
export type Page = {
  width: Mil;
  /** One column of the problems to try, at the topic's own column count. */
  cell: Mil;
  fontPt: number;
  font?: SheetFont;
};

/**
 * One lesson: what it is called, what the page says at the top, and the two
 * halves of it.
 *
 * `lesson` is written for the page — every picture is drawn at the width it
 * has, and every note is counted at that width — and `practice` is drawn from
 * the seed so the problems to try are the same problems on the key.
 */
export type Topic = {
  /** In the picker, and in the line that names a saved sheet. */
  label: string;
  title: string;
  instructions: string;
  /** How many problems to try go across. */
  columns: number;
  lesson(page: Page): LessonBlock[];
  practice(page: Page, rand: () => number): Problem[];
};

/** The four kinds of block a lesson is made of. */
export type LessonBlock = Extract<
  Block,
  { kind: "note" | "counters" | "numberline" | "problems" }
>;

/** Room for the "1." in front of a note's step, and the air after it. */
const NUMBER_CHARACTERS = 3;

/**
 * A problem written along a line with its slot, in ems of the body size: the
 * sheet's leading and the rule under the slot, with a little air.
 */
const LINE_EMS = 1.5;

/** `.sheet__slot` in sheet.css is this wide before anything is written in it. */
const SLOT_WIDTH: Mil = inches(0.8);

/**
 * A boxed note, with the lines it takes counted.
 *
 * Counted rather than measured: each paragraph is its characters over what
 * fits one line inside the box, at the face's own declared advance — which is
 * the mean over capitals and numerals wherever the text has either, so the
 * count comes out long before it comes out short. A heading is one line; a
 * step is its own paragraph with room for its number.
 */
export function note(
  page: Page,
  body: {
    heading?: string;
    text?: string[];
    items?: string[];
    aside?: boolean;
  },
): LessonBlock {
  const text = body.text ?? [];
  const items = body.items ?? [];
  const across = fittedCharacters(
    Math.max(1, page.width - 2 * NOTE_PAD),
    points(notePt(page, body.aside)),
    faceOf(page.font),
    [body.heading ?? "", ...text, ...items].join(""),
  );
  const rows = (characters: number) =>
    Math.max(1, Math.ceil(characters / across));
  const lines =
    (body.heading ? 1 : 0) +
    text.reduce((sum, paragraph) => sum + rows(paragraph.length), 0) +
    items.reduce((sum, item) => sum + rows(item.length + NUMBER_CHARACTERS), 0);
  return {
    kind: "note",
    heading: body.heading,
    text,
    items,
    lines,
    ...(body.aside ? { aside: true } : {}),
  };
}

/** The size a note's type is set at: the body's, or an aside's share of it. */
const notePt = (page: Page, aside?: boolean): number =>
  aside ? page.fontPt * ASIDE_EM : page.fontPt;

/** Counters as the picture a lesson is about, drawn across the whole page. */
export function picture(
  page: Page,
  total: number,
  per: number,
  layout: CounterLayout,
  over: { rings?: boolean; caption?: string } = {},
): LessonBlock {
  return {
    kind: "counters",
    counters: place(total, per, layout, page.width, over),
  };
}

/**
 * A number line from nought to the dividend with the divisor jumped back
 * along it, the whole page wide.
 */
export function jumpsLine(
  page: Page,
  dividend: number,
  divisor: number,
): LessonBlock {
  const line = numberLine(0, dividend, page.width);
  return {
    kind: "numberline",
    line: { ...line, jumps: { start: dividend, size: divisor } },
  };
}

/** A row of facts with their answers shown — the sentence, written each way. */
export function worked(
  facts: Array<{ prompt: string; answer: string }>,
  columns: number,
): LessonBlock {
  return {
    kind: "problems",
    columns,
    items: facts.map((fact) => ({ ...fact, worked: true })),
  };
}

/** The problems to try. */
export function tryIt(items: Problem[], columns: number): LessonBlock {
  return { kind: "problems", columns, items };
}

/**
 * How many lines a prompt wraps onto in its column, with its number in front
 * and its slot on the end — counted from the characters the way a note's
 * lines are, and for the same reason: "12 shared between 3 is ___ each" is
 * two lines in a third of a page, and a row reserved for one prints the last
 * row of the page on a second sheet.
 */
function promptLines(problem: Problem, page: Page, ruled: boolean): number {
  const text = problem.prompt.replace("_", "");
  const across = fittedCharacters(
    Math.max(1, page.cell - (ruled ? 0 : SLOT_WIDTH)),
    points(page.fontPt),
    faceOf(page.font),
    text,
  );
  return Math.max(1, Math.ceil((text.length + NUMBER_CHARACTERS) / across));
}

/**
 * How tall one problem stands: its picture, then the line it is written on,
 * then the ruled lines its answer goes on — whichever of the three it has,
 * with the wrap between each pair. This is the order `Problems.tsx` lays a
 * problem out in.
 */
function problemHeight(problem: Problem, page: Page): Mil {
  const parts: Mil[] = [];
  if (problem.counters) {
    parts.push(
      problem.counters.height +
        (problem.counters.caption ? points(page.fontPt * CAPTION_EMS) : 0),
    );
  }
  if (problem.line) parts.push(lineHeight(problem.line));
  const ruled = (problem.answers?.length ?? 0) > 0;
  if (problem.prompt !== "" || !ruled) {
    parts.push(
      points(page.fontPt * LINE_EMS) * promptLines(problem, page, ruled),
    );
  }
  if (ruled) {
    parts.push(
      problem.workspace ??
        (problem.answers?.length ?? 0) * answerLine(page.fontPt),
    );
  }
  return (
    parts.reduce((sum, part) => sum + part, 0) +
    WRAP_GAP * Math.max(0, parts.length - 1)
  );
}

/** How tall a block stands, for the family to page the lesson by. */
export function blockHeight(block: LessonBlock, page: Page): Mil {
  switch (block.kind) {
    case "note":
      return noteHeight(block.lines, notePt(page, block.aside));
    case "counters":
      return (
        block.counters.height +
        (block.counters.caption ? points(page.fontPt * CAPTION_EMS) : 0)
      );
    case "numberline":
      return lineHeight(block.line);
    case "problems": {
      const columns = Math.max(1, block.columns);
      const rows = Math.ceil(block.items.length / columns);
      const row = block.items.reduce(
        (tallest, item) => Math.max(tallest, problemHeight(item, page)),
        0,
      );
      return rows * row + PROBLEM_GAP.y * Math.max(0, rows - 1);
    }
  }
}
