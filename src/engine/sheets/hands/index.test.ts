import { describe, expect, it } from "vitest";

import { CURSIVE } from "./cursive";
import { handOf } from "./index";
import { PRINT } from "./print";

describe("handOf", () => {
  it("writes the print face in the print hand and the looped face in the cursive one", () => {
    expect(handOf("print")).toBe(PRINT);
    expect(handOf("cursive")).toBe(CURSIVE);
  });

  it("has no hand for the other faces, which keep the outline row", () => {
    for (const font of ["cursive-modern", "cursive-uk", "dyslexic"] as const) {
      expect(handOf(font), font).toBeUndefined();
    }
  });

  it("reads an absent face as the print face, as the rest of the sheet does", () => {
    // `faceOf` is what decides this, so a sheet saved with no `font` traces and
    // writes in the same face.
    expect(handOf(undefined)).toBe(PRINT);
  });
});
