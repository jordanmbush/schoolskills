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
import { artHeight } from "../fractionart";
import {
  ASIDE_EM,
  NOTE_PAD,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  noteHeight,
} from "../layout";
import { decimalTableau } from "../maths/decimal-division";
import { bracketHeight, divisionLines } from "../maths/long";
import type { Tableau } from "../maths/tableau";
import { hopLine, lineHeight } from "../numberline";
import { inches, points } from "../paper";
import type {
  Block,
  CounterLayout,
  DivisionHelp,
  Mil,
  Problem,
  SheetFont,
} from "../types";

/** The page a topic is written for: its width, a column of it, and the type. */
export type Page = {
  width: Mil;
  /** One column of the problems to try, at the topic's own column count. */
  cell: Mil;
  /**
   * One column at any count — what a row of worked facts set three across on
   * a two-column topic is measured against, since a prompt wraps in the
   * column it is printed in and not in the topic's.
   */
  cellOf(columns: number): Mil;
  fontPt: number;
  font?: SheetFont;
};

/**
 * One lesson: what it is called, what the page says at the top, and the two
 * halves of it.
 *
 * `lesson` is written for the page — every picture is drawn at the width it
 * has, and every note is counted at that width. `practice` takes the seed so a
 * saved sheet deals the same problems again (§7); a lesson's problems are
 * written, and the seed only orders them.
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

/** The five kinds of block a lesson is made of. */
export type LessonBlock = Extract<
  Block,
  { kind: "note" | "counters" | "numberline" | "problems" | "grid" }
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
 * `fittedCharacters` fits in one line inside the box — the text is passed so
 * a capital or numeral widens the advance (faces.ts says how) — and the count
 * comes out long before it comes out short. A heading is one line; a step is
 * its own paragraph with room for its number.
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
  const line = hopLine(dividend, [divisor], page.width);
  return {
    kind: "numberline",
    line: { ...line, jumps: { start: dividend, size: divisor } },
  };
}

/**
 * The line again, with hops of the sizes listed rather than one size over
 * and over — chunking: 156 with 120 taken away and then 36.
 */
export function chunkLine(
  page: Page,
  dividend: number,
  chunks: number[],
): LessonBlock {
  const line = hopLine(dividend, chunks, page.width);
  return {
    kind: "numberline",
    line: { ...line, jumps: { start: dividend, sizes: chunks } },
  };
}

/** Digits with at most one point between them: the one shape a dividend has. */
const DIVIDEND = /^\d+(?:\.\d+)?$/;

/**
 * A division set in the bracket with its working already computed, so a
 * lesson's example is the same tableau a drill sheet keys (§21). The dividend
 * may carry a point (§22); the working is over the digits alone, and the
 * answer is read back off it with the point on the same boundary, or with
 * the remainder after it. The squares reserved under the dividend are the
 * standard algorithm's two per quotient digit.
 *
 * The numbers are authored, so a dividend that is not a number or a divisor
 * that is not a whole number above nought is refused here, where the suite
 * builds every topic, rather than printed as an empty tableau over a "0".
 */
export function bracket(
  page: Page,
  dividend: string,
  divisor: number,
  help: DivisionHelp,
  over: { worked?: boolean } = {},
): Problem {
  if (!DIVIDEND.test(dividend) || !Number.isInteger(divisor) || divisor < 1) {
    throw new Error(`not a division: ${dividend} ÷ ${divisor}`);
  }
  const digits = dividend.replace(".", "");
  const tableau = decimalTableau(dividend, divisor);
  return {
    prompt: "",
    bracket: {
      divisor: String(divisor),
      dividend,
      cell: answerLine(page.fontPt),
      rows: divisionLines({ into: digits.length, by: String(divisor).length }),
      help,
      tableau,
    },
    answer: bracketAnswer(dividend, tableau),
    ...(over.worked ? { worked: true } : {}),
  };
}

/** "219", "2 r 5" or "2.82" — what the key writes over the bar, as one string. */
function bracketAnswer(dividend: string, tableau: Tableau): string {
  const { text, start } = tableau.quotient;
  const point = dividend.indexOf(".");
  if (point < 0) {
    return tableau.remainder > 0 ? `${text} r ${tableau.remainder}` : text;
  }
  const cut = point - start;
  return `${text.slice(0, cut)}.${text.slice(cut)}`;
}

/** A row of facts with their answers shown — the sentence, written each way. */
export function worked(facts: Problem[], columns: number): LessonBlock {
  return {
    kind: "problems",
    columns,
    items: facts.map((fact) => ({ ...fact, worked: true })),
  };
}

/** The problems to try, numbered from `start` when they carry on from a block before. */
export function tryIt(
  items: Problem[],
  columns: number,
  start = 1,
): LessonBlock {
  return { kind: "problems", columns, items, ...(start > 1 ? { start } : {}) };
}

/**
 * How many lines a prompt wraps onto in the column it is printed in, with its
 * number in front — a worked example carries none — and its slot on the end.
 * Counted from the characters the way a note's lines are, and for the same
 * reason: "12 shared between 3 is ___ each" is two lines in a third of a
 * page, and a row reserved for one prints the last row of the page on a
 * second sheet.
 */
function promptLines(
  problem: Problem,
  page: Page,
  ruled: boolean,
  columns: number,
): number {
  const text = problem.prompt.replace("_", "").trim();
  const across = fittedCharacters(
    Math.max(1, page.cellOf(columns) - (ruled ? 0 : SLOT_WIDTH)),
    points(page.fontPt),
    faceOf(page.font),
    text,
  );
  const number = problem.worked ? 0 : NUMBER_CHARACTERS;
  return Math.max(1, Math.ceil((text.length + number) / across));
}

/**
 * How tall one problem stands: its picture, then the bracket or the line it
 * is written on, then the ruled lines its answer goes on — whichever of them
 * it has, with the wrap between each pair. This is the order `Problems.tsx`
 * lays a problem out in.
 *
 * A fraction bar and a prompt are summed though the renderer sets them side
 * by side when the column is wide enough, which is the long side to be wrong
 * on (§4).
 */
function problemHeight(problem: Problem, page: Page, columns: number): Mil {
  const parts: Mil[] = [];
  if (problem.art) parts.push(artHeight(problem.art));
  if (problem.counters) {
    parts.push(
      problem.counters.height +
        (problem.counters.caption ? points(page.fontPt * CAPTION_EMS) : 0),
    );
  }
  if (problem.line) parts.push(lineHeight(problem.line));
  if (problem.bracket) {
    parts.push(
      bracketHeight(page.fontPt) + problem.bracket.rows * problem.bracket.cell,
    );
  }
  const ruled = (problem.answers?.length ?? 0) > 0;
  // A bracket has no prompt and no slot: its answer goes over the dividend.
  if (problem.prompt !== "" || !(ruled || problem.bracket)) {
    parts.push(
      points(page.fontPt * LINE_EMS) *
        promptLines(problem, page, ruled, columns),
    );
  }
  if (ruled) {
    parts.push(
      problem.workspace ??
        (problem.answers?.length ?? 0) * answerLine(page.fontPt),
    );
  } else if (problem.workspace !== undefined) {
    parts.push(problem.workspace);
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
    case "grid":
      return block.grid.rows * (block.grid.row ?? block.grid.cell);
    case "problems": {
      const columns = Math.max(1, block.columns);
      const rows = Math.ceil(block.items.length / columns);
      const row = block.items.reduce(
        (tallest, item) =>
          Math.max(tallest, problemHeight(item, page, columns)),
        0,
      );
      return rows * row + PROBLEM_GAP.y * Math.max(0, rows - 1);
    }
  }
}
