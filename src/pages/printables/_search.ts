/**
 * The catalog, written down once as something searchable.
 *
 * Underscored so Astro leaves it out of the routing table: it is data three
 * things share — `search-index.json.ts`, which ships it; the guard in
 * `scripts/search-index-guard.mjs`, which holds it to what `dist/` actually
 * contains; and the island on the front door, which reads the file the first
 * one wrote.
 *
 * **It is a projection, never a list.** Every row comes off `_shelves.ts` — the
 * same registry the grade hubs and the subject hubs render from — and every
 * field on it is read rather than restated: the route from the shelf's own
 * helper, the name and the ages from the catalog that owns the sheet, the kind
 * of page and the ruling from the config the sheet is actually built from, and
 * the school years from `reaches`, which is the function the year pages
 * themselves are filtered with. There is nothing here to keep in step with
 * anything, because there is nothing here that anything else doesn't already
 * say. A hand-maintained index is the same failure this epic has already
 * shipped twice — copy describing sheets that weren't there — only at the scale
 * of the whole shop.
 *
 * The half that knows what a row *means* is `@/engine/sheets/search`: the
 * column order, the fold onto six kinds of page, the matcher and the fragment.
 * This file knows what is on the shelves; that one knows nothing about them.
 */
import { RULINGS } from "@/engine/sheets/paper";
import {
  SHEET_TYPES,
  type Facet,
  type IndexRow,
  type SheetIndex,
} from "@/engine/sheets/search";

import { STOCKS } from "./_catalog";
import { GRADES, gradeHref, reaches } from "./_grades";
import { SHELVES, type ShelfSheet } from "./_shelves";

/**
 * The school years a sheet reaches, as one bit per year.
 *
 * A number rather than an array of slugs, and it is the one place in the file
 * where the shipped size decided the shape: ten slugs written out per row is
 * more bytes than everything else on the row put together, and a sheet for
 * seven to eleven reaches five of them. `reachesGrade` in the engine is what
 * reads it back, against the position in `facets.grade` — so the bit order is
 * the facet's order and not a second convention.
 */
const gradeMask = (sheet: ShelfSheet): number =>
  GRADES.reduce(
    (mask, grade, year) => (reaches(grade, sheet) ? mask | (1 << year) : mask),
    0,
  );

/** Every sheet in the shop, with the shelf it came off. */
const rows = (): IndexRow[] =>
  SHELVES.flatMap((shelf) =>
    shelf.sheets.map((sheet): IndexRow => [
      sheet.href,
      sheet.name,
      sheet.teaches,
      sheet.ages,
      shelf.id,
      sheet.type,
      sheet.rule ?? "",
      gradeMask(sheet),
    ]),
  );

/**
 * The whole index, as it is written to `/printables/search-index.json`.
 *
 * Built on every build and never cached anywhere, because the thing it is a
 * view of — the ten catalogs — is compiled into the same build. There is no
 * state here to go stale between one deploy and the next.
 */
export function searchIndex(): SheetIndex {
  const sheets = rows();

  /*
    Every facet is cut down to the values the catalog actually has sheets for.
    A chip that returns nothing is worse than no chip: it reads as a shelf that
    has been emptied rather than as one that was never stocked. Blank paper is
    the standing case — `RuleStyle` includes it because a handwriting sheet can
    be written on nothing, and no page in the catalog is.
  */
  const used = (column: 4 | 5 | 6): Set<string> =>
    new Set(sheets.map((row) => String(row[column])));
  const subjects = used(4);
  const types = used(5);
  const rulings = used(6);

  return {
    facets: {
      subject: SHELVES.filter((shelf) => subjects.has(shelf.id)).map(
        (shelf): Facet[number] => [shelf.id, shelf.label],
      ),
      /*
        The one facet listed whole, and it has to be: a row's `grades` is a bit
        per POSITION in this list, so dropping an entry would silently slide
        every year after it onto the sheets of the one before. It costs nothing
        to be honest about — every year from Pre-K to eighth is reached by
        something, if only by the paper.
      */
      grade: GRADES.map((grade): Facet[number] => [grade.slug, grade.short]),
      type: SHEET_TYPES.filter((type) => types.has(type.id)).map(
        (type): Facet[number] => [type.id, type.label],
      ),
      /*
        In the engine's order, which runs the handwriting sizes largest to
        smallest, then the three notebook rules, then the three grids — the
        order §5 sets them out in and the order the builder offers them in. A
        second opinion about how to sort eleven rulings is a second thing to
        keep in step for no gain.
      */
      rule: Object.values(RULINGS)
        .filter((ruling) => rulings.has(ruling.id))
        .map((ruling): Facet[number] => [ruling.id, ruling.label]),
    },
    sheets,
  };
}

/**
 * Every route under `/printables`, sorted into the two kinds there are.
 *
 * Read by the build guard, which is the half of this story that cannot be
 * written as a unit test: a test knows what the catalog says, and the failure
 * to catch is a page the catalog says exists that the build did not write, or a
 * page the build wrote that the index cannot reach. Only `dist/` can settle
 * either, so the guard is handed both lists and left to walk the directory.
 *
 * `stocks` is the third answer, and it is why this isn't just two arrays: every
 * ruled sheet prints at a second route for A4, which is a real page that is
 * deliberately not in the index — the index lists a sheet once, on the stock
 * the hubs link, and the sheet's own page carries the link to its twin.
 */
export function catalogAudit(): {
  sheets: string[];
  browse: string[];
  stocks: string[];
} {
  return {
    sheets: rows().map((row) => row[0]),
    browse: [
      ...new Set([
        "/printables",
        "/printables/make",
        "/printables/grade",
        ...SHELVES.map((shelf) => shelf.href),
        ...GRADES.map(gradeHref),
      ]),
    ],
    stocks: STOCKS.map((stock) => stock.path).filter(Boolean),
  };
}
