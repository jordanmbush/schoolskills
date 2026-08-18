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
import type { PaperConfig, Sheet } from "../types";

import { sheetBlockBox } from "../chrome";
import { ruleCapacity } from "../layout";
import { rulingOf } from "../paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";

export function buildPaperSheet(config: PaperConfig, seed: number): Sheet {
  // Whatever the header and footer leave. The reservation is shared with every
  // other family (chrome.ts) rather than counted again here, because it trails
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
