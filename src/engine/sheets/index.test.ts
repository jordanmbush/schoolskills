import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "./index";
import { SHEET_FAMILIES, sheetFamily } from "./families";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, UNKNOWN_SHEET } from "./spec";
import { DEFAULT_PAPER } from "./paper";
import type { BlankConfig, SheetConfig } from "./types";

const config = (over: Partial<BlankConfig> = {}): SheetConfig => ({
  kind: "blank",
  paper: DEFAULT_PAPER,
  fontPt: 12,
  fields: ["name", "date"],
  ...over,
});

describe("the registry", () => {
  it("routes a kind to its family", () => {
    expect(sheetFamily("blank")?.label).toBe("Blank page");
    expect(describeSheet(config())).toBe("A blank page");
  });

  it("answers for a kind this build has never heard of, rather than throwing", () => {
    // A config from a URL somebody bookmarked in March has to open in June,
    // after the family it named was renamed. Same promise as `deckSpec`.
    expect(sheetSpec("long-division-2027")).toBe(UNKNOWN_SHEET);
    const sheet = sheetSpec("long-division-2027").build(config(), 1);
    expect(sheet.blocks).toEqual([]);
    expect(sheet.header.title).toBe("Sheet unavailable");
  });

  it("is not fooled by a kind that names something on Object.prototype", () => {
    // `kind` comes from a URL or a saved sheet, so it can be any string at all.
    // A plain `SHEETS[kind] ?? UNKNOWN_SHEET` hands back the inherited function
    // for these three — truthy, not a spec — and `buildSheet` throws.
    for (const kind of ["toString", "constructor", "valueOf"]) {
      expect(sheetSpec(kind)).toBe(UNKNOWN_SHEET);
      const stale = { ...config(), kind } as SheetConfig;
      expect(() => buildSheet(stale, 1)).not.toThrow();
      expect(buildSheet(stale, 1).header.title).toBe("Sheet unavailable");
    }
  });

  it("falls back to Letter when the saved config has no paper at all", () => {
    // The one config the engine treats as untrusted: it came from outside this
    // build, so the field its type promises may not be there.
    const stale = { kind: "gone" } as unknown as SheetConfig;
    expect(UNKNOWN_SHEET.build(stale, 7).paper).toEqual(DEFAULT_PAPER);
  });

  it("has a module behind every family it offers", () => {
    // The picker names all twenty-seven before any of them has loaded, so a
    // loader pointing at a path that no longer exports what it says would stay
    // invisible until a parent picked that family. This door has awaited every
    // one of them by the time the suite runs.
    for (const { id } of SHEET_FAMILIES) {
      expect(sheetSpec(id), id).not.toBe(UNKNOWN_SHEET);
    }
  });

  it("prints in the world every sheet prints in", () => {
    const specs = SHEET_FAMILIES.map((family) => sheetSpec(family.id));
    for (const spec of [...specs, UNKNOWN_SHEET]) {
      expect(spec.world).toBe(SHEET_WORLD);
    }
  });

  it("lists what this build can make", () => {
    expect(SHEET_FAMILIES.map((family) => family.id)).toContain("blank");
  });
});

describe("buildSheet", () => {
  it("is a pure function of its config and seed", () => {
    // Three features rest on this, not one (§7): the answer key is the same
    // build, "another sheet like this one" is seed + 1, and a shared URL
    // reproduces a sheet because the seed travels in it.
    for (const seed of [0, 1, 4242]) {
      const once = buildSheet(config(), seed);
      const twice = buildSheet(config(), seed);
      expect(once).not.toBe(twice);
      expect(once).toEqual(twice);
    }
  });

  it("stays deterministic across papers, margins and options", () => {
    const variants: SheetConfig[] = [
      config(),
      config({
        paper: { size: "a4", orientation: "landscape", margin: "wide" },
      }),
      config({ title: "Story paper", instructions: "Write about your week." }),
      config({ fields: [] }),
    ];
    for (const variant of variants) {
      expect(buildSheet(variant, 9)).toEqual(buildSheet(variant, 9));
    }
  });

  it("carries the seed into the footer, which is what makes it repeatable", () => {
    expect(buildSheet(config(), 12_345).footer.seed).toBe(12_345);
    expect(buildSheet(config(), 12_346).footer.seed).toBe(12_346);
  });

  it("prints the name line blank, because it has nothing to fill it with", () => {
    const sheet = buildSheet(config(), 1);
    // A `HeaderField` is a marker, not a value: a config has nowhere to put a
    // child's name, which is what §1 means by print-blank by default.
    expect(sheet.header.fields).toEqual(["name", "date"]);
    expect(sheet.header).not.toHaveProperty("name");
  });

  it("sizes the page from geometry, not from a guess", () => {
    // Letter, half-inch margins: 11in less 1in of margin is 10in of content,
    // less the 1¼in the header and footer reserve. A4 wide: 11.693in less 2in
    // of margin, less the same 1¼in. The block fits *inside* the chrome.
    const letter = buildSheet(config(), 1).blocks[0];
    const a4 = buildSheet(
      config({
        paper: { size: "a4", orientation: "portrait", margin: "wide" },
      }),
      1,
    ).blocks[0];
    expect(letter).toEqual({ kind: "spacer", height: 8750 });
    expect(a4).toEqual({ kind: "spacer", height: 8443 });
  });

  it("carries the type size onto the sheet, where a renderer can reach it", () => {
    // §17's larger type is a config option, so it has to arrive at the output:
    // a renderer is handed a Sheet and nothing else. Two configs that differ
    // only in fontPt must not build the same sheet.
    expect(buildSheet(config({ fontPt: 18 }), 1).fontPt).toBe(18);
    expect(buildSheet(config({ fontPt: 18 }), 1)).not.toEqual(
      buildSheet(config({ fontPt: 12 }), 1),
    );
  });

  it("credits the site on every sheet, including the retired one", () => {
    // §19: the credit is a constant in the engine and prints on every sheet,
    // and §16 makes the URL the way back from paper to the games.
    for (const sheet of [
      buildSheet(config(), 1),
      UNKNOWN_SHEET.build(config(), 1),
    ]) {
      expect(sheet.footer).toMatchObject({
        credit: SHEET_CREDIT,
        url: SHEET_URL,
      });
    }
  });
});

describe("answerKey", () => {
  it("is the same build, keyed — never a second generation", () => {
    const spec = sheetSpec("blank");
    expect(answerKey(config(), 3)).toEqual(spec.key(spec.build(config(), 3)));
  });

  it("is deterministic too", () => {
    expect(answerKey(config(), 3)).toEqual(answerKey(config(), 3));
  });

  it("leaves a sheet with nothing to answer exactly as it was", () => {
    expect(answerKey(config(), 3)).toEqual(buildSheet(config(), 3));
  });
});
