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
import { inches } from "./paper";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "./spec";

/**
 * What the header and footer take out of the page.
 *
 * Declared, not measured — the bargain `blockBox` is built on (§4). An inch is
 * a title with a name and date line under it; a quarter is one small line of
 * credit. A family that reserved nothing would hand back a block the height of
 * the whole content area and print a page and a bit.
 */
const HEADER_HEIGHT = inches(1);
const FOOTER_HEIGHT = inches(0.25);

export function buildBlankSheet(config: BlankConfig, seed: number): Sheet {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: config.title ?? "",
      instructions: config.instructions,
      fields: config.fields,
    },
    // One spacer filling what the chrome leaves, so the sheet holds its shape
    // rather than collapsing to its header. The height is arithmetic, not a
    // guess: the content box less the two reservations above.
    blocks: [
      {
        kind: "spacer",
        height: blockBox(config.paper, {
          header: HEADER_HEIGHT,
          footer: FOOTER_HEIGHT,
        }).height,
      },
    ],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const BLANK_SHEET: SheetSpec<BlankConfig> = {
  world: SHEET_WORLD,
  build: buildBlankSheet,
  // Nothing to fill in. Returned as-is rather than with `answers: true`,
  // because a key that is indistinguishable from the sheet should also be
  // identical to it.
  key: (sheet) => sheet,
  describe: () => "A blank page",
};
