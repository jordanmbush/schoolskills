import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { findSheets, readRow, EMPTY_QUERY } from "@/engine/sheets/search";

import { STOCKS } from "./_catalog";
import { GRADES, gradeHref, sheetsForGrade } from "./_grades";
import { catalogAudit, searchIndex } from "./_search";
import { ALL_SHEETS, SHELVES } from "./_shelves";

/**
 * The index, held to the two things it can get wrong without anything failing.
 *
 * **It can describe a shop that isn't there.** Every row is a promise that a
 * page exists, and a broken one is invisible from inside the build — so the
 * routes are checked against `dist/`, the same standard the grade hubs are held
 * to, and skipped identically when the build hasn't run. The other direction —
 * a page nobody can reach — is checked at build time by
 * `scripts/search-index-guard.mjs`, because only the build knows what it wrote.
 *
 * **It can disagree with the pages it sits above.** A filter that offers a
 * sheet for third grade which the third-grade hub does not list is a second
 * opinion about the catalog, and the reason `reaches` is exported from
 * `_grades.ts` rather than reimplemented here. That equivalence is pinned
 * below, year by year.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const built = (href: string): string => `${ROOT}/dist${href}/index.html`;

const index = searchIndex();
const rows = index.sheets.map(readRow);

describe("what the index is made of", () => {
  it("is every sheet on the shelves, once, in shelf order", () => {
    expect(index.sheets).toHaveLength(ALL_SHEETS.length);
    expect(rows.map((row) => row.href)).toEqual(
      ALL_SHEETS.map((sheet) => sheet.href),
    );
    expect(new Set(rows.map((row) => row.href)).size).toBe(rows.length);
  });

  it("restates nothing — every field is read off the shelf it came from", () => {
    // The whole argument for the file: there is no line in it that anything
    // else doesn't already say, so there is nothing to keep in step.
    for (const [position, sheet] of ALL_SHEETS.entries()) {
      expect(rows[position], sheet.href).toMatchObject({
        name: sheet.name,
        teaches: sheet.teaches,
        ages: sheet.ages,
        type: sheet.type,
        rule: sheet.rule ?? "",
      });
    }
  });

  it("files each sheet under the shelf it is listed on", () => {
    for (const shelf of SHELVES) {
      const listed = rows.filter((row) => row.subject === shelf.id);
      expect(
        listed.map((row) => row.href),
        shelf.id,
      ).toEqual(shelf.sheets.map((sheet) => sheet.href));
    }
  });
});

describe("the facets it offers", () => {
  it("offers nothing that would come back empty", () => {
    const { subject, type, rule } = index.facets;
    for (const [id] of subject)
      expect(
        rows.some((row) => row.subject === id),
        id,
      ).toBe(true);
    for (const [id] of type)
      expect(
        rows.some((row) => row.type === id),
        id,
      ).toBe(true);
    for (const [id] of rule)
      expect(
        rows.some((row) => row.rule === id),
        id,
      ).toBe(true);
  });

  it("lists the school years whole, because the grade bits are positions", () => {
    // Trimming this facet would slide every year after the gap onto the sheets
    // of the one before it — silently, and on every row at once.
    expect(index.facets.grade.map(([slug]) => slug)).toEqual(
      GRADES.map((grade) => grade.slug),
    );
  });

  it("keeps the rulings the engine's names and the engine's order", () => {
    const paper = rows.filter((row) => row.subject === "paper");
    expect(paper.every((row) => row.rule !== "")).toBe(true);
    expect(index.facets.rule.map(([id]) => id)).toContain("wide");
    // Blank is a `RuleStyle` and is not a sheet anybody can print.
    expect(index.facets.rule.map(([id]) => id)).not.toContain("blank");
  });
});

describe("filtering it", () => {
  it("agrees with the grade hub, year for year", () => {
    for (const grade of GRADES) {
      const found = findSheets(index, { ...EMPTY_QUERY, grade: grade.slug });
      expect(found.map((hit) => hit.href).sort(), grade.slug).toEqual(
        sheetsForGrade(grade)
          .map((sheet) => sheet.href)
          .sort(),
      );
    }
  });

  it("agrees with the subject hub, shelf for shelf", () => {
    for (const shelf of SHELVES) {
      const found = findSheets(index, { ...EMPTY_QUERY, subject: shelf.id });
      expect(
        found.map((hit) => hit.href),
        shelf.id,
      ).toEqual(shelf.sheets.map((sheet) => sheet.href));
    }
  });

  it("answers the queries a parent actually types", () => {
    const ask = (text: string) =>
      findSheets(index, { ...EMPTY_QUERY, text }).map((hit) => hit.href);

    expect(ask("graph paper")).toContain("/printables/graph-paper");
    expect(ask("long division")).toContain(
      "/printables/long-division-worksheets",
    );
    expect(ask("cursive")).not.toHaveLength(0);
    // The three the placeholder on the front door promises, and a year written
    // out — the copy is a claim about what typing that does.
    expect(ask("third grade spelling")).not.toHaveLength(0);
    expect(ask("hundred chart")).toContain("/printables/charts/hundred-chart");
    expect(ask("qwertyuiop")).toEqual([]);
  });
});

describe("what it costs to download", () => {
  it("stays small enough to open on a phone", () => {
    // It lands on the front door of the largest section on the site, and the
    // person opening it is standing in a kitchen. The budget is per sheet
    // rather than absolute so that it scales with the shop rather than with
    // whatever the catalog happened to be the day it was written: rows are
    // tuples and the years are a bitmask, which is most of why this holds.
    const bytes = JSON.stringify(index).length;
    expect(bytes / index.sheets.length).toBeLessThan(200);
    expect(bytes).toBeLessThan(64 * 1024);
  });
});

describe("the audit the build guard is handed", () => {
  it("sorts every route under /printables into printing or browsing", () => {
    const audit = catalogAudit();
    expect(audit.sheets).toEqual(rows.map((row) => row.href));
    expect(audit.browse).toContain("/printables");
    expect(audit.browse).toContain("/printables/make");
    expect(audit.browse).toContain("/printables/grade");
    for (const shelf of SHELVES) expect(audit.browse).toContain(shelf.href);
    for (const grade of GRADES)
      expect(audit.browse).toContain(gradeHref(grade));
    // The default stock is the route itself, so it is not a suffix to exempt.
    expect(audit.stocks).toEqual(
      STOCKS.map((stock) => stock.path).filter(Boolean),
    );
  });

  it("points at pages that were built", () => {
    if (!existsSync(`${ROOT}/dist`)) return; // `npm run build` hasn't run yet.

    for (const row of rows) {
      expect(existsSync(built(row.href)), row.href).toBe(true);
    }
    expect(existsSync(`${ROOT}/dist/printables/search-index.json`)).toBe(true);
  });
});
