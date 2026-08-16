/**
 * What every family of sheets has to be able to say about itself.
 *
 * The same shape of answer `DeckSpec` gives the race loop, for the same reason:
 * the parts of a worksheet that generalise — paper, rulings, capacity, the
 * header, the footer, the print stylesheet — can't decide what a problem is,
 * what its answer is, or how to say in one line what the sheet contains. Those
 * three judgements belong to the family, and this is where it states them.
 */
import type { World } from "@/engine/worlds";

import type { Sheet, SheetConfig } from "./types";
import { DEFAULT_PAPER } from "./paper";

/**
 * Which world a sheet prints in — stated, not assumed, exactly as
 * `DeckSpec.world` is.
 *
 * It is `line`, the site's non-game chrome, until the Print Shop's own `paper`
 * world lands with its colours and its place on the map (§9). The engine never
 * interprets the value, so that is a one-line change here and a block of CSS
 * there — which is the whole point of keeping worlds opaque to the model.
 */
export const SHEET_WORLD: World = "line";

/** Printed small at the foot of every sheet: free traffic, and true (§16). */
export const SHEET_URL = "schoolskills.app";
export const SHEET_CREDIT = "Free printables and learning games";

/**
 * `C` is the family's own config, and the registry in index.ts is what ties it
 * back to the union: a spec is only ever handed the config whose `kind` looked
 * it up. Declaring `build` and `describe` as methods rather than as arrow
 * properties is load-bearing — TypeScript checks method parameters
 * bivariantly, which is what lets a `SheetSpec<LinedConfig>` sit in a registry
 * of `SheetSpec<SheetConfig>` without a cast at every entry. Rewrite either as
 * `build: (config: C, seed: number) => Sheet` and the registry stops
 * compiling.
 */
export type SheetSpec<C extends SheetConfig = SheetConfig> = {
  /** Matches `SheetConfig.kind`, so a saved sheet finds its way back here. */
  id: string;
  label: string;
  world: World;
  /** Build the sheet. Deterministic in (config, seed) — see §7. */
  build(config: C, seed: number): Sheet;
  /**
   * The same sheet with the answers filled in. Not optional on any family: an
   * answer key is the single most expected feature of a worksheet site and the
   * most common thing done badly, and a family that can't produce one has no
   * business generating problems.
   */
  key(sheet: Sheet): Sheet;
  /** One line for the catalog, and for the record of what was printed. */
  describe(config: C): string;
};

/**
 * Stands in for a sheet family that isn't in the registry.
 *
 * Saved sheets outlive the families they were made on, the same way sessions
 * outlive their decks: a config from a URL somebody bookmarked in March must
 * still open in June after its family was renamed. So this returns a page that
 * prints, and says plainly why there is nothing on it, rather than throwing
 * inside a build that would otherwise have shipped a catalog.
 */
export const UNKNOWN_SHEET: SheetSpec = {
  id: "unknown",
  label: "Retired sheet",
  world: SHEET_WORLD,
  build: (config, seed) => ({
    // The one place a config is treated as untrusted rather than as its type.
    // Everything that lands here came from outside this build — a shared URL,
    // a saved sheet — so the field the type promises may simply not be there.
    paper: config.paper ?? DEFAULT_PAPER,
    header: {
      title: "Sheet unavailable",
      instructions: "This kind of sheet isn't made any more.",
      fields: [],
    },
    blocks: [],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  }),
  key: (sheet) => sheet,
  describe: () => "A sheet this build no longer makes",
};
