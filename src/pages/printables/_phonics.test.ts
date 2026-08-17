import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import {
  WORD_BY_SPELLING,
  readInventory,
  wordSounds,
} from "@/engine/sheets/phonics";
import { PHONICS_STYLES } from "@/engine/sheets/phonics/sheets";
import type { Block } from "@/engine/sheets/types";

import { BIBLE_SHEETS, hrefFor as bibleHref } from "./_bible";
import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { GRAMMAR_SHEETS, pathFor as grammarPath } from "./_grammar";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import {
  PHONICS_GROUPS,
  PHONICS_SEED,
  PHONICS_SHEETS,
  builderHref,
  keyed,
  pathFor,
  phonicsShelf,
  type PhonicsSheet,
} from "./_phonics";
import { SPELLING_SHEETS, pathFor as spellingPath } from "./_spelling";

/**
 * The phonics catalog, held to the four things a catalog page has to be — and
 * to the one promise this shelf exists to make.
 *
 * **It has to be a worksheet.** Every entry is prerendered as the page a parent
 * lands on (§8), so an entry whose config produces an empty page is a URL in
 * the sitemap with nothing on it.
 *
 * **It has to print everything it promised.** The prose says "twenty" in as
 * many words, and a sheet that quietly dropped four off the bottom would look
 * exactly like a sheet that didn't.
 *
 * **It has to be curated**, and **it has to be reachable** — no two entries
 * printing the same sheet or answering the same query, every slug in the
 * sitemap and distinct from the six catalogs sharing the prefix.
 *
 * **And nothing on any of these pages may use a spelling its own inventory
 * does not hold.** That is checked here as well as in the engine, and on
 * purpose: the engine's suite proves the family keeps the promise for any
 * inventory, and this one proves the seven inventories somebody wrote by hand
 * are ones it keeps it for.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

/** How many things a block puts on the paper, whichever kind it is. */
function items(block: Block): number {
  if (block.kind === "problems") return block.items.length;
  if (block.kind === "cards") return block.cards.length;
  if (block.kind === "matching") return block.left.length;
  return 0;
}

/** Every whole word a block printed, however it printed it. */
function words(block: Block): string[] {
  if (block.kind === "problems")
    return block.items.map((item) => item.answer).filter(Boolean);
  if (block.kind === "matching") return block.right;
  if (block.kind === "cards")
    return block.cards.flatMap((card) =>
      card.big
        .map((part) => part.text)
        .join("")
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter(Boolean),
    );
  return [];
}

/** Everything the prose puts in curly quotes. */
const QUOTED = /“([^”]+)”/g;

/**
 * How long a quotation has to be before it is read as a claim about the sheet.
 *
 * The same house rule the grammar shelf keeps, and for the same reason: the
 * page IS the sheet, so a reader can look down it and check. A word or a short
 * phrase is an example of a kind of thing; five words is a sentence somebody is
 * pointing at.
 */
const CLAIMED = 5;

const same = (text: string): string =>
  text
    .trim()
    .replace(/[.?!]$/, "")
    .toLowerCase();

const built = (sheet: PhonicsSheet) => buildSheet(sheet.config, PHONICS_SEED);

describe("the phonics catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of PHONICS_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(PHONICS_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      PHONICS_SHEETS.length,
    );
  });

  it("never claims a path another shelf already prints on", () => {
    // Eight route patterns over one prefix. They only coexist because the paths
    // they emit are disjoint; the day they are not, Astro has two routes for
    // one URL and picks one of them.
    const taken = new Set<string>([
      ...PAPER_SHEETS.flatMap((sheet) =>
        STOCKS.map((stock) => `/printables/${paperPath(sheet, stock)}`),
      ),
      ...MATHS_SHEETS.map((sheet) => mathsPath(sheet)),
      ...SPELLING_SHEETS.map((sheet) => spellingPath(sheet)),
      ...GRAMMAR_SHEETS.map((sheet) => grammarPath(sheet)),
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
    for (const sheet of PHONICS_SHEETS) {
      expect(taken.has(pathFor(sheet)), sheet.slug).toBe(false);
    }
  });

  it("shows every kind of sheet the family can make", () => {
    // Seven styles, seven pages. A style with no page is a sheet a parent can
    // only find by opening the builder and reading a dropdown, which is the
    // opposite of what a catalog is for.
    expect(new Set(PHONICS_SHEETS.map((sheet) => sheet.config.style))).toEqual(
      new Set(PHONICS_STYLES),
    );
  });

  it("answers a different query on every page", () => {
    const keywords = PHONICS_SHEETS.map((sheet) => sheet.keyword.toLowerCase());
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of PHONICS_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      for (const note of sheet.notes)
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(100);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(60);
    }
  });

  it("shelves every sheet exactly once", () => {
    const shelved = phonicsShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(PHONICS_SHEETS.length);
    for (const group of PHONICS_GROUPS)
      expect(
        PHONICS_SHEETS.some((sheet) => sheet.group === group.id),
        group.id,
      ).toBe(true);
  });
});

describe("the sheet on a catalog page", () => {
  it("prints something on every page", () => {
    for (const sheet of PHONICS_SHEETS) {
      const printed = built(sheet);
      expect(printed.blocks, sheet.slug).toHaveLength(1);
      expect(items(printed.blocks[0]), sheet.slug).toBeGreaterThan(0);
    }
  });

  it("prints everything the config asked for", () => {
    // The prose counts these out in words — "twenty short words", "eight
    // sentences" — so a page that quietly fitted fewer would be a page telling
    // a reader something they can disprove by looking at it.
    for (const sheet of PHONICS_SHEETS) {
      expect(items(built(sheet).blocks[0]), sheet.slug).toBe(
        sheet.config.count,
      );
    }
  });

  it("uses no spelling the page's own inventory does not hold", () => {
    // The promise, re-derived from the finished sheet: every word read back off
    // the paper, looked up in the bank, and its spellings compared with the
    // ticked ids. A card's example word is the table's own mnemonic rather than
    // something to decode, which is why the cards and the chart are read for
    // their spellings instead (below).
    for (const sheet of PHONICS_SHEETS) {
      if (sheet.config.style === "cards" || sheet.config.style === "chart")
        continue;
      const inventory = readInventory(sheet.config.inventory);
      for (const word of words(built(sheet).blocks[0])) {
        const entry = WORD_BY_SPELLING.get(word);
        expect(entry, `${sheet.slug} · ${word}`).toBeDefined();
        const decodable = (entry?.parts ?? []).every((part) =>
          inventory.sounds.includes(part),
        );
        expect(
          decodable || inventory.tricky.includes(word),
          `${sheet.slug} · ${word}`,
        ).toBe(true);
      }
    }
  });

  it("keeps a page that says how long a word may be to it", () => {
    // The CVC page is the one entry that names a length, and its prose is a
    // claim a reader can disprove by looking at the sheet under it — "three
    // sounds at most" over a page with `camp` and `stop` on it. Counted in
    // sounds off the bank rather than in letters, which is the rule the copy
    // states: `box` is three letters and four sounds and is not on the page.
    for (const sheet of PHONICS_SHEETS) {
      const cap = sheet.config.maxSounds;
      if (cap === undefined) continue;
      const printed = words(built(sheet).blocks[0]);
      expect(printed.length, sheet.slug).toBeGreaterThan(0);
      for (const word of printed) {
        const entry = WORD_BY_SPELLING.get(word);
        expect(entry, `${sheet.slug} · ${word}`).toBeDefined();
        expect(
          wordSounds(entry!).length,
          `${sheet.slug} · ${word}`,
        ).toBeLessThanOrEqual(cap);
      }
    }
  });

  it("quotes only what the sheet under the prose really prints", () => {
    for (const sheet of PHONICS_SHEETS) {
      const printed = words(built(sheet).blocks[0]).map(same);
      const prose = [sheet.lead, sheet.summary, ...sheet.notes];
      for (const [, quote] of prose.join(" ").matchAll(QUOTED)) {
        if (quote.trim().split(/\s+/).length < CLAIMED) continue;
        const wanted = same(quote);
        expect(
          printed.join(" ").includes(wanted),
          `${sheet.slug} quotes “${quote}”, which it does not print`,
        ).toBe(true);
      }
    }
  });

  it("has a title and an instruction on it, and a score only where marked", () => {
    for (const sheet of PHONICS_SHEETS) {
      const printed = built(sheet);
      expect(printed.header.title, sheet.slug).toBeTruthy();
      expect(printed.header.instructions, sheet.slug).toBeTruthy();
      expect(printed.header.score !== undefined, sheet.slug).toBe(keyed(sheet));
    }
  });

  it("is the same sheet on every build", () => {
    for (const sheet of PHONICS_SHEETS) {
      expect(built(sheet), sheet.slug).toEqual(built(sheet));
    }
  });

  it("keys the pages that withhold an answer, and only those", () => {
    for (const sheet of PHONICS_SHEETS) {
      const printed = built(sheet);
      const key = answerKey(sheet.config, PHONICS_SEED);
      expect(key.blocks, sheet.slug).toEqual(printed.blocks);
      // A page of cards, a wall chart and a page of sentences withhold nothing,
      // so printing the same page twice under the word "key" would be noise.
      expect(keyed(sheet), sheet.slug).toBe(
        !["cards", "chart", "sentences"].includes(sheet.config.style),
      );
    }
  });

  it("ships no inventory that names a course", () => {
    // Not a shape a test can check on its own, so what it checks is the thing
    // that would make one possible: every entry's inventory is one of the two
    // written down in `_phonics.ts`, both of which are described by what is in
    // them rather than by where a child is meant to be.
    const seen = new Set(
      PHONICS_SHEETS.map((sheet) =>
        readInventory(sheet.config.inventory).sounds.join(","),
      ),
    );
    expect(seen.size).toBe(2);
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed", () => {
    for (const sheet of PHONICS_SHEETS) {
      const href = builderHref(sheet);
      expect(href.startsWith("/printables/make#s="), sheet.slug).toBe(true);
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
  it("carries every phonics slug and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/phonics")).toBe(true);
    for (const sheet of PHONICS_SHEETS) {
      expect(found.has(pathFor(sheet)), sheet.slug).toBe(true);
    }
  });
});
