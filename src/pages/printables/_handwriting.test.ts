import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import type { HandwritingConfig, TraceRow } from "@/engine/sheets/types";
import { MODELLED } from "@/engine/sheets/writing/handwriting";

import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import {
  HANDWRITING_GROUPS,
  HANDWRITING_SEED,
  HANDWRITING_SHEETS,
  builderHref,
  configFor,
  handwritingShelf,
  hrefFor,
} from "./_handwriting";

/**
 * The handwriting catalog, held to the three things a catalog page has to be —
 * and to the one thing only this family has to be.
 *
 * **It has to be a worksheet.** Every entry is prerendered as the page a parent
 * lands on (§8), so an entry whose config produces an empty page is a URL in the
 * sitemap with nothing on it.
 *
 * **It has to be curated.** No two entries print the same sheet, no two answer
 * the same query, and every one carries prose somebody wrote.
 *
 * **It has to be reachable.** Every slug in the sitemap, and every slug distinct
 * from the two catalogs that share the prefix.
 *
 * **And it has to print everything it promised.** A count is a request
 * everywhere else in the shop, capped at what the page holds. Here the content
 * is not a count but a set — the alphabet, the ten numerals, a poem — and a
 * page that quietly dropped `y` and `z` off the bottom would teach twenty-four
 * letters while looking exactly like a sheet that teaches twenty-six.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const UPPER = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Everything the sheet writes, worked out from the config and not from the family. */
function promised(config: HandwritingConfig): string[] {
  switch (config.style) {
    case "numbers":
      return [..."0123456789"];
    case "words":
      return config.words ?? [];
    case "passage":
      return (config.text ?? "").split(/\s+/).filter((word) => word !== "");
    default:
      switch (config.letters ?? "both") {
        case "upper":
          return UPPER;
        case "lower":
          return UPPER.map((letter) => letter.toLowerCase());
        default:
          return UPPER.map((letter) => `${letter}${letter.toLowerCase()}`);
      }
  }
}

/** Everything that is actually printed on it, empty places dropped. */
function printed(config: HandwritingConfig): string[] {
  const rows = buildSheet(config, HANDWRITING_SEED).blocks.flatMap(
    (block): TraceRow[] => (block.kind === "trace" ? block.rows : []),
  );
  return rows.flatMap((row) =>
    row.cells.map((cell) => cell.text).filter((text) => text !== ""),
  );
}

describe("the handwriting catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of HANDWRITING_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(HANDWRITING_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      HANDWRITING_SHEETS.length,
    );
  });

  it("never claims a path that paper or maths already prints on", () => {
    // Three route patterns over one prefix. They only coexist because the paths
    // they emit are disjoint; the day they are not, Astro has two routes for
    // one URL and picks one of them.
    const taken = new Set([
      ...PAPER_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => `/printables/${paperPath(sheet, stock)}`),
      ),
      ...MATHS_SHEETS.map((sheet) => mathsPath(sheet)),
    ]);
    for (const sheet of HANDWRITING_SHEETS) {
      for (const stock of STOCKS) {
        expect(taken.has(hrefFor(sheet, stock)), sheet.slug).toBe(false);
      }
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = HANDWRITING_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = HANDWRITING_SHEETS.map((sheet) =>
      JSON.stringify(sheet.config),
    );
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of HANDWRITING_SHEETS) {
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
    const shelved = handwritingShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(HANDWRITING_SHEETS.length);
    expect(handwritingShelf().every((group) => group.sheets.length > 0)) //
      .toBe(true);
    expect(HANDWRITING_GROUPS).toHaveLength(handwritingShelf().length);
  });

  it("covers the whole of what the story asked for", () => {
    // Letters in both cases, numerals, words and a passage — one page each, so
    // that "trace, then copy, then write" is a thing a parent can print rather
    // than a thing the engine can do.
    const styles = HANDWRITING_SHEETS.map((sheet) => sheet.config.style);
    expect(new Set(styles)).toEqual(
      new Set(["letters", "numbers", "words", "passage"]),
    );
    const cases = HANDWRITING_SHEETS.filter(
      (sheet) => sheet.config.style === "letters",
    ).map((sheet) => sheet.config.letters);
    expect(new Set(cases)).toEqual(new Set(["both", "upper", "lower"]));
  });
});

describe("the sheet on a catalog page", () => {
  it("prints every letter, numeral, word and line it promised", () => {
    // The check this family needs and the maths one doesn't: the content is a
    // set rather than a count, so "as many as fit" is not an acceptable answer.
    for (const sheet of HANDWRITING_SHEETS) {
      for (const stock of STOCKS) {
        const config = configFor(sheet, stock.id);
        const on = printed(config);
        // A passage is checked word by word, because the family decides where
        // the lines break and the page must still hold all of the poem.
        const words =
          config.style === "passage"
            ? on.flatMap((line) => line.split(/\s+/))
            : on;
        for (const thing of promised(config)) {
          expect(words, `${sheet.slug} on ${stock.id}`).toContain(thing);
        }
      }
    }
  });

  it("walks the child from a model to an empty line, on every page", () => {
    // Trace, then copy, then write, in one assertion: every catalog sheet has a
    // solid model to look at, something to trace, and a place where nobody is
    // helping.
    for (const sheet of HANDWRITING_SHEETS) {
      const [block] = buildSheet(sheet.config, HANDWRITING_SEED).blocks;
      expect(block.kind, sheet.slug).toBe("trace");
      if (block.kind !== "trace") continue;
      const styles = new Set(
        block.rows.flatMap((row) => row.cells.map((cell) => cell.style)),
      );
      expect(styles.has("solid"), `${sheet.slug} has a model`).toBe(true);
      expect(styles.has("none"), `${sheet.slug} has an empty place`).toBe(true);
      expect(
        [...styles].some((style) => MODELLED.has(style)),
        `${sheet.slug} has something to trace`,
      ).toBe(true);
    }
  });

  it("has a title and an instruction on it", () => {
    for (const sheet of HANDWRITING_SHEETS) {
      const built = buildSheet(sheet.config, HANDWRITING_SEED);
      expect(built.header.title, sheet.slug).not.toBe("");
      expect(built.header.instructions, sheet.slug).toBeTruthy();
      // Nothing to mark: there is no right answer on a handwriting sheet, so a
      // score box would be a number nobody can award.
      expect(built.header.score, sheet.slug).toBeUndefined();
    }
  });

  it("is the same sheet on every build, and its own answer key", () => {
    for (const sheet of HANDWRITING_SHEETS) {
      expect(JSON.stringify(buildSheet(sheet.config, HANDWRITING_SEED))).toBe(
        JSON.stringify(buildSheet(sheet.config, HANDWRITING_SEED)),
      );
      // The model is already printed, which is the whole exercise — so the key
      // is the sheet, exactly as it is for blank paper.
      expect(
        JSON.stringify(answerKey(sheet.config, HANDWRITING_SEED)),
        sheet.slug,
      ).toBe(JSON.stringify(buildSheet(sheet.config, HANDWRITING_SEED)));
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed, on the right stock", () => {
    for (const sheet of HANDWRITING_SHEETS) {
      for (const stock of STOCKS) {
        const href = builderHref(sheet, stock);
        expect(href.startsWith("/printables/make#s=")).toBe(true);

        const payload = href.slice("/printables/make#s=".length);
        const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
        const shared = JSON.parse(
          atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
        );
        expect(shared).toEqual({
          config: configFor(sheet, stock.id),
          seed: HANDWRITING_SEED,
        });
      }
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`, exactly as the maths one is; CI builds before it runs the suite.
   */
  it("carries every handwriting slug, on both stocks, and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/handwriting")).toBe(true);
    for (const sheet of HANDWRITING_SHEETS) {
      for (const stock of STOCKS) {
        expect(found.has(hrefFor(sheet, stock)), sheet.slug).toBe(true);
      }
    }
  });
});
