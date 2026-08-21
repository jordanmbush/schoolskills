/**
 * The catalog, written down once as something searchable.
 *
 * **It is a projection, never a list.** Every field on a row is read rather
 * than restated — the route from the shelf's own helper, the name and the ages
 * from the catalog that owns the sheet, the kind of page and the ruling from
 * the config it is built from, the school years from the same `reaches` the
 * year pages are filtered with — so there is nothing here to keep in step with
 * anything.
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
 * A number rather than an array of slugs, and the one place in the file where
 * the shipped size decided the shape: ten slugs per row is more bytes than
 * everything else on the row put together. `reachesGrade` in the engine reads
 * it back against the position in `facets.grade`, so the bit order is the
 * facet's order and not a second convention.
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

/** The whole index, as it is written to `/printables/search-index.json`. */
export function searchIndex(): SheetIndex {
  const sheets = rows();

  /*
    Every facet is cut down to the values the catalog actually has sheets for.
    A chip that returns nothing reads as a shelf that has been emptied rather
    than as one that was never stocked. Blank paper is the standing case —
    `RuleStyle` includes it because a handwriting sheet can be written on
    nothing, and no page in the catalog is.
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
        every year after it onto the sheets of the one before.
      */
      grade: GRADES.map((grade): Facet[number] => [grade.slug, grade.short]),
      type: SHEET_TYPES.filter((type) => types.has(type.id)).map(
        (type): Facet[number] => [type.id, type.label],
      ),
      /*
        In the engine's order — the order §5 sets the rulings out in and the
        order the builder offers them in. A second opinion about how to sort
        them is a second thing to keep in step for no gain.
      */
      rule: Object.values(RULINGS)
        .filter((ruling) => rulings.has(ruling.id))
        .map((ruling): Facet[number] => [ruling.id, ruling.label]),
    },
    sheets,
  };
}

/**
 * Every route under `/printables`, for `scripts/search-index-guard.mjs`.
 *
 * The failure to catch is a page the catalog says exists that the build did not
 * write, or a page the build wrote that the index cannot reach. A unit test
 * knows only what the catalog says; only `dist/` can settle either, so the
 * guard is handed these lists and left to walk the directory.
 *
 * `stocks` is why this isn't two arrays: every ruled sheet prints at a second
 * route for A4, a real page that is deliberately not in the index. The index
 * lists a sheet once, on the stock the hubs link, and the sheet's own page
 * carries the link to its twin.
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
