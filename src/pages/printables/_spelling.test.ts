import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import type { Block, SheetConfig } from "@/engine/sheets/types";
import { STUDY_TOPICS } from "@/engine/sheets/words/study";

import { BIBLE_SHEETS, hrefFor as bibleHref } from "./_bible";
import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import {
  SPELLING_GROUPS,
  SPELLING_SEED,
  SPELLING_SHEETS,
  builderHref,
  keyed,
  pathFor,
  spellingShelf,
  type SpellingSheet,
} from "./_spelling";

/**
 * The spelling catalog, held to the four things a catalog page has to be.
 *
 * **It has to be a worksheet.** Every entry is prerendered as the page a parent
 * lands on (§8), so an entry whose config produces an empty page is a URL in the
 * sitemap with nothing on it.
 *
 * **It has to print everything it promised.** A count is a request everywhere
 * else in the shop, capped at what the page holds — but a catalog page's prose
 * says "eighteen words" in as many words, and a sheet that quietly dropped two
 * off the bottom would look exactly like a sheet that didn't. So every entry is
 * checked against its own config rather than against the family's cap.
 *
 * **It has to be curated.** No two entries print the same sheet, no two answer
 * the same query, and every one carries prose somebody wrote.
 *
 * **It has to be reachable.** Every slug in the sitemap, and every slug distinct
 * from the five catalogs that share the prefix.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** How many things a block puts on the paper, whichever kind it is. */
function items(block: Block): number {
  switch (block.kind) {
    case "problems":
      return block.items.length;
    case "blanks":
      return block.sentences.length;
    case "choice":
      return block.questions.length;
    case "wordshapes":
      return block.words.length;
    case "matching":
      return block.left.length;
    case "trace":
      return block.rows.length;
    default:
      return 0;
  }
}

/** What the config asked for, read off the config rather than off the family. */
function promised(config: SheetConfig): number {
  if (config.kind === "words") return config.words.length;
  if (config.kind === "word-study") return config.count;
  // The tracing sheet: one row per word, which the handwriting family decides.
  if (config.kind === "handwriting") return config.words?.length ?? 0;
  return 0;
}

const built = (sheet: SpellingSheet) => buildSheet(sheet.config, SPELLING_SEED);

describe("the spelling catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of SPELLING_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(SPELLING_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      SPELLING_SHEETS.length,
    );
  });

  it("never claims a path another shelf already prints on", () => {
    // Six route patterns over one prefix. They only coexist because the paths
    // they emit are disjoint; the day they are not, Astro has two routes for one
    // URL and picks one of them.
    const taken = new Set([
      ...PAPER_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => `/printables/${paperPath(sheet, stock)}`),
      ),
      ...MATHS_SHEETS.map((sheet) => mathsPath(sheet)),
      ...HANDWRITING_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => handwritingHref(sheet, stock)),
      ),
      ...CURSIVE_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => cursiveHref(sheet, stock)),
      ),
      ...BIBLE_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => bibleHref(sheet, stock)),
      ),
    ]);
    for (const sheet of SPELLING_SHEETS) {
      expect(taken.has(pathFor(sheet)), sheet.slug).toBe(false);
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = SPELLING_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = SPELLING_SHEETS.map((sheet) =>
      JSON.stringify(sheet.config),
    );
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of SPELLING_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      for (const note of sheet.notes) {
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      }
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(80);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(40);
      expect(sheet.teaches, sheet.slug).not.toBe("");
      expect(sheet.ages, sheet.slug).toMatch(/^Ages /);
    }
  });

  it("shelves every sheet exactly once", () => {
    const shelved = spellingShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(SPELLING_SHEETS.length);
    expect(spellingShelf().every((group) => group.sheets.length > 0)) //
      .toBe(true);
    expect(SPELLING_GROUPS).toHaveLength(spellingShelf().length);
  });

  it("covers the whole of what the story asked for", () => {
    // The five spelling styles the story names, the sight-word trio, and a page
    // for every word-study topic — so each of them is a thing a parent can print
    // rather than a thing the engine can do.
    const styles = SPELLING_SHEETS.flatMap((sheet) =>
      sheet.config.kind === "words" ? [sheet.config.style] : [],
    );
    for (const style of [
      "copy",
      "missing",
      "abc",
      "shapes",
      "sentence",
      "find",
    ])
      expect(styles, style).toContain(style);

    const topics = SPELLING_SHEETS.flatMap((sheet) =>
      sheet.config.kind === "word-study" ? [sheet.config.topic] : [],
    );
    expect(new Set(topics)).toEqual(new Set(STUDY_TOPICS));

    // Trace, write, find — the three sight-word sheets, one of them ruled.
    const sight = SPELLING_SHEETS.filter((sheet) => sheet.group === "sight");
    expect(sight.map((sheet) => sheet.config.kind)).toEqual(
      expect.arrayContaining(["handwriting", "words"]),
    );
    expect(sight).toHaveLength(3);
  });
});

describe("the sheet on a catalog page", () => {
  it("prints every word and every question it promised", () => {
    for (const sheet of SPELLING_SHEETS) {
      const blocks = built(sheet).blocks;
      const printed = blocks.reduce((total, block) => total + items(block), 0);
      expect(printed, sheet.slug).toBe(promised(sheet.config));
      expect(printed, sheet.slug).toBeGreaterThan(7);
    }
  });

  it("has a title, an instruction and a score box on it", () => {
    for (const sheet of SPELLING_SHEETS) {
      const header = built(sheet).header;
      expect(header.title, sheet.slug).not.toBe("");
      expect(header.instructions, sheet.slug).toBeTruthy();
      // Marked out of what is on the page — except the tracing sheet, which is
      // a handwriting sheet and has nothing anybody can award a mark for.
      if (sheet.config.kind === "handwriting") {
        expect(header.score, sheet.slug).toBeUndefined();
        // And titled after the page it came off rather than after the family
        // that built it: paper headed "Handwriting practice" on a sight-word
        // page is paper that disagrees with the page it was printed from.
        expect(header.title, sheet.slug).toBe(sheet.name);
      } else {
        expect(header.score?.outOf, sheet.slug).toBe(promised(sheet.config));
      }
    }
  });

  it("points back at the game that reads these words aloud", () => {
    for (const sheet of SPELLING_SHEETS) {
      if (sheet.config.kind === "handwriting") continue;
      expect(built(sheet).footer.url, sheet.slug) //
        .toBe("schoolskills.app/spelling/play");
    }
  });

  it("is the same sheet on every build", () => {
    for (const sheet of SPELLING_SHEETS) {
      expect(JSON.stringify(built(sheet)), sheet.slug) //
        .toBe(JSON.stringify(buildSheet(sheet.config, SPELLING_SEED)));
    }
  });

  it("has an answer key exactly where there is an answer to print", () => {
    for (const sheet of SPELLING_SHEETS) {
      const key = answerKey(sheet.config, SPELLING_SEED);
      const blank = built(sheet);
      // The key is the same build with `answers` flipped, never a second
      // generation of the answers — so the two can never disagree (§7).
      expect({ ...key, answers: false, footer: blank.footer }, sheet.slug) //
        .toEqual(blank);

      if (!keyed(sheet)) continue;
      // And where a key is printed, it has something on it the sheet withheld.
      expect(key.answers, sheet.slug).toBe(true);
      expect(key.footer.note, sheet.slug).toBe("Answer key");
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed", () => {
    for (const sheet of SPELLING_SHEETS) {
      const href = builderHref(sheet);
      expect(href.startsWith("/printables/make#s=")).toBe(true);

      const payload = href.slice("/printables/make#s=".length);
      const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
      const shared = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      );
      expect(shared).toEqual({ config: sheet.config, seed: SPELLING_SEED });
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`, exactly as the other catalogs' are; CI builds before it runs the
   * suite.
   */
  it("carries every spelling slug and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/spelling")).toBe(true);
    for (const sheet of SPELLING_SHEETS) {
      expect(found.has(pathFor(sheet)), sheet.slug).toBe(true);
    }
  });
});
