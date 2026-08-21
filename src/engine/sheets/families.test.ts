import { describe, expect, it } from "vitest";

import {
  SHEET_FAMILIES,
  loadSheet,
  loadedSheet,
  sheetFamily,
} from "./families";
import { UNKNOWN_SHEET } from "./spec";

/**
 * The family table: what the picker reads before anything has loaded, and the
 * loader the bench reaches a family through.
 *
 * `index.ts` is tested separately and awaits every entry here, so a loader
 * pointing at a module that doesn't export what it says fails over there. What
 * this file covers is the half `index.ts` never uses: what a kind from outside
 * this build gets back, and that a family is fetched once.
 */

describe("the family table", () => {
  it("names every family exactly once", () => {
    const ids = SHEET_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size).toBe(ids.length);
    const labels = SHEET_FAMILIES.map((family) => family.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("is not fooled by a kind that names something on Object.prototype", () => {
    // Same untrusted `kind` the registry guards against, and the reason the
    // table is a Map: `{}["toString"]` is a function, truthy, and not a family.
    for (const kind of ["toString", "constructor", "valueOf"]) {
      expect(sheetFamily(kind)).toBeUndefined();
    }
    expect(sheetFamily("blank")?.label).toBe("Blank page");
  });
});

describe("fetching one", () => {
  it("answers a kind this build has never heard of, rather than rejecting", async () => {
    // A shared link bookmarked in March, opened in June, after its family was
    // renamed. Same promise `sheetSpec` makes.
    await expect(loadSheet("long-division-2027")).resolves.toBe(UNKNOWN_SHEET);
  });

  it("is nothing until it is here, and then the same module every time", async () => {
    expect(loadedSheet("memory")).toBeUndefined();

    const spec = await loadSheet("memory");
    expect(loadedSheet("memory")).toBe(spec);
    // One module, however many times it is asked for — the second ask is not a
    // second copy of the passage library.
    expect(await loadSheet("memory")).toBe(spec);
  });
});
