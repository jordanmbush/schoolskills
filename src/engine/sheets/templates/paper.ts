/**
 * Paper you print because it is empty.
 *
 * Lined, ruled, graph, dot and isometric — every ruling in §5, as sheets. It is
 * the "templates" tier of §11 rather than a generator: genuinely useful,
 * completely honest, and supposed to be blank. There are no problems on it, so
 * there is nothing to answer and nothing to seed.
 *
 * It is also the family the geometry is proved on. A sheet with something
 * written on it can hide a rule that is a thousandth out; a sheet that is
 * nothing *but* the rules cannot. If a ⅝ rule measures ⅝ of an inch under a
 * ruler here, it measures ⅝ of an inch everywhere, because every other family
 * asks `layout.ts` the same question this one does.
 *
 * One block, always: `ruleCapacity` says how many repeats fit in what the
 * chrome leaves, and the renderer draws that many. Nothing measures anything,
 * which is what lets this run at build time on a catalog page (§4).
 */
import type { Mil, PaperConfig, Sheet } from "../types";

import {
  blockBox,
  contentBox,
  fitAcross,
  ruleCapacity,
  type Box,
} from "../layout";
import { inches, points, rulingOf } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

/* ── What the chrome takes out of the page ────────────────────────────────
   Declared, not measured — the bargain `blockBox` is built on (§4) — and
   rounded up, because the two errors are not symmetrical. Reserving a tenth of
   an inch too much costs one rule line at the bottom of the page. Reserving
   too little pushes that line onto a second sheet of paper, and print is the
   whole of the output path here: there is no PDF to notice it in first.

   The numbers trail sheet.css, which sets the header's rows in ems of the body
   size and its gaps in inches. So these are too: a title is 1.7em over a 1.05
   line-height, a field line 0.82em over 1.35, an instruction 0.9em, and the
   footer 0.62em above a rule with 0.18in of air over it.                    */

const HEAD_ROWS = { title: 1.9, fields: 1.2, instructions: 1.3 } as const;
const FOOT_ROW = 0.9;

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
/** `.sheet__fields` sets 0.06in between rows and 0.28in between fields. */
const FIELD_GAP = inches(0.28);
const FIELD_ROW_GAP = inches(0.06);

/** A height quoted in ems of the body size, in the unit the page is in. */
const em = (fontPt: number, rows: number): Mil => points(fontPt * rows);

/** How many rows the name line wraps onto, given the width it has to fill. */
function fieldRows(config: PaperConfig): number {
  if (config.fields.length === 0) return 0;
  const across = fitAcross(
    contentBox(config.paper).width,
    FIELD_WIDTH,
    FIELD_GAP,
  );
  // A page too narrow for one whole field still prints one per row rather
  // than dividing by zero — and the rules then get whatever is left.
  return Math.ceil(config.fields.length / Math.max(1, across));
}

/**
 * How much of the page the header and footer will use.
 *
 * Counted from what the header actually holds rather than from a constant: a
 * sheet of lined paper with a name line and no title has an inch more writing
 * space than one with both, and on ⅝ paper an inch is two more lines to write
 * on. A family that reserved for the worst case would throw them away.
 */
function chrome(config: PaperConfig): { header: Mil; footer: Mil } {
  const fields = fieldRows(config);
  const rows = [
    config.title ? HEAD_ROWS.title : 0,
    HEAD_ROWS.fields * fields,
    config.instructions ? HEAD_ROWS.instructions : 0,
  ].filter((row) => row > 0);

  return {
    // The margin is there even when the header is empty — SheetHead renders
    // the element either way, and an empty flex column still takes its gap.
    header:
      HEAD_MARGIN +
      rows.reduce((total, row) => total + em(config.fontPt, row), 0) +
      HEAD_GAP * Math.max(0, rows.length - 1) +
      FIELD_ROW_GAP * Math.max(0, fields - 1),
    footer: FOOT_MARGIN + em(config.fontPt, FOOT_ROW),
  };
}

/**
 * What is left for the ruling: the page, less its margins, less the chrome.
 *
 * Exported because it is the reservation itself, and the reservation is the
 * only thing a test can hold `chrome` to. Checking the rules against the
 * *content* box instead cannot fail — `ruleCapacity` floors against this box,
 * which is the content box minus a non-negative number, so any chrome at all
 * satisfies it, including none.
 */
export function paperBlockBox(config: PaperConfig): Box {
  return blockBox(config.paper, chrome(config));
}

export function buildPaperSheet(config: PaperConfig, seed: number): Sheet {
  const box = paperBlockBox(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: config.title ?? "",
      instructions: config.instructions,
      fields: config.fields,
    },
    // As many repeats of the ruling as fit, and not one more. `ruleCapacity`
    // floors, so the last rule is inside the margin rather than on it.
    blocks: [
      {
        kind: "rules",
        rule: config.rule,
        lines: ruleCapacity(box.height, config.rule),
      },
    ],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

/**
 * One line naming the paper, in the words a teacher says out loud.
 *
 * A handwriting rule says more than its size, because the two things a parent
 * chooses between are exactly the two a shop's label leaves off: whether the
 * midline is there to write between, and whether a `g` has anywhere to go.
 */
export function describePaper(config: PaperConfig): string {
  const ruling = rulingOf(config.rule);
  const paper = `${ruling.label} paper`;
  if (!ruling.handwriting) return paper;

  const midline = config.rule.midline ?? "dashed";
  return [
    paper,
    midline === "none" ? "no midline" : `${midline} midline`,
    config.rule.descender ? "room for descenders" : "no descender space",
  ].join(" — ");
}

export const PAPER_SHEET: SheetSpec<PaperConfig> = {
  id: "paper",
  label: "Lined and graph paper",
  world: SHEET_WORLD,
  build: buildPaperSheet,
  // Blank paper is the answer. Returned as-is rather than with `answers: true`,
  // for the reason the blank page is: a key indistinguishable from its sheet
  // should also be identical to it.
  key: (sheet) => sheet,
  describe: describePaper,
};
