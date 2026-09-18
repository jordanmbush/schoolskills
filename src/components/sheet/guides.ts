/**
 * Where the guides on a model letter go (§25, "The guides on a model"): a
 * dot where each stroke starts, an arrow running *beside* it — a gap off,
 * following its shape — to say which way the pen goes, and the stroke's
 * number against the arrow's tail, so the two read as one mark.
 *
 * Positions are chosen by cost, not by rule, because no rule survives the
 * alphabet. Every candidate — early or slid along the stroke, full or cut
 * short, either side, each spot for the number — is scored on what it runs
 * into, in units of one sample of ink under a mark, and the cheapest wins.
 * The weights below are judgements; the specimen page is where they are
 * checked.
 *
 * Everything here is in the row's mil, on paths already placed; the row
 * decides sizes and this decides positions, so the layout can be tested
 * without rendering anything.
 */
import {
  along,
  arrowhead,
  beside,
  distance,
  flatten,
  nearest,
  resample,
  strokeLength,
  type Point,
  type Segment,
} from "./glyphs";
import type { StrokeInk } from "./strokes";

export type Guide = {
  start: Point;
  /**
   * The arrow's shaft, stopping where the head begins so its round cap stays
   * under the head — or empty when the stroke is too short to carry one.
   */
  line: Point[];
  /** The arrowhead as path data, or null with no shaft. */
  head: string | null;
  number: Point;
};

export type GuideSet = {
  /** The start dot's radius. */
  dot: number;
  /** The shaft's stroke width. */
  shaft: number;
  /** The stroke number's type size. */
  numeral: number;
  guides: Guide[];
  /** Every arrow, shaft and tip, sampled finely — for a neighbour to keep off. */
  marks: Point[][];
};

/**
 * What is already on the paper around a letter: the ink of the letters
 * beside it, and the arrows and numbers of the ones laid out before it.
 * Kept off, never numbered.
 */
export type Neighbours = {
  ink: Segment[][];
  marks: Point[][];
  numbers: Point[];
};

const NOBODY: Neighbours = { ink: [], marks: [], numbers: [] };

/**
 * The arrow's stretch of the stroke, as shares of the writing space: where
 * it first tries to start, and how far it runs. Short, so that on a letter
 * that starts with a straight bar — the `e` — the arrow is over before the
 * stroke turns, and reads as "across".
 */
const ARROW = { from: 0.15, span: 0.22 };

/**
 * What each compromise costs. The unit is one sample of ink under a mark:
 * an arrow crossing a stem at right angles scores about two, an arrow's
 * tail or head against a stroke up to two on its own, a numeral with a stem
 * through it about seven, a numeral's corner touching a curve one or two —
 * so anything here under one is a preference, not a clash.
 */
const COST = {
  /** Each notch the number is turned from behind the tail. */
  turn: 0.25,
  /** The arrow on the letter's inner side. */
  inside: 0.5,
  /** Leaving the start of the stroke at all — the arrow is no longer by the dot. */
  slide: 0.6,
  /** And then per writing space of stroke it goes on to leave behind. */
  late: 2.5,
  /** An arrow cut short, for a corner it would otherwise run into. */
  short: 0.3,
};

/** The middle of a letter's ink. */
export function centreOf(strokes: Segment[][]): Point {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const segment of strokes.flat()) {
    for (let i = 0; i < segment.points.length; i += 2) {
      xs.push(segment.points[i]);
      ys.push(segment.points[i + 1]);
    }
  }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

/** How far short of `needed` a distance falls, as a share: 0 when clear. */
const shortfall = (d: number, needed: number) => Math.max(0, 1 - d / needed);

const unit = (v: Point): Point => {
  const length = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / length, y: v.y / length };
};

/**
 * A numeral's box, as shares of its type size: a little narrower than it is
 * tall. What a number is when it is asked whether it covers something.
 */
const BOX = { x: 0.28, y: 0.36 };

/** The distance from a point to a box centred on `at`: none when inside. */
const offBox = (at: Point, half: Point, p: Point) =>
  Math.hypot(
    Math.max(0, Math.abs(p.x - at.x) - half.x),
    Math.max(0, Math.abs(p.y - at.y) - half.y),
  );

/** The first of the cheapest, so the order options come in breaks ties. */
const cheapest = <T extends { cost: number }>(options: T[]): T =>
  options.reduce((best, option) => (option.cost < best.cost ? option : best));

export function guidesOf(
  strokes: Segment[][],
  writing: number,
  ink: StrokeInk,
  around: Neighbours = NOBODY,
): GuideSet {
  const dot = ink.width * 1.3;
  const shaft = ink.width * 0.6;
  const head = { length: ink.width * 2.6, width: ink.width * 2.2 };
  const gap = Math.max(ink.width * 3, writing * 0.1);
  const numeral = Math.round(writing * 0.16);
  const marks: Point[][] = [...around.marks];
  if (strokes.length === 0) return { dot, shaft, numeral, guides: [], marks };
  const centre = centreOf(strokes);
  // This letter's strokes first, so a stroke's index finds its own ink.
  const inks = [...strokes, ...around.ink].map((segments) =>
    flatten(segments).map(({ x, y }) => ({ x, y })),
  );
  const starts = strokes.map((segments) => along(segments, 0));
  // A number is scored as its box against ink sampled finely enough that a
  // line through the box is counted point by point, and a curve grazing a
  // corner is seen at all. A dot or another number is one point, so each is
  // weighed as several to keep a number off them as firmly as off a line.
  const half = { x: numeral * BOX.x, y: numeral * BOX.y };
  const margin = numeral * 0.12;
  const samples = inks.map((line) => resample(line, margin));
  const apart = numeral * 0.9;

  const guides: Guide[] = [];
  const numbers: Point[] = [...around.numbers];

  const numberCost = (at: Point) => {
    let cost = 0;
    for (const line of samples) {
      for (const p of line) cost += shortfall(offBox(at, half, p), margin);
    }
    for (const start of starts) {
      cost += 4 * shortfall(offBox(at, half, start), margin + dot);
    }
    for (const mark of marks) {
      for (const p of mark) cost += shortfall(offBox(at, half, p), margin);
    }
    for (const number of numbers) {
      cost += 4 * shortfall(distance(at, number), apart);
    }
    return cost;
  };

  // An arrow's two ends matter most: a tail or a head against another
  // stroke says the arrow starts or ends there, so each is kept a whole gap
  // off and weighed double. Along the shaft, ink it crosses at right angles
  // is half the price of ink it runs alongside, which it would be read as
  // pointing along. Its own stroke is a gap away by construction, so only
  // that stroke doubling back within half of one counts.
  const arrowCost = (points: Point[], own: number) => {
    // Shaft samples count by the length each stands for, so a short shaft's
    // crowded samples don't make one crossing cost several.
    const spacing =
      points.length > 2
        ? distance(points[0], points[points.length - 2]) / (points.length - 2)
        : margin;
    const perSample = Math.min(1, spacing / margin);
    let cost = 0;
    points.forEach((p, k) => {
      const end = k === 0 || k === points.length - 1;
      const before = points[Math.max(0, k - 1)];
      const after = points[Math.min(points.length - 1, k + 1)];
      const heading = Math.atan2(after.y - before.y, after.x - before.x);
      const weigh = (near: { d: number; heading: number }, needed: number) =>
        (end
          ? 2
          : perSample *
            (0.5 + 0.5 * Math.abs(Math.cos(heading - near.heading)))) *
        shortfall(near.d, needed);
      inks.forEach((line, i) => {
        const needed = i === own ? gap * 0.5 : end ? gap : gap * 0.7;
        cost += weigh(nearest(p, line), needed);
      });
      for (const mark of marks) cost += weigh(nearest(p, mark), gap * 0.7);
      for (const number of numbers) {
        cost += shortfall(offBox(number, half, p), margin);
      }
    });
    return cost;
  };

  // Spots by a dot, nearest and straightest out from the letter's middle
  // first: straight out, swung to either side, then the same further out.
  const byTheDot = (start: Point): Point[] => {
    const away = Math.atan2(start.y - centre.y, start.x - centre.x);
    const swing = (50 * Math.PI) / 180;
    const spots: Point[] = [];
    for (const reach of [0.8, 1.5, 2.2]) {
      for (const turn of [0, swing, -swing]) {
        spots.push({
          x: start.x + reach * numeral * Math.cos(away + turn),
          y: start.y + reach * numeral * Math.sin(away + turn),
        });
      }
    }
    return spots;
  };

  strokes.forEach((segments, index) => {
    const start = starts[index];
    const length = strokeLength(segments);
    const span = Math.min(writing * ARROW.span, length * 0.5);
    if (span < head.length * 1.5) {
      const spots = byTheDot(start).map((at, rank) => ({
        at,
        cost: numberCost(at) + rank * 0.05,
      }));
      const number = cheapest(spots).at;
      guides.push({ start, line: [], head: null, number });
      numbers.push(number);
      return;
    }

    const first = Math.min(writing * ARROW.from, length * 0.25);
    const farness = (line: Point[]) =>
      line.reduce((sum, p) => sum + distance(p, centre), 0) / line.length;

    const options: Array<{
      cost: number;
      line: Point[];
      tip: Point;
      angle: number;
      number: Point;
    }> = [];
    const spans = [span, span * 0.7].filter((s) => s >= head.length * 1.5);
    for (
      let from = first, tries = 0;
      from + span <= length && tries < 8;
      from += span / 2, tries += 1
    ) {
      const slid =
        from > first ? COST.slide + (COST.late * (from - first)) / writing : 0;
      for (const [cut, run] of spans.entries()) {
        const to = from + run;
        const lines: Record<1 | -1, Point[]> = {
          1: beside(segments, from, to - head.length, gap, 1),
          [-1]: beside(segments, from, to - head.length, gap, -1),
        };
        const outside: 1 | -1 = farness(lines[-1]) > farness(lines[1]) ? -1 : 1;
        const inside: 1 | -1 = outside === 1 ? -1 : 1;
        for (const side of [outside, inside]) {
          const line = lines[side];
          const [tip] = beside(segments, to, to, gap, side, 1);
          const angle = along(segments, to).angle;
          const base =
            arrowCost([...line, tip], index) +
            (side === outside ? 0 : COST.inside) +
            slid +
            cut * COST.short;
          const tail = along(segments, from);
          const back = { x: -Math.cos(tail.angle), y: -Math.sin(tail.angle) };
          const out = unit({ x: line[0].x - tail.x, y: line[0].y - tail.y });
          const spots = [
            back,
            unit({ x: back.x + out.x, y: back.y + out.y }),
            out,
          ].map((direction, turn) => ({
            at: {
              x: line[0].x + direction.x * numeral * 0.65,
              y: line[0].y + direction.y * numeral * 0.65,
            },
            turn,
          }));
          byTheDot(start).forEach((at, rank) =>
            spots.push({ at, turn: 3 + rank * 0.2 }),
          );
          for (const spot of spots) {
            options.push({
              cost: base + numberCost(spot.at) + COST.turn * spot.turn,
              line,
              tip,
              angle,
              number: spot.at,
            });
          }
        }
      }
    }

    const chosen = cheapest(options);
    guides.push({
      start,
      line: chosen.line,
      head: arrowhead(
        chosen.tip.x,
        chosen.tip.y,
        chosen.angle,
        head.length,
        head.width,
      ),
      number: chosen.number,
    });
    numbers.push(chosen.number);
    marks.push(resample([...chosen.line, chosen.tip], margin));
  });

  return {
    dot,
    shaft,
    numeral,
    guides,
    marks: marks.slice(around.marks.length),
  };
}

/**
 * Guides for a run of letters, each numbered from 1 and laid out in turn
 * with the others' ink and the earlier letters' marks to keep off.
 */
export function wordGuides(
  letters: Segment[][][],
  writing: number,
  ink: StrokeInk,
): GuideSet[] {
  const sets: GuideSet[] = [];
  letters.forEach((strokes, i) => {
    sets.push(
      guidesOf(strokes, writing, ink, {
        ink: letters.filter((_, j) => j !== i).flat(),
        marks: sets.flatMap((set) => set.marks),
        numbers: sets.flatMap((set) => set.guides.map((g) => g.number)),
      }),
    );
  });
  return sets;
}
