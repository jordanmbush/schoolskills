/**
 * What the header and footer take out of the page.
 *
 * Declared, not measured — the bargain `blockBox` is built on (§4) — and
 * rounded up, because the two errors are not symmetrical. Reserving a tenth of
 * an inch too much costs one rule line at the bottom of the page. Reserving too
 * little pushes that line onto a second sheet of paper, and print is the whole
 * of the output path here: there is no PDF to notice it in first.
 *
 * It lives on its own rather than inside a family because every family asks the
 * same question and the answer is delicate: the numbers below trail sheet.css,
 * which sets the header's rows in ems of the body size and its gaps in inches.
 * A second copy of them would be a second thing to keep in step with a
 * stylesheet, and the failure would be silent — a sheet that looks right on
 * screen and prints a blank second page.
 *
 * So: a title is 1.7em over a 1.05 line-height, a field line 0.82em over 1.35,
 * an instruction 0.9em, and the footer 0.62em above a rule with 0.18in of air
 * over it.
 *
 * **Three of the rows are not always one row.** The name line wraps because it
 * is a flex row; the instruction line wraps because it is a paragraph; the
 * footer wraps because it is a flex row that a Scripture credit joins (§12).
 * Each is counted below rather than assumed, and each was assumed once.
 */
import type { Mil, SheetOptions } from "./types";

import { faceOf } from "./faces";
import { blockBox, contentBox, type Box } from "./layout";
import { inches, points } from "./paper";
import { LONGEST_SHEET_URL, SHEET_CREDIT } from "./spec";

const HEAD_ROWS = { title: 1.9, fields: 1.2, instructions: 1.3 } as const;
const FOOT_ROW = 0.9;

/** The share of the body size sheet.css sets each of the wrapping rows at. */
const INSTRUCTION_EM = 0.9;
const FOOT_EM = 0.62;

/** The gap sheet.css puts between the header's rows. */
const HEAD_GAP = inches(0.09);
/** And under the header itself, whatever is in it. */
const HEAD_MARGIN = inches(0.16);
/** The footer's rule, its padding, and the air above it. */
const FOOT_MARGIN = inches(0.23);

/* The name line is not always one row. `.sheet__fields` is a wrapping flex
   row, so how many rows it takes is a question about the width of the page —
   three fields ("name", "date", "class" are all legal) measure more than a
   Letter content width and land on two. A row that was not reserved for is a
   rule line below the bottom margin, which is a second sheet of paper. */

/** One field: `.sheet__field-rule` at 2.1in, plus its label and their gap. */
const FIELD_WIDTH = inches(2.5);
/** The score box is the same row and a third of the width: 0.7in and "/ 20". */
const SCORE_WIDTH = inches(1.4);
/** `.sheet__fields` sets 0.06in between rows and 0.28in between fields. */
const FIELD_GAP = inches(0.28);
const FIELD_ROW_GAP = inches(0.06);

/** `.sheet__foot` sets 0.04in between rows and 0.16in between its spans. */
const FOOT_GAP = inches(0.16);
const FOOT_ROW_GAP = inches(0.04);

/**
 * The seed's own place, at the widest a printed one can be.
 *
 * `decodeSharedSheet` takes any safe integer, so the allowance is sixteen
 * digits and a hash rather than the `#1` the catalog happens to print. It is
 * declared rather than passed in because the reservation is made before the
 * sheet exists — and it costs under an inch of a row that has several to spare
 * once the content credit is off it.
 */
const FOOT_SEED = `#${"0".repeat(16)}`;

/** A height quoted in ems of the body size, in the unit the page is in. */
const em = (fontPt: number, rows: number): Mil => points(fontPt * rows);

/**
 * How wide a run of text is set, declared rather than measured.
 *
 * The same bargain `layout.ts` strikes over a problem cell (§4) and the same
 * mean advance `handwriting.ts` packs a row of letters by: characters times the
 * face's own declared mean, at whatever share of the body size sheet.css sets
 * this part of the chrome in. There is no DOM at build time to ask instead.
 */
const declaredWidth = (
  text: string,
  options: SheetOptions,
  share: number,
): Mil =>
  Math.round(
    text.length * points(options.fontPt * share) * faceOf(options.font).advance,
  );

/**
 * How many rows a wrapping flex row packs its items onto.
 *
 * Greedy, item by item, because that is what `flex-wrap` does, and because the
 * items are not all the same width — a score box is a third of a field, and a
 * Scripture credit is twice the site's own. Neither of the two rows this counts
 * breaks *inside* an item: a field rule and a credit line are atomic, so a page
 * too narrow for one whole item still prints one per row rather than looping
 * forever, which is what `used > 0` is for.
 */
function packRows(widths: Mil[], limit: Mil, gap: Mil): number {
  if (widths.length === 0) return 0;
  let rows = 1;
  let used = 0;
  for (const width of widths) {
    const next = used === 0 ? width : used + gap + width;
    if (next > limit && used > 0) {
      rows += 1;
      used = width;
    } else {
      used = next;
    }
  }
  return rows;
}

/**
 * How many rows the name line wraps onto.
 *
 * Counting the score as another 2.5in field instead of at its own width would
 * push a name-date-score header onto a second row it does not use, and on ⅝
 * paper a row is a line to write on.
 */
const fieldRows = (options: SheetOptions, score: boolean): number =>
  packRows(
    [...options.fields.map(() => FIELD_WIDTH), ...(score ? [SCORE_WIDTH] : [])],
    contentBox(options.paper).width,
    FIELD_GAP,
  );

/**
 * How many rows the instruction line wraps onto.
 *
 * A paragraph rather than a flex row, so it breaks *inside* itself and the
 * answer is its length against the content width rather than a packing. One row
 * was assumed flat until the memory family arrived: the notice §12 asks that
 * sheet to print runs to a hundred and fifty-seven characters, which is two
 * rows at 12pt on both stocks and five at the largest type a config may ask for.
 */
function instructionRows(options: SheetOptions): number {
  if (!options.instructions) return 0;
  const limit = contentBox(options.paper).width;
  if (limit <= 0) return 1;
  return Math.max(
    1,
    Math.ceil(
      declaredWidth(options.instructions, options, INSTRUCTION_EM) / limit,
    ),
  );
}

/**
 * What the footer will hold beyond the three every sheet's carries.
 *
 * The credit, the link and the seed are the spine's (`spec.ts`) and are counted
 * for every sheet; these two belong to a family, and a family that prints either
 * has to say so here — the reservation is made before the footer is built, so
 * nothing down there can be discovered from it.
 */
export type FootLine = {
  /**
   * The content credit, where the words on the page are somebody else's — for
   * Scripture a condition of the name rather than a courtesy (§12), and 75
   * characters of it, which is more than twice the site's own credit.
   */
  source?: string;
  /**
   * The note a key prints — "Answer key".
   *
   * Declared on the *sheet* rather than only on the key, because the two are
   * laid out against one box: `SheetSpec.key` replaces the footer and keeps the
   * blocks, so a key whose footer is a row taller than its sheet's prints that
   * row below the bottom margin. Reserving it either way costs a footer row a
   * family with no key does not use, which is the cheap side to be wrong on.
   */
  note?: string;
};

/**
 * How many rows the footer wraps onto.
 *
 * One row was assumed flat until a sheet arrived carrying credit, source, link,
 * seed *and* a note — the answer key of a Scripture memory sheet, which is two
 * rows at 12pt on both stocks and was reserved as one.
 *
 * The content credit is given **its own row** rather than packed with the rest,
 * and that is a deliberate over-reservation. Whether 75 characters of Scripture
 * credit share a row with the credit, the link and the seed comes down to a few
 * thousandths of an inch under a declared mean advance — the strings a shipped
 * page carries measure 7,097 against a 7,268 A4 content width, on a mean taken
 * over `a`–`z` — and that is not a distinction this arithmetic can honestly
 * claim to make. So a sheet that credits its source reserves a row for the
 * credit and a row for everything else, and pays for it at the bottom of the
 * page: a footer row over-reserved costs one rule line, and one under-reserved
 * costs a second sheet of paper.
 *
 * The credit still gets *more* than one row where it needs it — at 36pt it is
 * wider than either stock on its own — which is why it is a count and not a
 * flag.
 */
function footRows(options: SheetOptions, foot: FootLine): number {
  const limit = contentBox(options.paper).width;
  const spine = packRows(
    [SHEET_CREDIT, foot.note, LONGEST_SHEET_URL, FOOT_SEED]
      .filter((text): text is string => Boolean(text))
      .map((text) => declaredWidth(text, options, FOOT_EM)),
    limit,
    FOOT_GAP,
  );
  if (!foot.source || limit <= 0) return spine;
  return (
    spine +
    Math.max(1, Math.ceil(declaredWidth(foot.source, options, FOOT_EM) / limit))
  );
}

/**
 * How much of the page the header and footer will use.
 *
 * Counted from what the header actually holds rather than from a constant: a
 * sheet of lined paper with a name line and no title has an inch more writing
 * space than one with both, and on ⅝ paper an inch is two more lines to write
 * on. A family that reserved for the worst case would throw them away.
 */
export function chromeHeight(
  options: SheetOptions,
  /**
   * Whether the header carries a "___ / 20" box. The one part of the chrome a
   * family decides rather than a parent: a sheet is marked out of the number
   * of problems it ended up with, which is known after the build.
   */
  score = false,
  /** What this family will put at the foot beyond the spine's own three. */
  foot: FootLine = {},
): { header: Mil; footer: Mil } {
  const fields = fieldRows(options, score);
  const instructions = instructionRows(options);
  const rows = [
    options.title ? HEAD_ROWS.title : 0,
    HEAD_ROWS.fields * fields,
    HEAD_ROWS.instructions * instructions,
  ].filter((row) => row > 0);
  const feet = footRows(options, foot);

  return {
    // The margin is there even when the header is empty — SheetHead renders
    // the element either way, and an empty flex column still takes its gap.
    header:
      HEAD_MARGIN +
      rows.reduce((total, row) => total + em(options.fontPt, row), 0) +
      HEAD_GAP * Math.max(0, rows.length - 1) +
      FIELD_ROW_GAP * Math.max(0, fields - 1),
    footer:
      FOOT_MARGIN +
      em(options.fontPt, FOOT_ROW * feet) +
      FOOT_ROW_GAP * Math.max(0, feet - 1),
  };
}

/**
 * What is left for the blocks: the page, less its margins, less the chrome.
 *
 * Exported because it is the reservation itself, and the reservation is the
 * only thing a test can hold `chromeHeight` to. Checking a family's blocks
 * against the *content* box instead cannot fail — capacity is floored against
 * this box, which is the content box minus a non-negative number, so any
 * chrome at all satisfies it, including none.
 */
export function sheetBlockBox(
  options: SheetOptions,
  score = false,
  foot: FootLine = {},
): Box {
  return blockBox(options.paper, chromeHeight(options, score, foot));
}
