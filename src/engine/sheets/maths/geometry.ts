/**
 * Shape: area, perimeter, volume, angles, names and the coordinate plane.
 *
 * The family where the *question* is a drawing. Everything the arithmetic
 * families established holds unchanged, and the two things that are new are both
 * about the picture rather than the sum.
 *
 * **A wrong drawing is a wrong answer.** A rectangle labelled 8 by 3 and drawn 8
 * by 4 is a sheet that teaches a child not to trust the picture, which is worse
 * than a sheet with no picture on it. So every figure is built from the same
 * numbers the labels are written from (`figure.ts` does the building), and the
 * suite recovers the measurements from the *drawing* rather than from the
 * generator — a shape drawn out of proportion fails there.
 *
 * **An angle is drawn true.** Lengths are drawn in proportion because a
 * rectangle eight metres across does not fit on a page; an angle has no size, so
 * a sixty-degree angle is drawn at sixty degrees and "is this acute or obtuse?"
 * is a question about the paper rather than about the caption.
 *
 * Volume is the one style with no figure. A cuboid drawn on flat paper is a
 * picture that has to be taught before it can be read — the two hidden edges are
 * a convention, not a fact — and this sheet is about multiplying three numbers,
 * which are all in the sentence.
 */
import { between, mulberry32 } from "@/engine/random";

import type {
  Figure,
  GeometryConfig,
  GeometryStyle,
  GridMark,
  Mil,
  Problem,
  Sheet,
  SheetOptions,
  UnitSystem,
} from "../types";

import { sheetBlockBox } from "../chrome";
import {
  angleFigure,
  circleFigure,
  figureRow,
  polygonFigure,
  rectangleFigure,
  rightTriangleFigure,
} from "../figure";
import {
  BLOCK_GAP,
  PROBLEM_GAP,
  WRAP_GAP,
  answerLine,
  columnWidth,
  fitAcross,
  type Box,
} from "../layout";
import { inches } from "../paper";
import {
  letterAt,
  markAt,
  planeFloor,
  planeHeight,
  planeOf,
  type Plane,
} from "../plane";
import { SHEET_CREDIT, SHEET_URL, SHEET_WORLD, type SheetSpec } from "../spec";
import { cubed, figureUnitsOf, squared } from "./units";

/* ── What a problem takes on the page ─────────────────────────────────────
   Declared, not measured (§4).                                              */

/** Two lines of the body type and the air a wrap puts between them. */
const writtenRow = (fontPt: number): Mil => 2 * answerLine(fontPt) + WRAP_GAP;

/** Blank space to work an answer out in, when the config asks for it. */
const WORKSPACE = inches(0.55);

/**
 * Three columns of shapes, and four of sentences.
 *
 * A figure is an inch across before its labels are given room, and the blank it
 * is answered in sits beside it.
 */
const MAX_FIGURE_COLUMNS = 3;
const MAX_COLUMNS = 4;

/** As `arithmetic.ts` — see the note there on why a budget rather than a proof. */
const MISS_BUDGET = 500;

/* ── The plane ─────────────────────────────────────────────────────────────
   One grid at the top of the page and the questions under it, rather than a
   little pair of axes beside every problem: a child reads the scale once and
   then uses it a dozen times.

   The geometry of it lives in `plane.ts`, because a plane is the question on a
   pre-algebra sheet as well as on this one — see the note there.             */

/* ── Drawing a problem ─────────────────────────────────────────────────────
   Each style draws its own shape and they have little in common, so each
   returns the same three answers instead: what it reads, what the answer is,
   and what makes two of them the same problem.                              */

type Drawn = {
  key: string;
  prompt: string;
  answer: string;
  figure?: Figure;
  /** Where the point being asked about sits, on the sheets that have a plane. */
  mark?: GridMark;
};

const pick = <T>(items: T[], rand: () => number): T =>
  items[Math.floor(rand() * items.length)];

function bounds(range: { min: number; max: number }): {
  min: number;
  max: number;
} {
  const min = Math.max(1, Math.floor(range?.min ?? 1));
  return { min, max: Math.max(min, Math.floor(range?.max ?? 1)) };
}

const unitOf = (system: UnitSystem, rand: () => number): string =>
  pick(figureUnitsOf(system), rand);

/** The three flat shapes a child is asked to measure. */
const FLAT = ["rectangle", "square", "triangle"] as const;

/**
 * The right-angled triangles whose three sides are all whole numbers.
 *
 * A perimeter is the sum of the sides, so a triangle on a perimeter sheet needs
 * its sloping side to be a number a child can add — and the only right triangles
 * with one are these. Multiples of them count too, which is what `range` scales.
 */
const TRIPLES = [
  [3, 4, 5],
  [6, 8, 10],
  [5, 12, 13],
  [9, 12, 15],
  [8, 15, 17],
];

/** How much of a shape is inside it: length times width, or half base times height. */
function drawArea(config: GeometryConfig, rand: () => number): Drawn | null {
  const { min, max } = bounds(config.range);
  const unit = unitOf(config.system, rand);
  const shape = pick([...FLAT], rand);
  const say = (value: number) => `${value} ${unit}`;

  if (shape === "square") {
    const side = between(min, max, rand);
    return {
      key: `area:square:${side}:${unit}`,
      prompt: "",
      answer: `${side * side} ${squared(unit)}`,
      figure: rectangleFigure(side, side, [say(side)]),
    };
  }
  const across = between(min, max, rand);
  const down = between(min, max, rand);
  if (shape === "rectangle") {
    // A rectangle with two equal sides is a square, and it is drawn as one —
    // so it would be the square question with an extra label on it.
    if (across === down) return null;
    return {
      key: `area:rectangle:${across}:${down}:${unit}`,
      prompt: "",
      answer: `${across * down} ${squared(unit)}`,
      figure: rectangleFigure(across, down, [say(across), say(down)]),
    };
  }
  // Half of an odd product is not a whole number, and a triangle whose area is
  // 7.5 is a decimal sheet wearing a geometry sheet's clothes.
  if ((across * down) % 2 !== 0) return null;
  return {
    key: `area:triangle:${across}:${down}:${unit}`,
    prompt: "",
    answer: `${(across * down) / 2} ${squared(unit)}`,
    // The sloping side is not labelled: it is not part of the area, and a number
    // on it is a number a child will try to multiply by.
    figure: rightTriangleFigure(across, down, [say(across), "", say(down)]),
  };
}

/** All the way round the outside. */
function drawPerimeter(
  config: GeometryConfig,
  rand: () => number,
): Drawn | null {
  const { min, max } = bounds(config.range);
  const unit = unitOf(config.system, rand);
  const shape = pick([...FLAT], rand);
  const say = (value: number) => `${value} ${unit}`;

  if (shape === "square") {
    const side = between(min, max, rand);
    return {
      key: `perimeter:square:${side}:${unit}`,
      prompt: "",
      answer: `${side * 4} ${unit}`,
      figure: rectangleFigure(side, side, [say(side)]),
    };
  }
  if (shape === "rectangle") {
    const across = between(min, max, rand);
    const down = between(min, max, rand);
    if (across === down) return null;
    return {
      key: `perimeter:rectangle:${across}:${down}:${unit}`,
      prompt: "",
      answer: `${(across + down) * 2} ${unit}`,
      figure: rectangleFigure(across, down, [say(across), say(down)]),
    };
  }

  const [base, height, slope] = pick(TRIPLES, rand);
  // Scaled to land inside the range rather than drawn and rejected: the smallest
  // triple is 3-4-5, so a sheet asking for sides up to twelve has exactly one
  // multiple of each to choose from and rejecting would empty the pool.
  const by = between(1, Math.max(1, Math.floor(max / slope)), rand);
  if (base * by < min || slope * by > max) return null;
  return {
    key: `perimeter:triangle:${base * by}:${height * by}:${unit}`,
    prompt: "",
    answer: `${(base + height + slope) * by} ${unit}`,
    // In the order the points are given: the base, then the sloping side, then
    // the upright. All three are labelled here, because all three are added.
    figure: rightTriangleFigure(base * by, height * by, [
      say(base * by),
      say(slope * by),
      say(height * by),
    ]),
  };
}

/** How much a box holds: three numbers multiplied, and no picture. */
function drawVolume(config: GeometryConfig, rand: () => number): Drawn {
  const { min, max } = bounds(config.range);
  const unit = unitOf(config.system, rand);
  const sides = [
    between(min, max, rand),
    between(min, max, rand),
    between(min, max, rand),
  ];
  return {
    // Folded on the three sides sorted, because a box four by three by two is
    // the same box as one two by three by four — it has been turned round, and
    // a child asked both has been asked one question twice.
    key: `volume:${[...sides].sort((a, b) => a - b).join(":")}:${unit}`,
    prompt: `${sides.map((side) => `${side} ${unit}`).join(" × ")} =`,
    answer: `${sides[0] * sides[1] * sides[2]} ${cubed(unit)}`,
  };
}

/**
 * The four angles a child is taught to name, and the degrees each is drawn at.
 *
 * Nothing within ten degrees of a boundary: a sheet is not asking whether a
 * child can tell 88° from 92° by eye, and one that did would be marked wrong by
 * a parent holding a protractor rather than the key.
 *
 * A reflex angle is not here. The same two arms make a reflex angle and its
 * explement, so which is meant lives in the arc rather than in the lines — that
 * is a second thing for the drawing to say, and this sheet does not ask it.
 */
const ANGLES: Array<{ name: string; degrees: number[] }> = [
  { name: "acute", degrees: [20, 30, 40, 50, 60, 70, 80] },
  { name: "right", degrees: [90] },
  { name: "obtuse", degrees: [100, 110, 120, 130, 140, 150, 160, 170] },
  { name: "straight", degrees: [180] },
];

/** How far round an angle may be turned: every fifteen degrees, all the way. */
const TURNS = 24;

function drawAngle(rand: () => number): Drawn {
  const kind = pick(ANGLES, rand);
  const degrees = pick(kind.degrees, rand);
  const from = between(0, TURNS - 1, rand) * (360 / TURNS);
  return {
    // Folded on the angle rather than on the drawing: the same angle turned
    // round is the same question, and a child notices that faster than the
    // adult who printed it.
    key: `angle:${degrees}`,
    prompt: "",
    answer: kind.name,
    figure: angleFigure(degrees, from),
  };
}

/**
 * How oblong an unlabelled rectangle has to be drawn: seven to five.
 *
 * Written as two whole numbers rather than a ratio, so the comparison that uses
 * them is whole-number arithmetic like everything else in this family.
 */
const LONG = 7;
const SHORT = 5;

/** The shapes a child is asked to name, and how many sides each is drawn with. */
const NAMED: Array<{ name: string; sides: number }> = [
  { name: "triangle", sides: 3 },
  { name: "square", sides: 4 },
  { name: "pentagon", sides: 5 },
  { name: "hexagon", sides: 6 },
  { name: "octagon", sides: 8 },
];

function drawNamed(config: GeometryConfig, rand: () => number): Drawn | null {
  // A circle and a rectangle are not regular polygons, so they are drawn by
  // hand; everything else is its own corner count.
  const which = between(0, NAMED.length + 1, rand);
  if (which === NAMED.length) {
    return {
      key: "shape:circle",
      prompt: "",
      answer: "circle",
      figure: circleFigure(),
    };
  }
  if (which === NAMED.length + 1) {
    const { min, max } = bounds(config.range);
    const across = between(min, max, rand);
    const down = between(min, max, rand);
    // A rectangle whose sides match is the square that is already in the list —
    // and so, to a child, is one drawn eight by seven. This sheet carries no
    // labels to read: the whole question is what the shape is *called*, so an
    // oblong has to look like one beside the square that is also on the page,
    // or the picture disagrees with the key and the key wins.
    if (Math.max(across, down) * SHORT < Math.min(across, down) * LONG)
      return null;
    return {
      key: "shape:rectangle",
      prompt: "",
      answer: "rectangle",
      figure: rectangleFigure(across, down),
    };
  }
  const shape = NAMED[which];
  return {
    key: `shape:${shape.name}`,
    prompt: "",
    answer: shape.name,
    figure: polygonFigure(shape.sides),
  };
}

/** A point on the plane, and the pair of numbers that finds it. */
function drawPoint(
  plane: Plane,
  index: number,
  rand: () => number,
): Drawn | null {
  const low = planeFloor(plane);
  const x = between(low, plane.span, rand);
  const y = between(low, plane.span, rand);
  // Never on an axis. A dot sitting on one of the two heavy rules is a dot a
  // child has to look twice at, and nought is not the part of this that is
  // being taught.
  if (x === 0 || y === 0) return null;
  const label = letterAt(index);
  return {
    key: `point:${x}:${y}`,
    prompt: `${label} = _`,
    answer: `(${x}, ${y})`,
    // The dot the question is about, made here rather than worked out again
    // from the answer — one draw, one point, and nothing to disagree with.
    mark: markAt(plane, x, y, label),
  };
}

/* ── The page ──────────────────────────────────────────────────────────── */

const clamp = (value: number, low: number, high: number): number =>
  Math.max(low, Math.min(high, Math.floor(value)));

/** Whether the sheet's problems carry a drawing of their own. */
const hasFigure = (config: GeometryConfig): boolean =>
  config.style === "area" ||
  config.style === "perimeter" ||
  config.style === "angles" ||
  config.style === "identify";

/** How tall one problem stands, drawing and working space and all. */
function rowHeight(config: GeometryConfig): Mil {
  // A shape and the blank it is answered in do not fit across a third of a
  // page, so the row is the drawing, the wrap, and the line beside it — the
  // same shape a fraction naming problem takes.
  const body = hasFigure(config)
    ? figureRow(config.fontPt) + WRAP_GAP + answerLine(config.fontPt)
    : writtenRow(config.fontPt);
  return body + (config.workspace ? WORKSPACE : 0);
}

/**
 * How many problems the paper holds, how wide a column of them is, and — on a
 * coordinate sheet — the plane they are asked about.
 *
 * Arithmetic, not measurement, so `npm run test:unit` can answer "did it fit?"
 * without a browser — and so the same answer serves the catalog page built at
 * build time and the builder's preview (§4).
 */
export function geometryLayout(config: GeometryConfig): {
  box: Box;
  columns: number;
  cell: Mil;
  row: Mil;
  perPage: number;
  plane?: Plane;
} {
  // Against the header the sheet will print, not the one the config holds, and
  // `true` for the score box because a sheet of problems is marked out of them.
  const box = sheetBlockBox(headerOf(config), true);
  const most = hasFigure(config) ? MAX_FIGURE_COLUMNS : MAX_COLUMNS;
  const columns = clamp(config.columns, 1, most);
  const row = rowHeight(config);

  const plane =
    config.style === "coordinates"
      ? planeOf(config.quadrants ?? 1, box)
      : undefined;
  // The grid is a block of its own above the problems, so it takes its height
  // and the gap under it out of what is left for them.
  const left = plane
    ? Math.max(0, box.height - planeHeight(plane) - BLOCK_GAP)
    : box.height;

  return {
    box,
    columns,
    cell: columnWidth(box, columns, PROBLEM_GAP.x),
    row,
    perPage: columns * fitAcross(left, row, PROBLEM_GAP.y),
    ...(plane ? { plane } : {}),
  };
}

/**
 * Every problem on the sheet, and the points marked on the plane above them.
 *
 * Exported because it is the whole of what a test has to check, and checking it
 * through the `Sheet` means unwrapping a block union to reach it. The marks come
 * back with the problems rather than being worked out again from them, so a dot
 * on the grid and the coordinates it is answered with cannot disagree.
 */
export function geometryProblems(
  config: GeometryConfig,
  seed: number,
): { items: Problem[]; marks: GridMark[] } {
  const { perPage, plane } = geometryLayout(config);
  // The count is a request, not a promise: a count that overruns is a second
  // sheet out of the printer with two problems on it.
  const wanted = clamp(config.count, 0, perPage);

  const rand = mulberry32(seed);
  const seen = new Set<string>();
  const items: Problem[] = [];
  const marks: GridMark[] = [];
  const extras = config.workspace ? { workspace: WORKSPACE } : {};

  let misses = 0;
  while (items.length < wanted && misses < MISS_BUDGET) {
    const drawn = drawOne(config, plane, items.length, rand);
    // Not what was asked for, or already on the page. Either way the budget
    // ticks down, and a pool that has run out ends the draw rather than
    // repeating itself: there are five shapes with names on this sheet, and
    // five is the honest answer to a request for twenty.
    if (drawn === null || seen.has(drawn.key)) {
      misses += 1;
      continue;
    }
    seen.add(drawn.key);
    items.push({
      prompt: drawn.prompt,
      answer: drawn.answer,
      ...(drawn.figure ? { figure: drawn.figure } : {}),
      ...extras,
    });
    if (drawn.mark) marks.push(drawn.mark);
    misses = 0;
  }
  return { items, marks };
}

function drawOne(
  config: GeometryConfig,
  plane: Plane | undefined,
  index: number,
  rand: () => number,
): Drawn | null {
  switch (config.style) {
    case "perimeter":
      return drawPerimeter(config, rand);
    case "volume":
      return drawVolume(config, rand);
    case "angles":
      return drawAngle(rand);
    case "identify":
      return drawNamed(config, rand);
    case "coordinates":
      return plane ? drawPoint(plane, index, rand) : null;
    default:
      return drawArea(config, rand);
  }
}

/* ── What it is called ─────────────────────────────────────────────────── */

const TITLE: Record<GeometryStyle, string> = {
  area: "Area of rectangles and triangles",
  perimeter: "Perimeter of rectangles and triangles",
  volume: "Volume of a box",
  angles: "Naming angles",
  identify: "Naming 2D shapes",
  coordinates: "Reading coordinates",
};

const INSTRUCTION: Record<GeometryStyle, string> = {
  area: "Work out the area of each shape.",
  perimeter: "Work out the distance all the way round each shape.",
  volume: "Work out the volume of each box.",
  angles: "Write whether each angle is acute, right, obtuse or straight.",
  identify: "Write the name of each shape.",
  coordinates: "Write the coordinates of each point.",
};

const titleOf = (config: GeometryConfig): string =>
  TITLE[config.style] ?? TITLE.area;

/**
 * The header this sheet will actually print.
 *
 * A generated family names its own sheet, so `config.title` is an override and
 * is usually absent — which makes it the wrong thing to reserve space against.
 * Written once and read by both the layout and the build, so the two cannot
 * disagree about what is at the top of the page.
 */
function headerOf(config: GeometryConfig): SheetOptions {
  return {
    paper: config.paper,
    fontPt: config.fontPt,
    fields: config.fields,
    title: config.title ?? titleOf(config),
    instructions:
      config.instructions ?? INSTRUCTION[config.style] ?? INSTRUCTION.area,
  };
}

/**
 * One line naming what the sheet holds, in the terms a parent chose it by.
 *
 * What the title leaves off is the size of the numbers and how far the plane
 * runs, which is the difference between a sheet a child does in their head and
 * one they need paper for.
 */
export function describeGeometry(config: GeometryConfig): string {
  const title = titleOf(config);
  if (config.style === "coordinates") {
    return `${title} — ${Math.floor(config.quadrants ?? 1) === 4 ? "four quadrants" : "the first quadrant"}`;
  }
  if (config.style === "angles" || config.style === "identify") return title;
  const { max } = bounds(config.range);
  return [
    title,
    `sides to ${max}`,
    `in ${figureUnitsOf(config.system).join(" and ")}`,
  ].join(" — ");
}

export function buildGeometrySheet(
  config: GeometryConfig,
  seed: number,
): Sheet {
  const { items, marks } = geometryProblems(config, seed);
  const { columns, plane } = geometryLayout(config);
  const head = headerOf(config);

  return {
    paper: config.paper,
    fontPt: config.fontPt,
    header: {
      title: head.title ?? "",
      instructions: head.instructions,
      fields: head.fields,
      // Out of what is actually on the page, not out of what was asked for: a
      // sheet that says "/ 20" over eighteen problems is wrong twice.
      score: { outOf: items.length },
    },
    blocks: [
      // The plane, then the questions about it. One grid for the sheet rather
      // than one per problem, and it carries the dots that are being asked
      // about — which is why it is only here when there is a plane at all.
      ...(plane
        ? [{ kind: "grid" as const, grid: { ...plane.grid, marks } }]
        : []),
      { kind: "problems", columns, items },
    ],
    footer: { credit: SHEET_CREDIT, url: SHEET_URL, seed },
    answers: false,
  };
}

export const GEOMETRY_SHEET: SheetSpec<GeometryConfig> = {
  id: "geometry",
  label: "Shape and space",
  world: SHEET_WORLD,
  build: buildGeometrySheet,
  // The whole of the answer-key mechanism: every answer on the page was
  // computed from the same numbers the figure was drawn from, so a key prints
  // what is already there rather than measuring the drawing a second time.
  key: (sheet) => ({
    ...sheet,
    answers: true,
    footer: { ...sheet.footer, note: "Answer key" },
  }),
  describe: describeGeometry,
};
