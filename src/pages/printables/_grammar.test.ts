import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { GRAMMAR_TOPICS } from "@/engine/sheets/grammar/grammar";
import type { Block } from "@/engine/sheets/types";

import { BIBLE_SHEETS, hrefFor as bibleHref } from "./_bible";
import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import {
  GRAMMAR_GROUPS,
  GRAMMAR_SEED,
  GRAMMAR_SHEETS,
  builderHref,
  grammarShelf,
  pathFor,
  type GrammarSheet,
} from "./_grammar";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import { SPELLING_SHEETS, pathFor as spellingPath } from "./_spelling";

/**
 * The grammar catalog, held to the four things a catalog page has to be — and
 * to a fifth this shelf adds.
 *
 * **It has to be a worksheet.** Every entry is prerendered as the page a parent
 * lands on (§8), so an entry whose config produces an empty page is a URL in the
 * sitemap with nothing on it.
 *
 * **It has to print everything it promised.** The prose says "twelve sentences"
 * in as many words, and a sheet that quietly dropped two off the bottom would
 * look exactly like a sheet that didn't. So every entry is checked against its
 * own config rather than against the family's cap.
 *
 * **It has to be curated.** No two entries print the same sheet, no two answer
 * the same query, and every one carries prose somebody wrote.
 *
 * **It has to be reachable.** Every slug in the sitemap, and every slug distinct
 * from the six catalogs that share the prefix.
 *
 * **And it has to have a key on every page.** This is the shelf where being
 * wrong costs the most, and it is also the shelf with no sheet that legitimately
 * has nothing to mark — no copying page, no write-your-own-sentence page. A
 * grammar sheet without a key would be a page of judgements with nobody to
 * settle them.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** How many things a block puts on the paper, whichever kind it is. */
function items(block: Block): number {
  if (block.kind === "problems") return block.items.length;
  if (block.kind === "choice") return block.questions.length;
  return 0;
}

/** What a block printed, in the words a reader sees down the page. */
function prompts(block: Block): string[] {
  if (block.kind === "problems") return block.items.map((item) => item.prompt);
  if (block.kind === "choice") return block.questions.map((one) => one.prompt);
  return [];
}

/** Everything the prose puts in curly quotes. */
const QUOTED = /“([^”]+)”/g;

/**
 * How long a quotation has to be before it is read as a claim about the sheet.
 *
 * The prose quotes two different things. A word or a phrase is an example of a
 * *kind* of sentence — “Close the gate”, “What a mess” — and is deliberately
 * one the sheet does not print. A whole sentence is the page itself being
 * pointed at. Five words is the line between them, and it is a house rule of
 * `_grammar.ts` rather than a fact about English: keep a hypothetical short.
 */
const CLAIMED = 5;

/** A quotation and a prompt compared as the same sentence. */
const same = (text: string): string =>
  text
    .trim()
    .replace(/[.?!]$/, "")
    .toLowerCase();

const built = (sheet: GrammarSheet) => buildSheet(sheet.config, GRAMMAR_SEED);

describe("the grammar catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(GRAMMAR_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      GRAMMAR_SHEETS.length,
    );
  });

  it("never claims a path another shelf already prints on", () => {
    // Seven route patterns over one prefix. They only coexist because the paths
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
      ...SPELLING_SHEETS.map((sheet) => spellingPath(sheet)),
    ]);
    for (const sheet of GRAMMAR_SHEETS) {
      expect(taken.has(pathFor(sheet)), sheet.slug).toBe(false);
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = GRAMMAR_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = GRAMMAR_SHEETS.map((sheet) => JSON.stringify(sheet.config));
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of GRAMMAR_SHEETS) {
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
    const shelved = grammarShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(GRAMMAR_SHEETS.length);
    expect(grammarShelf().every((group) => group.sheets.length > 0)).toBe(true);
    expect(GRAMMAR_GROUPS).toHaveLength(grammarShelf().length);
  });

  it("covers the whole of what the story asked for", () => {
    // Parts of speech, subject and predicate, sentence types, punctuation and
    // capitalisation — one page each, so every one of them is a thing a parent
    // can print rather than a thing the engine can do.
    const topics = GRAMMAR_SHEETS.map((sheet) => sheet.config.topic);
    expect(new Set(topics)).toEqual(new Set(GRAMMAR_TOPICS));
    expect(topics).toHaveLength(GRAMMAR_TOPICS.length);
  });
});

describe("the sheet on a catalog page", () => {
  it("prints every sentence it promised", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      const printed = built(sheet).blocks.reduce(
        (total, block) => total + items(block),
        0,
      );
      expect(printed, sheet.slug).toBe(sheet.config.count);
      expect(printed, sheet.slug).toBeGreaterThan(7);
    }
  });

  it("quotes only sentences the sheet printed under the prose says", () => {
    // The page IS the sheet (§8), so a note that quotes a sentence is telling a
    // reader to look down the page and find it. A quotation can be a real bank
    // sentence and still not be in this page's draw. Nothing but a test keeps
    // the two together, because what breaks it is a count or a seed moving, and
    // neither looks like prose.
    for (const sheet of GRAMMAR_SHEETS) {
      const printed = built(sheet).blocks.flatMap(prompts).map(same);
      const prose = [sheet.lead, sheet.summary, ...sheet.notes];
      for (const [, quote] of prose.join(" ").matchAll(QUOTED)) {
        if (quote.trim().split(/\s+/).length < CLAIMED) continue;
        const wanted = same(quote);
        expect(
          printed.some((prompt) => prompt.includes(wanted)),
          `${sheet.slug} quotes “${quote}”, which it does not print`,
        ).toBe(true);
      }
    }
  });

  it("has a title, an instruction and a score box on it", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      const header = built(sheet).header;
      expect(header.title, sheet.slug).not.toBe("");
      expect(header.instructions, sheet.slug).toBeTruthy();
      expect(header.score?.outOf, sheet.slug).toBe(sheet.config.count);
    }
  });

  it("is the same sheet on every build", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      expect(JSON.stringify(built(sheet)), sheet.slug) //
        .toBe(JSON.stringify(buildSheet(sheet.config, GRAMMAR_SEED)));
    }
  });

  it("has an answer key on every page, and it is the same build keyed", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      const key = answerKey(sheet.config, GRAMMAR_SEED);
      const blank = built(sheet);
      // The key is the same build with `answers` flipped, never a second
      // generation of the answers — so the two can never disagree (§7).
      expect({ ...key, answers: false, footer: blank.footer }, sheet.slug) //
        .toEqual(blank);
      expect(key.answers, sheet.slug).toBe(true);
      expect(key.footer.note, sheet.slug).toBe("Answer key");
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed", () => {
    for (const sheet of GRAMMAR_SHEETS) {
      const href = builderHref(sheet);
      expect(href.startsWith("/printables/make#s=")).toBe(true);

      const payload = href.slice("/printables/make#s=".length);
      const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
      const shared = JSON.parse(
        atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      );
      expect(shared).toEqual({ config: sheet.config, seed: GRAMMAR_SEED });
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
  it("carries every grammar slug and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/grammar")).toBe(true);
    for (const sheet of GRAMMAR_SHEETS) {
      expect(found.has(pathFor(sheet)), sheet.slug).toBe(true);
    }
  });
});
