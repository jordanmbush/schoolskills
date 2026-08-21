/**
 * What every family of sheets has to be able to say about itself: `DeckSpec` for
 * paper, and for the same reason (§3).
 */
import { WORLDS, type World } from "@/engine/worlds";

import type { Sheet, SheetConfig } from "./types";
import { DEFAULT_FONT_PT, DEFAULT_PAPER } from "./paper";

/**
 * Which world a sheet prints in — stated, not assumed, exactly as
 * `DeckSpec.world` is.
 *
 * The engine never interprets the value: a world id is an opaque string to the
 * model, and everything it means is a block of CSS in worlds.css (§9).
 */
export const SHEET_WORLD: World = "paper";

/** Printed small at the foot of every sheet (§16). */
export const SHEET_URL = "schoolskills.app";
export const SHEET_CREDIT = "Free printables and learning games";

/**
 * The same URL, pointing at the game this sheet's practice is also a race in
 * (§16).
 *
 * Only families that *have* a matching game print one. There is no race for long
 * division or for the area of a trapezium, and a footer that sent a parent to
 * the times tables from a geometry sheet would be an advert rather than a route
 * back. The world registry is where a game's route is written down, so nothing
 * here is a second copy of it.
 */
export function gameUrl(world: World): string {
  const found = WORLDS.find((entry) => entry.id === world);
  return found ? `${SHEET_URL}${found.href}` : SHEET_URL;
}

/**
 * The longest link the foot of a sheet can carry.
 *
 * Derived from the registry rather than written out, because it is `chrome.ts`
 * that reads it: the footer's height is reserved before the sheet is built, so
 * the reservation has to be made against the widest link a family might choose
 * rather than against the one it did. A second copy of "schoolskills.app/
 * spelling/play" would be a second thing to keep in step with `worlds.ts`.
 */
export const LONGEST_SHEET_URL: string = WORLDS.map((world) =>
  gameUrl(world.id),
).reduce(
  (longest, url) => (url.length > longest.length ? url : longest),
  SHEET_URL,
);

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
   * The same sheet with the answers filled in. Not optional on any family (§3):
   * a family that can't produce a key has no business generating problems.
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
 * inside a build that would otherwise have shipped a catalog (§3).
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
    fontPt: config.fontPt ?? DEFAULT_FONT_PT,
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
