import { describe, expect, it } from "vitest";

import { answerKey, buildSheet, describeSheet, sheetSpec } from "../index";
import { figureBox, figureRow } from "../figure";
import { BLOCK_GAP, PROBLEM_GAP } from "../layout";
import type {
  Figure,
  GeometryConfig,
  GridSpec,
  MarginSize,
  Paper,
  PaperSize,
  Point,
  Problem,
} from "../types";

import { GEOMETRY_SHEET, geometryLayout } from "./geometry";

/**
 * Shape and space, held to the bar the maths families set.
 *
 * **Nothing here checks the generator against the generator.** The family works
 * forwards — from a pair of numbers to a figure and an answer — and every check
 * below works backwards from what is *printed*: the shape is recognised by
 * counting the corners it was drawn with, its measurements are read off the
 * labels, its angles are recovered with `atan2`, and the answers are recomputed
 * by repeated addition. There is no multiplication in this file.
 *
 * That makes one thing testable that a worksheet site usually leaves to review:
 * **the drawing has to agree with the labels.** A rectangle labelled 8 by 3 and
 * drawn 8 by 4 has a right answer and a lying picture, and the scale check below
 * is what catches it — every labelled edge has to have been drawn at the same
 * number of mil per centimetre, or the figure is out of proportion.
 *
 * The angles go further, because an angle is drawn at life size: a sheet that
 * called something obtuse is checked by measuring the ink.
 */

/* ── Configs ───────────────────────────────────────────────────────────── */

const paper = (over: Partial<Paper> = {}): Paper => ({
  size: "letter",
  orientation: "portrait",
  margin: "normal",
  ...over,
});

const config = (over: Partial<GeometryConfig> = {}): GeometryConfig => ({
  kind: "geometry",
  paper: paper(),
  fontPt: 12,
  fields: ["name", "date"],
  style: "area",
  system: "metric",
  range: { min: 2, max: 12 },
  count: 9,
  columns: 3,
  ...over,
});

/**
 * Every shape the family can print: area, perimeter and volume in both
 * systems, angles, shape names, and the coordinate plane in one quadrant and
 * in four.
 */
const EVERY_SHAPE: Array<Partial<GeometryConfig>> = [
  {},
  { system: "imperial" },
  { style: "perimeter" },
  { style: "perimeter", system: "imperial" },
  { style: "volume", count: 12 },
  { style: "volume", system: "imperial", count: 12 },
  { style: "angles" },
  { style: "identify" },
  { style: "coordinates", count: 8 },
  { style: "coordinates", quadrants: 4, count: 8 },
  { range: { min: 1, max: 4 }, count: 6 },
  { style: "perimeter", range: { min: 3, max: 20 }, count: 6 },
  { workspace: true, count: 6 },
  { style: "volume", workspace: true, count: 8 },
];

const SEEDS = [0, 1, 2, 7, 4242];

/** The problems of a sheet, whichever block they landed in. */
function problemsOf(over: Partial<GeometryConfig>, seed: number): Problem[] {
  for (const block of buildSheet(config(over), seed).blocks) {
    if (block.kind === "problems") return block.items;
  }
  throw new Error("no problems on the sheet");
}

/** And the plane above them, on the one style that has one. */
function gridOf(over: Partial<GeometryConfig>, seed: number): GridSpec {
  for (const block of buildSheet(config(over), seed).blocks) {
    if (block.kind === "grid") return block.grid;
  }
  throw new Error("no grid on the sheet");
}

/** The figure a problem carries, or a failure — every shape sheet has one. */
function figureOf(problem: Problem): Figure {
  if (!problem.figure) throw new Error(`no figure on "${problem.answer}"`);
  return problem.figure;
}

/* ── Reading a drawing the way a protractor does ─────────────────────────── */

/** `a` added to itself `b` times — the only multiplication in this file. */
function repeated(a: number, b: number): number {
  const [each, times] = a > b ? [a, b] : [b, a];
  let total = 0;
  for (let step = 0; step < times; step += 1) total += each;
  return total;
}

/** How long a drawn edge is, in mil. */
const spans = (from: Point, to: Point): number =>
  Math.hypot(to.x - from.x, to.y - from.y);

/** Every drawn edge of a closed figure, in the order the points are given. */
const drawnSides = (figure: Figure): number[] =>
  figure.points.map((point, index) =>
    spans(point, figure.points[(index + 1) % figure.points.length]),
  );

type Measured = { value: number; unit: string };

/** A label as it is printed, split back into a number and a unit. */
function labelOf(text: string): Measured {
  const written = /^(\d+) ([a-z]+)$/.exec(text.trim());
  if (!written) throw new Error(`not a measurement: "${text}"`);
  return { value: Number(written[1]), unit: written[2] };
}

/** The measurements on a figure, in edge order, with the gaps left as gaps. */
const measurements = (figure: Figure): Array<Measured | null> =>
  (figure.labels ?? []).map((text) => (text === "" ? null : labelOf(text)));

/**
 * How many mil the figure was drawn at, per unit of every edge that carries a
 * measurement.
 *
 * The whole of the proportion check: a shape drawn 8 by 4 and labelled 8 by 3
 * comes back with two different numbers here, and a shape drawn honestly comes
 * back with one.
 */
const scales = (figure: Figure): number[] => {
  const sides = drawnSides(figure);
  return measurements(figure).flatMap((measured, edge) =>
    measured === null ? [] : [sides[edge] / measured.value],
  );
};

/** The angle at the vertex of an angle figure, in degrees, from the ink. */
function angleOf(figure: Figure): number {
  const [first, vertex, second] = figure.points;
  const turn = (point: Point) =>
    Math.atan2(point.y - vertex.y, point.x - vertex.x);
  const between = Math.abs(((turn(second) - turn(first)) * 180) / Math.PI);
  return between > 180 ? 360 - between : between;
}

/** The angle at one corner of a closed figure, in degrees. */
function cornerOf(figure: Figure, index: number): number {
  const corners = figure.points;
  const at = corners[index];
  const before = corners[(index + corners.length - 1) % corners.length];
  const after = corners[(index + 1) % corners.length];
  return angleOf({
    shape: "angle",
    points: [before, at, after],
  });
}

/** What a drawn angle is called, from the four names a child is taught. */
const named = (degrees: number): string =>
  degrees > 179.5
    ? "straight"
    : degrees > 90.5
      ? "obtuse"
      : degrees > 89.5
        ? "right"
        : "acute";

/** Whether every drawn side is the same length, within the rounding to mil. */
const equalSided = (figure: Figure): boolean => {
  const sides = drawnSides(figure);
  return Math.max(...sides) - Math.min(...sides) < 2;
};

/** How far apart the largest and smallest of a set are, as a proportion. */
const spread = (values: number[]): number =>
  Math.max(...values) / Math.min(...values);

/**
 * What a problem asks, as one string — read off the drawing rather than off the
 * fields, because on four of these sheets the drawing *is* the question.
 *
 * Two angles at forty degrees are one question however far round either of them
 * has been turned, and a child notices that faster than the adult who printed
 * it.
 */
const question = (problem: Problem): string => {
  const figure = problem.figure;
  const drawing = !figure
    ? ""
    : figure.shape === "angle"
      ? `${Math.round(angleOf(figure))}°`
      : `${figure.points.length}:${(figure.labels ?? []).join("/")}`;
  return `${problem.prompt}|${problem.answer}|${drawing}`;
};

/* ── The registry ──────────────────────────────────────────────────────── */

describe("the geometry family", () => {
  it("is in the registry under the kind its config carries", () => {
    expect(sheetSpec("geometry")).toBe(GEOMETRY_SHEET);
    expect(sheetSpec("geometry").label).toBe("Shape and space");
  });

  it("names the sheet in the words a parent chose it by", () => {
    expect(describeSheet(config())).toBe(
      "Area of rectangles and triangles — sides to 12 — in cm and m",
    );
    expect(describeSheet(config({ style: "perimeter", system: "imperial" }))) //
      .toBe(
        "Perimeter of rectangles and triangles — sides to 12 — in in and ft",
      );
    expect(describeSheet(config({ style: "angles" }))).toBe("Naming angles");
    expect(describeSheet(config({ style: "identify" }))).toBe(
      "Naming 2D shapes",
    );
    expect(describeSheet(config({ style: "coordinates" }))).toBe(
      "Reading coordinates — the first quadrant",
    );
    expect(describeSheet(config({ style: "coordinates", quadrants: 4 }))).toBe(
      "Reading coordinates — four quadrants",
    );
  });

  it("gives the sheet a title and a score box it can be marked against", () => {
    const sheet = buildSheet(config({ count: 6 }), 3);
    expect(sheet.header.title).toBe("Area of rectangles and triangles");
    expect(sheet.header.instructions).toBe("Work out the area of each shape.");
    expect(sheet.header.score?.outOf).toBe(problemsOf({ count: 6 }, 3).length);
  });
});

/* ── The answer key (§20) ──────────────────────────────────────────────── */

describe("the answer key", () => {
  it("works out an area that matches the shape it was drawn as", () => {
    for (const shape of EVERY_SHAPE.filter(
      (one) => (one.style ?? "area") === "area",
    )) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const figure = figureOf(problem);
          const sides = measurements(figure);
          const total = totalOf(problem.answer, "²");

          if (figure.points.length === 3) {
            // Half of base times height, checked without the halving: twice the
            // printed area has to be the product, which is the same statement
            // and has no division in it.
            const [base, , height] = sides;
            expect(base && height, problem.answer).toBeTruthy();
            expect(total.value + total.value, problem.answer) //
              .toBe(repeated(base!.value, height!.value));
          } else {
            const [across, down] = squareOrRectangle(figure, sides);
            expect(total.value, problem.answer).toBe(repeated(across, down));
          }
          expect(total.unit, problem.answer).toBe(unitOn(figure));
        }
      }
    }
  });

  it("works out a perimeter by adding up the sides that are printed on it", () => {
    for (const shape of EVERY_SHAPE.filter(
      (one) => one.style === "perimeter",
    )) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const figure = figureOf(problem);
          const sides = measurements(figure);
          const total = totalOf(problem.answer, "");

          if (figure.points.length === 3) {
            // All three sides are labelled, because all three are added — and
            // the sloping one has to be a whole number, which is why the family
            // draws these out of Pythagorean triples.
            expect(sides.filter(Boolean).length, problem.answer).toBe(3);
            const round = sides.reduce(
              (sum, side) => sum + (side?.value ?? 0),
              0,
            );
            expect(total.value, problem.answer).toBe(round);
          } else {
            const [across, down] = squareOrRectangle(figure, sides);
            expect(total.value, problem.answer) //
              .toBe(repeated(across, 2) + repeated(down, 2));
          }
          expect(total.unit, problem.answer).toBe(unitOn(figure));
        }
      }
    }
  });

  it("draws every figure in proportion to the numbers written on it", () => {
    // The check a worksheet site usually leaves to review. A rectangle labelled
    // 8 by 3 and drawn 8 by 4 has a right answer and a lying picture.
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        for (const problem of problemsOf(shape, seed)) {
          if (!problem.figure?.labels) continue;
          const at = scales(problem.figure);
          expect(at.length, problem.answer).toBeGreaterThan(0);
          expect(spread(at), `${problem.answer}: ${at.join(", ")}`) //
            .toBeLessThan(1.02);
        }
      }
    }
  });

  it("multiplies three sides for a volume, and says so in cubes", () => {
    for (const shape of EVERY_SHAPE.filter((one) => one.style === "volume")) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        expect(problems.length, JSON.stringify(shape)).toBeGreaterThan(0);
        for (const problem of problems) {
          const sides = problem.prompt
            .replace(/ =$/, "")
            .split(" × ")
            .map(labelOf);
          expect(sides.length, problem.prompt).toBe(3);
          const total = totalOf(problem.answer, "³");
          expect(total.value, problem.prompt).toBe(
            repeated(repeated(sides[0].value, sides[1].value), sides[2].value),
          );
          expect(new Set(sides.map((side) => side.unit)).size).toBe(1);
          expect(total.unit, problem.answer).toBe(sides[0].unit);
        }
      }
    }
  });

  it("names an angle by measuring the ink, not by reading the caption", () => {
    for (const seed of SEEDS) {
      const problems = problemsOf({ style: "angles", count: 12 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const figure = figureOf(problem);
        expect(figure.points.length, "an angle is two arms and a vertex").toBe(
          3,
        );
        expect(named(angleOf(figure)), `${angleOf(figure)}°`) //
          .toBe(problem.answer);
      }
    }
  });

  it("names a shape by the corners it was drawn with", () => {
    const BY_CORNERS: Record<number, string> = {
      3: "triangle",
      5: "pentagon",
      6: "hexagon",
      8: "octagon",
    };
    for (const seed of SEEDS) {
      const problems = problemsOf({ style: "identify", count: 8 }, seed);
      expect(problems.length).toBeGreaterThan(0);
      for (const problem of problems) {
        const figure = figureOf(problem);
        if (figure.shape === "circle") {
          expect(problem.answer).toBe("circle");
          expect(figure.points.length, "a centre and a point on it").toBe(2);
          continue;
        }
        const corners = figure.points.length;
        if (corners === 4) {
          // A square is a rhombus with right angles, and a rhombus is not a
          // square. Both halves are measured off the drawing.
          expect(problem.answer).toBe(
            equalSided(figure) ? "square" : "rectangle",
          );
          if (problem.answer === "rectangle") {
            // And tellable apart by eye, which is the only way it can be told:
            // there are no labels on this sheet, so a rectangle drawn eight by
            // seven is a shape a child names "square" and is marked wrong on.
            expect(spread(drawnSides(figure)), problem.answer) //
              .toBeGreaterThan(1.35);
          }
          for (let corner = 0; corner < 4; corner += 1) {
            expect(cornerOf(figure, corner), problem.answer) //
              .toBeCloseTo(90, 0);
          }
          continue;
        }
        expect(BY_CORNERS[corners], `${corners} corners`) //
          .toBe(problem.answer);
        // The named ones are regular, which is the shape the word means to a
        // child: a hexagon drawn with one long side is a puzzle, not a hexagon.
        expect(equalSided(figure), problem.answer).toBe(true);
      }
    }
  });

  it("reads a coordinate off the plane the dot was put on", () => {
    for (const quadrants of [1, 4]) {
      for (const seed of SEEDS) {
        const over = { style: "coordinates" as const, quadrants, count: 8 };
        const grid = gridOf(over, seed);
        const problems = problemsOf(over, seed);
        expect(problems.length).toBeGreaterThan(0);
        expect(grid.marks?.length).toBe(problems.length);

        for (const problem of problems) {
          const letter = /^(\w) = _$/.exec(problem.prompt)?.[1];
          const mark = grid.marks?.find((one) => one.label === letter);
          expect(mark, problem.prompt).toBeTruthy();
          // Counted out from where the axes cross, in squares — which is what a
          // child does with a finger.
          const x = mark!.column - (grid.origin?.column ?? 0);
          const y = (grid.origin?.row ?? 0) - mark!.row;
          expect(problem.answer, problem.prompt).toBe(`(${x}, ${y})`);
        }
      }
    }
  });

  it("prints the answers only when the sheet is a key", () => {
    const sheet = buildSheet(config(), 5);
    const key = answerKey(config(), 5);
    expect(sheet.answers).toBe(false);
    expect(key.answers).toBe(true);
    expect(key.footer.note).toBe("Answer key");
  });

  it("is the same sheet keyed, never a second generation", () => {
    for (const shape of EVERY_SHAPE) {
      expect(answerKey(config(shape), 11).blocks).toEqual(
        buildSheet(config(shape), 11).blocks,
      );
    }
  });
});

/** A printed total, split into its number and the unit it is counted in. */
function totalOf(text: string, power: string): Measured {
  const written = new RegExp(`^(\\d+) ([a-z]+)${power}$`).exec(text.trim());
  if (!written) throw new Error(`not a total: "${text}"`);
  return { value: Number(written[1]), unit: written[2] };
}

/** The unit a figure is measured in — one for the whole shape, or it is wrong. */
function unitOn(figure: Figure): string {
  const units = measurements(figure).flatMap((side) =>
    side === null ? [] : [side.unit],
  );
  if (new Set(units).size !== 1)
    throw new Error(`more than one unit: ${units.join(", ")}`);
  return units[0];
}

/**
 * The two sides of a four-cornered figure.
 *
 * A square carries one measurement and four equal drawn sides, so the second
 * side is the first one — read off the drawing rather than assumed, which is
 * what makes a square labelled once still checkable.
 */
function squareOrRectangle(
  figure: Figure,
  sides: Array<Measured | null>,
): [number, number] {
  expect(figure.points.length).toBe(4);
  const given = sides.flatMap((side) => (side === null ? [] : [side.value]));
  if (given.length === 1) {
    expect(equalSided(figure), "a square is drawn with four equal sides") //
      .toBe(true);
    return [given[0], given[0]];
  }
  expect(given.length).toBe(2);
  return [given[0], given[1]];
}

/* ── Bounds (§20) ──────────────────────────────────────────────────────── */

describe("what may be on the page", () => {
  it("keeps every side inside the range a parent asked for", () => {
    const ASKS = [
      { min: 1, max: 4 },
      { min: 2, max: 12 },
      { min: 5, max: 20 },
    ];
    for (const range of ASKS) {
      for (const style of ["area", "perimeter", "volume"] as const) {
        const problems = problemsOf({ range, style, count: 8 }, 9);
        expect(problems.length, JSON.stringify(range)).toBeGreaterThan(0);
        for (const problem of problems) {
          const drawn = problem.figure
            ? measurements(problem.figure).flatMap((side) =>
                side === null ? [] : [side.value],
              )
            : problem.prompt
                .replace(/ =$/, "")
                .split(" × ")
                .map((side) => labelOf(side).value);
          for (const side of drawn) {
            expect(side, problem.prompt || problem.answer) //
              .toBeGreaterThanOrEqual(range.min);
            expect(side, problem.prompt || problem.answer) //
              .toBeLessThanOrEqual(range.max);
          }
        }
      }
    }
  });

  it("never draws an angle a child would have to guess at", () => {
    // Ten degrees clear of every boundary. A sheet is not asking whether a child
    // can tell 88° from 92° by eye, and one that did would be marked wrong by a
    // parent with a protractor rather than by the key.
    for (const seed of SEEDS) {
      for (const problem of problemsOf({ style: "angles", count: 12 }, seed)) {
        const degrees = angleOf(figureOf(problem));
        const away = [0, 90, 180].map((edge) => Math.abs(degrees - edge));
        // Nine and a half rather than ten, because the arms land on whole
        // thousandths of an inch: a hundred degrees measures 99.97 off the ink.
        expect(
          Math.min(...away) < 0.5 || Math.min(...away) >= 9.5,
          `${degrees}°`,
        ).toBe(true);
      }
    }
  });

  it("draws both arms of an angle the same length", () => {
    // Or the drawing answers the question: a long arm and a short one reads as a
    // narrower angle than it is.
    for (const seed of SEEDS) {
      for (const problem of problemsOf({ style: "angles", count: 12 }, seed)) {
        const figure = figureOf(problem);
        const [first, vertex, second] = figure.points;
        expect(spread([spans(vertex, first), spans(vertex, second)])) //
          .toBeLessThan(1.02);
      }
    }
  });

  it("keeps every point on the plane and off its axes", () => {
    for (const quadrants of [1, 4]) {
      for (const seed of SEEDS) {
        const over = { style: "coordinates" as const, quadrants, count: 8 };
        const grid = gridOf(over, seed);
        // How far the plane runs, which is not how far the ruling runs: the
        // squares outside the axes are where the numerals sit, and a plane that
        // called them part of itself would have the renderer print a "-1" on a
        // first-quadrant sheet.
        const axis = grid.axis;
        expect(axis, "a plane says how far it runs").toBeTruthy();
        expect(axis!.min).toBe(quadrants === 4 ? -axis!.max : 0);
        expect(axis!.max).toBe(grid.columns - (grid.origin?.column ?? 0));

        for (const mark of grid.marks ?? []) {
          expect(mark.column).toBeGreaterThanOrEqual(0);
          expect(mark.column).toBeLessThanOrEqual(grid.columns);
          expect(mark.row).toBeGreaterThanOrEqual(0);
          expect(mark.row).toBeLessThanOrEqual(grid.rows);
          expect(mark.column).not.toBe(grid.origin?.column);
          expect(mark.row).not.toBe(grid.origin?.row);
          // And inside the extent the axes are numbered over, or the dot is a
          // dot whose coordinates are not written anywhere on the paper.
          for (const at of [
            mark.column - (grid.origin?.column ?? 0),
            (grid.origin?.row ?? 0) - mark.row,
          ]) {
            expect(at).toBeGreaterThanOrEqual(axis!.min);
            expect(at).toBeLessThanOrEqual(axis!.max);
          }
        }
      }
    }
  });

  it("puts negative coordinates on a four-quadrant plane and none on a first", () => {
    const coordinates = (quadrants: number) =>
      SEEDS.flatMap((seed) =>
        problemsOf({ style: "coordinates", quadrants, count: 8 }, seed).map(
          (problem) => problem.answer,
        ),
      );
    expect(coordinates(1).some((answer) => answer.includes("-"))).toBe(false);
    expect(coordinates(4).some((answer) => answer.includes("-"))).toBe(true);
  });

  it("asks the same question twice on no sheet at all", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const problems = problemsOf(shape, seed);
        const asked = problems.map(question);
        expect(new Set(asked).size, JSON.stringify(shape)).toBe(
          problems.length,
        );
      }
    }
  });

  it("turns a box round rather than asking about it twice", () => {
    // Four by three by two is the same box as two by three by four, and the
    // dedupe test above cannot see that — the two read differently on the page.
    for (const seed of SEEDS) {
      const boxes = problemsOf({ style: "volume", count: 12 }, seed).map(
        (problem) => {
          const sides = problem.prompt
            .replace(/ =$/, "")
            .split(" × ")
            .map(labelOf);
          return [
            ...sides.map((side) => side.value).sort((a, b) => a - b),
            sides[0].unit,
          ].join(":");
        },
      );
      expect(new Set(boxes).size).toBe(boxes.length);
    }
  });

  it("prints what the pool holds rather than repeating itself", () => {
    // There are seven shapes with names on this sheet, and seven is the honest
    // answer to a request for twenty.
    expect(problemsOf({ style: "identify", count: 20 }, 1).length).toBe(7);
  });
});

/* ── Determinism, and the three features it buys (§7) ──────────────────── */

describe("(config, seed)", () => {
  it("builds the same sheet twice", () => {
    for (const shape of EVERY_SHAPE) {
      for (const seed of SEEDS) {
        const once = buildSheet(config(shape), seed);
        const twice = buildSheet(config(shape), seed);
        expect(once).not.toBe(twice);
        expect(once).toEqual(twice);
      }
    }
  });

  it("draws the same problems for a seed as it did the day it shipped", () => {
    // The promise the footer makes: the seed is printed on the paper so a
    // parent can have the same sheet again next week, across a deploy.
    expect(
      problemsOf({ count: 4 }, 4242).map((p) => [
        p.answer,
        (p.figure?.labels ?? []).join("/"),
      ]),
    ).toEqual(GOLDEN.area);

    expect(problemsOf({ style: "angles", count: 4 }, 7).map((p) => p.answer)) //
      .toEqual(GOLDEN.angles);
  });

  it("makes variants A, B and C genuinely different sets of problems", () => {
    // Except the two whose pools are small on purpose: there are four names for
    // an angle and seven shapes in the world, so two variants must share some.
    for (const shape of EVERY_SHAPE.filter(
      (one) => one.style !== "angles" && one.style !== "identify",
    )) {
      const [a, b, c] = [0, 1, 2].map((offset) =>
        problemsOf({ ...shape, count: 6 }, 100 + offset).map(question),
      );
      for (const [one, other] of [
        [a, b],
        [a, c],
        [b, c],
      ]) {
        expect(one).not.toEqual(other);
        const shared = one.filter((asked) => other.includes(asked)).length;
        expect(shared, JSON.stringify(shape)).toBeLessThan(
          (one.length * 2) / 3,
        );
      }
    }
  });
});

/* ── Capacity (§20) ────────────────────────────────────────────────────── */

describe("how much fits", () => {
  const SIZES: PaperSize[] = ["letter", "a4", "legal"];
  const MARGINS: MarginSize[] = ["none", "narrow", "normal", "wide"];

  it("never prints more problems than the paper holds", () => {
    for (const size of SIZES) {
      for (const margin of MARGINS) {
        for (const fontPt of [12, 18]) {
          for (const shape of EVERY_SHAPE) {
            const over = { ...shape, paper: paper({ size, margin }), fontPt };
            const problems = problemsOf({ ...over, count: 200 }, 8);
            const { box, columns, row, plane } = geometryLayout(config(over));
            const rows = Math.ceil(problems.length / columns);
            const used =
              rows * row +
              Math.max(0, rows - 1) * PROBLEM_GAP.y +
              (plane ? plane.grid.rows * plane.grid.cell + BLOCK_GAP : 0);
            expect(used, `${size}/${margin}/${fontPt}pt`).toBeLessThanOrEqual(
              box.height,
            );
          }
        }
      }
    }
  });

  it("reserves a whole figure for every row that carries one", () => {
    // The drawing does not scale with the body type (§17) but the room for its
    // labels does, so the reservation has to cover both — a figure taller than
    // the row is the bottom of the page on a second sheet.
    for (const fontPt of [10, 12, 14, 18]) {
      for (const style of [
        "area",
        "perimeter",
        "angles",
        "identify",
      ] as const) {
        const { row } = geometryLayout(config({ fontPt, style }));
        for (const problem of problemsOf({ fontPt, style, count: 9 }, 4)) {
          const drawn = figureBox(figureOf(problem), fontPt);
          expect(drawn.height, `${style} at ${fontPt}pt`) //
            .toBeLessThanOrEqual(figureRow(fontPt));
          expect(drawn.height).toBeLessThan(row);
        }
      }
    }
  });

  it("keeps the plane inside the page it is drawn on", () => {
    for (const size of SIZES) {
      for (const quadrants of [1, 4]) {
        const over = {
          style: "coordinates" as const,
          quadrants,
          paper: paper({ size }),
        };
        const { box, plane } = geometryLayout(config(over));
        expect(plane).toBeTruthy();
        expect(plane!.grid.columns * plane!.grid.cell) //
          .toBeLessThanOrEqual(box.width);
        expect(plane!.grid.rows * plane!.grid.cell).toBeLessThan(box.height);
        // And a square is a square: one cell for both directions, or the
        // coordinates a child counts out are not the ones the dot is on.
        expect(plane!.grid.columns).toBe(plane!.grid.rows);
      }
    }
  });

  it("honours the count and the columns it was given", () => {
    expect(problemsOf({ style: "volume", count: 10 }, 1).length).toBe(10);
    expect(problemsOf({ count: 0 }, 1).length).toBe(0);
    for (const columns of [1, 2, 3]) {
      const problems = buildSheet(config({ columns }), 1).blocks[0];
      expect(problems.kind === "problems" && problems.columns).toBe(columns);
    }
    // Three columns of figures, four of sentences.
    const wide = buildSheet(config({ columns: 6 }), 1).blocks[0];
    expect(wide.kind === "problems" && wide.columns).toBe(3);
    const sums = buildSheet(config({ style: "volume", columns: 6 }), 1)
      .blocks[0];
    expect(sums.kind === "problems" && sums.columns).toBe(4);
  });
});

/**
 * What two sheets came out as on the day this shipped.
 *
 * Recorded rather than computed — both are proved right by the assertions
 * above, and what these hold is that they do not silently *change*.
 */
const GOLDEN = {
  area: [
    ["84 m²", "12 m/7 m"],
    ["24 m²", "4 m/6 m"],
    ["100 cm²", "10 cm"],
    ["144 m²", "12 m"],
  ],
  angles: ["acute", "obtuse", "right", "obtuse"],
};
