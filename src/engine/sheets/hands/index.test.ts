import { describe, expect, it } from "vitest";

import { CURSIVE } from "./cursive";
import { CURSIVE_MODERN } from "./cursive-modern";
import { CURSIVE_UK } from "./cursive-uk";
import { handOf } from "./index";
import { PRINT } from "./print";

describe("handOf", () => {
  it("writes each face in its own hand", () => {
    expect(handOf("print")).toBe(PRINT);
    expect(handOf("cursive")).toBe(CURSIVE);
    expect(handOf("cursive-modern")).toBe(CURSIVE_MODERN);
    expect(handOf("cursive-uk")).toBe(CURSIVE_UK);
  });

  it("has no hand for the dyslexia face, which keeps the outline row", () => {
    expect(handOf("dyslexic")).toBeUndefined();
  });

  it("reads an absent face as the print face, as the rest of the sheet does", () => {
    // `faceOf` is what decides this, so a sheet saved with no `font` traces and
    // writes in the same face.
    expect(handOf(undefined)).toBe(PRINT);
  });
});
