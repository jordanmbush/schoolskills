import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import type {
  PenmanshipConfig,
  StrokePattern,
  TraceStyle,
} from "@/engine/sheets/types";
import { SPACING_SENTENCES } from "@/engine/sheets/writing/letterfamilies";
import { SPACE_MARK } from "@/engine/sheets/writing/penmanship";
import { LOWER, MODELLED } from "@/engine/sheets/writing/rows";
import { STROKE_PATTERNS } from "@/engine/sheets/writing/strokes";

import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { CURSIVE_SHEETS, hrefFor as cursiveHref } from "./_cursive";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import {
  PENMANSHIP_GROUPS,
  PENMANSHIP_SEED,
  PENMANSHIP_SHEETS,
  builderHref,
  configFor,
  hrefFor,
  penmanshipShelf,
} from "./_penmanship";

/**
 * The penmanship catalog, held to what every catalog page has to be — and to
 * the two things only this one has to be.
 *
 * **It has to print what its prose promises.** The content is a set rather
 * than a count on every style: seven strokes, the whole small alphabet, five
 * sentences, the alphabet once and a box to count in. A page that quietly
 * dropped the tail loops off the bottom, or the words after the letters,
 * would teach part of the thing while looking exactly like a sheet that
 * teaches all of it.
 *
 * **It has to cover the shelf.** Six styles is six problems a page can have
 * after the letters are right, and a catalog that printed four of them would
 * be a shelf that says the other two exist without a page a parent can hold.
 *
 * The rest is what `_handwriting.test.ts` asserts for its own shelf: curated,
 * distinct, reachable, and a real worksheet on both stocks.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const ALPHABET = [...LOWER];

/** The stroke rows drawn, in order, empty rows included. */
function drawn(config: PenmanshipConfig): StrokePattern[] {
  return buildSheet(config, PENMANSHIP_SEED).blocks.flatMap((block) =>
    block.kind === "strokes" ? block.rows.map((row) => row.pattern) : [],
  );
}

/** Everything written on the trace rows, empty places dropped. */
function printed(config: PenmanshipConfig): string[] {
  return buildSheet(config, PENMANSHIP_SEED).blocks.flatMap((block) =>
    block.kind === "trace"
      ? block.rows.flatMap((row) =>
          row.cells.map((cell) => cell.text).filter((text) => text !== ""),
        )
      : [],
  );
}

/** Every cell style on the page, whichever kind of row it is in. */
function styles(config: PenmanshipConfig): Set<TraceStyle> {
  return new Set(
    buildSheet(config, PENMANSHIP_SEED).blocks.flatMap((block) => {
      if (block.kind === "trace") {
        return block.rows.flatMap((row) => row.cells.map((cell) => cell.style));
      }
      if (block.kind === "strokes") {
        return block.rows.flatMap((row) => row.cells);
      }
      return [];
    }),
  );
}

const bySlug = (style: PenmanshipConfig["style"]) =>
  PENMANSHIP_SHEETS.filter((sheet) => sheet.config.style === style);

describe("the penmanship catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of PENMANSHIP_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(PENMANSHIP_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      PENMANSHIP_SHEETS.length,
    );
  });

  it("never claims a path another catalog already prints on", () => {
    // Five route patterns over one prefix. They only coexist because the
    // paths they emit are disjoint; the day they are not, Astro has two routes
    // for one URL and picks one of them.
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
    for (const sheet of PENMANSHIP_SHEETS) {
      for (const stock of STOCKS) {
        expect(taken.has(hrefFor(sheet, stock)), sheet.slug).toBe(false);
      }
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = PENMANSHIP_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
    // And a different query from the two shelves it sits after — "handwriting
    // warm-up" is not "handwriting", and a loops sheet is not the cursive one.
    const theirs = new Set(
      [...HANDWRITING_SHEETS, ...CURSIVE_SHEETS].map((sheet) => sheet.keyword),
    );
    for (const sheet of PENMANSHIP_SHEETS) {
      expect(theirs.has(sheet.keyword), sheet.slug).toBe(false);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = PENMANSHIP_SHEETS.map((sheet) =>
      JSON.stringify(sheet.config),
    );
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of PENMANSHIP_SHEETS) {
      expect(sheet.notes.length, sheet.slug).toBeGreaterThanOrEqual(2);
      for (const note of sheet.notes) {
        expect(note.length, sheet.slug).toBeGreaterThan(200);
      }
      expect(sheet.lead.length, sheet.slug).toBeGreaterThan(80);
      expect(sheet.summary.length, sheet.slug).toBeGreaterThan(40);
      expect(sheet.teaches, sheet.slug).not.toBe("");
      expect(sheet.ages, sheet.slug).toMatch(/^Ages \d+–\d+$/);
    }
  });

  it("shelves every sheet exactly once", () => {
    const shelved = penmanshipShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(PENMANSHIP_SHEETS.length);
    expect(penmanshipShelf().every((group) => group.sheets.length > 0)) //
      .toBe(true);
    expect(PENMANSHIP_GROUPS).toHaveLength(penmanshipShelf().length);
  });

  it("covers all six styles", () => {
    const styled = new Set(
      PENMANSHIP_SHEETS.map((sheet) => sheet.config.style),
    );
    expect(styled).toEqual(
      new Set(["strokes", "families", "sizes", "spacing", "check", "fluency"]),
    );
  });

  it("ruled on more than one size of paper", () => {
    // The rulings walk down as the sheets get harder — ¾ for a three-year-old
    // drawing lines, ⅜ for a ten-year-old against the clock — which is the
    // progression a school follows.
    const rulings = new Set(
      PENMANSHIP_SHEETS.map((sheet) => sheet.config.rule.style),
    );
    expect(rulings.size).toBeGreaterThanOrEqual(3);
  });
});

describe("the sheet on a catalog page", () => {
  it("draws every stroke it promised, as many rows as it promised", () => {
    // A tail loop on a ruling with no room under the baseline is dropped by
    // the family rather than drawn through the row below — so this is also
    // the check that every ruling chosen here has that room.
    for (const sheet of bySlug("strokes")) {
      const asked =
        sheet.config.patterns ?? STROKE_PATTERNS.map((set) => set.id);
      for (const stock of STOCKS) {
        const rows = drawn(configFor(sheet, stock.id));
        for (const pattern of asked) {
          expect(
            rows.filter((row) => row === pattern),
            `${sheet.slug} on ${stock.id}: ${pattern}`,
          ).toHaveLength(sheet.config.lines ?? 1);
        }
        expect(new Set(rows), `${sheet.slug} on ${stock.id}`).toEqual(
          new Set(asked),
        );
      }
    }
  });

  it("prints all twenty-six small letters on the families, sizes and check pages", () => {
    for (const sheet of [
      ...bySlug("families"),
      ...bySlug("sizes"),
      ...bySlug("check"),
    ]) {
      for (const stock of STOCKS) {
        const on = printed(configFor(sheet, stock.id));
        for (const letter of ALPHABET) {
          expect(on, `${sheet.slug} on ${stock.id}`).toContain(letter);
        }
      }
    }
  });

  it("prints every word of every sentence on the spacing page", () => {
    // The model row carries a dot in place of each space, so it is split on
    // the dot as well as on whitespace — every word has to be there in both
    // the row with the dots and the row without them.
    for (const sheet of bySlug("spacing")) {
      for (const stock of STOCKS) {
        const words = new Set(
          printed(configFor(sheet, stock.id)).flatMap((line) =>
            line.split(new RegExp(`[${SPACE_MARK}\\s]+`)),
          ),
        );
        for (const sentence of SPACING_SENTENCES) {
          for (const word of sentence.split(" ")) {
            expect(words.has(word), `${sheet.slug} on ${stock.id}: ${word}`) //
              .toBe(true);
          }
        }
      }
    }
  });

  it("prints the alphabet once, then a box to count in, on the timed page", () => {
    for (const sheet of bySlug("fluency")) {
      for (const stock of STOCKS) {
        const built = buildSheet(configFor(sheet, stock.id), PENMANSHIP_SEED);
        const model = built.blocks
          .flatMap((block) => (block.kind === "trace" ? block.rows : []))
          .flatMap((row) => row.cells)
          .filter((cell) => cell.style === "solid")
          .map((cell) => cell.text)
          .join("");
        expect(model, `${sheet.slug} on ${stock.id}`).toBe(LOWER);
        // One page and never more: the prose says so, and "as many as you
        // can" is measured against the paper in front of the child.
        expect(
          built.blocks.map((block) => block.kind),
          `${sheet.slug} on ${stock.id}`,
        ).toEqual(["trace", "note"]);
      }
    }
  });

  it("walks the child from a model to an empty place, on every page", () => {
    // Every page has a solid model and somewhere nobody is helping. The traced
    // pages have something to trace between the two; the check and timed
    // pages must not, because their prose says there is nothing to trace and
    // a dotted letter is not the child's own.
    for (const sheet of PENMANSHIP_SHEETS) {
      for (const stock of STOCKS) {
        const on = styles(configFor(sheet, stock.id));
        const where = `${sheet.slug} on ${stock.id}`;
        expect(on.has("solid"), `${where} has a model`).toBe(true);
        expect(on.has("none"), `${where} has an empty place`).toBe(true);
        const traced = [...on].some((style) => MODELLED.has(style));
        const judged =
          sheet.config.style === "check" || sheet.config.style === "fluency";
        expect(
          traced,
          `${where} ${judged ? "has nothing" : "has something"} to trace`,
        ) //
          .toBe(!judged);
      }
    }
  });

  it("has a title and an instruction on it", () => {
    for (const sheet of PENMANSHIP_SHEETS) {
      const built = buildSheet(sheet.config, PENMANSHIP_SEED);
      expect(built.header.title, sheet.slug).not.toBe("");
      expect(built.header.instructions, sheet.slug).toBeTruthy();
      // Nothing to mark: there is no right answer on a penmanship sheet, so a
      // score box would be a number nobody can award.
      expect(built.header.score, sheet.slug).toBeUndefined();
    }
  });

  it("is the same sheet on every build, and its own answer key", () => {
    for (const sheet of PENMANSHIP_SHEETS) {
      expect(JSON.stringify(buildSheet(sheet.config, PENMANSHIP_SEED))).toBe(
        JSON.stringify(buildSheet(sheet.config, PENMANSHIP_SEED)),
      );
      // The model is already printed, which is the whole exercise — so the key
      // is the sheet, exactly as it is for handwriting.
      expect(
        JSON.stringify(answerKey(sheet.config, PENMANSHIP_SEED)),
        sheet.slug,
      ).toBe(JSON.stringify(buildSheet(sheet.config, PENMANSHIP_SEED)));
    }
  });
});

describe("the link into the builder", () => {
  it("opens the bench on the sheet that was printed, on the right stock", () => {
    for (const sheet of PENMANSHIP_SHEETS) {
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
          seed: PENMANSHIP_SEED,
        });
      }
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`, exactly as the handwriting one is; CI builds before it runs the
   * suite.
   */
  it("carries every penmanship slug, on both stocks, and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/penmanship")).toBe(true);
    for (const sheet of PENMANSHIP_SHEETS) {
      for (const stock of STOCKS) {
        expect(found.has(hrefFor(sheet, stock)), sheet.slug).toBe(true);
      }
    }
  });
});
