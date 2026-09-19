import { describe, expect, it } from "vitest";

import { expectedReach, fused, readDrawing, strokesOf } from "./drawing.mjs";
import { absolute } from "./path.mjs";

const HAND = {
  id: "test",
  ascent: 1000,
  xHeight: 500,
  descent: -500,
  bearing: 60,
  reach: { tall: "bdfhkl", threeQuarter: "t", tail: "gjpqy" },
};

/** A template as `hand-template.mjs` writes one: origin 150, baseline 1150. */
const template = (stem, strokes, extra = "") =>
  `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
  viewBox="0 0 900 1800" data-hand="test" data-glyph="${stem}" data-units="1000" data-origin="150" data-baseline="1150">
  <g inkscape:groupmode="layer" id="ruling" inkscape:label="ruling">
    <path d="M 0 1150 L 900 1150"/>
  </g>
  <g inkscape:groupmode="layer" id="strokes" inkscape:label="strokes"${extra}>
${strokes}
  </g>
</svg>`;

describe("strokesOf", () => {
  it("reads only the strokes layer, in document order", () => {
    const svg = template(
      "l",
      `    <path d="M 200 150 L 200 1150"/>\n    <path d="M 100 650 L 300 650"/>`,
    );
    const paths = strokesOf(svg, "l.svg");
    expect(paths).toHaveLength(2);
    expect(paths[0][0]).toEqual({ type: "M", points: [200, 150] });
    expect(paths[1][1]).toEqual({ type: "L", points: [300, 650] });
  });

  it("applies the transform of the layer and of every group inside it", () => {
    const svg = template(
      "l",
      `    <g transform="translate(0 100)"><path transform="scale(2)" d="M 100 100 L 100 200"/></g>`,
      ` transform="translate(10 0)"`,
    );
    const [path] = strokesOf(svg, "l.svg");
    expect(path[0].points).toEqual([210, 300]);
    expect(path[1].points).toEqual([210, 500]);
  });

  it("names the file when the layer is missing", () => {
    expect(() => strokesOf("<svg></svg>", "a.svg")).toThrow(
      /a\.svg: no "strokes"/,
    );
  });
});

describe("readDrawing", () => {
  it("turns y over, sets the bearings and takes the advance from the ink", () => {
    // A stem drawn from the top line to the baseline at template x=400.
    const svg = template("l", `    <path d="M 400 150 L 400 1150"/>`);
    const { character, glyph } = readDrawing(HAND, svg, "l.svg");
    expect(character).toBe("l");
    expect(glyph.strokes).toEqual(["M 60 1000 L 60 0"]);
    expect(glyph.advance).toBe(120);
  });

  it("reads relative and shorthand path data as the same stroke", () => {
    const absolute = readDrawing(
      HAND,
      template("t", `    <path d="M 300 400 L 300 1150 M 200 650 L 400 650"/>`),
      "t.svg",
    );
    const relative = readDrawing(
      HAND,
      template("t", `    <path d="m 300 400 v 750 m -100 -500 h 200"/>`),
      "t.svg",
    );
    expect(relative.glyph).toEqual(absolute.glyph);
  });

  it("keeps a capital's file stem apart from the small letter's", () => {
    const svg = template("A_", `    <path d="M 200 150 L 400 1150"/>`);
    expect(readDrawing(HAND, svg, "A_.svg").character).toBe("A");
  });

  it("warns, and does not fail, on a letter that stops short of its line", () => {
    const warnings = [];
    // An `l` drawn only to the midline.
    const svg = template("l", `    <path d="M 200 650 L 200 1150"/>`);
    readDrawing(HAND, svg, "l.svg", warnings);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/reaches 500/);
  });

  it("refuses what cannot be a glyph", () => {
    expect(() => readDrawing(HAND, template("l", ""), "l.svg")).toThrow(
      /nothing drawn/,
    );
    expect(() =>
      readDrawing(
        HAND,
        template("l", `    <path d="M 0 0 L 0 1150"/>`),
        "l.svg",
      ),
    ).toThrow(/off the ruling/);
    expect(() =>
      readDrawing(
        HAND,
        template("l", `    <path d="M 200 150 L 200 1150 Z"/>`),
        "l.svg",
      ),
    ).toThrow(/closed path/);
    expect(() =>
      readDrawing(
        HAND,
        template("what", `    <path d="M 200 150 L 200 1150"/>`),
        "what.svg",
      ),
    ).toThrow(/names table/);
    expect(() =>
      readDrawing(
        HAND,
        `<svg><g inkscape:label="strokes"><path d="M 0 0 L 1 1"/></g></svg>`,
        "l.svg",
      ),
    ).toThrow(/not a template/);
  });
});

describe("expectedReach", () => {
  it("sends a capital to the top line, and below the baseline only when the table lists it", () => {
    expect(expectedReach(HAND, "A")).toEqual({ top: 1000, bottom: 0 });
    const cursive = { ...HAND, reach: { ...HAND.reach, tail: "gjpqyJ" } };
    expect(expectedReach(cursive, "J")).toEqual({ top: 1000, bottom: -500 });
    expect(expectedReach(cursive, "A")).toEqual({ top: 1000, bottom: 0 });
  });

  it("knows the four kinds of letter and says nothing of punctuation", () => {
    expect(expectedReach(HAND, "l")).toEqual({ top: 1000, bottom: 0 });
    expect(expectedReach(HAND, "t")).toEqual({ top: 750, bottom: 0 });
    expect(expectedReach(HAND, "g")).toEqual({ top: 500, bottom: -500 });
    expect(expectedReach(HAND, "a")).toEqual({ top: 500, bottom: 0 });
    expect(expectedReach(HAND, "A")).toEqual({ top: 1000, bottom: 0 });
    expect(expectedReach(HAND, "7")).toEqual({ top: 1000, bottom: 0 });
    expect(expectedReach(HAND, ".")).toBeNull();
  });
});

describe("readDrawing, for a letter that joins", () => {
  const drawn = (stem, top) =>
    template(
      stem,
      `    <path inkscape:label="body" d="M 150 1150 L 150 ${top} L 400 1150"/>
    <path inkscape:label="tail" d="M 400 1150 L 500 900"/>`,
    );

  it("marks a capital's join as initial: nothing joins into one", () => {
    expect(readDrawing(HAND, drawn("A_", 150), "A_.svg").glyph.join).toEqual({
      lead: 0,
      tail: 1,
      initial: true,
    });
    expect(readDrawing(HAND, drawn("n", 650), "n.svg").glyph.join).toEqual({
      lead: 0,
      tail: 1,
    });
  });
});

describe("readDrawing, for a letter drawn in more than one form", () => {
  const hand = { ...HAND, forms: { t: ["curved", "straight"] } };
  const stem = `    <path d="M 400 400 L 400 1150"/>`;

  it("reads the form off the drawing's id", () => {
    const { character, form } = readDrawing(
      hand,
      template("t.straight", stem),
      "t.straight.svg",
    );
    expect(character).toBe("t");
    expect(form).toBe("straight");
    expect(
      readDrawing(hand, template("l", stem), "l.svg").form,
    ).toBeUndefined();
  });

  it("refuses a form the hand does not list, and a listed letter drawn without one", () => {
    expect(() =>
      readDrawing(hand, template("t.curly", stem), "t.curly.svg"),
    ).toThrow(/t\.curly\.svg: "curly" is not a form/);
    expect(() =>
      readDrawing(hand, template("l.curved", stem), "l.curved.svg"),
    ).toThrow(
      /l\.curved\.svg: hand\.json does not list a "curved" form of "l"/,
    );
    expect(() => readDrawing(hand, template("t", stem), "t.svg")).toThrow(
      /t\.svg: "t" is drawn in more than one form; name this one t\.curved\.svg/,
    );
  });
});

describe("fused", () => {
  const path = (name, d) => ({ name, segments: absolute(d) });

  it("leaves a drawing with no named part alone", () => {
    const paths = [
      path(undefined, "M 0 0 L 1 1"),
      path("path2", "M 2 2 L 3 3"),
    ];
    const { strokes, join } = fused(paths, "l.svg");
    expect(strokes).toHaveLength(2);
    expect(join).toBeUndefined();
  });

  it("fuses lead, top, body and tail into the first stroke and counts them", () => {
    const paths = [
      path("lead", "M 0 0 L 10 10"),
      path("top", "M 10 10 C 11 11 12 12 13 13"),
      path("body", "M 13 13 L 20 20 L 30 30"),
      path("tail", "M 30 30 L 40 40"),
      path("dot", "M 5 50 L 6 50"),
    ];
    const { strokes, join } = fused(paths, "a.svg");
    expect(strokes).toHaveLength(2);
    expect(strokes[0].map((s) => s.type).join("")).toBe("MLCLLL");
    expect(join).toEqual({ lead: 1, top: 1, tail: 1 });
  });

  it("counts a missing lead-in or tail as none", () => {
    const { join } = fused(
      [path("body", "M 0 0 L 1 1"), path("tail", "M 1 1 L 2 2 L 3 3")],
      "n.svg",
    );
    expect(join).toEqual({ lead: 0, tail: 2 });
    const { join: noTail } = fused(
      [path("lead", "M 0 0 L 1 1"), path(undefined, "M 1 1 L 2 2")],
      "b.svg",
    );
    expect(noTail).toEqual({ lead: 1, tail: 0 });
  });

  it("refuses a part that does not meet the one before it", () => {
    expect(() =>
      fused(
        [path("lead", "M 0 0 L 10 10"), path(undefined, "M 20 10 L 30 30")],
        "i.svg",
      ),
    ).toThrow(
      /i\.svg: "the body" starts at 20,10 but the part before it ends at 10,10/,
    );
  });

  it("finds the joining stroke after one written first, and says which it is", () => {
    const { strokes, join } = fused(
      [
        path("stroke-1", "M 0 0 L 0 10"),
        path("body", "M 5 10 L 0 5 L 5 0"),
        path("tail", "M 5 0 L 8 3"),
      ],
      "K_.svg",
    );
    expect(strokes).toHaveLength(2);
    expect(strokes[1].map((s) => s.type).join("")).toBe("MLLL");
    expect(join).toEqual({ lead: 0, tail: 1, stroke: 1 });
  });

  it("refuses a part out of order", () => {
    expect(() =>
      fused(
        [
          path("lead", "M 0 0 L 1 1"),
          path("body", "M 1 1 L 2 2"),
          path("dot", "M 5 5 L 6 6"),
          path("tail", "M 2 2 L 3 3"),
        ],
        "i.svg",
      ),
    ).toThrow(/"tail" is out of place/);
    expect(() =>
      fused(
        [path("lead", "M 0 0 L 1 1"), path("tail", "M 1 1 L 2 2")],
        "i.svg",
      ),
    ).toThrow(/needs a body/);
  });
});
