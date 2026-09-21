import { describe, expect, it } from "vitest";

import type { SheetConfig } from "@/engine/sheets/types";

import { defaultConfig } from "./defaults";
import { headingLine, letteringLine, paperLine } from "./summary";

const base = defaultConfig("arithmetic");
const tuned = (patch: Partial<SheetConfig>): SheetConfig =>
  ({ ...base, ...patch }) as SheetConfig;

describe("the lines a closed step shows", () => {
  it("say the paper, and only what was changed about it", () => {
    expect(paperLine(base)).toBe("Letter, portrait");
    expect(
      paperLine(
        tuned({
          paper: { size: "a4", orientation: "landscape", margin: "narrow" },
          cutLines: true,
        }),
      ),
    ).toBe("A4, landscape, narrow margins, cut lines");
    expect(
      paperLine(
        tuned({
          paper: { size: "legal", orientation: "portrait", margin: "none" },
        }),
      ),
    ).toBe("Legal, portrait, no margins");
  });

  it("say the type size and the face, and whether letter shapes were chosen", () => {
    expect(letteringLine(base)).toBe("12 pt, Print");
    expect(letteringLine(tuned({ fontPt: 14, font: "cursive" }))).toBe(
      "14 pt, Cursive, looped",
    );
    expect(
      letteringLine(tuned({ font: "cursive", forms: { a: "double" } })),
    ).toBe("12 pt, Cursive, looped, letter shapes chosen");
  });

  it("say the lines to fill in, and the title where there is one", () => {
    expect(headingLine(base)).toBe("Name, date");
    expect(headingLine(tuned({ fields: ["name", "date", "class"] }))).toBe(
      "Name, date, class",
    );
    expect(headingLine(tuned({ fields: [] }))).toBe("No lines to fill in");
    expect(headingLine(tuned({ title: "Friday tables" }))).toBe(
      "“Friday tables”, name, date",
    );
  });
});
