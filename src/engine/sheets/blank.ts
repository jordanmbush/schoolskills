/**
 * The blank page.
 *
 * Not one of the sheet families in §11 — it generates no problems, so it has
 * no answers to key and no seed to vary. It is the spine's own sheet: the page
 * the builder opens on, and the smallest thing that proves the front door
 * routes a config to a spec, builds it deterministically and can key it.
 *
 * It is still a sheet somebody would print. A page with a name line, a title
 * and nothing else is what a child writes a story on.
 */
import type { BlankConfig, Sheet } from "./types";

import { blockBox } from "./layout";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "./spec";

export function buildBlankSheet(config: BlankConfig, seed: number): Sheet {
  return {
    paper: config.paper,
    header: {
      title: config.title ?? "",
      instructions: config.instructions,
      fields: config.fields,
    },
    // One spacer the height of the page, so the sheet holds its shape rather
    // than collapsing to its header. The height is arithmetic, not a guess.
    blocks: [{ kind: "spacer", height: blockBox(config.paper).height }],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const BLANK_SHEET: SheetSpec<BlankConfig> = {
  id: "blank",
  label: "Blank page",
  world: SHEET_WORLD,
  build: buildBlankSheet,
  // Nothing to fill in. Returned as-is rather than with `answers: true`,
  // because a key that is indistinguishable from the sheet should also be
  // identical to it.
  key: (sheet) => sheet,
  describe: () => "A blank page",
};
