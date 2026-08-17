import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { answerKey, buildSheet } from "@/engine/sheets";
import { CURSIVE_FACES, isCursive } from "@/engine/sheets/faces";
import type {
  HandwritingConfig,
  TraceRow,
  TraceStyle,
} from "@/engine/sheets/types";
import { MODELLED } from "@/engine/sheets/writing/handwriting";
import { JOIN_FAMILIES, joinPairs } from "@/engine/sheets/writing/joins";

import { PAPER_SHEETS, STOCKS, pathFor as paperPath } from "./_catalog";
import { MATHS_SHEETS, pathFor as mathsPath } from "./_maths";
import { HANDWRITING_SHEETS, hrefFor as handwritingHref } from "./_handwriting";
import {
  CURSIVE_GROUPS,
  CURSIVE_MODELS,
  CURSIVE_SEED,
  CURSIVE_SHEETS,
  builderHref,
  configFor,
  cursiveShelf,
  hrefFor,
} from "./_cursive";

/**
 * The cursive catalog, held to what every catalog page has to be — and to the
 * two things only this one has to be.
 *
 * **It has to be joined.** A cursive sheet set in a print face is two letters
 * standing next to each other under an instruction to join them, which is the
 * one mistake this whole shelf exists to prevent. Every sheet declares a
 * cursive model, and the joins sheet resolves one even if a config says
 * otherwise.
 *
 * **It has to print every join it promised.** The content here is a set rather
 * than a count — six families, five pairs each — and a page that quietly
 * dropped the last family off the bottom would teach five sixths of the joins
 * while looking exactly like a sheet that teaches all of them.
 *
 * The rest is what `_handwriting.test.ts` asserts for its own shelf: curated,
 * distinct, reachable, and a real worksheet on both stocks.
 */

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));

const UPPER = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];

/** Everything the sheet writes, worked out from the config and not from the family. */
function promised(config: HandwritingConfig): string[] {
  switch (config.style) {
    case "joins":
      return joinPairs(config.joins);
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
  const rows = buildSheet(config, CURSIVE_SEED).blocks.flatMap(
    (block): TraceRow[] => (block.kind === "trace" ? block.rows : []),
  );
  return rows.flatMap((row) =>
    row.cells.map((cell) => cell.text).filter((text) => text !== ""),
  );
}

describe("the cursive catalog", () => {
  it("is bounded, and every slug is a route somebody could type", () => {
    for (const sheet of CURSIVE_SHEETS) {
      expect(sheet.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
    expect(new Set(CURSIVE_SHEETS.map((sheet) => sheet.slug)).size).toBe(
      CURSIVE_SHEETS.length,
    );
  });

  it("never claims a path another catalog already prints on", () => {
    // Four route patterns over one prefix now. They only coexist because the
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
    ]);
    for (const sheet of CURSIVE_SHEETS) {
      for (const stock of STOCKS) {
        expect(taken.has(hrefFor(sheet, stock)), sheet.slug).toBe(false);
      }
    }
  });

  it("answers a different query on every page", () => {
    const fields = ["keyword", "heading", "name", "short"] as const;
    for (const field of fields) {
      const values = CURSIVE_SHEETS.map((sheet) => sheet[field]);
      expect(new Set(values).size, `duplicate ${field}`).toBe(values.length);
    }
    // And a different query from the print shelf's, which is the whole reason
    // cursive is a catalog rather than a fourth group under handwriting.
    const printed = new Set(HANDWRITING_SHEETS.map((sheet) => sheet.keyword));
    for (const sheet of CURSIVE_SHEETS) {
      expect(printed.has(sheet.keyword), sheet.slug).toBe(false);
    }
  });

  it("prints a different sheet on every page", () => {
    const configs = CURSIVE_SHEETS.map((sheet) => JSON.stringify(sheet.config));
    expect(new Set(configs).size).toBe(configs.length);
  });

  it("carries prose on every page rather than a filled-in template", () => {
    for (const sheet of CURSIVE_SHEETS) {
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
    const shelved = cursiveShelf().flatMap((group) => group.sheets);
    expect(shelved).toHaveLength(CURSIVE_SHEETS.length);
    expect(cursiveShelf().every((group) => group.sheets.length > 0)).toBe(true);
    expect(CURSIVE_GROUPS).toHaveLength(cursiveShelf().length);
  });

  it("covers the whole of what the story asked for", () => {
    // Cursive letters upper and lower, the common joins, words and passages —
    // one page each, so the progression is a thing a parent can print rather
    // than a thing the engine can do.
    const styles = CURSIVE_SHEETS.map((sheet) => sheet.config.style);
    expect(new Set(styles)).toEqual(
      new Set(["letters", "joins", "words", "passage"]),
    );
    const cases = CURSIVE_SHEETS.filter(
      (sheet) => sheet.config.style === "letters",
    ).map((sheet) => sheet.config.letters);
    expect(new Set(cases)).toEqual(new Set(["both", "upper", "lower"]));
  });

  it("shows every trace style there is, across the shelf", () => {
    // The other half of the criterion: five ways of drawing a model, and a
    // shelf that only ever printed dotted ones would be a shelf that says the
    // other four exist without a page a parent can look at.
    const drawn = new Set<TraceStyle>(
      CURSIVE_SHEETS.map((sheet) => sheet.config.trace),
    );
    expect(drawn).toEqual(
      new Set<TraceStyle>(["dotted", "dashed", "hollow", "dim"]),
    );
    // Solid is the first cell of every progression rather than a `trace` value,
    // so it is checked where it is drawn rather than where it is configured.
    for (const sheet of CURSIVE_SHEETS) {
      const [block] = buildSheet(sheet.config, CURSIVE_SEED).blocks;
      const styles =
        block.kind === "trace"
          ? block.rows.flatMap((row) => row.cells.map((cell) => cell.style))
          : [];
      expect(styles, sheet.slug).toContain("solid");
    }
  });

  it("ruled on more than one size of paper", () => {
    // A shelf ruled entirely at ⅝ would print seven copies of one decision. The
    // rulings walk down as the sheets get harder, which is the progression a
    // school follows.
    const rulings = new Set(
      CURSIVE_SHEETS.map((sheet) => sheet.config.rule.style),
    );
    expect(rulings.size).toBeGreaterThanOrEqual(3);
  });
});

describe("a sheet on this shelf is joined", () => {
  it("is set in a cursive model, on every page", () => {
    for (const sheet of CURSIVE_SHEETS) {
      expect(isCursive(sheet.config.font), sheet.slug).toBe(true);
      // And the model survives the build: `present()` copies the config's face
      // onto the sheet, and the renderer sets type from `sheet.font` alone.
      const built = buildSheet(sheet.config, CURSIVE_SEED);
      expect(isCursive(built.font), sheet.slug).toBe(true);
    }
  });

  it("joins a joins sheet even when the config asks for print", () => {
    // The one style that cannot be drawn in the face it was asked for: two
    // letters that do not touch are not a join, whatever the instruction line
    // says. A saved sheet or a hand-edited link can say `print` here, so it is
    // the family that answers rather than the catalog.
    const joins = CURSIVE_SHEETS.find(
      (sheet) => sheet.config.style === "joins",
    )!;
    const built = buildSheet({ ...joins.config, font: "print" }, CURSIVE_SEED);
    expect(isCursive(built.font)).toBe(true);
    // A model that was chosen is kept, though — resolving is not overriding.
    for (const font of CURSIVE_FACES) {
      expect(buildSheet({ ...joins.config, font }, CURSIVE_SEED).font).toBe(
        font,
      );
    }
  });
});

describe("the sheet on a catalog page", () => {
  it("prints every letter, join, word and line it promised", () => {
    // The check this family needs and the maths one doesn't: the content is a
    // set rather than a count, so "as many as fit" is not an acceptable answer.
    for (const sheet of CURSIVE_SHEETS) {
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

  it("prints all six families of join on the joins page", () => {
    const joins = CURSIVE_SHEETS.find(
      (sheet) => sheet.config.style === "joins",
    )!;
    for (const stock of STOCKS) {
      const on = printed(configFor(joins, stock.id));
      for (const family of JOIN_FAMILIES) {
        for (const pair of family.pairs) {
          expect(on, `${family.id} on ${stock.id}`).toContain(pair);
        }
      }
    }
  });

  it("walks the child from a model to an empty line, on every page", () => {
    for (const sheet of CURSIVE_SHEETS) {
      const [block] = buildSheet(sheet.config, CURSIVE_SEED).blocks;
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
    for (const sheet of CURSIVE_SHEETS) {
      const built = buildSheet(sheet.config, CURSIVE_SEED);
      expect(built.header.title, sheet.slug).not.toBe("");
      expect(built.header.instructions, sheet.slug).toBeTruthy();
      // Nothing to mark: there is no right answer on a handwriting sheet, so a
      // score box would be a number nobody can award.
      expect(built.header.score, sheet.slug).toBeUndefined();
    }
  });

  it("is the same sheet on every build, and its own answer key", () => {
    for (const sheet of CURSIVE_SHEETS) {
      expect(JSON.stringify(buildSheet(sheet.config, CURSIVE_SEED))).toBe(
        JSON.stringify(buildSheet(sheet.config, CURSIVE_SEED)),
      );
      expect(
        JSON.stringify(answerKey(sheet.config, CURSIVE_SEED)),
        sheet.slug,
      ).toBe(JSON.stringify(buildSheet(sheet.config, CURSIVE_SEED)));
    }
  });
});

describe("the link into the builder", () => {
  const decode = (href: string) => {
    const payload = href.slice("/printables/make#s=".length);
    const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
    );
  };

  it("opens the bench on the sheet that was printed, on the right stock", () => {
    for (const sheet of CURSIVE_SHEETS) {
      for (const stock of STOCKS) {
        const href = builderHref(sheet, stock);
        expect(href.startsWith("/printables/make#s=")).toBe(true);
        expect(decode(href)).toEqual({
          config: configFor(sheet, stock.id),
          seed: CURSIVE_SEED,
        });
      }
    }
  });

  it("offers all three models, each on a sheet that is already set", () => {
    // The story's own note: the regional models are the hands actually taught,
    // so the choice belongs to the parent. Every one of them has to arrive on
    // the bench as a sheet rather than as a setting to find.
    expect(CURSIVE_MODELS.map((model) => model.font)).toEqual(CURSIVE_FACES);
    const [sheet] = CURSIVE_SHEETS;
    for (const model of CURSIVE_MODELS) {
      const shared = decode(builderHref(sheet, STOCKS[0], model.font));
      expect(shared.config.font, model.label).toBe(model.font);
      expect(model.blurb.length, model.label).toBeGreaterThan(80);
    }
  });
});

describe("the sitemap", () => {
  /*
   * A URL missing from the sitemap is the failure nobody notices — nothing
   * breaks, the page is simply never submitted. Skipped when there is no
   * `dist/`; CI builds before it runs the suite.
   */
  it("carries every cursive slug, on both stocks, and the hub", () => {
    const file = `${ROOT}/dist/sitemap-0.xml`;
    if (!existsSync(file)) return; // `npm run build` hasn't run yet.

    const xml = readFileSync(file, "utf8");
    const found = new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) =>
        new URL(match[1]).pathname.replace(/\/$/, ""),
      ),
    );

    expect(found.has("/printables/cursive")).toBe(true);
    for (const sheet of CURSIVE_SHEETS) {
      for (const stock of STOCKS) {
        expect(found.has(hrefFor(sheet, stock)), sheet.slug).toBe(true);
      }
    }
  });
});
