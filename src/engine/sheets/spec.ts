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
 * `C` is the family's own config, and the table in families.ts is what ties it
 * back to the union: a spec is only ever handed the config whose `kind` looked
 * it up. Declaring `build` and `describe` as methods rather than as arrow
 * properties is load-bearing — TypeScript checks method parameters
 * bivariantly, which is what lets a `SheetSpec<LinedConfig>` sit in a registry
 * of `SheetSpec<SheetConfig>` without a cast at every entry. Rewrite either as
 * `build: (config: C, seed: number) => Sheet` and the registry stops
 * compiling.
 *
 * Behaviour only: what a family is called and which `kind` reaches it are in
 * `SheetFamily`, because the picker names every family without loading one.
 *
 * **The functions a family fills these in with are its own — not exported.**
 * The spec is the whole of what a family offers, and `index.ts` is how a caller
 * reaches one. An exported `buildArithmeticSheet` would be a second door past
 * the registry, and it would also hide drift: `noUnusedLocals` has nothing to
 * say about an export, so a builder that fell out of its own spec would go on
 * looking used forever. Export one only if a test needs it directly, and say so
 * on the line above it.
 */
export type SheetSpec<C extends SheetConfig = SheetConfig> = {
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
 * Stands in for a sheet family that isn't in the table.
 *
 * Saved sheets outlive the families they were made on, the same way sessions
 * outlive their decks: a config from a URL somebody bookmarked in March must
 * still open in June after its family was renamed. So this returns a page that
 * prints, and says plainly why there is nothing on it, rather than throwing
 * inside a build that would otherwise have shipped a catalog (§3).
 */
export const UNKNOWN_SHEET: SheetSpec = {
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

/**
 * The presentation half of `SheetOptions`, copied onto what a family built.
 *
 * Here rather than in every `build` function: every family would otherwise write
 * the same three lines, and the next one added would be the one that forgot. It
 * is safe to do after the fact because none of the three changes a length — the
 * face is set in points, a bordered slot is the same line box as a ruled one,
 * and the cut guides are drawn over the paper rather than in the flow — so
 * nothing here can make a sheet the layout arithmetic already fitted stop
 * fitting.
 *
 * A family that has already said something wins, which is what keeps this a
 * default rather than an override: `UNKNOWN_SHEET` sets nothing and gets the
 * parent's choices, and a family that one day sets its own is not quietly
 * undone from out here.
 */
function present(config: SheetConfig, sheet: Sheet): Sheet {
  return {
    ...sheet,
    font: sheet.font ?? config.font,
    answerBox: sheet.answerBox ?? config.answerBox,
    cutLines: sheet.cutLines ?? config.cutLines,
  };
}

/**
 * Build a sheet from a family already in hand. Deterministic in
 * `(config, seed)`, which is the mechanism behind three of the features in §7
 * rather than one: an answer key is the same build, "another sheet like this
 * one" is `seed + 1`, and a sheet is reproducible from a shared URL because the
 * seed is in it.
 *
 * Takes the spec rather than looking one up, because there are two ways to
 * reach a family — the whole press at once in index.ts, one at a time through
 * `loadSheet` — and only one of them may decide what "built" means.
 */
export function buildWith(
  spec: SheetSpec,
  config: SheetConfig,
  seed: number,
): Sheet {
  return present(config, spec.build(config, seed));
}

/**
 * The same sheet with the answers drawn in.
 *
 * A second build from the same seed, not a second generation of the answers:
 * they were computed when the sheet was built and `key` only decides to print
 * them, so a key cannot disagree with the sheet it belongs to.
 */
export function keyWith(
  spec: SheetSpec,
  config: SheetConfig,
  seed: number,
): Sheet {
  return present(config, spec.key(spec.build(config, seed)));
}
