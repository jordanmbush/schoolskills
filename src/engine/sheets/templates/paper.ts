/**
 * Paper you print because it is empty.
 *
 * Lined, ruled, graph, dot and isometric — every ruling in §5, as sheets, and
 * the "templates" tier of §11 rather than a generator. There are no problems on
 * one, so there is nothing to answer and nothing to seed.
 *
 * It is also the family the geometry is proved on. A sheet with something
 * written on it can hide a rule that is a thousandth out; a sheet that is
 * nothing *but* the rules cannot. If a ⅝ rule measures ⅝ of an inch under a
 * ruler here, it measures ⅝ of an inch everywhere, because every other family
 * asks `layout.ts` the same question this one does.
 */
import type { PaperConfig, Sheet } from "../types";

import { sheetBlockBox } from "../chrome";
import { ruleCapacity } from "../layout";
import { rulingOf, steppedSize } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

function buildPaperSheet(config: PaperConfig, seed: number): Sheet {
  // Whatever the header and footer leave. Shared with every other family
  // (chrome.ts) rather than counted again here, because the reservation trails
  // sheet.css and a second copy of it would drift silently.
  const box = sheetBlockBox(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: config.title ?? "",
      instructions: config.instructions,
      fields: config.fields,
    },
    // `ruleCapacity` floors, so the last rule is inside the margin, not on it.
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
 * chooses between are the two a shop's label leaves off: whether the midline is
 * there to write between, and whether a `g` has anywhere to go.
 */
function describePaper(config: PaperConfig): string {
  const ruling = rulingOf(config.rule);
  const stepped = steppedSize(config.rule);
  const paper = [
    `${ruling.label} paper`,
    ...(stepped ? [`${stepped} letters`] : []),
  ];
  if (!ruling.handwriting) return paper.join(" — ");

  const midline = config.rule.midline ?? "dashed";
  return [
    ...paper,
    midline === "none" ? "no midline" : `${midline} midline`,
    config.rule.descender ? "room for descenders" : "no descender space",
  ].join(" — ");
}

export const PAPER_SHEET: SheetSpec<PaperConfig> = {
  world: SHEET_WORLD,
  build: buildPaperSheet,
  // Blank paper is the answer. Returned as-is rather than with `answers: true`,
  // for the reason the blank page is: a key indistinguishable from its sheet
  // should also be identical to it.
  key: (sheet) => sheet,
  describe: describePaper,
};
