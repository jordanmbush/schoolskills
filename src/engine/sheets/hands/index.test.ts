import { describe, expect, it } from "vitest";

import { handOf } from "./index";
import { PRINT } from "./print";

describe("handOf", () => {
  it("writes the print face in the print hand", () => {
    expect(handOf("print")).toBe(PRINT);
  });

  it("has no hand for the other faces, which keep the outline row", () => {
    for (const font of [
      "cursive",
      "cursive-modern",
      "cursive-uk",
      "dyslexic",
    ] as const) {
      expect(handOf(font), font).toBeUndefined();
    }
  });

  it("reads an absent face as the print face, as the rest of the sheet does", () => {
    // `faceOf` is what decides this, so a sheet saved with no `font` traces and
    // writes in the same face.
    expect(handOf(undefined)).toBe(PRINT);
  });
});
