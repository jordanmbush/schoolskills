import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import type { Block } from "@/engine/sheets/types";

import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import {
  MATHS_SEED,
  MATHS_SHEETS,
  STRANDS,
  builderHref,
  mathsShelf,
  pathFor,
} from "./_maths";

/**
 * The catalog, held to the three things a catalog page has to be.
 *
 * **It has to be a worksheet.** Every entry here is prerendered as the page a
 * parent lands on (§8), so an entry whose config produces an empty page is a
 * URL in the sitemap with nothing on it — the thin-content failure `Base.astro`
 * argues against, arrived at from the other direction.
 *
 * **It has to be curated.** The engine can generate millions of these. The
 * checks below are what "curated" means when it is not a promise: no two
 * entries print the same sheet, no two answer the same query, and every one of
 * them carries prose somebody wrote rather than a template that was filled in.
 *
 * **It has to be reachable.** Every slug in the sitemap, every slug distinct
 * from paper's — two route patterns claiming one path is a build error, and a
 * missing URL is the failure nobody notices, because the site still builds,
 * still deploys and still looks right.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** Everything on the page that a child writes an answer on. */
function problemsOf(blocks: Block[]) {
  return blocks.flatMap((block) =>
    block.kind === "problems" ? block.items : [],
  );
}

describe("the maths catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    // Not a style rule. A slug is the URL, the head term and the file on disk
    // at once, so a capital letter or a stray space here is a 404 that only
    // shows up in production.
    for (const sheet of MATHS_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(MATHS_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      MATHS_SHEETS.length,
    );
  });

  it("never claims a path that paper already prints on", () => {
    // `[topic].astro` and `[...slug].astro` are two patterns over one prefix.
    // They only coexist because the paths they emit are disjoint; the day they
    // are not, Astro has two routes for one URL and picks one of them.
    const paper = new Set(
      PAPER_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => `/printables/${paperPath(sheet, stock)}`),
      ),
    );
    for (const sheet of MATHS_SHEETS) {
      expect(paper.has(pathFor(sheet))).toBe(false);
    }
  });

  it("answers a different query on every page", () => {
    // Two pages written to the same term compete with each other and neither
    // wins — which is the shape a permutation farm takes before it is one.
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = MATHS_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("prints a different sheet on every page", () => {
    // The other half of the same test, from the paper's side: two slugs whose
    // configs are identical are one worksheet with two URLs, whatever the prose
    // around them says.
    const configs = MATHS_SHEETS.map((sheet) => JSON.stringify(sheet.config));
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of MATHS_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      // A sentence and a half is the shortest thing that can say something
      // true about one sheet and not about the one beside it.
      for (const note of sheet.notes) {
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      }
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(80);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(40);
      // The `LearningResource` block on the page is built from these two.
      expect(sheet.teaches, sheet.slug).not.toBe("");
      expect(sheet.ages, sheet.slug).toMatch(/^Ages /);
    }
  });

  it("shelves every sheet exactly once", () => {
    const shelved = mathsShelf().flatMap((strand) => strand.sheets);
    expect(shelved).toHaveLength(MATHS_SHEETS.length);
    expect(mathsShelf().every((strand) => strand.sheets.length > 0)).toBe(true);
    expect(STRANDS).toHaveLength(mathsShelf().length);
  });

  it("only cross-links to times-table pages that exist", () => {
    // /multiplication/[table]-times-table is built for 1 to 12 and nothing
    // else, so a 13 here is a link into a 404 on a page whose whole job is to
    // be found.
    for (const sheet of MATHS_SHEETS) {
      for (const table of sheet.tables ?? []) {
        expect(table, sheet.slug).toBeGreaterThanOrEqual(1);
        expect(table, sheet.slug).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe("the sheet on a catalog page", () => {
  it("has something on it", () => {
    for (const sheet of MATHS_SHEETS) {
      const built = buildSheet(sheet.config, MATHS_SEED);
      expect(built.blocks.length, sheet.slug).toBeGreaterThan(0);
      // Marked out of what is actually on the page, so this is also the check
      // that the page is not a header and a footer with nothing between them.
      expect(built.header.score?.outOf, sheet.slug).toBeGreaterThan(0);
      expect(built.header.title, sheet.slug).not.toBe("");
    }
  });

  it("asks for no more than the paper holds", () => {
    // A count is a request, not a promise: the families cap it at what fits.
    // A page that asked for thirty and got twenty-nine is fine; the failure
    // this catches is prose that says "thirty" over a sheet of nine.
    for (const sheet of MATHS_SHEETS) {
      const problems = problemsOf(buildSheet(sheet.config, MATHS_SEED).blocks);
      const asked = "count" in sheet.config ? sheet.config.count : 0;
      if (asked > 0) expect(problems.length, sheet.slug).toBe(asked);
    }
  });

  it("is the same sheet on every build", () => {
    // §7, and the reason these pages can be prerendered at all: a crawler that
    // comes back next month has to read the page it indexed, and a parent has
    // to be able to print the same sheet again next week.
    for (const sheet of MATHS_SHEETS) {
      expect(JSON.stringify(buildSheet(sheet.config, MATHS_SEED))).toBe(
        JSON.stringify(buildSheet(sheet.config, MATHS_SEED)),
      );
    }
  });

  it("prints an answer key that is the same sheet with the answers shown", () => {
    for (const sheet of MATHS_SHEETS) {
      const built = buildSheet(sheet.config, MATHS_SEED);
      const key = answerKey(sheet.config, MATHS_SEED);
      expect(built.answers, sheet.slug).toBe(false);
      expect(key.answers, sheet.slug).toBe(true);
      expect(key.footer.note, sheet.slug).toBe("Answer key");
      // The same questions, not a second set of them — the key is the sheet
      // with `answers` flipped, so nothing it prints can disagree with what
      // the child was asked.
      expect(JSON.stringify(key.blocks), sheet.slug).toBe(
        JSON.stringify(built.blocks),
      );
      for (const problem of problemsOf(key.blocks)) {
        expect(problem.answer.length, sheet.slug).toBeGreaterThan(0);
      }
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed", () => {
    for (const sheet of MATHS_SHEETS) {
      const href = builderHref(sheet);
      expect(href.startsWith("/printables/make#s=")).toBe(true);

      const payload = href.slice("/printables/make#s=".length);
      const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
      const shared = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      );
      expect(shared).toEqual({ config: sheet.config, seed: MATHS_SEED });
    }
  });
});

describe("the sitemap", () => {
  /*
   * §20's last line, against the file that actually shipped.
   *
   * The catalog is the largest crawlable surface this site has, and a URL
   * missing from the sitemap is the failure nobody notices — nothing breaks,
   * the page is simply never submitted. `astro.config.mjs` filters the sitemap
   * from the world registry, which means a change there can silently take a
   * whole directory out; this is the assertion that it hasn't.
   *
   * Skipped when there is no `dist/`, exactly as the built-output check in
   * Sheet.test.tsx is. CI builds before it runs the suite.
   */
  it("carries every maths slug and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/math")).toBe(true);
    for (const sheet of MATHS_SHEETS) {
      expect(found.has(pathFor(sheet)), sheet.slug).toBe(true);
    }
    // And the builder still isn't in it: it is an island and carries noindex.
    expect(found.has("/printables/make")).toBe(false);
  });
});
