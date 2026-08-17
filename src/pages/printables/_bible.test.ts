import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { passage, passageText } from "@/engine/sheets/passages";
import type { Blank, PaperSize, TraceRow } from "@/engine/sheets/types";

import {
  BIBLE_GROUPS,
  BIBLE_SEED,
  BIBLE_SHEETS,
  STOCKS,
  bibleShelf,
  builderHref,
  configFor,
  creditFor,
  hrefFor,
  keyed,
  type BibleSheet,
} from "./_bible";
import { PAPER_SHEETS, pathFor as paperPath } from "./_catalog";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";

/**
 * The Scripture catalog, held to what every catalog page has to be — and to the
 * two things only this one has to be.
 *
 * **It has to be a worksheet**, prerendered as the page a parent lands on (§8),
 * **curated**, and **reachable**: no two entries print the same sheet, no two
 * answer the same query, and no slug collides with the four catalogs that share
 * the prefix.
 *
 * **It has to print the whole passage.** A count is a request capped at what
 * fits everywhere else in the shop. A verse is not a count: a copywork sheet
 * that quietly dropped the last clause off the bottom of the page would be
 * quoting a translation wrongly while looking exactly like one that didn't.
 *
 * **It has to say where the words came from.** The credit line is a condition
 * of the WEB's name rather than a courtesy (§12), so it is on the sheet, and it
 * is read off the passage rather than typed onto the page.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/**
 * The passage as a sheet prints it, whichever family printed it.
 *
 * Distinct lines in the order they first appear, because a copywork sheet
 * writes each line two or three times over — a model, a trace and an empty
 * place — and a straight read of the rows would interleave the repeats. What is
 * being checked is that the passage is on the page and in one piece; how many
 * times each line of it is written is the handwriting family's own suite.
 */
function printed(sheet: BibleSheet, size: PaperSize): string {
  const built = buildSheet(configFor(sheet, size), BIBLE_SEED);
  const rows = built.blocks.flatMap((block): TraceRow[] =>
    block.kind === "trace" ? block.rows : [],
  );
  const sentences = built.blocks.flatMap((block): Blank[] =>
    block.kind === "blanks" ? block.sentences : [],
  );
  const lines = [
    ...rows.flatMap((row) => row.cells.map((cell) => cell.text)),
    ...sentences.map((sentence) => sentence.text),
  ].filter((line) => line !== "");
  return [...new Set(lines)].join(" ").replace(/\s+/g, " ");
}

describe("the Scripture catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of BIBLE_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(BIBLE_SHEETS.map((sheet) => sheet.slug)).size) //
      .toBe(BIBLE_SHEETS.length);
  });

  it("never claims a path one of the other four shelves already prints on", () => {
    // Five route patterns over one prefix. They only coexist because the paths
    // they emit are disjoint; the day they are not, Astro has two routes for
    // one URL and picks one of them.
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
    ]);
    for (const sheet of BIBLE_SHEETS) {
      for (const stock of STOCKS) {
        expect(taken.has(hrefFor(sheet, stock)), sheet.slug).toBe(false);
      }
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = BIBLE_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = BIBLE_SHEETS.map((sheet) =>
      JSON.stringify(configFor(sheet, "letter")),
    );
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of BIBLE_SHEETS) {
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
    const shelved = bibleShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(BIBLE_SHEETS.length);
    expect(bibleShelf().every((group) => group.sheets.length > 0)).toBe(true);
    expect(BIBLE_GROUPS).toHaveLength(bibleShelf().length);
  });

  it("covers the whole of what the story asked for", () => {
    // Copywork at more than one ruling and more than one trace style, and the
    // memory sheet — the three things §12 says Scripture goes into.
    const rules = new Set(
      BIBLE_SHEETS.map((sheet) => sheet.config).flatMap((config) =>
        config.kind === "handwriting" ? [JSON.stringify(config.rule)] : [],
      ),
    );
    expect(rules.size).toBeGreaterThanOrEqual(4);
    const kinds = new Set(BIBLE_SHEETS.map((sheet) => sheet.config.kind));
    expect(kinds).toEqual(new Set(["handwriting", "memory"]));
  });
});

describe("the sheet on a catalog page", () => {
  it("quotes the library, and quotes all of it", () => {
    // The whole passage, on both stocks, in order and word for word. A verse
    // with its last clause below the bottom margin is a misquotation that looks
    // exactly like a sheet — which is the failure this shelf cannot have.
    for (const sheet of BIBLE_SHEETS) {
      const words = passageText(passage(sheet.passage)!).replace(/\s+/g, " ");
      for (const stock of STOCKS) {
        expect(printed(sheet, stock.id), `${sheet.slug} on ${stock.id}`) //
          .toContain(words);
      }
    }
  });

  it("names the passage on the paper and credits it at the foot", () => {
    for (const sheet of BIBLE_SHEETS) {
      const built = buildSheet(configFor(sheet, "letter"), BIBLE_SEED);
      const quoted = passage(sheet.passage)!;
      expect(built.header.title, sheet.slug).toContain(quoted.title);
      expect(built.header.instructions, sheet.slug).toBeTruthy();
      // §12: the credit is the engine's constant, on the sheet and on the page.
      expect(built.footer.source, sheet.slug).toBe(quoted.credit);
      expect(creditFor(sheet), sheet.slug).toBe(quoted.credit);
      expect(creditFor(sheet), sheet.slug).toContain("public domain");
    }
  });

  it("keys a memory sheet with the whole passage, and nothing else at all", () => {
    for (const sheet of BIBLE_SHEETS) {
      const config = configFor(sheet, "letter");
      const key = answerKey(config, BIBLE_SEED);
      if (!keyed(sheet)) {
        // Copywork's model is already printed, so its key is its own sheet —
        // and the page behind it would be a second copy of the same paper.
        expect(JSON.stringify(key), sheet.slug) //
          .toBe(JSON.stringify(buildSheet(config, BIBLE_SEED)));
        continue;
      }
      expect(key.answers, sheet.slug).toBe(true);
      expect(key.footer.source, sheet.slug).toBe(creditFor(sheet));
      // Every gap on the key is filled from the words that came out, so the
      // marked-up page reads as the passage itself.
      const [block] = key.blocks;
      expect(block.kind).toBe("blanks");
      if (block.kind !== "blanks") continue;
      const whole = passageText(passage(sheet.passage)!).replace(/\s+/g, " ");
      for (const sentence of block.sentences) {
        let at = 0;
        const filled = sentence.text
          .split(" ")
          .map((word) => (word === "_" ? sentence.answers[at++] : word))
          .join(" ");
        expect(filled, sheet.slug).toBe(whole);
      }
      // And the blank sheet says the words are missing on purpose.
      expect(
        buildSheet(config, BIBLE_SEED).header.instructions,
        sheet.slug,
      ).toContain("left out");
    }
  });

  it("is the same sheet on every build", () => {
    for (const sheet of BIBLE_SHEETS) {
      const config = configFor(sheet, "letter");
      expect(JSON.stringify(buildSheet(config, BIBLE_SEED))).toBe(
        JSON.stringify(buildSheet(config, BIBLE_SEED)),
      );
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed, on the right stock", () => {
    for (const sheet of BIBLE_SHEETS) {
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
          seed: BIBLE_SEED,
        });
        // The passage travels as an id, which is the whole reason a copywork
        // sheet fits in a link at all (§14).
        expect(shared.config.passage).toBe(sheet.passage);
        expect(href.length).toBeLessThan(600);
      }
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`, exactly as the other shelves' are; CI builds before it runs.
   */
  it("carries every Scripture slug, on both stocks, and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/bible")).toBe(true);
    for (const sheet of BIBLE_SHEETS) {
      for (const stock of STOCKS) {
        expect(found.has(hrefFor(sheet, stock)), sheet.slug).toBe(true);
      }
    }
  });
});
