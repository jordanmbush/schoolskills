import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BIBLE_SHEETS } from "./_bible";
import { PAPER_SHEETS, STOCKS } from "./_catalog";
import { CHART_SHEETS } from "./_charts";
import { CURSIVE_SHEETS } from "./_cursive";
import {
  GRADES,
  ageBand,
  ageRange,
  gradeHref,
  sheetByHref,
  sheetsForGrade,
  shelvesForGrade,
} from "./_grades";
import { GRAMMAR_SHEETS } from "./_grammar";
import { HANDWRITING_SHEETS } from "./_handwriting";
import { MATHS_SHEETS } from "./_maths";
import { PHONICS_SHEETS } from "./_phonics";
import { ALL_SHEETS, HUBS, SHELVES } from "./_shelves";
import { SPELLING_SHEETS } from "./_spelling";
import { TEMPLATE_SHEETS } from "./_templates";

/**
 * The two hubs that cut across the shelves, held to the two things a hub can
 * get wrong without anything failing.
 *
 * **A link to a page that isn't there.** A catalog page that lists a sheet
 * nobody built still renders, still deploys and still looks right; the reader
 * finds out. So every route these pages emit is checked against `dist/` rather
 * than against the data that generated it — the same standard the sitemap
 * checks in the sibling catalogs use, and skipped identically when the build
 * hasn't run.
 *
 * **A claim the page cannot back up.** The counts on a grade hub are computed,
 * so they cannot drift; the sentences are not, and the two that make a factual
 * claim are pinned here — the three landmarks a year recommends, and the
 * eighth-grade page's statement about which shelves stop before it.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** Where a route's HTML lands, with `build.format: "directory"`. */
const built = (href: string): string => `${ROOT}/dist${href}/index.html`;

const bySlug = (slug: string) => {
  const grade = GRADES.find((entry) => entry.slug === slug);
  if (!grade) throw new Error(`no grade at ${slug}`);
  return grade;
};

describe("the shelf registry", () => {
  it("holds every sheet in the shop, once", () => {
    // The registry is a hand-written list of ten catalogs, which is the one
    // way a shelf gets left off every grade page at once: nothing else in the
    // codebase would notice, because each catalog's own tests still pass.
    const catalogued =
      MATHS_SHEETS.length +
      HANDWRITING_SHEETS.length +
      CURSIVE_SHEETS.length +
      BIBLE_SHEETS.length +
      SPELLING_SHEETS.length +
      GRAMMAR_SHEETS.length +
      PHONICS_SHEETS.length +
      CHART_SHEETS.length +
      TEMPLATE_SHEETS.length +
      PAPER_SHEETS.length;

    expect(ALL_SHEETS).toHaveLength(catalogued);
    expect(new Set(ALL_SHEETS.map((sheet) => sheet.href)).size).toBe(
      catalogued,
    );
  });

  it("links the paper shelf at the front door and every other at its own hub", () => {
    // Paper is the exception the `hub` flag exists for: its fifteen rulings are
    // set out on /printables itself, because a ruling is chosen by reading what
    // makes it different from the ruling beside it.
    expect(HUBS.map((shelf) => shelf.id)).not.toContain("paper");
    expect(HUBS).toHaveLength(SHELVES.length - 1);
    for (const shelf of HUBS) {
      expect(shelf.href.startsWith("/printables/"), shelf.id).toBe(true);
    }
    const paper = SHELVES.find((shelf) => shelf.id === "paper");
    expect(paper?.href).toBe("/printables");
  });

  it("lists paper on the stock the front door lists it on", () => {
    // Letter, and no `/a4` suffix: each sheet page carries the link to its twin.
    const paper = SHELVES.find((shelf) => shelf.id === "paper");
    expect(STOCKS[0].path).toBe("");
    for (const sheet of paper?.sheets ?? []) {
      expect(sheet.href, sheet.name).not.toMatch(/\/a4$/);
    }
  });
});

describe("reading a sheet's stated ages", () => {
  it("reads the two shapes the catalogs write, and refuses a third", () => {
    expect(ageBand("Ages 6–9")).toEqual([6, 9]);
    expect(ageBand("Ages 4+")).toEqual([4, Infinity]);
    // Throwing rather than returning nothing is the point: a silent miss would
    // drop the sheet off all ten grade pages with every test still green.
    expect(() => ageBand("Ages 6-9")).toThrow(); // hyphen, not an en dash
    expect(() => ageBand("Ages 6 to 9")).toThrow();
    expect(() => ageBand("KS1")).toThrow();
  });

  it("reads every sheet in the shop", () => {
    for (const sheet of ALL_SHEETS) {
      const [from, to] = ageBand(sheet.ages);
      expect(from, sheet.href).toBeGreaterThanOrEqual(3);
      expect(to, sheet.href).toBeGreaterThan(from);
    }
  });
});

describe("the ten years", () => {
  it("runs Pre-K to 8th, a year at a time and with no gap", () => {
    expect(GRADES).toHaveLength(10);
    expect(GRADES[0].slug).toBe("pre-k");
    expect(GRADES[9].slug).toBe("8th-grade");

    for (const grade of GRADES) {
      expect(grade.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      // Two ages to a year: six in the autumn, seven by the spring.
      expect(grade.ages[1], grade.slug).toBe(grade.ages[0] + 1);
    }
    for (const [index, grade] of GRADES.slice(1).entries()) {
      expect(grade.ages[0], grade.slug).toBe(GRADES[index].ages[0] + 1);
    }
    expect(new Set(GRADES.map((grade) => grade.slug)).size).toBe(GRADES.length);
    expect(ageRange(bySlug("3rd-grade"))).toBe("8-9");
  });

  it("answers a different query on every page", () => {
    const keywords = GRADES.map((grade) => grade.keyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const grade of GRADES) {
      expect(grade.notes.length, grade.slug).toBeGreaterThanOrEqual(2);
      for (const note of grade.notes)
        expect(note.length, grade.slug).toBeGreaterThan(200);
      expect(grade.lead.length, grade.slug).toBeGreaterThan(100);
    }
  });

  it("never claims a path a sheet already prints on", () => {
    // /printables/grade/3rd-grade is two segments where a sheet is one, so the
    // patterns cannot collide today. Asserted anyway: the day somebody adds a
    // shelf at /printables/grade/… , Astro has two routes for one URL.
    const taken = new Set(ALL_SHEETS.map((sheet) => sheet.href));
    for (const grade of GRADES) {
      expect(taken.has(gradeHref(grade)), grade.slug).toBe(false);
    }
  });
});

describe("what a year lists", () => {
  it("lists something from most of the shop, every year", () => {
    for (const grade of GRADES) {
      const shelves = shelvesForGrade(grade);
      expect(shelves.length, grade.slug).toBeGreaterThanOrEqual(4);
      expect(sheetsForGrade(grade).length, grade.slug).toBeGreaterThan(20);
      // An empty shelf is dropped rather than printed as a heading with
      // nothing under it.
      for (const shelf of shelves)
        expect(
          shelf.sheets.length,
          `${grade.slug}/${shelf.id}`,
        ).toBeGreaterThan(0);
    }
  });

  it("lists Scripture beside everything else, in every year", () => {
    // §12, and an acceptance criterion of its own: the Scripture sheets are
    // listed under their own heading among the other shelves rather than
    // cordoned off — and there is a passage for every age in the catalog.
    for (const grade of GRADES) {
      const shelves = shelvesForGrade(grade).map((shelf) => shelf.id);
      expect(shelves, grade.slug).toContain("bible");
      // Among the others, not alone: a year with only Scripture on it would
      // pass the line above and fail what it means.
      expect(shelves.length, grade.slug).toBeGreaterThan(1);
    }
  });

  it("leaves no sheet unreachable from any year", () => {
    const listed = new Set(
      GRADES.flatMap((grade) => sheetsForGrade(grade)).map(
        (sheet) => sheet.href,
      ),
    );
    for (const sheet of ALL_SHEETS) {
      expect(listed.has(sheet.href), sheet.href).toBe(true);
    }
  });

  it("stops the shelves that stop, on the eighth-grade page", () => {
    // The one claim the eighth-grade prose makes about what is NOT there:
    // "no handwriting, cursive, phonics, spelling or grammar sheet on this
    // page, because every one of those states an age range that ends before
    // thirteen". Re-ageing a single catalog entry would make that a lie.
    const shelves = shelvesForGrade(bySlug("8th-grade")).map(
      (shelf) => shelf.id,
    );
    for (const absent of [
      "handwriting",
      "cursive",
      "phonics",
      "spelling",
      "grammar",
    ]) {
      expect(shelves, absent).not.toContain(absent);
    }
    expect(shelves).toContain("math");
    expect(shelves).toContain("paper");
  });

  it("puts a sheet on every year its own ages reach, and no other", () => {
    // The mechanism the pages describe in as many words, spot-checked at both
    // ends: a sheet for 9–12 belongs to the fourth-grader and the seventh, and
    // an open-ended ruling belongs to everybody old enough for it.
    const on = (href: string) =>
      GRADES.filter((grade) =>
        sheetsForGrade(grade).some((sheet) => sheet.href === href),
      ).map((grade) => grade.slug);

    expect(on("/printables/long-division-worksheets")).toEqual([
      "3rd-grade",
      "4th-grade",
      "5th-grade",
      "6th-grade",
      "7th-grade",
    ]);
    expect(on("/printables/templates/blank-flashcards")).toEqual(
      GRADES.map((grade) => grade.slug),
    );
    expect(on("/printables/narrow-ruled-paper")).toEqual([
      "6th-grade",
      "7th-grade",
      "8th-grade",
    ]);
  });

  it("knows which sheet names collide with a year's own name", () => {
    // The year prose cannot be built out of `grade.label`. One ruling in the
    // paper catalog is called "Kindergarten writing paper — 1 inch", after the
    // size it is conventionally sold at, and its own "Ages 4–6" puts it on both
    // the Pre-K and the kindergarten page — so a sentence reading "No sheet is
    // labelled Kindergarten" would ship directly above a link disproving it.
    //
    // Pinned rather than forbidden: the sheet's name is right and its ages are
    // right, and nothing should be renamed to make an assertion easier. What
    // must not happen quietly is a SECOND such name arriving — a "First grade
    // writing paper", say — under prose that has been reworded back into
    // naming years. A new entry here fails this test and sends whoever added
    // it to `grade/[grade].astro` to check the sentence still holds.
    const collisions = GRADES.flatMap((grade) =>
      sheetsForGrade(grade)
        .filter((sheet) =>
          sheet.name.toLowerCase().includes(grade.label.toLowerCase()),
        )
        .map((sheet) => `${grade.slug} → ${sheet.name}`),
    );

    expect(collisions).toEqual([
      "kindergarten → Kindergarten writing paper — 1 inch",
    ]);
  });
});

describe("the three sheets a year opens with", () => {
  it("names a sheet that exists", () => {
    for (const grade of GRADES) {
      for (const pick of grade.landmarks) {
        expect(
          sheetByHref(pick.href),
          `${grade.slug} → ${pick.href}`,
        ).toBeTruthy();
      }
    }
  });

  it("names a sheet this year's ages actually reach", () => {
    // The failure this exists for: a catalog entry re-aged in the file that
    // owns it, leaving a hand-written recommendation pointing at a sheet the
    // listing underneath it no longer shows.
    for (const grade of GRADES) {
      const listed = new Set(sheetsForGrade(grade).map((sheet) => sheet.href));
      for (const pick of grade.landmarks) {
        expect(listed.has(pick.href), `${grade.slug} → ${pick.href}`).toBe(
          true,
        );
      }
    }
  });

  it("gives three of them, each with a reason", () => {
    for (const grade of GRADES) {
      expect(grade.landmarks, grade.slug).toHaveLength(3);
      for (const pick of grade.landmarks)
        expect(pick.why.length, pick.href).toBeGreaterThan(30);
    }
  });
});

describe("the built site", () => {
  /*
   * Against `dist/`, not against the data: the accuracy trap on a hub is a
   * link to a page that was described but never built, and the only thing that
   * disproves it is the file. Skipped when there is no `dist/`, exactly as the
   * catalogs' sitemap checks are; CI builds before it runs the suite.
   */
  it("has a page behind every link a hub prints", () => {
    if (!existsSync(`${ROOT}/dist`)) return; // `npm run build` hasn't run yet.

    for (const sheet of ALL_SHEETS) {
      expect(existsSync(built(sheet.href)), sheet.href).toBe(true);
    }
    for (const shelf of SHELVES) {
      expect(existsSync(built(shelf.href)), shelf.id).toBe(true);
    }
    for (const grade of GRADES) {
      expect(existsSync(built(gradeHref(grade))), grade.slug).toBe(true);
    }
    expect(existsSync(built("/printables/grade"))).toBe(true);
  });

  it("ships the year pages with no JavaScript on them", () => {
    if (!existsSync(`${ROOT}/dist`)) return;

    // §2, and the reason a hub is a listing rather than an island: an
    // `<astro-island>` is how a component's JavaScript reaches a page at all.
    for (const grade of GRADES) {
      const html = readFileSync(built(gradeHref(grade)), "utf8");
      expect(html, grade.slug).not.toContain("astro-island");
      expect(html, grade.slug).toContain("<h1");
    }
  });

  it("puts every year in the sitemap", () => {
    // A URL missing from the sitemap is the failure nobody notices — nothing
    // breaks, the page is simply never submitted.
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return;

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/grade")).toBe(true);
    for (const grade of GRADES) {
      expect(found.has(gradeHref(grade)), grade.slug).toBe(true);
    }
    for (const shelf of HUBS) {
      expect(found.has(shelf.href), shelf.id).toBe(true);
    }
  });
});
