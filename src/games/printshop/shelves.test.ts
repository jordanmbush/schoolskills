import { describe, expect, it } from "vitest";

import { SHEET_FAMILIES } from "@/engine/sheets/families";

import { SHELVES, labelOf, shelfOf, tabOf } from "./shelves";

const shelved = SHELVES.flatMap((shelf) => shelf.families.map((f) => f.id));

describe("the chooser's shelves", () => {
  it("put every family the engine makes on exactly one shelf", () => {
    for (const family of SHEET_FAMILIES) {
      expect(
        shelved.filter((id) => id === family.id),
        `${family.id} on the shelves`,
      ).toHaveLength(1);
    }
  });

  it("name no family the engine doesn't make", () => {
    const known = new Set(SHEET_FAMILIES.map((family) => family.id));
    for (const id of shelved) expect(known.has(id), id).toBe(true);
  });

  it("find a family's shelf, and fall back to the first for a stranger", () => {
    expect(shelfOf("arithmetic").label).toBe("Maths");
    expect(shelfOf("handwriting").label).toBe("Handwriting");
    expect(shelfOf("no-such-family")).toBe(SHELVES[0]);
  });

  it("give every family but blank paper a tab of its own", () => {
    for (const family of SHEET_FAMILIES) {
      if (family.id === "blank") expect(tabOf(family.id)).toBeUndefined();
      else expect(tabOf(family.id), family.id).toBeTruthy();
    }
    expect(tabOf("no-such-family")).toBeUndefined();
  });

  it("read a family by the registry's own label", () => {
    expect(labelOf("arithmetic")).toBe("Addition and subtraction");
    expect(labelOf("no-such-family")).toMatch(/can't make/);
  });
});
